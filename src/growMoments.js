// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.
//
// growMoments.js — what the Grow tab says, as sentences rather than numbers (3.29).
//
// Grow showed nine counts of more or less the same thing (117 times, 107 kind words, 10 acts, 170
// hearts, 2 countries, 217 "passed it on", 58 days, 24 of 30, 4,500 drops), then "How kindness
// felt this week: warm. You felt warm." and a list of answers with no act, date or person attached.
// The founder: "the your answers bit is quite meaningless". A number doesn't make anyone feel
// anything; "Mona wrote back: 'needed this'" does. So Grow now leads with real moments from the
// week — what came back to you first, then what you did — and turns the tree's drops into time.

import { kindLine } from "./kindLog.js";

const DAY = 86400000;
const clip = (s, n) => { const t = String(s || "").replace(/\s+/g, " ").trim(); return t.length > n ? `${t.slice(0, n - 1)}…` : t; };
const first = (name) => String(name || "").trim().split(/\s+/)[0] || "Someone";
const lower = (s) => String(s || "").trim().toLowerCase();
const tsOf = (x) => Number(x?.ts ?? x?.at ?? x?.reactedAt ?? x?.createdAt ?? 0);

const ICON = { sent: "🌍", reply: "💬", note: "💌", act: "🤝" };

// Up to `max` moments from the last week: replies and hearts that came back to you first (newest
// first), then your own acts. Hearts from several people become one line.
export function weekMoments({ acts = [], replies = [], hearts = [], now = Date.now(), max = 3 } = {}) {
  const from = now - 7 * DAY;
  const back = [];
  for (const r of replies || []) {
    if (tsOf(r) < from || !r?.text) continue;
    back.push({ at: tsOf(r), icon: "💬", text: `${first(r.fromName)} wrote back: “${clip(r.text, 70)}”` });
  }
  const recentHearts = (hearts || []).filter((h) => tsOf(h) >= from);
  const names = [...new Set(recentHearts.map((h) => first(h.reactorName)).filter((n) => n !== "Someone"))];
  if (recentHearts.length) {
    const at = Math.max(...recentHearts.map(tsOf));
    const text = names.length === 1 ? `${names[0]} felt your words ❤️`
      : names.length === 2 ? `${names[0]} and ${names[1]} felt your words ❤️`
      : `${recentHearts.length === 1 ? "Someone" : `${recentHearts.length} people`} felt your words ❤️`;
    back.push({ at, icon: "❤️", text });
  }
  back.sort((a, b) => b.at - a.at);
  const mine = (acts || [])
    .filter((e) => e && ICON[e.route] && tsOf(e) >= from)
    .sort((a, b) => tsOf(b) - tsOf(a))
    .map((e) => ({ at: tsOf(e), icon: ICON[e.route], text: `${kindLine(e)}${e.feeling ? ` — it felt ${lower(e.feeling)}` : ""}` }));
  return [...back, ...mine].slice(0, max);
}

// The tree's next stage as time, at the pace someone actually keeps — "about 3 weeks" rather than
// "1,500 more drops". Null when there's no pace to go on (a new account, or a long pause).
export function timeToNext({ remaining, balance, activeDays, recentDays }) {
  if (!(remaining > 0) || !(balance > 0) || !(activeDays > 0) || !(recentDays > 0)) return null;
  const perActiveDay = balance / activeDays;
  const activeShare = Math.min(1, recentDays / 30);
  const days = Math.ceil(remaining / (perActiveDay * activeShare));
  if (!Number.isFinite(days) || days <= 0) return null;
  if (days === 1) return "about a day";
  if (days < 14) return `about ${days} days`;
  const weeks = Math.round(days / 7);
  if (weeks <= 8) return `about ${weeks} weeks`;
  return `about ${Math.round(days / 30)} months`;
}

// The newest reflection Seen wrote that the person hasn't turned away ("Not quite", "Forget this").
export function latestReflection(chat = []) {
  return [...(chat || [])].reverse().find((m) => m?.role === "seen" && m.kind === "reflection" && m.text && !["no", "forget"].includes(m.feedback)) || null;
}

// A reason saved before 3.29.1 was cut to 70 characters ("You said on Sunday: “I have made
// progress in terms of my…”"). The person's own message is still in their Seen conversation, so
// the full sentence is put back from there. Anything that can't be matched is left as it was.
export function expandEvidence(evidence = [], chat = []) {
  const mine = (chat || []).filter((m) => m?.role === "me" && typeof m.text === "string");
  return (evidence || []).map((ev) => {
    const label = String(ev?.label || "");
    const m = label.match(/^(.*“)(.+?)…”(.*)$/);
    if (!m) return ev;
    const norm = (t) => String(t).replace(/\s+/g, " ").trim();
    const prefix = norm(m[2]);
    const full = mine.find((x) => norm(x.text).startsWith(prefix));
    return full ? { ...ev, label: `${m[1]}${norm(full.text)}”${m[3]}` } : ev;
  });
}
