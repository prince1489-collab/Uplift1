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
  { id: "warmth",    label: "Warmth",        emoji: "💛",  isPremium: true  },
  { id: "strength",  label: "Strength",      emoji: "💪",  isPremium: true  },
  { id: "celebrate", label: "Celebrate",     emoji: "🎉",  isPremium: true  },
  { id: "calm",      label: "Calm",          emoji: "🌿",  isPremium: true  },
  { id: "cultural",  label: "World moments", emoji: "🌍",  isPremium: true  },
];

export const ALL_GREETINGS = [
  // ─── FREE: Core ───────────────────────────────────────────────
  { id: "morning",   text: "Good Morning, have a nice day! ☀️",           sparkReward: 10, isMystery: false, category: "core",      isPremium: false },
  { id: "afternoon", text: "Good Afternoon, hope you are doing great! 💛", sparkReward: 10, isMystery: false, category: "core",      isPremium: false },
  { id: "night",     text: "Good Night! Sleep well 🌙",                   sparkReward: 10, isMystery: false, category: "core",      isPremium: false },
  { id: "mystery",   text: "🎁 Mystery Greeting",                         sparkReward: 25, isMystery: true,  category: "core",      isPremium: false },

  // ─── PREMIUM: Warmth ──────────────────────────────────────────
  { id: "w1", text: "Thinking of you today 💭",                           sparkReward: 12, isMystery: false, category: "warmth",    isPremium: true },
  { id: "w2", text: "You are not alone 🤝",                               sparkReward: 12, isMystery: false, category: "warmth",    isPremium: true },
  { id: "w3", text: "Someone in the world is rooting for you 🌟",         sparkReward: 15, isMystery: false, category: "warmth",    isPremium: true },
  { id: "w4", text: "You matter more than you know 💙",                   sparkReward: 15, isMystery: false, category: "warmth",    isPremium: true },
  { id: "w5", text: "Sending you a little warmth today 🕯️",              sparkReward: 12, isMystery: false, category: "warmth",    isPremium: true },

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
  { id: "calm1", text: "Take a breath. You are here 🌬️",                 sparkReward: 12, isMystery: false, category: "calm",      isPremium: true },
  { id: "calm2", text: "It's okay to rest 🛌",                           sparkReward: 12, isMystery: false, category: "calm",      isPremium: true },
  { id: "calm3", text: "Peace to you today 🕊️",                         sparkReward: 12, isMystery: false, category: "calm",      isPremium: true },
  { id: "calm4", text: "Be gentle with yourself today 🌸",               sparkReward: 12, isMystery: false, category: "calm",      isPremium: true },
  { id: "calm5", text: "You are enough, exactly as you are 🌱",          sparkReward: 15, isMystery: false, category: "calm",      isPremium: true },

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
