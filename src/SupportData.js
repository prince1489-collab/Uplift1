// Mental health support data: questionnaires, scoring, resources, affiliates

export const CONDITIONS = [
  {
    id: "depression",
    label: "Low mood / Depression",
    emoji: "🌧️",
    color: "#6366f1",
    gradient: "from-indigo-500 to-violet-600",
    description: "Feeling down, hopeless, or losing interest in things you used to enjoy",
    questionnaire: "PHQ-9",
  },
  {
    id: "anxiety",
    label: "Worry / Anxiety",
    emoji: "🌀",
    color: "#0ea5e9",
    gradient: "from-sky-500 to-blue-600",
    description: "Feeling nervous, on edge, or unable to stop worrying",
    questionnaire: "GAD-7",
  },
  {
    id: "loneliness",
    label: "Loneliness",
    emoji: "🫂",
    color: "#8b5cf6",
    gradient: "from-violet-500 to-purple-600",
    description: "Feeling disconnected, isolated, or like no one truly understands you",
    questionnaire: "UCLA-3",
  },
  {
    id: "stress",
    label: "Stress / Overwhelm",
    emoji: "⚡",
    color: "#f59e0b",
    gradient: "from-amber-500 to-orange-500",
    description: "Feeling unable to cope, overwhelmed by demands, or losing control",
    questionnaire: "PSS-4",
  },
  {
    id: "burnout",
    label: "Burnout",
    emoji: "🪫",
    color: "#ef4444",
    gradient: "from-red-500 to-rose-600",
    description: "Exhausted, detached, or feeling like nothing you do makes a difference",
    questionnaire: "BURNOUT-5",
  },
  {
    id: "unsure",
    label: "Not sure — help me find out",
    emoji: "🔍",
    color: "#64748b",
    gradient: "from-slate-500 to-slate-600",
    description: "Not sure what you're feeling? Answer a short triage to find the right pathway",
    questionnaire: "TRIAGE",
  },
];

// ── Questionnaires ────────────────────────────────────────────────────────────

