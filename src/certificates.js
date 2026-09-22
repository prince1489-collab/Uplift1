// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.
//
// certificates.js — the seven kindness certificates, and the latch that says which are new.
//
// ── WHAT THEY COUNT, AND WHY IT IS NOT THE STREAK ────────────────────────────────────────────
// Days you showed up. Not days in a row.
//
// The streak (users/{uid}.streakDays) is the right number for the flame — it is about momentum,
// and momentum genuinely breaks. It is the wrong number for a certificate. A year's streak is
// reachable by almost nobody, and the version of this feature where one missed Tuesday in March
// destroys a December certificate is precisely the guilt mechanic docs/v2-roadmap.md rules out:
// "must never feel like failure (wellbeing app — no guilt mechanics)".
//
// So these run off `activeDays`, written by recordGreetingDay in UpliftRetentionFeatures.jsx —
// a count of distinct days on which somebody did SOMETHING kind. A gap pauses it; nothing
// erases it.
//
// ── THE NAMES ARE ROUNDER THAN THE NUMBERS, AND THE CERTIFICATE SAYS THE NUMBER ──────────────
// "2 months" is 60 days here. With gaps allowed, 60 active days might take somebody five calendar
// months, so the card in the app uses the friendly name and the ARTEFACT states the true thing:
// "60 days of kindness". A certificate somebody posts publicly must not claim something they can
// count for themselves and find wrong — that is the one detail that would make the whole idea
// feel cheap.

export const CERTIFICATES = [
  { days: 15,  name: "15 days",  emoji: "🌱", blurb: "A fortnight of showing up" },
  { days: 30,  name: "30 days",  emoji: "🌿", blurb: "A month of kindness" },
  { days: 60,  name: "2 months", emoji: "🍃", blurb: "Sixty days of small acts" },
  { days: 120, name: "4 months", emoji: "🌳", blurb: "A habit, not an intention" },
  { days: 180, name: "6 months", emoji: "🌸", blurb: "Half a year of turning up" },
  { days: 240, name: "8 months", emoji: "🌼", blurb: "Kindness as a way of being" },
  { days: 365, name: "One year", emoji: "🏆", blurb: "Three hundred and sixty-five days" },
];

// How many are earned at a given count of active days. Returns an index count, so
// CERTIFICATES.slice(0, earnedCount(n)) is the earned set and CERTIFICATES[earnedCount(n)] is
// the next one (or undefined when they are all done).
export function earnedCount(activeDays) {
  const n = Number(activeDays) || 0;
  let i = 0;
  while (i < CERTIFICATES.length && n >= CERTIFICATES[i].days) i++;
  return i;
}

// ── The claim-once latch ─────────────────────────────────────────────────────────────────────
// Same shape and the same reasoning as treeMilestone.js, deliberately: claiming and asking are
// ONE call, because the alternative is a read-then-write with a render in between and the same
// certificate celebrated twice on one screen.
//
// THE FIRST-RUN RULE MATTERS MORE HERE THAN IT DID THERE. Everybody who already uses this app
// has an activeDays count the moment the field appears, seeded from their streak — so without
// this, the first launch after the update throws a party for every certificate they have
// already passed, at once. A stack of celebrations nobody earned this morning is how a person
// learns that the real ones are noise too.
const SEEN_KEY = "seen_v2_certificates_seen";

function read() {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    return raw == null ? null : Number(raw);
  } catch { return null; }
}

function write(count) {
  try { localStorage.setItem(SEEN_KEY, String(count)); } catch { /* ignore */ }
}

// Returns the certificate to celebrate, or null.
//
// Returns null for a count already seen, for a count that has gone DOWN (activeDays should never
// fall, but a stale profile snapshot can arrive after a fresh one), and for the very first run on
// a device — which records where the person is and says nothing.
export function claimCertificate(activeDays) {
  const earned = earnedCount(activeDays);
  if (earned <= 0) { if (read() == null) write(0); return null; }
  const seen = read();
  write(Math.max(earned, seen ?? 0));
  if (seen == null) return null;          // first run: record, celebrate nothing
  if (earned <= seen) return null;        // nothing new
  return CERTIFICATES[earned - 1];
}
