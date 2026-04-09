/**
 * greetings.js
 *
 * Expanded greeting library for Uplift.
 * Addresses Gap 3 (repetition fatigue) and Gap 4 (monetization).
 *
 * FREE tier:    category "core"
 * PREMIUM tier: all other categories (requires profile.isPremium === true)
 *
 * Each greeting: { id, text, sparkReward, isMystery, category, isPremium }
 */

export const GREETING_CATEGORIES = [
  { id: "core",      label: "Greetings",     emoji: "☀️",  isPremium: false },
  { id: "warmth",    label: "Warmth",        emoji: "💛",  isPremium: false },
  { id: "strength",  label: "Strength",      emoji: "💪",  isPremium: true  },
  { id: "celebrate", label: "Celebrate",     emoji: "🎉",  isPremium: true  },
  { id: "calm",      label: "Calm",          emoji: "🌿",  isPremium: false },
  { id: "cultural",  label: "World moments", emoji: "🌍",  isPremium: true  },
];

export const ALL_GREETINGS = [
  // ─── FREE: Core ───────────────────────────────────────────────
  { id: "morning",   text: "Morning! Hope something good finds you today ☀️",      sparkReward: 10, isMystery: false, category: "core", isPremium: false },
  { id: "afternoon", text: "Afternoon check-in — you doing okay? 💛",              sparkReward: 10, isMystery: false, category: "core", isPremium: false },
  { id: "evening",   text: "Evening. Time to breathe and let the day go 🌆",       sparkReward: 10, isMystery: false, category: "core", isPremium: false },
  { id: "night",     text: "Good night. You showed up today and that counts 🌙",   sparkReward: 10, isMystery: false, category: "core", isPremium: false },
  { id: "mystery",   text: "🎁 Mystery Greeting",                                  sparkReward: 25, isMystery: true,  category: "core", isPremium: false },

  // ─── PREMIUM: Warmth ──────────────────────────────────────────
  { id: "w1", text: "Thinking of you today 💭",                           sparkReward: 12, isMystery: false, category: "warmth",    isPremium: false },
  { id: "w2", text: "You are not alone 🤝",                               sparkReward: 12, isMystery: false, category: "warmth",    isPremium: false },
  { id: "w3", text: "Someone in the world is rooting for you 🌟",         sparkReward: 15, isMystery: false, category: "warmth",    isPremium: false },
  { id: "w4", text: "You matter more than you know 💙",                   sparkReward: 15, isMystery: false, category: "warmth",    isPremium: false },
  { id: "w5", text: "Sending you a little warmth today 🕯️",              sparkReward: 12, isMystery: false, category: "warmth",    isPremium: false },

  // ─── PREMIUM: Strength ────────────────────────────────────────
  { id: "s1", text: "You've got this 💪",                                 sparkReward: 12, isMystery: false, category: "strength",  isPremium: true },
  { id: "s2", text: "Keep going — you're stronger than you think 🦁",     sparkReward: 15, isMystery: false, category: "strength",  isPremium: true },
  { id: "s3", text: "One step at a time is still progress 👣",            sparkReward: 12, isMystery: false, category: "strength",  isPremium: true },
  { id: "s4", text: "Today is a new chance 🌅",                           sparkReward: 12, isMystery: false, category: "strength",  isPremium: true },
  { id: "s5", text: "Hard days don't last. You do 🌿",                   sparkReward: 15, isMystery: false, category: "strength",  isPremium: true },

  // ─── PREMIUM: Celebrate ───────────────────────────────────────
  { id: "c1", text: "Hope today brings you something to smile about 😊",  sparkReward: 12, isMystery: false, category: "celebrate", isPremium: true },
  { id: "c2", text: "Celebrating you just because 🎉",                   sparkReward: 15, isMystery: false, category: "celebrate", isPremium: true },
  { id: "c3", text: "You deserve good things 🎁",                        sparkReward: 12, isMystery: false, category: "celebrate", isPremium: true },
  { id: "c4", text: "Today could be the start of something wonderful ✨", sparkReward: 12, isMystery: false, category: "celebrate", isPremium: true },

  // ─── PREMIUM: Calm ────────────────────────────────────────────
  { id: "calm1", text: "Take a breath. You are here 🌬️",                 sparkReward: 12, isMystery: false, category: "calm",      isPremium: false },
  { id: "calm2", text: "It's okay to rest 🛌",                           sparkReward: 12, isMystery: false, category: "calm",      isPremium: false },
  { id: "calm3", text: "Peace to you today 🕊️",                         sparkReward: 12, isMystery: false, category: "calm",      isPremium: false },
  { id: "calm4", text: "Be gentle with yourself today 🌸",               sparkReward: 12, isMystery: false, category: "calm",      isPremium: false },
  { id: "calm5", text: "You are enough, exactly as you are 🌱",          sparkReward: 15, isMystery: false, category: "calm",      isPremium: false },

  // ─── PREMIUM: World moments (rotating cultural) ───────────────
  { id: "wm1", text: "Wishing you and your family joy this season 🌙",    sparkReward: 20, isMystery: false, category: "cultural",  isPremium: true },
  { id: "wm2", text: "Light and love to you this festive time 🕯️",       sparkReward: 20, isMystery: false, category: "cultural",  isPremium: true },
  { id: "wm3", text: "May this new year bring you everything you hope for 🎊", sparkReward: 20, isMystery: false, category: "cultural", isPremium: true },
  { id: "wm4", text: "Sending spring energy your way 🌸",                sparkReward: 15, isMystery: false, category: "cultural",  isPremium: true },
  { id: "wm5", text: "Harvest blessings to you and yours 🌾",            sparkReward: 15, isMystery: false, category: "cultural",  isPremium: true },
];

/**
 * Returns greetings the user can access based on their premium status.
 */
export function getAccessibleGreetings(isPremium = false) {
  if (isPremium) return ALL_GREETINGS;
  return ALL_GREETINGS.filter((g) => !g.isPremium);
}

/**
 * Returns greetings grouped by category, filtering by access.
 */
export function getGreetingsByCategory(isPremium = false) {
  const accessible = getAccessibleGreetings(isPremium);
  return GREETING_CATEGORIES.map((cat) => ({
    ...cat,
    greetings: accessible.filter((g) => g.category === cat.id),
  })).filter((cat) => cat.greetings.length > 0);
}

/**
 * Warm messages revealed when a recipient unwraps a Mystery Greeting.
 * Picked randomly client-side; persisted to localStorage per messageId.
 */
export const MYSTERY_MESSAGES = [
  "You are someone's reason to smile today 🌟",
  "The world is genuinely better with you in it 💛",
  "Someone out there is rooting for you right now 🤝",
  "You matter more than you'll ever know ✨",
  "You bring something to this world no one else can 🌍",
  "Today, someone thought of you and smiled 😊",
  "You are seen. You are valued. You are enough 🙏",
];
