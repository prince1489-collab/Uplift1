// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.
//
// klipy.js — GIF search, from a catalogue somebody else has already rated.
//
// ── WHY KLIPY AND NOT TENOR ──────────────────────────────────────────────────────────────────
// This was written against Tenor first, which was a mistake: Google closed Tenor to new API
// clients on 13 January 2026 and shut the public API down entirely on 30 June 2026. X, Discord,
// WhatsApp and Bluesky all had to migrate. Searching the Google Cloud API Library for "Tenor"
// now returns nothing, because there is nothing to return.
//
// Klipy is where that migration went. It is built by the ex-Tenor founders and engineering team
// as a near drop-in replacement, WhatsApp is replacing Tenor with it, and it already backs
// Canva, Figma, Miro and Outlook. It has a lifetime-free tier.
//
// ── WHY A THIRD-PARTY CATALOGUE AND NOT UPLOADS ──────────────────────────────────────────────
// A GIF from Klipy is a link to Klipy's CDN. The bytes are never ours, never enter our bucket,
// and were rated before we saw them. A photo from a user's camera roll is the opposite of all
// three, and on a 13+ app that difference is not one of degree — hosting user-chosen images
// carries an illegal-imagery reporting duty that a link to a pre-rated catalogue does not.
//
// The safety argument only holds while the bytes really do come from that catalogue, which is
// why firestore.rules pins the stored URL to Klipy's CDN rather than trusting this file.
//
// ── NO SERVERLESS PROXY, DELIBERATELY ────────────────────────────────────────────────────────
// This calls Klipy straight from the client, so the app key ships in the bundle. api/README.md
// records why there is no route: the Vercel function limit is already reached, a 13th function
// fails the BUILD rather than the request, and `npm run build` never touches api/ — so it passes
// locally every time and only appears on Vercel, silently serving the previous deploy.
//
// Unlike the Tenor version this replaces, the key is a KLIPY app key rather than a Google Cloud
// API key. That removes a real hazard rather than a theoretical one: a Google key minted in
// uplift-6d9ea could, without API restrictions, reach Firestore, Identity Toolkit, FCM and the
// Play Developer API. A Klipy key can reach Klipy. Nothing about this key touches Firebase.

const KEY = import.meta.env.VITE_KLIPY_KEY;

const BASE = "https://api.klipy.com/api/v1";

// SAFE SEARCH. A CONSTANT, not an argument — the single most important line in this file.
//
// Every safety claim made about GIFs anywhere in this codebase reduces to "someone else rated
// the catalogue and we asked for the strictest tier". A call site that could pass its own value
// would make that claim depend on every future caller remembering to; sooner or later one would
// not, and nothing would look wrong until something inappropriate was in a 13-year-old's feed.
//
// Klipy accepts high | medium | low | off and DEFAULTS TO MEDIUM, so leaving it out is not
// neutral — it is a choice, and the wrong one here.
const CONTENT_FILTER = "high";

// Only GIFs. Klipy also serves clips, memes and stickers; this app has its own sticker set.
const FORMAT_FILTER = "gif";

// Klipy clamps per_page to 8–50.
const PER_PAGE = 24;

// Klipy returns each item at four quality tiers. Take a middle tier for the thing that gets
// posted and a small one for the picker grid, falling back through the rest so an item missing
// a tier still renders rather than vanishing.
const FULL_QUALITY_ORDER = ["md", "hd", "sm", "xs"];
const PREVIEW_QUALITY_ORDER = ["sm", "xs", "md", "hd"];

export function isKlipyConfigured() {
  return typeof KEY === "string" && KEY.length > 0;
}

function pickGif(item, order) {
  for (const quality of order) {
    const format = item?.file?.[quality]?.gif;
    if (format?.url) return format;
  }
  return null;
}

// Klipy's shape → ours. One place, so nothing downstream knows what `file.md.gif.url` is and a
// change at their end lands in a single function.
function normalise(item) {
  // SPONSORED ITEMS ARE DROPPED. Klipy's free tier interleaves ads into results as
  // `type: "ad"`, which is how the tier is free. An advert inside the compose flow of a
  // wellbeing app used by 13-year-olds is not something to let through by omission — if it is
  // ever wanted it should be a decision someone makes, not a default nobody noticed.
  if (item?.type !== "gif") return null;

  const full = pickGif(item, FULL_QUALITY_ORDER);
  const preview = pickGif(item, PREVIEW_QUALITY_ORDER);
  // Dropped rather than rendered half-working: no preview is a blank tile in the grid, and no
  // full gif is a tile that does nothing when tapped.
  if (!full || !preview) return null;

  return {
    id: String(item.slug || item.id || ""),
    url: full.url,
    previewUrl: preview.url,
    width: Number(full.width) || 0,
    height: Number(full.height) || 0,
    // Used as the img alt, so a screen reader says something better than "image", and stored
    // with the message so the description survives without another Klipy call on every render.
    description: String(item.title || item.tags?.[0] || "GIF").slice(0, 140),
  };
}

// The app key is a PATH SEGMENT, not a query parameter — Klipy's scheme is
// /{appKey}/gifs/{endpoint}. Encoded, because it lands in a URL path.
function endpointUrl(endpoint, params) {
  const url = new URL(`${BASE}/${encodeURIComponent(KEY)}/gifs/${endpoint}`);
  const merged = {
    page: "1",
    per_page: String(PER_PAGE),
    format_filter: FORMAT_FILTER,
    content_filter: CONTENT_FILTER,
    ...params,
  };
  for (const [k, v] of Object.entries(merged)) url.searchParams.set(k, v);
  return url.toString();
}

async function request(endpoint, params, signal) {
  if (!isKlipyConfigured()) return [];

  const res = await fetch(endpointUrl(endpoint, params), { signal });

  let body;
  try {
    body = await res.json();
  } catch {
    // Non-JSON (a gateway error, say) — handled below.
  }

  // Klipy signals a bad app key with HTTP 404 AND result:false, so the envelope is more
  // trustworthy than the status code. Treating 404 as "no results" would turn a wrong key into
  // a permanently empty picker with nothing in the console to explain it.
  if (!res.ok || !body || body.result === false) {
    const reason = Array.isArray(body?.errors?.message) ? body.errors.message.join(" ") : null;
    throw new Error(reason || `klipy_${res.status}`);
  }

  return (body?.data?.data ?? []).map(normalise).filter(Boolean);
}

// What the picker shows before anyone types, so the sheet is never an empty box asking for input.
export function featuredGifs(signal) {
  return request("trending", {}, signal);
}

// `signal` is not optional in practice: the picker searches as you type, and without aborting
// the previous request an early slow response can land after a later fast one and repaint the
// grid with results for a query the user has already moved on from.
export function searchGifs(query, signal) {
  const q = String(query || "").trim();
  if (!q) return featuredGifs(signal);
  return request("search", { q }, signal);
}
