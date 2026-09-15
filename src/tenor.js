// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.
//
// tenor.js — GIF search, from a catalogue somebody else has already rated.
//
// WHY A THIRD-PARTY CATALOGUE AND NOT UPLOADS. A GIF from Tenor is a link to Tenor's CDN. The
// bytes are never ours, never enter our bucket, and were rated before we saw them. A photo from
// a user's camera roll is the opposite of all three, and on a 13+ app the difference is not one
// of degree — hosting user-chosen images carries an illegal-imagery reporting duty that a link
// to a pre-rated catalogue does not. That is the entire reason GIFs ship first and separately.
//
// The safety argument only holds while the bytes really do come from that catalogue, which is
// why firestore.rules pins the stored URL to Tenor's CDN rather than trusting this file.
//
// ── NO SERVERLESS PROXY, DELIBERATELY ────────────────────────────────────────────────────────
// This calls Tenor straight from the client, which means the API key ships in the bundle. That
// is a real trade and it was made for a specific reason: api/README.md records that the Vercel
// plan's function limit is already reached, that a 13th function fails the BUILD rather than the
// request, and that `npm run build` never touches api/ — so the failure passes locally every
// time and only appears on Vercel, where it silently serves the previous deploy. That has
// already cost this project two commits that looked live and were not.
//
// What an exposed key is worth to somebody who takes it: read-only GIF search against a free
// quota. No user data, no writes, nothing about anybody. It is quota theft, not a breach, and
// it is why Tenor's own documentation shows client-side use. Restrict it by HTTP referrer in
// the Google Cloud console and the quota is protected too. See DEPLOY.md.
//
// If the function budget is ever freed — retiring api/goodnews.js would do it — moving this
// behind a route is a small change: the two exported functions are the whole surface.

const KEY = import.meta.env.VITE_TENOR_KEY;

// Identifies this app to Tenor for quota and analytics. Not a secret.
const CLIENT_KEY = "seen_app";

const BASE = "https://tenor.googleapis.com/v2";

// G-rated only. A CONSTANT, not an argument — the single most important line in this file.
//
// Every safety claim made about GIFs anywhere in this codebase reduces to "someone else rated
// the catalogue and we asked for the safest tier". A call site that could pass its own value
// would make that claim depend on every future caller remembering to; sooner or later one
// would not, and nothing would look wrong until something inappropriate was in a 13-year-old's
// feed. There is no legitimate reason for any screen in Seen to want a looser filter.
const CONTENT_FILTER = "high";

// Only the two formats that get used: the full GIF, and a small one for the picker grid.
// Without this Tenor returns every format it has, which is a much larger response for no gain.
const MEDIA_FILTER = "gif,tinygif";

const LIMIT = 24;

export function isTenorConfigured() {
  return typeof KEY === "string" && KEY.length > 0;
}

// Tenor's shape → ours. Kept in one place so nothing downstream has to know what
// `media_formats.tinygif.dims` is, and so a change at their end lands in a single function.
//
// A result missing either format is DROPPED rather than rendered half-working: no preview means
// a blank tile in the grid, and no gif means a tile that does nothing when tapped.
function normalise(result) {
  const full = result?.media_formats?.gif;
  const preview = result?.media_formats?.tinygif;
  if (!full?.url || !preview?.url) return null;

  const [w, h] = Array.isArray(full.dims) && full.dims.length === 2 ? full.dims : [0, 0];
  return {
    id: String(result.id ?? ""),
    url: full.url,
    previewUrl: preview.url,
    width: Number(w) || 0,
    height: Number(h) || 0,
    // Tenor's own alt text. Used as the img alt, so a screen reader says something better than
    // "image", and stored with the message so the description survives without a Tenor call.
    description: String(result.content_description || result.title || "GIF").slice(0, 140),
  };
}

async function fetchTenor(path, params, signal) {
  if (!isTenorConfigured()) return [];

  const qs = new URLSearchParams({
    key: KEY,
    client_key: CLIENT_KEY,
    contentfilter: CONTENT_FILTER,
    media_filter: MEDIA_FILTER,
    limit: String(LIMIT),
    ...params,
  });

  const res = await fetch(`${BASE}/${path}?${qs}`, { signal });
  if (!res.ok) throw new Error(`tenor_${res.status}`);
  const data = await res.json();
  return (Array.isArray(data?.results) ? data.results : []).map(normalise).filter(Boolean);
}

// What the picker shows before anyone types. Tenor's curated front page, same G-rated filter.
export function featuredGifs(signal) {
  return fetchTenor("featured", {}, signal);
}

// `signal` is not optional in practice: the picker searches as you type, and without aborting
// the previous request an early slow response can land after a later fast one and repaint the
// grid with results for a query the user has already moved on from.
export function searchGifs(query, signal) {
  const q = String(query || "").trim();
  if (!q) return featuredGifs(signal);
  return fetchTenor("search", { q }, signal);
}
