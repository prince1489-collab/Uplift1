// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.
//
// pushAsk.js — when to ask for notifications (3.28).
//
// Only 24 of 96 accounts could receive a notification, because the phone's own "Allow Seen to
// send you notifications?" appeared the instant anyone signed in, before they knew what Seen was
// or what it would send. Most people say no to that. Now the question waits until just after a
// kind act — the one moment the answer is obvious, because their words have just gone to someone —
// and comes with a reason: "Want to know when your words land?" (PushAskNote.jsx). Yes brings up
// the system prompt; Not now is asked again a week later, at most three times in all.
//
// Remembered per account (the key carries the uid, so it survives sign-out and never leaks to
// another account on the device — deviceOwner.js).

export const ASK_GAP_MS = 7 * 86400000;
export const MAX_ASKS = 3;
const key = (uid) => `seen_push_ask_${uid}`;

const defaultStorage = () => { try { return typeof localStorage !== "undefined" ? localStorage : null; } catch { return null; } };

function read(uid, storage) {
  try { return JSON.parse(storage?.getItem(key(uid)) || "null"); } catch { return null; }
}

// May the note be shown now?
export function pushAskDue(uid, now = Date.now(), storage = defaultStorage()) {
  if (!uid || !storage) return false;
  const rec = read(uid, storage);
  if (!rec) return true;
  const n = Number(rec.n) || 0;
  return n < MAX_ASKS && now - (Number(rec.at) || 0) >= ASK_GAP_MS;
}

// The note was answered (either way) or shown.
export function markPushAsked(uid, now = Date.now(), storage = defaultStorage()) {
  if (!uid || !storage) return;
  const rec = read(uid, storage);
  try { storage.setItem(key(uid), JSON.stringify({ at: now, n: (Number(rec?.n) || 0) + 1 })); } catch { /* blocked */ }
}

// Only worth asking when the system can still show its prompt.
export const askable = (permission) => permission === "prompt" || permission === "prompt-with-rationale";
