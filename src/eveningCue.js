// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.
//
// eveningCue.js — the one thing, if any, that is waiting for you tonight.
//
// ── WHY THIS HAS TO BE IN FIRESTORE ──────────────────────────────────────────────────────────
// Everything else Practice and Reflect remember lives in localStorage, which is right: it is
// per-device, it costs nothing, and none of it needs to leave the phone. This does, because the
// thing that acts on it is a cron running on a server that cannot see a phone's local storage.
//
// ── WHAT IT IS FOR ───────────────────────────────────────────────────────────────────────────
// Seen sends one notification a day, at nine in the morning. That is the right number and the
// wrong hour for half of what it wants to say: Reflect's prompts look BACK at a day, and at 9am
// there is no day to look back on yet.
//
// So there is a second, evening slot — and it is empty on almost every day. It fires only when
// the person themselves left something open a few hours earlier:
//
//   pinned    they tapped "hold this thought" on a journal prompt
//   draft     they started writing and did not finish
//   planned   they said "I'll do this today" about a Practice prompt
//
// That distinction is the whole design. An evening push that says "write in your journal" is the
// app asking again. An evening push that quotes back the question THEY chose to keep is a promise
// they made to themselves, and answering it is finishing something rather than starting it.
//
// ── IT CARRIES A DATE, AND THE DATE IS THE EXPIRY ────────────────────────────────────────────
// There is no cleanup job and there does not need to be one. The sender compares the stored date
// with the recipient's local date and ignores anything that is not today, so a cue left behind by
// someone who never came back simply stops meaning anything at midnight. Staleness is not a state
// that has to be swept up; it is the absence of a match.

import { doc, setDoc } from "firebase/firestore";

export const CUE_KINDS = ["pinned", "draft", "planned"];

// Local calendar date, not UTC. The sender resolves the recipient's own midnight from their
// stored timezone, so both ends have to be talking about the same day in the same terms.
export function cueDateKey(d = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// Write, or clear. `null` means the thing was finished — the reflection was saved, the prompt was
// ticked — and clearing is as important as setting: a reminder about something already done is
// the fastest way to teach somebody the app is not paying attention.
//
// Best-effort throughout. This is a convenience, and a failed write must never surface as an
// error on a screen whose whole job is to be gentle. The worst case is one missing notification.
export function setEveningCue(db, uid, cue) {
  if (!db || !uid) return Promise.resolve();
  const payload = cue && CUE_KINDS.includes(cue.kind)
    ? {
        date: cueDateKey(),
        kind: cue.kind,
        // Quoted back verbatim in the notification, so it is capped at something that will not be
        // truncated mid-word on a lock screen.
        text: String(cue.text || "").slice(0, 120),
        at: Date.now(),
      }
    : null;
  return setDoc(doc(db, "users", uid), { eveningCue: payload }, { merge: true }).catch(() => {});
}
