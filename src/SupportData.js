// SupportData.js — helplines and emergency numbers by country (3.31: helplines only).
//
// Until 3.31 this also held clinical questionnaires (PHQ-9, GAD-7, loneliness, stress, burnout),
// their scoring, coping tips by severity and paid-app suggestions. A non-clinical app shouldn't
// score anyone's wellbeing, so they're gone; scripts/check-no-scores.cjs keeps them out.

// ── Country resources ─────────────────────────────────────────────────────────

const GLOBAL = {
  crisis: [
    { name: "International Association for Suicide Prevention", url: "https://www.iasp.info/resources/Crisis_Centres/", phone: null },
  ],
  mental: [
    { name: "7 Cups (free online chat)", url: "https://www.7cups.com", phone: null },
    { name: "MindLine (free anonymous chat)", url: "https://mindhealthconnect.com", phone: null },
  ],
};

export const COUNTRY_RESOURCES = {
  "United Kingdom": {
    crisis: [
      { name: "Samaritans", phone: "116 123", url: "https://www.samaritans.org", free: true },
      { name: "SHOUT (text)", phone: "Text SHOUT to 85258", url: "https://giveusashout.org", free: true },
      { name: "Crisis Team (NHS 111 opt 2)", phone: "111", url: "https://www.nhs.uk/mental-health/", free: true },
    ],
    mental: [
      { name: "Mind", url: "https://www.mind.org.uk", phone: "0300 123 3393" },
      { name: "NHS Every Mind Matters", url: "https://www.nhs.uk/every-mind-matters/", phone: null },
      { name: "Rethink Mental Illness", url: "https://www.rethink.org", phone: "0300 5000 927" },
      { name: "CALM (men)", url: "https://www.thecalmzone.net", phone: "0800 58 58 58" },
    ],
  },
  "United States": {
    crisis: [
      { name: "988 Suicide & Crisis Lifeline", phone: "988", url: "https://988lifeline.org", free: true },
      { name: "Crisis Text Line", phone: "Text HOME to 741741", url: "https://www.crisistextline.org", free: true },
    ],
    mental: [
      { name: "NAMI Helpline", url: "https://nami.org", phone: "1-800-950-6264" },
      { name: "SAMHSA National Helpline", url: "https://www.samhsa.gov/find-help/national-helpline", phone: "1-800-662-4357" },
      { name: "MentalHealth.gov", url: "https://www.mentalhealth.gov", phone: null },
    ],
  },
  "Canada": {
    crisis: [
      { name: "Talk Suicide Canada", phone: "1-833-456-4566", url: "https://talksuicide.ca", free: true },
      { name: "Crisis Text Line CA", phone: "Text HOME to 686868", url: "https://www.crisistextline.ca", free: true },
    ],
    mental: [
      { name: "CAMH", url: "https://www.camh.ca", phone: null },
      { name: "Canadian Mental Health Association", url: "https://cmha.ca", phone: null },
    ],
  },
  "Australia": {
    crisis: [
      { name: "Lifeline", phone: "13 11 14", url: "https://www.lifeline.org.au", free: true },
      { name: "Beyond Blue", phone: "1300 22 4636", url: "https://www.beyondblue.org.au", free: true },
    ],
    mental: [
      { name: "Head to Health", url: "https://www.headtohealth.gov.au", phone: null },
      { name: "Black Dog Institute", url: "https://www.blackdoginstitute.org.au", phone: null },
      { name: "SANE Australia", url: "https://www.sane.org", phone: "1800 187 263" },
    ],
  },
  "India": {
    crisis: [
      { name: "iCall", phone: "9152987821", url: "https://icallhelpline.org", free: true },
      { name: "Vandrevala Foundation", phone: "1860-2662-345", url: "https://vandrevalafoundation.com", free: true },
    ],
    mental: [
      { name: "Sangath", url: "https://sangath.in", phone: null },
      { name: "The Mind Research Foundation", url: "https://mindresearchfoundation.org", phone: null },
    ],
  },
  "South Africa": {
    crisis: [
      { name: "SADAG", phone: "0800 456 789", url: "https://www.sadag.org", free: true },
      { name: "Lifeline SA", phone: "0861 322 322", url: "https://lifelinesa.co.za", free: true },
    ],
    mental: [
      { name: "SADAG Mental Health Line", url: "https://www.sadag.org", phone: "011 234 4837" },
    ],
  },
  "Ireland": {
    crisis: [
      { name: "Samaritans Ireland", phone: "116 123", url: "https://www.samaritans.org/ireland/", free: true },
      { name: "Crisis Text Line Ireland", phone: "Text HELLO to 50808", url: "https://www.crisistextline.ie", free: true },
    ],
    mental: [
      { name: "Aware (depression/bipolar)", url: "https://www.aware.ie", phone: "1800 80 48 48" },
      { name: "Mental Health Ireland", url: "https://www.mentalhealthireland.ie", phone: null },
    ],
  },
  "New Zealand": {
    crisis: [
      { name: "Lifeline NZ", phone: "0800 543 354", url: "https://www.lifeline.org.nz", free: true },
      { name: "1737 Need to Talk", phone: "1737", url: "https://1737.org.nz", free: true },
    ],
    mental: [
      { name: "Mental Health Foundation NZ", url: "https://www.mentalhealth.org.nz", phone: null },
    ],
  },
  "Nigeria": {
    crisis: [
      { name: "SURPIN", phone: "0800-SURPIN-1", url: "https://surpinng.org", free: true },
    ],
    mental: [
      { name: "She Writes Woman", url: "https://shewriteswoman.org", phone: null },
      { name: "Mental Health Foundation Nigeria", url: "https://mhfnigeria.org", phone: null },
    ],
  },
};

