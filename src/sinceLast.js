// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.
//
// sinceLast.js — "Since you were last here", the top of the home screen (3.32).
//
// Opening Seen used to answer nothing about you. What had happened since your last visit was
// spread over six places — the bell, toasts that vanish in seconds, the Messages badge, a footer
// note after two days away, the bar's outcome line and Seen's chat — and the first thing on screen
// was a stranger's card changing every five seconds. The reason anyone opens an app like this is
// "did anything happen for me?", so that answer now comes first: a few real lines, with names,
// places and words, each one tap from doing something about it.
//
// Real news only. Nothing here is invented to fill the space, and a quiet day says it is quiet —
// that honesty is the difference between a reason to look and a slot machine. Pure, so it is
// tested in node (scripts/test-since-last.mjs).

const DAY = 86400000;
export const SINCE_FIRST_MS = 3 * DAY; // no marker yet on this device: the last three days
export const SINCE_MAX_MS = 7 * DAY;   // never reaches back further than a week

const ms = (t) => (typeof t?.toMillis === "function" ? t.toMillis() : Number(t) || 0);
const first = (n) => String(n || "").trim().split(/\s+/)[0] || "Someone";
const clip = (s, n) => { const t = String(s || "").replace(/\s+/g, " ").trim(); return t.length > n ? `${t.slice(0, n - 1)}…` : t; };
const THE = new Set(["United Kingdom", "United States", "Netherlands", "Philippines", "United Arab Emirates", "Czech Republic", "Dominican Republic", "Bahamas", "Maldives", "Gambia"]);
const place = (c) => (c ? `${THE.has(c) ? "the " : ""}${c}` : null);
const names = (list) => {
  const u = [...new Set(list)];
  if (u.length === 1) return u[0];
  if (u.length === 2) return `${u[0]} and ${u[1]}`;
  if (u.length === 3) return `${u[0]}, ${u[1]} and ${u[2]}`;
  return `${u[0]}, ${u[1]} and ${u.length - 2} others`;
};

// The window: since the last visit on this device, but never more than a week, and the last three
// days when there is no record of a visit yet.
export function sinceWindow(lastSeenAt, now = Date.now()) {
  const last = Number(lastSeenAt) || 0;
  if (!last || last > now) return now - SINCE_FIRST_MS;
  return Math.max(last, now - SINCE_MAX_MS);
}

// The lines, newest first. Each is { key, at, icon, text, action } where action says what a tap
// does: { type: "conversation", uid } · { type: "kindness", item } · { type: "hearts" } ·
// { type: "globe" } · { type: "seen" }.
export function sinceLastItems({ since = 0, myUid = null, replies = [], hearts = [], acts = [], kindness = [], updates = [], max = 5 } = {}) {
  const out = [];

  // Someone wrote to you: a reply to your words, or a kind note out of nowhere.
  for (const r of replies || []) {
    const at = ms(r?.ts);
    if (at <= since || !r?.fromUid || r.fromUid === myUid) continue;
    const who = first(r.fromName);
    const words = clip(r.text, 70);
    out.push({
      key: `r-${r.id || at}`, at, icon: r.messageId ? "💬" : "💌",
      text: r.messageId ? `${who} wrote back: “${words}”` : `${who} sent you a kind note: “${words}”`,
      action: { type: "conversation", uid: r.fromUid },
    });
  }

  // A stranger's kind words were delivered to you.
  for (const k of kindness || []) {
    const at = ms(k?.deliveredAt);
    if (at <= since || !k?.message) continue;
    const who = first(k.fromName || k.message?.sender);
    const where = place(k.fromCountry || k.message?.country);
    out.push({ key: `k-${k.id}`, at, icon: "💌", text: `${who}${where ? ` in ${where}` : ""} sent you a few kind words`, action: { type: "kindness", item: k } });
  }

  // People who felt your words — one line for all of them.
  const felt = (hearts || []).filter((h) => ms(h?.reactedAt) > since && h?.reactorUid && h.reactorUid !== myUid);
  if (felt.length) {
    const who = felt.map((h) => first(h.reactorName)).filter((n) => n !== "Someone");
    const text = who.length ? `${names(who)} felt your words` : felt.length === 1 ? "Someone felt your words" : `${felt.length} people felt your words`;
    out.push({ key: "hearts", at: Math.max(...felt.map((h) => ms(h.reactedAt))), icon: "❤️", text, action: { type: "hearts" } });
  }

  // Where your words reached — one line, every country.
  const reached = (acts || []).filter((e) => e?.route === "sent" && e.delivered && e.country && ms(e.at) > since);
  if (reached.length) {
    const countries = [...new Set(reached.map((e) => e.country))];
    const text = countries.length === 1 ? `Your words reached someone in ${place(countries[0])}`
      : `Your words reached people in ${names(countries.map(place))}`;
    out.push({ key: "reached", at: Math.max(...reached.map((e) => ms(e.at))), icon: "🌍", text, action: { type: "globe" } });
  }

  // Something from Seen, the app's own updates (your week, a new level) not yet read.
  const fresh = (updates || []).filter((u) => u?.kind === "update" && u.read === false && ms(u.createdAt) > since);
  if (fresh.length) {
    const u = fresh.sort((a, b) => ms(b.createdAt) - ms(a.createdAt))[0];
    const text = String(u.id || "").startsWith("u-week-") ? "Your week in Seen is ready" : clip(String(u.text || "").split("\n")[0], 80);
    out.push({ key: `u-${u.id}`, at: ms(u.createdAt), icon: "🌱", text, action: { type: "seen" } });
  }

  return out.sort((a, b) => b.at - a.at).slice(0, max);
}