export const QUESTIONNAIRES = {
  "PHQ-9": {
    title: "Low mood check-in",
    instruction: "Over the last 2 weeks, how often have you been bothered by the following problems?",
    options: ["Not at all", "Several days", "More than half the days", "Nearly every day"],
    scores: [0, 1, 2, 3],
    questions: [
      "Little interest or pleasure in doing things",
      "Feeling down, depressed, or hopeless",
      "Trouble falling or staying asleep, or sleeping too much",
      "Feeling tired or having little energy",
      "Poor appetite or overeating",
      "Feeling bad about yourself — or that you are a failure",
      "Trouble concentrating on things, such as reading or watching TV",
      "Moving or speaking so slowly that other people could have noticed, or the opposite — being so fidgety or restless that you have been moving a lot more than usual",
      "Thoughts that you would be better off dead, or of hurting yourself in some way",
    ],
    crisisQuestion: 8, // index of Q9
    score(answers) {
      return answers.reduce((s, a) => s + a, 0);
    },
    severity(total) {
      if (total <= 4) return { level: "minimal", label: "Minimal", color: "#22c55e" };
      if (total <= 9) return { level: "mild", label: "Mild", color: "#84cc16" };
      if (total <= 14) return { level: "moderate", label: "Moderate", color: "#f59e0b" };
      if (total <= 19) return { level: "moderateSevere", label: "Moderately Severe", color: "#f97316" };
      return { level: "severe", label: "Severe", color: "#ef4444" };
    },
    crisisThreshold: 1, // any score > 0 on Q9 = crisis pathway
  },

  "GAD-7": {
    title: "Worry check-in",
    instruction: "Over the last 2 weeks, how often have you been bothered by the following?",
    options: ["Not at all", "Several days", "More than half the days", "Nearly every day"],
    scores: [0, 1, 2, 3],
    questions: [
      "Feeling nervous, anxious, or on edge",
      "Not being able to stop or control worrying",
      "Worrying too much about different things",
      "Trouble relaxing",
      "Being so restless that it is hard to sit still",
      "Becoming easily annoyed or irritable",
      "Feeling afraid, as if something awful might happen",
    ],
    crisisQuestion: null,
    score(answers) {
      return answers.reduce((s, a) => s + a, 0);
    },
    severity(total) {
      if (total <= 4) return { level: "minimal", label: "Minimal", color: "#22c55e" };
      if (total <= 9) return { level: "mild", label: "Mild", color: "#84cc16" };
      if (total <= 14) return { level: "moderate", label: "Moderate", color: "#f59e0b" };
      return { level: "severe", label: "Severe", color: "#ef4444" };
    },
  },

  "UCLA-3": {
    title: "Loneliness check-in",
    instruction: "How often do you feel the following?",
    options: ["Hardly ever", "Some of the time", "Often"],
    scores: [1, 2, 3],
    questions: [
      "How often do you feel that you lack companionship?",
      "How often do you feel left out?",
      "How often do you feel isolated from others?",
    ],
    crisisQuestion: null,
    score(answers) {
      return answers.reduce((s, a) => s + a, 0);
    },
    severity(total) {
      if (total <= 4) return { level: "low", label: "Low", color: "#22c55e" };
      if (total <= 6) return { level: "moderate", label: "Moderate", color: "#f59e0b" };
      return { level: "high", label: "High", color: "#ef4444" };
    },
  },

  "PSS-4": {
    title: "Stress check-in",
    instruction: "In the last month, how often have you…",
    options: ["Never", "Almost never", "Sometimes", "Fairly often", "Very often"],
    scores: [0, 1, 2, 3, 4],
    questions: [
      "…felt that you were unable to control the important things in your life?",
      "…felt difficulties were piling up so high that you could not overcome them?",
      "…felt confident about your ability to handle your personal problems?",  // reverse
      "…been able to control irritations in your life?",                         // reverse
    ],
    reverseItems: [2, 3],
    crisisQuestion: null,
    score(answers) {
      return answers.reduce((s, a, i) => {
        const rev = [2, 3].includes(i);
        return s + (rev ? 4 - a : a);
      }, 0);
    },
    severity(total) {
      if (total <= 5) return { level: "low", label: "Low", color: "#22c55e" };
      if (total <= 11) return { level: "moderate", label: "Moderate", color: "#f59e0b" };
      return { level: "high", label: "High", color: "#ef4444" };
    },
  },

  "BURNOUT-5": {
    title: "Burnout Check",
    instruction: "How true are these statements for you right now?",
    options: ["Not true", "Rarely true", "Sometimes true", "Often true", "Always true"],
    scores: [0, 1, 2, 3, 4],
    questions: [
      "I feel emotionally drained by my work or daily responsibilities",
      "I feel detached or indifferent towards things I used to care about",
      "I feel exhausted even after sleeping",
      "I doubt whether my efforts make any difference",
      "I feel like I have nothing left to give",
    ],
    crisisQuestion: null,
    score(answers) {
      return answers.reduce((s, a) => s + a, 0);
    },
    severity(total) {
      if (total <= 6) return { level: "low", label: "Low", color: "#22c55e" };
      if (total <= 12) return { level: "moderate", label: "Moderate", color: "#f59e0b" };
      if (total <= 16) return { level: "high", label: "High", color: "#f97316" };
      return { level: "severe", label: "Severe", color: "#ef4444" };
    },
  },

  "TRIAGE": {
    title: "Quick Check-In",
    instruction: "Answer honestly — there are no wrong answers",
    options: ["Not at all", "A little", "Quite a bit", "Very much"],
    scores: [0, 1, 2, 3],
    questions: [
      "I have been feeling low or hopeless",
      "I have been feeling anxious or unable to stop worrying",
      "I have been feeling isolated or like no one understands me",
      "I feel overwhelmed and unable to cope with daily demands",
      "I feel completely drained with nothing left to give",
    ],
    crisisQuestion: null,
    score(answers) { return answers; },
    triage(answers) {
      const [dep, anx, lon, str, brn] = answers;
      const max = Math.max(dep, anx, lon, str, brn);
      const idx = answers.indexOf(max);
      const map = ["depression", "anxiety", "loneliness", "stress", "burnout"];
      return map[idx] || "depression";
    },
  },
};

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

// ── Affiliate links ───────────────────────────────────────────────────────────

