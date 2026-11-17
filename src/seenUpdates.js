// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.
//
// seenUpdates.js — what the app tells you in Seen, written by the app, never by the AI (3.30).
//
// Grow used to say things in words: this week's moments, what Seen noticed, a new certificate, the
// tree's pace. The founder wanted Grow to be the tree and three numbers, and "all the other wordy
// bits communicated through the Seen AI chat". So these become messages in the Seen conversation
// (users/{uid}/seenChat, kind "update"):
//
//   u-week-<monday>         Your week — the first open from Sunday to Tuesday
//   u-stage-<n>             your tree reached a new stage
//   u-badge-<stat>-<level>  a new level on one of Grow's three numbers
//   u-cert-<days>           a new certificate
//
// They are built from the person's own activity on their device, so they go to everyone signed in,
// including people who haven't switched on the AI. The ids are fixed so two devices can't write
// the same one twice (firestore.rules only allows creating them, at an id of this shape), and the
// server never sends them to the model (api/_seen.js modelChat) — they carry other people's names
// and words, and the AI only reads what you said and did.
//
// Pure, so it is tested in node (scripts/test-seen-updates.mjs). The copy never says "streak" and
// never counts what was missed (scripts/check-reflect.cjs's GUILT rule).

import { weekMoments } from "./growMoments.js";
import { CERTIFICATES } from "./certificates.js";

export const UPDATE_KIND = "update";
export const MAX_UPDATE = 400;          // firestore.rules: an update's text is at most 400
export const RECAP_FIRST_WEEK = "2026-11-16"; // the kindness log began on 17 Nov (3.29)
const DAY = 86400000;

const pad = (n) => String(n).padStart(2, "0");
const keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const localMidnight = (key) => { const [y, m, d] = key.split("-").map(Number); return new Date(y, m - 1, d).getTime(); };
const addDays = (key, n) => { const [y, m, d] = key.split("-").map(Number); return keyOf(new Date(y, m - 1, d + n)); };

// Monday of the week that "Your week" is about, or null when it isn't the time to write one. On a
// Sunday it's this week (Monday to now); on Monday or Tuesday, the week just gone, for anyone who
// didn't open on Sunday. Later in the week it's too late to be news.
export function recapWeekKey(now = Date.now()) {
  const d = new Date(now);
  const dow = d.getDay(); // 0 Sunday … 6 Saturday
  if (dow === 0) return addDays(keyOf(d), -6);
  if (dow === 1) return addDays(keyOf(d), -7);
  if (dow === 2) return addDays(keyOf(d), -8);
  return null;
}

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const times = (n) => (n === 1 ? "once" : n === 2 ? "twice" : `${n} times`);

// Fit lines into the 400 the rules allow: drop from the end of the moments first, then cut.
function fit(lines, keepLast = 0) {
  const head = lines.slice(0, lines.length - keepLast);
  const tail = lines.slice(lines.length - keepLast);
  let out = [...head, ...tail];
  while (out.join("\n").length > MAX_UPDATE && head.length > 2) { head.pop(); out = [...head, ...tail]; }
  const text = out.join("\n");
  return text.length > MAX_UPDATE ? `${text.slice(0, MAX_UPDATE - 1)}…` : text;
}

// "Your week", or null when there's nothing to say (or it isn't this account's week to say it).
//   activeDates — profile.activeDates (local YYYY-MM-DD days with a kind act)
//   acts, replies, hearts — the kindness log, replies received, hearts received (growMoments)
//   journalCount — journal entries written that week (a count only)
//   pace, nextStage — "about 4 weeks", "Young tree" (growMoments.timeToNext)
//   createdAt, forgotAt — ms: no week from before the account, or before "Forget everything"
export function weeklyRecap({ weekKey, now = Date.now(), activeDates = [], acts = [], replies = [], hearts = [], journalCount = 0,
  pace = null, nextStage = null, createdAt = 0, forgotAt = 0 } = {}) {
  if (!weekKey || weekKey < RECAP_FIRST_WEEK) return null;
  const from = localMidnight(weekKey);
  const to = Math.min(now, from + 7 * DAY);
  if (Number(createdAt) > from || Number(forgotAt) >= from) return null;
  const last = addDays(weekKey, 6);
  const days = new Set((activeDates || []).filter((k) => typeof k === "string" && k >= weekKey && k <= last)).size;
  const moments = weekMoments({ acts, replies, hearts, now: to, from, max: 3 });
  const wrote = Math.max(0, Number(journalCount) || 0);
  if (!days && !moments.length && !wrote) return null;
  const lines = ["Your week 🌱"];
  if (days) lines.push(`You made someone feel seen on ${plural(days, "day")}.`);
  for (const m of moments) lines.push(`${m.icon} ${m.text}`);
  const tail = [];
  if (wrote) tail.push(`📓 You wrote in your journal ${times(wrote)}.`);
  if (pace && nextStage) tail.push(`🌳 ${nextStage} in ${pace} at your pace.`);
  return { id: `u-week-${weekKey}`, text: fit([...lines, ...tail], tail.length) };
}

// A new stage. `stages` is TREE_STAGES (KindnessTree.jsx — passed in, it's a .jsx module).
export function stageUpdate({ stageIdx, stages = [], pace = null } = {}) {
  const stage = stages[stageIdx];
  if (!stage) return null;
  const next = stages[stageIdx + 1];
  const text = next
    ? `🌳 Your tree reached a new stage: ${stage.name}.${pace ? ` At your pace, ${next.name} is ${pace} away.` : ` Next comes ${next.name}.`}`
    : `🌳 Your tree reached ${stage.name}. A real tree will be planted in your name — we'll let you know when it's in the ground.`;
  return { id: `u-stage-${stageIdx}`, text: text.slice(0, MAX_UPDATE), action: "tree" };
}

// A new level on one of Grow's three numbers (growStats.planBadges).
export function badgeUpdate({ stat, level, threshold } = {}) {
  const n = Number(threshold) || 0;
  const text = stat === "streak" ? `🔥 Level ${level}: ${plural(n, "day")} in a row. Your best run yet.`
    : stat === "hearts" ? `❤️ Level ${level}: ${n.toLocaleString("en-GB")} hearts on your words. Each one is a person who felt them.`
    : stat === "countries" ? `🌍 Level ${level}: your kindness has reached ${plural(n, "country", "countries")}.`
    : null;
  if (!text || !level) return null;
  return { id: `u-badge-${stat}-${level}`, text, action: "grow" };
}

// A new certificate (certificates.js).
export function certUpdate(cert) {
  if (!cert?.days) return null;
  return {
    id: `u-cert-${cert.days}`,
    text: `${cert.emoji || "📜"} ${cert.name}: you've made someone feel seen on ${cert.days} different days. Your certificate is ready.`,
    action: `cert:${cert.days}`,
  };
}

// What an update's button does — only these, whatever a stored message says.
export function parseAction(action) {
  const a = String(action || "");
  if (a === "tree") return { type: "tree", label: "See your tree" };
  if (a === "grow") return { type: "grow", label: "See it on Grow" };
  const m = a.match(/^cert:(\d+)$/);
  if (m) {
    const cert = CERTIFICATES.find((c) => c.days === Number(m[1]));
    return cert ? { type: "cert", cert, label: "See certificate" } : null;
  }
  return null;
}

// Whether to write an update now: only from a list that came from the server (a cached one can be
// missing what another device wrote), and only if it isn't there already.
export function canCreate(chat, id, { fromServer = false } = {}) {
  return Boolean(id) && Array.isArray(chat) && fromServer && !chat.some((m) => m?.id === id);
}
