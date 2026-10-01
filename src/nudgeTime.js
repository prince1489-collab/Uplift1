// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.
//
// nudgeTime.js — the hour of the day somebody wants Seen to find them.
//
// A habit attaches to something that already happens: breakfast, lunch, the walk home. Nine
// o'clock for everybody is nobody's moment, so the Today card asks once — straight after the
// first kind act, when the loop has just worked — and api/send-reminder.js sends the daily push
// at this LOCAL hour instead of 9am. Not answering keeps 9am.
//
// Stored on users/{uid} because the thing that reads it is a cron with no access to the phone.
// The owner may already write any field on their own document, so there is no rules change.

import { doc, setDoc } from "firebase/firestore";

export const NUDGE_CHOICES = [
  { hour: 8, label: "After breakfast", emoji: "☕" },
  { hour: 12, label: "Lunchtime", emoji: "🥪" },
  { hour: 17, label: "Heading home", emoji: "🚶" },
  { hour: 20, label: "Evening", emoji: "🌙" },
];

const ASKED_KEY = "seen_v2_nudge_asked";

export function nudgeLabel(hour) {
  return NUDGE_CHOICES.find((c) => c.hour === hour)?.label || null;
}

// Asked once per device. Answering or dismissing both count: a question that keeps coming back
// after "not now" is a nag, and the choice stays reachable from the card's menu.
export function nudgeAsked() {
  try { return localStorage.getItem(ASKED_KEY) === "1"; } catch { return true; }
}

export function markNudgeAsked() {
  try { localStorage.setItem(ASKED_KEY, "1"); } catch { /* ignore */ }
}

// The timezone travels with it: the sender resolves "12" against the zone it was chosen in, and
// timezone is otherwise only written when a push token registers. Best-effort — a failed write
// costs one push at the old hour, never an error on screen.
export function setNudgeHour(db, uid, hour) {
  markNudgeAsked();
  if (!db || !uid || !Number.isInteger(hour)) return Promise.resolve();
  let timezone = null;
  try { timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || null; } catch { /* ignore */ }
  const patch = timezone ? { nudgeHour: hour, timezone } : { nudgeHour: hour };
  return setDoc(doc(db, "users", uid), patch, { merge: true }).catch(() => {});
}