// Normalise common UK/other aliases so a crisis-moment lookup never silently
// misses a country and drops the user to a phone-less GLOBAL fallback.
const COUNTRY_ALIASES = {
  "uk": "United Kingdom", "u.k.": "United Kingdom", "gb": "United Kingdom",
  "great britain": "United Kingdom", "britain": "United Kingdom",
  "england": "United Kingdom", "scotland": "United Kingdom",
  "wales": "United Kingdom", "northern ireland": "United Kingdom",
  "usa": "United States", "us": "United States", "u.s.": "United States",
  "u.s.a.": "United States", "america": "United States",
};

// Resolve a stored country string to a key in COUNTRY_RESOURCES, or null if we don't
// cover it. Shared by getResources and getEmergency so both agree on aliases.
export function resolveCountry(countryName) {
  if (countryName && COUNTRY_RESOURCES[countryName]) return countryName;
  const aliased = COUNTRY_ALIASES[(countryName || "").trim().toLowerCase()];
  return aliased && COUNTRY_RESOURCES[aliased] ? aliased : null;
}

// Emergency service numbers for the countries we cover. Showing the wrong country's
// emergency number is worse than showing none, so anything unresolved returns null and
// the caller falls back to wording that works anywhere.
export const EMERGENCY_NUMBERS = {
  "United Kingdom": "999",
  "United States": "911",
  "Canada": "911",
  "Australia": "000",
  "India": "112",
  "South Africa": "112",
  "Ireland": "112",
  "New Zealand": "111",
  "Nigeria": "112",
};
export function getEmergency(countryName) {
  const key = resolveCountry(countryName);
  return key ? (EMERGENCY_NUMBERS[key] ?? null) : null;
}

export function getResources(countryName) {
  const key = resolveCountry(countryName);
  if (key) return COUNTRY_RESOURCES[key];
  return GLOBAL;
}


// "116 123" → tel:116123; "Text SHOUT to 85258" → an SMS with the keyword; anything else, the site.
export function contactHref(r) {
  const p = String(r?.phone || "").trim();
  const text = p.match(/^text\s+(\S+)\s+to\s+([+\d][\d\s]*)$/i);
  if (text) return `sms:${text[2].replace(/\s/g, "")}?body=${encodeURIComponent(text[1])}`;
  if (/^[+\d][\d\s-]*$/.test(p)) return `tel:${p.replace(/[\s-]/g, "")}`;
  return r?.url || null;
}
