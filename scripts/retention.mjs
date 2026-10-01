// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.
//
// retention.mjs — how many people come back, read from users/*. Run it on your own machine:
//
//   SEEN_SERVICE_ACCOUNT=/path/to/service-account.json node scripts/retention.mjs
//
// or against the emulator with FIRESTORE_EMULATOR_HOST set and no credential at all.
//
// ── WHAT IT WILL NOT DO ──────────────────────────────────────────────────────────────────────
// It prints COUNTS. No names, no emails, no uids, nothing from anyone's journal — it never reads
// a subcollection. The service account is read from a file path in an environment variable so the
// key itself never has to be pasted anywhere, least of all into a chat.
//
// It is read-only: there is no write call in this file.
//
// ── WHAT THE NUMBERS ARE BUILT FROM ──────────────────────────────────────────────────────────
// lastGreetingDate  — the last local day someone showed up (YYYY-MM-DD)
// activeDays        — how many days they have ever shown up
// activeDates       — the last 30 of those days, exact (only on accounts active since 2.9)
// onboardingCompletedAt / firstActiveDate — when they joined
//
// "Came back" is therefore honest but coarse for accounts older than activeDates: Day-1 return
// means "showed up on at least two days", Day-7 means "was still showing up a week after joining".

import { readFileSync } from "node:fs";

const DAY = 86400000;

export function dayKey(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

function toMs(v) {
  if (v == null) return null;
  if (typeof v === "number") return v;
  if (typeof v.toMillis === "function") return v.toMillis();
  if (typeof v === "string") { const t = Date.parse(v); return Number.isNaN(t) ? null : t; }
  if (typeof v._seconds === "number") return v._seconds * 1000;
  return null;
}

function joinedAt(u) {
  return toMs(u.onboardingCompletedAt)
    ?? (typeof u.firstActiveDate === "string" ? Date.parse(u.firstActiveDate) : null)
    ?? toMs(u.createdAt);
}

// Monday of the week a timestamp falls in, as YYYY-MM-DD — so cohorts line up with calendar weeks.
function weekOf(ms) {
  const d = new Date(ms);
  const back = (d.getUTCDay() + 6) % 7;
  return dayKey(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - back));
}

const BUCKETS = [[0, 0], [1, 1], [2, 3], [4, 7], [8, 14], [15, 30], [31, 90], [91, Infinity]];

// Pure, so it can be tested without a database.
export function summarise(users, now = Date.now()) {
  const today = dayKey(now);
  const ago = (n) => dayKey(now - n * DAY);
  const out = {
    total: users.length,
    onboarded: 0,
    active: { today: 0, last7: 0, last30: 0 },
    cohorts: {},
    activeDays: Object.fromEntries(BUCKETS.map(([a, b]) => [b === Infinity ? `${a}+` : a === b ? `${a}` : `${a}-${b}`, 0])),
    nudgeHour: {},
    rhythm30: { measured: 0, median: null },
    trees: { reached: 0, planted: 0 },
  };
  const rhythms = [];

  for (const u of users) {
    const joined = joinedAt(u);
    if (u.onboardingCompletedAt) out.onboarded++;

    const last = typeof u.lastGreetingDate === "string" ? u.lastGreetingDate : null;
    if (last) {
      // Local dates against a UTC "today" is off by a few hours at the edges, which is fine for a
      // trend and is said here rather than hidden.
      if (last >= ago(1)) out.active.today++;
      if (last > ago(7)) out.active.last7++;
      if (last > ago(30)) out.active.last30++;
    }

    const days = Number(u.activeDays) || 0;
    for (const [a, b] of BUCKETS) {
      if (days >= a && days <= b) {
        out.activeDays[b === Infinity ? `${a}+` : a === b ? `${a}` : `${a}-${b}`]++;
        break;
      }
    }

    if (u.treeOfLifeAt) { out.trees.reached++; if (u.treePlantedAt) out.trees.planted++; }
    if (Number.isInteger(u.nudgeHour)) out.nudgeHour[u.nudgeHour] = (out.nudgeHour[u.nudgeHour] || 0) + 1;
    else out.nudgeHour.default = (out.nudgeHour.default || 0) + 1;

    if (Array.isArray(u.activeDates)) {
      rhythms.push(u.activeDates.filter((d) => typeof d === "string" && d > ago(30) && d <= today).length);
    }

    if (joined) {
      const wk = weekOf(joined);
      const c = (out.cohorts[wk] ||= { joined: 0, day1: 0, day7: 0, day7Eligible: 0 });
      c.joined++;
      if (days >= 2) c.day1++;
      if (now - joined >= 7 * DAY) {
        c.day7Eligible++;
        if (last && last >= dayKey(joined + 7 * DAY)) c.day7++;
      }
    }
  }

  if (rhythms.length) {
    rhythms.sort((a, b) => a - b);
    out.rhythm30 = { measured: rhythms.length, median: rhythms[Math.floor(rhythms.length / 2)] };
  }
  return out;
}

