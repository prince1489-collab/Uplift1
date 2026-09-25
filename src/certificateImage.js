// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.
//
// certificateImage.js — draws a kindness certificate to a PNG, for sharing.
//
// ── PLAIN CANVAS, NO LIBRARY, NO CDN ─────────────────────────────────────────────────────────
// There is one existing image-share in this app (ProfileCard.handleShare) and it injects
// html2canvas from cdnjs at the moment the button is pressed. That is a network dependency at
// exactly the wrong time: the person is on a train, taps Share, and nothing happens — inside a
// bare `catch {}`, so not even an error.
//
// This app is a BUNDLED Capacitor build. Everything it needs should already be on the device.
// Canvas 2D draws this in about eighty lines and is available everywhere, offline, always; and
// imagePrep.js already establishes canvas → toBlob in this codebase.
//
// ── THE SHAPE IS THE SHARE TARGET ────────────────────────────────────────────────────────────
// 1080×1350 is the 4:5 portrait that Instagram, WhatsApp status and Messages all accept without
// cropping. A square would be safer still but wastes the vertical room this layout wants.

const W = 1080;
const H = 1350;

// The app's own palette, from the tailwind.config in index.html. Written out longhand because
// this file cannot read CSS — and noted here so that if the rebrand moves, someone finds this.
const INK = "#5b2a28";
const ACCENT = "#A82E2C";   // teal-700 in the remapped palette
const MUTED = "#8a6f69";
const EDGE = "#FFD4B0";     // emerald-200

