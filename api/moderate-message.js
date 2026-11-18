// Live AI safety review of what a user is about to publish — their words, and now their profile
// photo. Auth: any signed-in user (verified Firebase ID token).
//
// Fail-safe behaviour is decided by the CALLER via the returned "checked" flag:
//  - custom replies fail CLOSED (client blocks when checked=false — suggestions still work)
//  - feeling posts fail OPEN (client allows when checked=false — 60-char limit + user
//    reporting are the backstop; an AI outage must not block the core loop)
//  - IMAGES fail CLOSED, and have no fallback at all. See below.
//
// ── THE IMAGE BRANCH, AND WHY IT IS NOT LIKE THE TEXT ONE ────────────────────────────────────
// Text that cannot reach the model still gets wordlistCheck() (_screen.js) — blunt, but a real second
// opinion, and enough to let somebody send an encouraging message during an outage. There is no
// word list for pixels. So when the key is missing, the call throws, or the reply will not parse,
// this returns { ok: false, checked: false } and the client refuses the upload.
//
// The trade is deliberate and one-sided: an outage costs somebody their new profile picture for
// ten minutes, and the alternative costs an unreviewed photograph in a world-readable bucket.
//
// ── WHAT THIS IS NOT ─────────────────────────────────────────────────────────────────────────
// This is a judgement model. It is a competent reviewer of the ordinary case — nudity, gore, hate
// symbols, a phone number written across the picture — and it is NOT a CSAM detector, which is a
// hash-matching problem and belongs to PhotoDNA or Project Arachnid Shield.
//
// That distinction is the reason photos are allowed on AVATARS and not yet in the feed. An avatar
// is one image per account, attached to a named, age-gated, signed-in person, replacing an image
// that was previously uploaded with no review whatsoever. A feed post is unbounded, and waits for
// hash matching to be in place. Do not read this file as permission to open that door.

import Anthropic from "@anthropic-ai/sdk";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { screenText } from "./_screen.js";
import { sortKindAct, SORT_MODEL, MAX_ACT } from "./_sort.js";

// The model call behind sorting a kind act (3.36). No key, or any failure: not sorted.
async function sortWithModel({ system, user }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return "";
  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({ model: SORT_MODEL, max_tokens: 10, system, messages: [{ role: "user", content: user }] });
  return response.content[0]?.text ?? "";
}

function initAdmin() {
  if (!getApps().length) {
    initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)) });
  }
}

const MAX_LEN = 200; // hard input cap; callers enforce their own tighter limits

// ── Image limits ─────────────────────────────────────────────────────────────────────────────
// The only client is src/imagePrep.js, which re-encodes everything to a JPEG of at most 1024px on
// the long edge — a couple of hundred kilobytes. The allowlist is wider than that on purpose: it
// is the set Anthropic's vision API accepts, so a future caller that sends a PNG straight through
// meets a limit rather than a mystery. Anything outside it is refused here rather than forwarded.
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
// Decoded bytes. Well under Vercel's 4.5MB request body and Anthropic's 5MB per image, and about
// six times what a prepared avatar actually weighs — so this is a backstop, not a working limit.
const MAX_IMAGE_BYTES = 1.5 * 1024 * 1024;
// base64 carries 3 bytes in every 4 characters.
const MAX_IMAGE_B64 = Math.ceil(MAX_IMAGE_BYTES * 4 / 3);