const pct = (n, d) => (d ? `${Math.round((100 * n) / d)}%` : "—");

export function report(s) {
  const lines = [];
  lines.push(`Accounts            ${s.total}  (onboarded ${s.onboarded})`);
  lines.push(`Showed up since yesterday  ${s.active.today}`);
  lines.push(`… in last 7 days    ${s.active.last7}`);
  lines.push(`… in last 30 days   ${s.active.last30}`);
  if (s.rhythm30.measured) lines.push(`Median days of last 30  ${s.rhythm30.median}  (of ${s.rhythm30.measured} accounts with exact dates)`);
  lines.push(`Reached Tree of Life ${s.trees.reached}  (real tree planted: ${s.trees.planted})`);
  lines.push("");
  lines.push("Join week    joined   came back (2+ days)   still here after 7 days");
  for (const wk of Object.keys(s.cohorts).sort().slice(-12)) {
    const c = s.cohorts[wk];
    lines.push(`${wk}   ${String(c.joined).padStart(5)}   ${pct(c.day1, c.joined).padStart(19)}   ${c.day7Eligible ? pct(c.day7, c.day7Eligible).padStart(23) : "too recent".padStart(23)}`);
  }
  lines.push("");
  lines.push("Days ever shown up");
  for (const [k, v] of Object.entries(s.activeDays)) lines.push(`  ${k.padEnd(6)} ${v}`);
  lines.push("");
  lines.push("Reminder time chosen");
  for (const [k, v] of Object.entries(s.nudgeHour)) lines.push(`  ${(k === "default" ? "not chosen (09:00)" : `${String(k).padStart(2, "0")}:00`).padEnd(20)} ${v}`);
  return lines.join("\n");
}

async function main() {
  const { cert, initializeApp } = await import("firebase-admin/app");
  const { getFirestore } = await import("firebase-admin/firestore");

  const path = process.env.SEEN_SERVICE_ACCOUNT || process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (process.env.FIRESTORE_EMULATOR_HOST) {
    initializeApp({ projectId: process.env.GCLOUD_PROJECT || "demo-seen" });
  } else if (path) {
    initializeApp({ credential: cert(JSON.parse(readFileSync(path, "utf8"))) });
  } else {
    console.error("Set SEEN_SERVICE_ACCOUNT to the path of a service-account JSON file (or FIRESTORE_EMULATOR_HOST).");
    process.exit(1);
  }

  // Only the fields above are requested, so nothing personal ever reaches this process.
  const snap = await getFirestore().collection("users")
    .select("lastGreetingDate", "activeDays", "activeDates", "onboardingCompletedAt", "firstActiveDate", "createdAt", "nudgeHour", "treeOfLifeAt", "treePlantedAt")
    .get();
  console.log(report(summarise(snap.docs.map((d) => d.data()))));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error(e.message); process.exit(1); });
}
