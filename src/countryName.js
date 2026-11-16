// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.
//
// countryName.js — "in the United Kingdom", not "in United Kingdom" (3.21).
//
// Country names come from the onboarding list (COUNTRY_OPTIONS), and a handful of them read as
// English only with "the" in front. Used wherever a sentence puts someone in a place: "Mahiman in
// the United Kingdom sent you a few kind words", "Your words reached someone in the Philippines".
// api/_kindness.js keeps the same list for the push it sends; scripts/test-kindness.mjs checks
// the two agree.
export const TAKES_THE = new Set([
  "United Kingdom", "United States", "United Arab Emirates", "Netherlands", "Philippines",
  "Czech Republic", "Dominican Republic", "Central African Republic", "Bahamas", "Gambia",
  "Maldives", "Marshall Islands", "Solomon Islands", "Comoros", "Seychelles",
]);

export function inCountry(country) {
  const name = String(country || "").trim();
  if (!name) return "";
  return TAKES_THE.has(name) ? `the ${name}` : name;
}
