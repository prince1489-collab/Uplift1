// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.
//
// imagePrep.js — turn a file somebody picked off their phone into bytes this app is willing to
// publish, BEFORE anything else touches it.
//
// ── WHY A RE-ENCODE RATHER THAN A VALIDATION ─────────────────────────────────────────────────
// The obvious version of this file inspects the file and says yes or no. This one throws the
// user's file away and keeps only its pixels, which does four separate jobs at once — and each
// of the four is the answer to a real problem in this codebase:
//
//   1. EXIF, INCLUDING GPS. A photo taken on a phone carries the coordinates it was taken at.
//      Avatars are world-readable (storage.rules says so, deliberately, because they appear next
//      to every message), so until now "add a profile picture" could mean "publish my address".
//      A canvas copies pixels. Metadata does not survive the trip.
//
//   2. THE POLYGLOT. storage.rules:27 already worries in writing about avatar.html reaching the
//      bucket, because the extension comes from the END OF THE USER'S FILENAME and the content
//      type comes from the file. The rule refuses it; this refuses to ever hold the bytes. A file
//      that is both a valid JPEG and something else stops being both the moment it is decoded and
//      re-drawn, because what gets uploaded is our output, not their input.
//
//   3. SIZE. Vercel caps a serverless request body at 4.5MB and Anthropic caps an image at 5MB;
//      an unmodified phone photo is comfortably capable of breaking the first. At 1024px on the
//      long edge a JPEG is a couple of hundred kilobytes, so neither limit is anywhere near.
//
//   4. HONESTY ABOUT WHAT WAS SCREENED. The blob returned here is both what gets reviewed and
//      what gets uploaded. If the file were screened and the ORIGINAL then uploaded, the review
//      would be of a different set of bytes than the ones that end up public — a gap that is
//      invisible in testing and is the whole ballgame in an attack.
//
// ── THE SIZE OF THE LONG EDGE ────────────────────────────────────────────────────────────────
// 1024 is far more than an avatar needs (the largest one rendered anywhere in the app is 160
// CSS px, ProfilePhotoStep's upload circle) and is what Anthropic's vision guidance treats as
// plenty for a judgement about content. Smaller would save bytes and start costing the reviewer
// detail; larger would buy a sharper picture nobody looks at.

// Long edge, in pixels, of what we keep.
const MAX_EDGE = 1024;
// JPEG quality. 0.85 is the usual "no visible loss at this size" setting.
const QUALITY = 0.85;
// Everything downstream is JPEG — one type through the API, one type in the bucket, one
// contentType on the object. See the allowlist in api/moderate-message.js.
export const PREPARED_TYPE = "image/jpeg";

// Base64 of the blob, without the `data:...;base64,` preamble — which is the shape the Anthropic
// image block wants, and also the shape that keeps the media type out of the payload twice.
function toBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read failed"));
    reader.onload = () => {
      const s = String(reader.result || "");
      const comma = s.indexOf(",");
      if (comma < 0) { reject(new Error("unexpected data url")); return; }
      resolve(s.slice(comma + 1));
    };
    reader.readAsDataURL(blob);
  });
}

// Decode → scale → re-encode. Rejects if the file is not something the browser can decode as an
// image at all, which is a stronger statement than checking file.type: the type is whatever the
// OS said, and createImageBitmap has to actually parse it.
//
// Returns { blob, base64, mediaType, width, height, previewUrl }. previewUrl is an object URL of
// the PREPARED blob, so what the user sees in the sheet is what was screened and what will be
// uploaded — the caller owns it and should revokeObjectURL when it swaps or closes.
export async function prepareImage(file) {
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("decode_failed");
  }

  const { width: sw, height: sh } = bitmap;
  if (!sw || !sh) { bitmap.close?.(); throw new Error("decode_failed"); }

  // Scale down only. Blowing a small avatar up to 1024 would add bytes and no detail.
  const scale = Math.min(1, MAX_EDGE / Math.max(sw, sh));
  const w = Math.max(1, Math.round(sw * scale));
  const h = Math.max(1, Math.round(sh * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) { bitmap.close?.(); throw new Error("decode_failed"); }
  // A transparent PNG flattened to JPEG goes black without this; white is what every surface
  // the avatar sits on is anyway.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, PREPARED_TYPE, QUALITY));
  if (!blob) throw new Error("encode_failed");

  return {
    blob,
    base64: await toBase64(blob),
    mediaType: PREPARED_TYPE,
    width: w,
    height: h,
    previewUrl: URL.createObjectURL(blob),
  };
}
