// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.
//
// kindMoments.js — turning private kindnesses into one calm card a day (3.13).
//
// Every private reply writes an anonymous "kind moment": two countries, a time, nothing else
// (Feed2.jsx recordKindMoment). The feed used to show each as its own card with the same
// sentence, so three in a row filled half the screen and a busy day would have filled all of it.
//
// Now each day is ONE card, the same size however busy the day was:
//   • a header that carries the scale ("✨ 100 private kindnesses today · 10 countries");
//   • at most three rows — repeat pairs merged ("×12"), your own moments first, then the busiest,
//     then the most recent — each worded from a rotating set so it never reads the same twice;
//   • one summary line for everything else, pointing at the globe, which is built for volume;
//   • earlier days fold to a single line.
// Names, words and distances are deliberately absent. Pure functions; scripts/test-moments.mjs.

export const MAX_ROWS = 3;

const THE = new Set(["United Kingdom", "United States", "Netherlands", "Philippines", "United Arab Emirates", "Czech Republic", "Dominican Republic", "Bahamas", "Maldives", "Gambia"]);
const SHORT = { "United Kingdom": "UK", "United States": "US", "United Arab Emirates": "UAE" };

// "United Kingdom" → "the UK", "India" → "India".
export function placeName(country) {
  if (!country) return null;
  const n = SHORT[country] || country;
  return THE.has(country) ? `the ${n}` : n;
}
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// Lines for one moment, chosen by the moment's id so a row keeps its wording between renders but
// neighbouring rows differ. {A} and {B} are place names; a line may start with {A}.
const CROSS = [
  "A quiet thank-you went from {A} to {B}",
  "Kindness crossed from {A} to {B}",
  "Someone in {A} made someone in {B} feel seen",
  "A private word of kindness travelled from {A} to {B}",
  "{A} sent a little warmth to {B}",
];
const HOME = [
  "Close to home — two people in {A} made each other's day",
  "Two people in {A} shared a private word of kindness",
  "A kind word between neighbours in {A}",
];
const NOWHERE = ["Two people shared a private word of kindness", "Somewhere, someone made someone feel seen"];

const fill = (line, a, b) => {
  const out = line.replace("{A}", a ?? "").replace("{B}", b ?? "");
  return line.startsWith("{A}") ? cap(out) : out;
};

// One row's words. `segments` lets the card bold the place names without parsing a string.
export function rowLine(row, seed = "") {
  const a = placeName(row.aCountry), b = placeName(row.bCountry);
  // Rows of the same day are given consecutive variants (summarizeMoments), so no two of them
  // ever share a sentence; a lone moment falls back to its own key.
  const h = Number.isInteger(row.variant) ? row.variant : hash(`${seed}|${row.key}`);
  let line;
  if (!a || !b) line = NOWHERE[h % NOWHERE.length];
  else if (row.same) line = row.count > 1 ? `Close to home in ${a}` : fill(HOME[h % HOME.length], a);
  else line = row.count > 1 ? `${cap(a)} and ${b} kept it going` : fill(CROSS[h % CROSS.length], a, b);
  return { text: line, places: [a, b].filter(Boolean) };
}

export function ago(ts, now = Date.now()) {
  const m = Math.max(0, Math.round((now - Number(ts || 0)) / 60000));
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? "yesterday" : `${d} days ago`;
}

const dayKeyOf = (ts) => { const d = new Date(Number(ts) || 0); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; };

function dayLabel(ts, now) {
  const d = new Date(Number(ts) || 0);
  const today = new Date(now);
  const y = new Date(now); y.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === y.toDateString()) return "Yesterday";
  const diff = (today - d) / 86400000;
  if (diff < 7) return d.toLocaleDateString([], { weekday: "long" });
  return d.toLocaleDateString([], { day: "numeric", month: "short" });
}

// Merge a day's moments into rows: one per pair of countries (either direction), or per country
// for two people in the same place. The latest moment in a row decides its direction.
function rowsOf(moments, myUid) {
  const byKey = new Map();
  for (const m of moments) {
    const a = m.aCountry || null, b = m.bCountry || null;
    const same = Boolean(a && b && a === b);
    const key = !a || !b ? "unknown" : same ? `home:${a}` : [a, b].sort().join("|");
    let r = byKey.get(key);
    if (!r) { r = { key, same, count: 0, latest: 0, aCountry: a, bCountry: b, mine: false, id: m.id }; byKey.set(key, r); }
    r.count += 1;
    if (Number(m.ts) >= r.latest) { r.latest = Number(m.ts) || 0; r.aCountry = a; r.bCountry = b; r.id = m.id; }
    if (myUid && (m.aUid === myUid || m.bUid === myUid)) r.mine = true;
  }
  // Yours first (quietly — no badge), then the busiest pair, then the newest.
  return [...byKey.values()].sort((x, y) => (y.mine - x.mine) || (y.count - x.count) || (y.latest - x.latest));
}

// The feed's view of the moments: one entry per day, newest day first.
export function summarizeMoments(moments = [], { now = Date.now(), myUid = null, maxRows = MAX_ROWS } = {}) {
  const days = new Map();
  for (const m of moments) {
    if (!m || !Number(m.ts)) continue;
    const k = dayKeyOf(m.ts);
    if (!days.has(k)) days.set(k, []);
    days.get(k).push(m);
  }
  const out = [];
  for (const [key, list] of days) {
    const ts = Math.max(...list.map((m) => Number(m.ts) || 0));
    const countries = new Set(list.flatMap((m) => [m.aCountry, m.bCountry]).filter(Boolean));
    const rows = rowsOf(list, myUid);
    const base = hash(key);
    const shown = rows.slice(0, maxRows).map((r, i) => ({ ...r, variant: base + i }));
    const rest = rows.slice(maxRows);
    const restFlags = [...new Set(rest.flatMap((r) => [r.aCountry, r.bCountry]).filter(Boolean))];
    out.push({
      key, ts, label: dayLabel(ts, now), isToday: dayLabel(ts, now) === "Today",
      total: list.length, countries: countries.size, rows: shown,
      more: rest.length ? { count: rest.reduce((n, r) => n + r.count, 0), countries: restFlags } : null,
    });
  }
  return out.sort((a, b) => b.ts - a.ts);
}

// "100 private kindnesses today · 10 countries" / "1 kindness across 2 countries".
export function headline(day) {
  const n = day.total;
  const what = `${n} private ${n === 1 ? "kindness" : "kindnesses"}`;
  return day.isToday ? `${what} today` : what;
}
export function dayLine(day) {
  const n = day.total;
  const kind = `${n} ${n === 1 ? "kindness" : "kindnesses"}`;
  if (day.countries > 1) return `${kind} across ${day.countries} countries`;
  const only = day.rows[0]?.aCountry;
  return only ? `${kind} in ${placeName(only)}` : kind;
}