// ── The image reviewer ───────────────────────────────────────────────────────────────────────
// Returns the JSON body to send. `checked: false` is the signal that no verdict was reached, and
// every caller treats it as a refusal — there is no fallback path here by design (see the header).
//
// Exported for scripts/test-image-review.mjs, which asserts the refusals without a key and
// without a network. Vercel routes on the DEFAULT export, so a named one changes nothing here.
export async function reviewImage(image) {
  const mediaType = String(image?.mediaType || "");
  const base64 = String(image?.base64 || "");

  if (!ALLOWED_IMAGE_TYPES.has(mediaType)) {
    return { status: 400, body: { error: "unsupported_image_type" } };
  }
  if (!base64) return { status: 400, body: { error: "missing image" } };
  if (base64.length > MAX_IMAGE_B64) {
    return { status: 413, body: { error: "image_too_large" } };
  }
  // Cheap shape check before spending a round trip: anything that is not base64 cannot be an
  // image, and the API would reject it less legibly a second later.
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) {
    return { status: 400, body: { error: "malformed image" } };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  // No key, no verdict. Unlike the text path there is nothing to fall back to.
  if (!apiKey) {
    console.error("[moderate-message] image review requested with no ANTHROPIC_API_KEY");
    return { status: 200, body: { ok: false, checked: false, reason: null } };
  }

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 150,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
          {
            type: "text",
            text:
              "You are the safety reviewer for a kindness app used by people who may be " +
              "vulnerable. The image above is somebody's PROFILE PICTURE, shown next to their " +
              "name throughout the app.\n\n" +
              "Flag it ONLY if it contains: nudity or sexual content; violence, gore or injury; " +
              "hate symbols or extremist insignia; weapons, drugs or drug paraphernalia; " +
              "harassment or mockery of an identifiable person; or contact details, a phone " +
              "number, an email address, a web address or a QR code written into the picture.\n\n" +
              "Ordinary photographs PASS and must not be flagged: selfies, portraits, group " +
              "photos, children pictured normally and fully clothed, pets, landscapes, food, " +
              "cartoons, drawings, a logo, a blank or abstract image, a blurry or badly lit " +
              "photo. A picture being dull, unflattering or not obviously a face is not a reason " +
              "to flag it.\n\n" +
              'Reply with ONLY JSON: {"ok": true} or {"ok": false, "reason": "<ten words max, ' +
              'gentle, user-facing>"}.',
          },
        ],
      }],
    });
    const raw = response.content[0]?.text ?? "";
    const match = raw.match(/\{[\s\S]*\}/);
    const parsed = match ? JSON.parse(match[0]) : null;
    if (parsed && typeof parsed.ok === "boolean") {
      return { status: 200, body: { ok: parsed.ok, reason: parsed.reason || null, checked: true } };
    }
    // A reply we cannot read is not a pass. Same outcome as an outage.
    console.error("[moderate-message] unparseable image verdict");
    return { status: 200, body: { ok: false, checked: false, reason: null } };
  } catch (err) {
    console.error("[moderate-message] image review failed:", err?.message);
    return { status: 200, body: { ok: false, checked: false, reason: null } };
  }
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).end();

  // Admin-init failure and a bad user token used to share one catch and both returned 401,
  // which made a missing FIREBASE_SERVICE_ACCOUNT_JSON indistinguishable from a failed
  // sign-in — the deployment looked fine and every caller just saw "unauthorised".
  try {
    initAdmin();
  } catch (err) {
    console.error("[moderate-message] admin init failed — is FIREBASE_SERVICE_ACCOUNT_JSON set?", err?.message);
    return res.status(503).json({ error: "moderation_unavailable" });
  }
  try {
    const auth = req.headers["authorization"] || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) return res.status(401).json({ error: "unauthorised" });
    await getAuth().verifyIdToken(token);
  } catch {
    return res.status(401).json({ error: "unauthorised" });
  }

  // ── Image, or text ─────────────────────────────────────────────────────────────────────────
  // Branched here so the image path inherits the CORS preamble, the admin init and the token
  // check above it verbatim — one endpoint, one set of doors, and no second Vercel function
  // against a ceiling of twelve that api/ already holds all twelve of.
  if (req.body?.image) {
    const { status, body } = await reviewImage(req.body.image);
    return res.status(status).json(body);
  }

  // Sorting a kind act into an area (3.36, api/_sort.js) — not a check, nothing is published.
  if (req.body?.sort === "kind_act") {
    const area = await sortKindAct(String(req.body?.text ?? "").slice(0, MAX_ACT), sortWithModel);
    return res.status(200).json({ area });
  }

  const text = String(req.body?.text ?? "").trim().slice(0, MAX_LEN);
  const raw = req.body?.context;
  const context = ["feeling", "post", "post_anonymous"].includes(raw) ? raw : "reply";
  if (!text) return res.status(400).json({ error: "missing text" });

  // The reviewer itself lives in _screen.js since 3.21, because delivering a message to a
  // stranger's inbox screens it there too and the two must never disagree about what passes.
  return res.status(200).json(await screenText(text, context));
}
