// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.
//
// seenText.js — how Seen's saved messages read on screen (3.36.5).
//
// Two things got into the conversation that were never meant to be read:
//   • the model's evidence ids — "…unsolvable at first (A4), and…" — which belong under
//     "Why I think this", not in the sentence. The server now strips them from new messages
//     (stripEvidenceIds in api/_seen.js); this takes them out of ones saved before that.
//   • "[object Object]", which the Send button sent instead of what was typed, until 3.36.5.
//     Those messages are hidden; nothing the person wrote is lost, because nothing was sent.
// Kept identical to api/_seen.js; scripts/test-seen-text.mjs checks the two give the same results.

const EVIDENCE_ID = String.raw`[AFRJKS]\d{1,3}(?:\s*[-–]\s*[AFRJKS]?\d{1,3})?`;
const EVIDENCE_GROUP = new RegExp(String.raw`\s*[(\[]\s*${EVIDENCE_ID}(?:\s*(?:,|;|&|and)\s*${EVIDENCE_ID})*\s*[)\]]`, "g");

export function stripEvidenceIds(text) {
  return String(text || "").replace(EVIDENCE_GROUP, "").replace(/[ \t]+([,.;:!?])/g, "$1").replace(/[ \t]{2,}/g, " ").trim();
}

export const isJunkText = (t) => /^\s*\[object Object\]\s*$/.test(String(t ?? ""));