// Shrink to fit, then ellipsize. A name is the one thing on this card the app does not control,
// and "Bartholomew Featherstonehaugh" running off the edge of something somebody posts publicly
// is the failure that matters here.
function fitText(ctx, text, maxWidth, weight, startPx, minPx, family) {
  let size = startPx;
  const set = (px) => { ctx.font = `${weight} ${px}px ${family}`; };
  set(size);
  while (size > minPx && ctx.measureText(text).width > maxWidth) {
    size -= 2;
    set(size);
  }
  if (ctx.measureText(text).width <= maxWidth) return text;
  let out = text;
  while (out.length > 1 && ctx.measureText(`${out}…`).width > maxWidth) out = out.slice(0, -1);
  return `${out}…`;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// The app icon, drawn at the top instead of the certificate's own emoji.
//
// It lives in public/, so a root-relative path is right on the web AND in the Capacitor build,
// where it resolves against the bundle rather than the network — the same reasoning apiBase.js
// spells out, pointing the other way. Same origin either way, so the canvas is not tainted and
// toBlob still works.
//
// Resolves to null rather than rejecting: a certificate with the leaf emoji on it is a fine
// certificate, and an image that failed to decode must not cost somebody their share.
function loadIcon(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

// `days` is the TRUE count and is what the card states. `title` is the friendly name the app
// uses in its own list ("2 months"); it is deliberately not printed as a claim about elapsed
// time — see the note at the top of certificates.js.
//
// `iconSrc` is overridable only so scripts can render this outside the app, where a root-relative
// path has nothing to resolve against. Nothing in the app passes it.
export async function drawCertificate({ name, days, emoji, since, iconSrc = "/icon-512.png" }) {
  // Without this the first draw measures against a fallback face and the layout shifts on the
  // second one — which, on a card that is generated once and shared, means shipping the wrong one.
  try { await document.fonts?.ready; } catch { /* a browser without the API just draws */ }

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas_unavailable");

  const sans = "Inter, system-ui, sans-serif";
  const serif = "'DM Serif Display', Georgia, serif";

  const bg = ctx.createLinearGradient(0, 0, W * 0.4, H);
  bg.addColorStop(0, "#FEF2F8");
  bg.addColorStop(0.55, "#FFF6EF");
  bg.addColorStop(1, "#FFF1F0");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = EDGE;
  ctx.lineWidth = 4;
  roundRect(ctx, 56, 56, W - 112, H - 112, 48);
  ctx.stroke();

  ctx.textAlign = "center";
  const mid = W / 2;

  // The mark, clipped to its own radius. Clipped rather than trusted: whether the source PNG's
  // corners are transparent or cream is not something this function should have an opinion about,
  // and a square corner on a warm gradient is the one thing that would make this look pasted on.
  const icon = await loadIcon(iconSrc);
  if (icon) {
    const S = 250;          // big enough to read as the app's mark, not a favicon
    const ix = (W - S) / 2;
    const iy = 95;
    ctx.save();
    roundRect(ctx, ix, iy, S, S, 48);
    ctx.clip();
    ctx.drawImage(icon, ix, iy, S, S);
    ctx.restore();
  } else {
    ctx.font = `120px ${sans}`;
    ctx.fillText(emoji || "🌿", mid, 300);
  }

  ctx.fillStyle = MUTED;
  ctx.font = `700 26px ${sans}`;
  const eyebrow = "CERTIFICATE OF KINDNESS";
  ctx.letterSpacing = "8px";           // ignored where unsupported; the layout does not depend on it
  ctx.fillText(eyebrow, mid, 400);   // 10px lower than it was, for the larger mark above it
  ctx.letterSpacing = "0px";

  ctx.fillStyle = INK;
  ctx.font = `400 34px ${sans}`;
  ctx.fillText("This is to say that", mid, 500);

  ctx.fillStyle = ACCENT;
  const shown = fitText(ctx, (name || "A kind person").trim(), W - 220, 400, 92, 44, serif);
  ctx.fillText(shown, mid, 600);

  ctx.fillStyle = INK;
  ctx.font = `400 34px ${sans}`;
  ctx.fillText("has shown up for kindness on", mid, 690);

  ctx.fillStyle = ACCENT;
  ctx.font = `800 150px ${sans}`;
  ctx.fillText(String(days), mid, 850);

  ctx.fillStyle = INK;
  ctx.font = `600 42px ${sans}`;
  ctx.fillText(days === 1 ? "day" : "separate days", mid, 915);

  if (since) {
    ctx.fillStyle = MUTED;
    ctx.font = `400 30px ${sans}`;
    ctx.fillText(`since ${since}`, mid, 985);
  }

  ctx.strokeStyle = EDGE;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(mid - 160, 1075);
  ctx.lineTo(mid + 160, 1075);
  ctx.stroke();

  ctx.fillStyle = ACCENT;
  ctx.font = `400 64px ${serif}`;
  ctx.fillText("Seen", mid, 1160);

  ctx.fillStyle = MUTED;
  ctx.font = `600 26px ${sans}`;
  ctx.fillText("seenapp.app", mid, 1210);

  // ── IF THE MARK EVER TAINTS THE CANVAS, DROP THE MARK, NOT THE CERTIFICATE ─────────────────
  // The icon is same-origin in every real build — served from public/ on the web, resolved
  // against the bundle under capacitor:// and https://localhost on the phones — so this should
  // not fire. But a tainted canvas makes toBlob THROW, and the failure that would produce is
  // "Couldn't draw your certificate just now" on a screen somebody opened to celebrate
  // something. That trade is not worth a logo.
  //
  // So: try the real thing; if the export is refused, wipe the icon area back to the background
  // and export that instead. A certificate with a plain top is still a certificate.
  try {
    const blob = await new Promise((resolve, reject) => {
      try { canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode_failed"))), "image/png"); }
      catch (err) { reject(err); }
    });
    return blob;
  } catch (err) {
    if (!icon) throw err;   // nothing to blame but the encoder — let the caller hear it
    console.error("[certificate] icon tainted the canvas, falling back:", err?.message);
    ctx.save();
    ctx.fillStyle = bg;
    ctx.fillRect(0, 100, W, 250);
    ctx.restore();
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("encode_failed");
    return blob;
  }
}
