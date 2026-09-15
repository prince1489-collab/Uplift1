// test-tokens.mjs — guards tokensFor, the function that decides which devices hear from Seen.
//
// WHY THIS FUNCTION GETS A TEST WHEN THE OTHER HELPERS DO NOT. It shipped as an either/or —
// return the fcmTokens map if it has anything in it, otherwise the legacy fcmToken field — and
// that reads as obviously correct until you hold a real account up to it:
//
//   Chrome        writes an fcmTokens map entry   (current web build)
//   the Seen app  writes only the legacy scalar   (any build before 1.5)
//
// The map is non-empty, so the legacy field is never read, and the phone stops receiving
// anything at all. It looked exactly like native push being broken on Android. Nothing failed,
// nothing logged, and the one person most likely to hit it is whoever is testing on the web and
// the app at the same time — which is to say the developer, who will conclude the native code is
// at fault.
//
// The bug is invisible to every test that checks one shape at a time. So the case that matters
// most below is the MIXED one, and it exists specifically because that is the case that broke.
//
// Pure function, no emulator, no network:  node scripts/test-tokens.mjs

import { tokensFor } from "../api/_auth.js";

const results = [];
const check = (name, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  results.push([ok, name, ok ? null : `got ${JSON.stringify(actual)}`]);
};

// ── The case that caused the outage ──────────────────────────────────────────────────────────
check(
  "MIXED: a modern client and an old one both get a row",
  tokensFor({
    fcmTokens: { devA: { token: "web-token", platform: "web" } },
    fcmToken: "old-phone-token",
    pushPlatform: "android",
  }),
  [
    { deviceId: "devA", token: "web-token", platform: "web" },
    { deviceId: null, token: "old-phone-token", platform: "android" },
  ],
);

// ── Dedupe: current clients write the SAME token to both places ──────────────────────────────
// Matching on device id would miss this, because the legacy row has no device id — so the
// dedupe is on the token value. Getting this wrong sends one device two of every notification.
check(
  "the same token in both places produces ONE row, not two",
  tokensFor({
    fcmTokens: { devA: { token: "same-token", platform: "android" } },
    fcmToken: "same-token",
    pushPlatform: "android",
  }),
  [{ deviceId: "devA", token: "same-token", platform: "android" }],
);

check(
  "a token repeated across two device ids is only sent to once",
  tokensFor({
    fcmTokens: {
      devA: { token: "dupe", platform: "android" },
      devB: { token: "dupe", platform: "android" },
    },
  }),
  [{ deviceId: "devA", token: "dupe", platform: "android" }],
);

// ── The two single-shape cases, which always worked ──────────────────────────────────────────
check(
  "map only",
  tokensFor({
    fcmTokens: {
      devA: { token: "t1", platform: "android" },
      devB: { token: "t2", platform: "web" },
    },
  }),
  [
    { deviceId: "devA", token: "t1", platform: "android" },
    { deviceId: "devB", token: "t2", platform: "web" },
  ],
);

check(
  "legacy only — someone who has not opened a modern client yet",
  tokensFor({ fcmToken: "legacy", pushPlatform: "ios" }),
  [{ deviceId: null, token: "legacy", platform: "ios" }],
);

// ── Nothing to send to ───────────────────────────────────────────────────────────────────────
check("no push fields at all", tokensFor({}), []);
check("undefined user data", tokensFor(undefined), []);
check("an empty map is not mistaken for a device", tokensFor({ fcmTokens: {} }), []);
check(
  "an empty map still lets the legacy token through",
  tokensFor({ fcmTokens: {}, fcmToken: "legacy", pushPlatform: "web" }),
  [{ deviceId: null, token: "legacy", platform: "web" }],
);

// ── Malformed rows must be skipped, not crash the send ───────────────────────────────────────
// These run inside a cron that walks every user; one bad document must not stop the loop.
check(
  "entries with no token are skipped",
  tokensFor({
    fcmTokens: {
      devA: { platform: "web" },
      devB: null,
      devC: "not-an-object",
      devD: { token: "good", platform: "android" },
    },
  }),
  [{ deviceId: "devD", token: "good", platform: "android" }],
);

check(
  "a missing platform is null rather than undefined, so the envelope branch is predictable",
  tokensFor({ fcmTokens: { devA: { token: "t" } } }),
  [{ deviceId: "devA", token: "t", platform: null }],
);

let failed = 0;
for (const [ok, name, detail] of results) {
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${name}${detail ? `\n          ${detail}` : ""}`);
  if (!ok) failed++;
}
console.log(`\n${results.length - failed}/${results.length} tokensFor tests passed.`);
process.exit(failed ? 1 : 0);
