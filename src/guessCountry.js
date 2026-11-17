// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.
//
// guessCountry.js — pre-select the country on sign-up (3.28).
//
// The sign-up form's country list starts at Afghanistan and has no search, so someone in the UK
// or India scrolled past about two hundred names — seconds of the first visit spent on a list. The
// phone already knows: its time zone (Europe/London, Asia/Kolkata) says where it is, and failing
// that, the region in its language setting (en-GB, hi-IN). Either gives a two-letter code; the
// app's flag map (MicroAnimations FLAG_MAP, passed in so this stays testable) turns a code back
// into the name the form uses — a flag emoji IS its two letters. A guess only ever pre-fills the
// list; the person can change it, and nothing is guessed when nothing is known.

// Time zones that belong to one country. Most of the world is covered by its largest cities;
// anything not here falls through to the language region.
const ZONE = {
  "Europe/London": "GB", "Europe/Belfast": "GB", "Europe/Dublin": "IE",
  "Asia/Kolkata": "IN", "Asia/Calcutta": "IN", "Asia/Karachi": "PK", "Asia/Dhaka": "BD", "Asia/Kathmandu": "NP", "Asia/Colombo": "LK",
  "Asia/Dubai": "AE", "Asia/Riyadh": "SA", "Asia/Qatar": "QA", "Asia/Singapore": "SG", "Asia/Kuala_Lumpur": "MY",
  "Asia/Manila": "PH", "Asia/Jakarta": "ID", "Asia/Bangkok": "TH", "Asia/Tokyo": "JP", "Asia/Seoul": "KR", "Asia/Shanghai": "CN",
  "Asia/Hong_Kong": "HK", "Asia/Ho_Chi_Minh": "VN",
  "Europe/Paris": "FR", "Europe/Berlin": "DE", "Europe/Madrid": "ES", "Europe/Rome": "IT", "Europe/Amsterdam": "NL",
  "Europe/Brussels": "BE", "Europe/Lisbon": "PT", "Europe/Stockholm": "SE", "Europe/Oslo": "NO", "Europe/Copenhagen": "DK",
  "Europe/Helsinki": "FI", "Europe/Warsaw": "PL", "Europe/Vienna": "AT", "Europe/Zurich": "CH", "Europe/Athens": "GR",
  "Europe/Istanbul": "TR", "Europe/Bucharest": "RO", "Europe/Prague": "CZ", "Europe/Budapest": "HU",
  "Africa/Lagos": "NG", "Africa/Nairobi": "KE", "Africa/Johannesburg": "ZA", "Africa/Cairo": "EG", "Africa/Accra": "GH",
  "Africa/Casablanca": "MA", "Africa/Algiers": "DZ",
  "America/New_York": "US", "America/Chicago": "US", "America/Denver": "US", "America/Los_Angeles": "US",
  "America/Phoenix": "US", "America/Anchorage": "US", "Pacific/Honolulu": "US", "America/Detroit": "US",
  "America/Toronto": "CA", "America/Vancouver": "CA", "America/Edmonton": "CA", "America/Winnipeg": "CA", "America/Halifax": "CA",
  "America/Mexico_City": "MX", "America/Sao_Paulo": "BR", "America/Argentina/Buenos_Aires": "AR", "America/Bogota": "CO",
  "America/Lima": "PE", "America/Santiago": "CL", "America/Jamaica": "JM",
  "Australia/Sydney": "AU", "Australia/Melbourne": "AU", "Australia/Brisbane": "AU", "Australia/Perth": "AU",
  "Australia/Adelaide": "AU", "Pacific/Auckland": "NZ",
};

// "🇬🇧" → "GB".
export function flagToCode(flag) {
  const pts = [...String(flag || "")].map((c) => c.codePointAt(0));
  if (pts.length !== 2 || pts.some((p) => p < 0x1F1E6 || p > 0x1F1FF)) return null;
  return pts.map((p) => String.fromCharCode(p - 0x1F1E6 + 65)).join("");
}

// The region in a language tag: "en-GB" → "GB", "zh-Hant-TW" → "TW", "en" → null.
export function regionOf(tag) {
  const parts = String(tag || "").split(/[-_]/).slice(1);
  const r = parts.find((p) => /^[A-Za-z]{2}$/.test(p));
  return r ? r.toUpperCase() : null;
}

export function guessCountry({ timeZone = null, languages = [], options = [], flagMap = {} } = {}) {
  const byCode = new Map();
  for (const [name, flag] of Object.entries(flagMap || {})) {
    const code = flagToCode(flag);
    if (code && options.includes(name) && !byCode.has(code)) byCode.set(code, name);
  }
  const fromZone = ZONE[timeZone] || null;
  if (fromZone && byCode.has(fromZone)) return byCode.get(fromZone);
  for (const tag of Array.isArray(languages) ? languages : []) {
    const r = regionOf(tag);
    if (r && byCode.has(r)) return byCode.get(r);
  }
  return null;
}

// What this device says, for the form.
export function deviceHints() {
  let timeZone = null, languages = [];
  try { timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || null; } catch { /* ignore */ }
  try { languages = navigator.languages?.length ? [...navigator.languages] : (navigator.language ? [navigator.language] : []); } catch { /* ignore */ }
  return { timeZone, languages };
}
