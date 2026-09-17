/* Copyright © 2025 Mahiman Singh Rathore. All rights reserved. */
//
// test-image-review.mjs — the image reviewer refuses, every way it can fail.
//
// THE CLAIM BEING TESTED. api/moderate-message.js screens text with a word-list fallback, so an
// AI outage still lets somebody send an encouraging message. The image branch has no fallback,
// because there is no word list for pixels: anything short of a clean verdict must come back as
// { ok: false, checked: false }, and the client must refuse the upload.
//
// That claim is one line of code per failure path and completely invisible if any one of them is
// written the other way round — an accidental `ok: true` on an unparseable reply would screen
// nothing and look, from the app, exactly like screening working. So each path is asserted.
//
// Runs with NO ANTHROPIC_API_KEY and NO network: every case here is refused before the client is
// ever constructed, which is itself part of what is being asserted.
//
// Run: node scripts/test-image-review.mjs

import assert from "node:assert/strict";

// Must be unset BEFORE the module decides anything — it reads the env per call, but be explicit.
delete process.env.ANTHROPIC_API_KEY;

const { reviewImage } = await import("../api/moderate-message.js");

let passed = 0;
const cases = [];
function t(name, fn) { cases.push([name, fn]); }

// A minimal valid-looking base64 payload. The contents never reach a decoder in these tests.
const B64 = "AAAA";

t("a type outside the allowlist is refused", async () => {
  const r = await reviewImage({ mediaType: "image/svg+xml", base64: B64 });
  assert.equal(r.status, 400);
  assert.equal(r.body.error, "unsupported_image_type");
});

t("image/gif is refused — the allowlist is what Anthropic accepts, not what looks like an image", async () => {
  const r = await reviewImage({ mediaType: "image/gif", base64: B64 });
  assert.equal(r.status, 400);
});

t("a missing media type is refused rather than guessed", async () => {
  const r = await reviewImage({ base64: B64 });
  assert.equal(r.status, 400);
});

t("no bytes is a bad request, not a pass", async () => {
  const r = await reviewImage({ mediaType: "image/jpeg", base64: "" });
  assert.equal(r.status, 400);
  assert.notEqual(r.body.ok, true);
});

t("an oversized payload is refused before it is sent anywhere", async () => {
  const r = await reviewImage({ mediaType: "image/jpeg", base64: "A".repeat(3 * 1024 * 1024) });
  assert.equal(r.status, 413);
});

t("something that is not base64 at all is refused", async () => {
  const r = await reviewImage({ mediaType: "image/png", base64: "not base64!!" });
  assert.equal(r.status, 400);
});

// The one that matters most: a well-formed request, with the service unreachable.
t("NO KEY: a valid image gets checked=false and ok=false — never a pass", async () => {
  const r = await reviewImage({ mediaType: "image/jpeg", base64: B64 });
  assert.equal(r.status, 200);
  assert.equal(r.body.checked, false, "no verdict must report checked:false");
  assert.equal(r.body.ok, false, "no verdict must NOT report ok:true");
});

t("no failure path ever returns ok:true", async () => {
  const inputs = [
    { mediaType: "image/svg+xml", base64: B64 },
    { mediaType: "image/jpeg", base64: "" },
    { mediaType: "image/jpeg", base64: "@@@@" },
    { mediaType: "image/jpeg", base64: B64 },
    {},
    null,
  ];
  for (const i of inputs) {
    const r = await reviewImage(i);
    assert.notEqual(r.body.ok, true, `ok:true leaked for ${JSON.stringify(i)}`);
  }
});

for (const [name, fn] of cases) {
  try {
    await fn();
    console.log(`  ok    ${name}`);
    passed++;
  } catch (err) {
    console.error(`  FAIL  ${name}\n        ${err.message}`);
  }
}

console.log(`\n  ${passed}/${cases.length} image-review tests passed.`);
if (passed !== cases.length) process.exit(1);
