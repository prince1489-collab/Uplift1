// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.
//
// replyNudge.js — when a ❤️ should become "tell them what it meant".
//
// A heart says a message landed. A private word saying HOW is the thing that makes its writer feel
// seen, and nothing used to suggest it: Reply sat in the long-press bar, a separate decision that
// almost nobody made after liking. So after a heart, a single line offers it — and these rules
// are what keep that line an invitation rather than a nag:
//
//   • once per message, ever (seen_nudged_msgs)
//   • never for a message you have already replied to (seen_replied_msgs)
//   • at most NUDGES_PER_DAY a day
//
// Per-device and best-effort, like the rest of the app's small memories.

const REPLIED = "seen_replied_msgs";
const NUDGED = "seen_nudged_msgs";
const DAILY = "seen_nudges_day";
export const NUDGES_PER_DAY = 3;
export const NUDGE_MS = 8000;
const KEEP = 300;

const read = (k, fb) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch { return fb; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } };
const dayKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function hasReplied(messageId) {
  return Boolean(messageId) && read(REPLIED, []).includes(messageId);
}

export function markReplied(messageId) {
  if (!messageId) return;
  const list = read(REPLIED, []).filter((x) => x !== messageId);
  write(REPLIED, [...list, messageId].slice(-KEEP));
}

export function canNudge(messageId) {
  if (!messageId || hasReplied(messageId)) return false;
  if (read(NUDGED, []).includes(messageId)) return false;
  const d = read(DAILY, null);
  return !(d && d.day === dayKey() && d.n >= NUDGES_PER_DAY);
}

export function markNudged(messageId) {
  write(NUDGED, [...read(NUDGED, []), messageId].slice(-KEEP));
  const d = read(DAILY, null);
  const today = dayKey();
  write(DAILY, { day: today, n: d && d.day === today ? d.n + 1 : 1 });
}
