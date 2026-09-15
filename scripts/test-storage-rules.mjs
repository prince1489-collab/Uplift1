// test-storage-rules.mjs — exercises storage.rules against the REAL rules engine.
//
// The same question test-rules.mjs asks of Firestore: not "does the file parse?" but "does the
// rule actually do what its comment claims?" That distinction matters more here than usual,
// because the bucket's rules have never existed in this repo — they lived only in the Firebase
// console, so there is no history to diff against and no prior test to inherit confidence from.
//
// The claims under test, each of which the app relied on WITHOUT enforcement until now:
//   · your avatar is yours — nobody else can overwrite it
//   · an avatar must be an image (the path's extension comes from the user's own filename)
//   · an avatar must be under 2MB (the profile-edit upload never checked)
//   · no other path in the bucket accepts anything at all
//
// Needs the emulator (and therefore Java):
//   npx firebase-tools emulators:exec --only storage --project demo-seen "npm run test:storage"
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { ref, uploadBytes, getBytes, deleteObject } from "firebase/storage";

const RULES = join(dirname(fileURLToPath(import.meta.url)), "..", "storage.rules");
const [host, port] = (process.env.FIREBASE_STORAGE_EMULATOR_HOST || "127.0.0.1:9199").split(":");

const env = await initializeTestEnvironment({
  projectId: "demo-seen",
  storage: { rules: readFileSync(RULES, "utf8"), host, port: Number(port) },
});

const A = env.authenticatedContext("uidA").storage();
const B = env.authenticatedContext("uidB").storage();
const ANON = env.unauthenticatedContext().storage();

const png = (bytes = 64) => new Uint8Array(bytes).fill(1);
const asImage = { contentType: "image/png" };

const results = [];
const check = async (name, promise) => {
  try { await promise; results.push([true, name]); }
  catch (e) { results.push([false, `${name}  — ${String(e.message).slice(0, 90)}`]); }
};

// ── The happy path, first: none of the rules below are worth anything if this fails ─────────
await check(
  "owner uploads their own avatar",
  assertSucceeds(uploadBytes(ref(A, "profilePhotos/uidA/avatar.png"), png(), asImage)),
);
await check(
  "anyone can read an avatar (they appear beside messages and on public profiles)",
  assertSucceeds(getBytes(ref(ANON, "profilePhotos/uidA/avatar.png"))),
);
await check(
  "owner can delete their own avatar",
  assertSucceeds(deleteObject(ref(A, "profilePhotos/uidA/avatar.png"))),
);

// ── Ownership ────────────────────────────────────────────────────────────────────────────────
// The Firebase DEFAULT rule is `allow read, write: if request.auth != null`, which would let
// this succeed. If the console was ever left on the default, this is the hole that was open.
await check(
  "another signed-in user CANNOT overwrite your avatar",
  assertFails(uploadBytes(ref(B, "profilePhotos/uidA/avatar.png"), png(), asImage)),
);
await check(
  "a signed-out visitor cannot write an avatar",
  assertFails(uploadBytes(ref(ANON, "profilePhotos/uidA/avatar.png"), png(), asImage)),
);

// ── Content type ─────────────────────────────────────────────────────────────────────────────
// Both callers build the object path by taking the extension off the END OF THE USER'S FILENAME
// and set contentType from the file. Without the contentType condition a signed-in user could
// park avatar.html in the bucket, served as text/html.
await check(
  "an avatar cannot be HTML, even at a .png path",
  assertFails(uploadBytes(ref(A, "profilePhotos/uidA/avatar.png"), png(), { contentType: "text/html" })),
);
await check(
  "an avatar cannot be an arbitrary binary",
  assertFails(uploadBytes(ref(A, "profilePhotos/uidA/avatar.exe"), png(), { contentType: "application/octet-stream" })),
);

// ── Size ─────────────────────────────────────────────────────────────────────────────────────
// Onboarding refuses >2MB; profile-edit did not check at all. This is where that becomes true
// for both paths rather than just the polite one.
await check(
  "an avatar just under 2MB is accepted",
  assertSucceeds(uploadBytes(ref(A, "profilePhotos/uidA/avatar.png"), png(2 * 1024 * 1024 - 1024), asImage)),
);
await check(
  "an avatar over 2MB is refused",
  assertFails(uploadBytes(ref(A, "profilePhotos/uidA/avatar.png"), png(2 * 1024 * 1024 + 1), asImage)),
);

// ── Everything else is closed ────────────────────────────────────────────────────────────────
// The catch-all is what stops a future feature's first upload path from silently inheriting
// whatever the console was last set to.
await check(
  "an unrelated path rejects writes",
  assertFails(uploadBytes(ref(A, "somethingElse/uidA/file.png"), png(), asImage)),
);
await check(
  "Release B's pendingMedia path is NOT open yet — it has no rule and must stay shut",
  assertFails(uploadBytes(ref(A, "pendingMedia/uidA/photo.png"), png(), asImage)),
);
await check(
  "the bucket root rejects writes",
  assertFails(uploadBytes(ref(A, "loose.png"), png(), asImage)),
);

await env.cleanup();

let failed = 0;
for (const [ok, name] of results) {
  console.log(`  ${ok ? "ok  " : "FAIL"}  ${name}`);
  if (!ok) failed++;
}
console.log(`\n${results.length - failed}/${results.length} storage rules tests passed.`);
process.exit(failed ? 1 : 0);