export const AFFILIATE_APPS = [
  {
    id: "headspace",
    name: "Headspace",
    tagline: "Meditation & mindfulness for calmer days",
    emoji: "🧘",
    color: "#f97316",
    url: "https://www.headspace.com/?utm_source=seen_app&utm_medium=referral&utm_campaign=support",
    conditions: ["anxiety", "stress", "burnout"],
    badge: "Free trial",
  },
  {
    id: "calm",
    name: "Calm",
    tagline: "Sleep, meditation, and relaxation",
    emoji: "🌙",
    color: "#3b82f6",
    url: "https://www.calm.com/?utm_source=seen_app&utm_medium=referral&utm_campaign=support",
    conditions: ["anxiety", "stress", "depression"],
    badge: "Free trial",
  },
  {
    id: "betterhelp",
    name: "BetterHelp",
    tagline: "Online talking-therapy support",
    emoji: "💬",
    color: "#22c55e",
    url: "https://www.betterhelp.com/start/?utm_source=seen_app&utm_medium=referral&utm_campaign=support",
    conditions: ["depression", "anxiety", "burnout", "stress", "loneliness"],
    badge: "First week discounted",
  },
  {
    id: "woebot",
    name: "Woebot",
    tagline: "Guided self-help exercises, anytime",
    emoji: "🤖",
    color: "#6366f1",
    url: "https://woebothealth.com/?utm_source=seen_app&utm_medium=referral&utm_campaign=support",
    conditions: ["depression", "anxiety"],
    badge: "Free",
  },
  {
    id: "wysa",
    name: "Wysa",
    tagline: "Emotional wellbeing AI coach",
    emoji: "🐧",
    color: "#0ea5e9",
    url: "https://www.wysa.com/?utm_source=seen_app&utm_medium=referral&utm_campaign=support",
    conditions: ["depression", "anxiety", "stress", "loneliness"],
    badge: "Free tier",
  },
  {
    id: "loona",
    name: "Loóna",
    tagline: "Wind-down games to ease your mind before sleep",
    emoji: "🌀",
    color: "#a855f7",
    url: "https://loona.app/?utm_source=seen_app&utm_medium=referral&utm_campaign=support",
    conditions: ["stress", "burnout", "anxiety"],
    badge: "Free trial",
  },
];

export function getAffiliateApps(conditionId) {
  return AFFILIATE_APPS.filter(a => a.conditions.includes(conditionId));
}

// ── Coping tips per condition/severity ───────────────────────────────────────

export const COPING_TIPS = {
  depression: {
    minimal: ["Keep a short gratitude note each morning", "Move your body for 10 minutes outdoors", "Reach out to one person this week"],
    mild: ["Try a 5-minute mood journal daily", "Schedule one enjoyable activity each day", "Limit social media to 30 min/day"],
    moderate: ["Talk to your GP or a trusted friend this week", "Try Woebot or Wysa for daily check-ins", "Structure your day with small achievable goals"],
    moderateSevere: ["Speaking to a professional can make a real difference — see resources below", "You don't have to figure this out alone"],
    severe: ["Please reach out to a crisis line or your GP today — you deserve support now"],
  },
  anxiety: {
    minimal: ["Try box breathing: 4s in, 4s hold, 4s out, 4s hold", "Limit caffeine after noon", "Write your worries down and schedule a 'worry time'"],
    mild: ["5-min body scan before bed", "Challenge anxious thoughts: is this likely, or worst case?", "Physical exercise reduces anxiety hormones significantly"],
    moderate: ["Consider a CBT-based app (Woebot, Wysa) for daily practice", "Talk to your GP — effective treatments exist", "Reduce news consumption to once per day"],
    severe: ["Please speak to a professional — anxiety at this level is very treatable with the right support"],
  },
  loneliness: {
    low: ["Send one message to someone you haven't spoken to in a while", "Join a local or online group around something you enjoy"],
    moderate: ["Schedule a regular call with a friend or family member", "Volunteer locally — shared purpose builds connection", "Consider 7 Cups for anonymous peer chat"],
    high: ["You're not alone in feeling alone — millions feel this. Reaching out is the first step", "A therapist can help you build the connection you deserve — see resources below"],
  },
  stress: {
    low: ["Try a 5-minute mindful break between tasks", "Physical activity is the fastest stress reducer"],
    moderate: ["Identify your top 3 stressors and tackle one today", "Reduce decision fatigue by planning evenings the night before", "Try a short progressive muscle relaxation (PMR) session"],
    high: ["This level of stress takes a real toll — please don't push through alone", "Talk to someone you trust, or a professional — see resources below"],
  },
  burnout: {
    low: ["Build in one full-rest hour daily with no phone", "Celebrate small wins — burnout steals your ability to notice them"],
    moderate: ["Set a hard stop time for work today", "Take at least one full rest day this week", "Identify one thing you can say 'no' to right now"],
    high: ["Burnout at this level needs real recovery time, not just tips", "Talk to your manager, GP, or a counsellor — see resources below"],
    severe: ["Please speak to a professional. Severe burnout can lead to serious health consequences and you deserve proper support"],
  },
};
