/**
 * greetings.js — Greeting library for Seen / Uplift.
 *
 * FREE tier:    core, warmth, calm
 * PREMIUM tier: strength, celebrate, cultural, themed (monthly)
 */

export const MONTHLY_THEMES = {
  0:  { name: "New Year's Light",    emoji: "✨" },
  1:  { name: "Love & Kindness",     emoji: "❤️" },
  2:  { name: "Renewal Season",      emoji: "🌱" },
  3:  { name: "Earth Month",         emoji: "🌍" },
  4:  { name: "Growth Month",        emoji: "🌻" },
  5:  { name: "Midsummer",           emoji: "☀️" },
  6:  { name: "Summer Warmth",       emoji: "🌊" },
  7:  { name: "Late Summer",         emoji: "🌾" },
  8:  { name: "Harvest & Gratitude", emoji: "🍂" },
  9:  { name: "Reflection Season",   emoji: "🍁" },
  10: { name: "Gratitude Month",     emoji: "🙏" },
  11: { name: "Season of Light",     emoji: "🕯️" },
};

export function getCurrentMonthTheme() {
  return MONTHLY_THEMES[new Date().getMonth()];
}

export const GREETING_CATEGORIES = [
  { id: "core",      label: "Greetings",     emoji: "☀️",  isPremium: false },
  { id: "warmth",    label: "Warmth",        emoji: "💛",  isPremium: false },
  { id: "strength",  label: "Strength",      emoji: "💪",  isPremium: true  },
  { id: "celebrate", label: "Celebrate",     emoji: "🎉",  isPremium: true  },
  { id: "calm",      label: "Calm",          emoji: "🌿",  isPremium: false },
  { id: "cultural",  label: "World moments", emoji: "🌍",  isPremium: true  },
  { id: "themed",    label: "This Month",    emoji: "🗓️",  isPremium: true  },
];

export const ALL_GREETINGS = [
  // ─── FREE: Core ────────────────────────────────────────────────────────────
  { id: "morning",   text: "Morning! Hope something good finds you today ☀️",    sparkReward: 10, isMystery: false, category: "core", isPremium: false },
  { id: "afternoon", text: "Afternoon check-in — you doing okay? 💛",            sparkReward: 10, isMystery: false, category: "core", isPremium: false },
  { id: "evening",   text: "Evening. Time to breathe and let the day go 🌆",     sparkReward: 10, isMystery: false, category: "core", isPremium: false },
  { id: "night",     text: "Good night. You showed up today and that counts 🌙", sparkReward: 10, isMystery: false, category: "core", isPremium: false },
  { id: "mystery",   text: "🎁 Mystery Greeting",                                sparkReward: 25, isMystery: true,  category: "core", isPremium: false },

  // ─── FREE: Warmth ──────────────────────────────────────────────────────────
  { id: "w1", text: "Thinking of you today 💭",                                 sparkReward: 12, isMystery: false, category: "warmth", isPremium: false },
  { id: "w2", text: "You are not alone 🤝",                                     sparkReward: 12, isMystery: false, category: "warmth", isPremium: false },
  { id: "w3", text: "Someone in the world is rooting for you 🌟",               sparkReward: 15, isMystery: false, category: "warmth", isPremium: false },
  { id: "w4", text: "You matter more than you know 💙",                         sparkReward: 15, isMystery: false, category: "warmth", isPremium: false },
  { id: "w5", text: "Sending you a little warmth today 🕯️",                    sparkReward: 12, isMystery: false, category: "warmth", isPremium: false },

  // ─── PREMIUM: Strength ─────────────────────────────────────────────────────
  { id: "s1", text: "You've got this 💪",                                       sparkReward: 12, isMystery: false, category: "strength", isPremium: true },
  { id: "s2", text: "Keep going — you're stronger than you think 🦁",           sparkReward: 15, isMystery: false, category: "strength", isPremium: true },
  { id: "s3", text: "One step at a time is still progress 👣",                  sparkReward: 12, isMystery: false, category: "strength", isPremium: true },
  { id: "s4", text: "Today is a new chance 🌅",                                 sparkReward: 12, isMystery: false, category: "strength", isPremium: true },
  { id: "s5", text: "Hard days don't last. You do 🌿",                         sparkReward: 15, isMystery: false, category: "strength", isPremium: true },

  // ─── PREMIUM: Celebrate ────────────────────────────────────────────────────
  { id: "c1", text: "Hope today brings you something to smile about 😊",        sparkReward: 12, isMystery: false, category: "celebrate", isPremium: true },
  { id: "c2", text: "Celebrating you just because 🎉",                         sparkReward: 15, isMystery: false, category: "celebrate", isPremium: true },
  { id: "c3", text: "You deserve good things 🎁",                              sparkReward: 12, isMystery: false, category: "celebrate", isPremium: true },
  { id: "c4", text: "Today could be the start of something wonderful ✨",       sparkReward: 12, isMystery: false, category: "celebrate", isPremium: true },

  // ─── FREE: Calm ────────────────────────────────────────────────────────────
  { id: "calm1", text: "Take a breath. You are here 🌬️",                       sparkReward: 12, isMystery: false, category: "calm", isPremium: false },
  { id: "calm2", text: "It's okay to rest 🛌",                                 sparkReward: 12, isMystery: false, category: "calm", isPremium: false },
  { id: "calm3", text: "Peace to you today 🕊️",                               sparkReward: 12, isMystery: false, category: "calm", isPremium: false },
  { id: "calm4", text: "Be gentle with yourself today 🌸",                     sparkReward: 12, isMystery: false, category: "calm", isPremium: false },
  { id: "calm5", text: "You are enough, exactly as you are 🌱",                sparkReward: 15, isMystery: false, category: "calm", isPremium: false },

  // ─── PREMIUM: World moments ────────────────────────────────────────────────
  { id: "wm1", text: "Wishing you and your family joy this season 🌙",         sparkReward: 20, isMystery: false, category: "cultural", isPremium: true },
  { id: "wm2", text: "Light and love to you this festive time 🕯️",            sparkReward: 20, isMystery: false, category: "cultural", isPremium: true },
  { id: "wm3", text: "May this new year bring you everything you hope for 🎊", sparkReward: 20, isMystery: false, category: "cultural", isPremium: true },
  { id: "wm4", text: "Sending spring energy your way 🌸",                     sparkReward: 15, isMystery: false, category: "cultural", isPremium: true },
  { id: "wm5", text: "Harvest blessings to you and yours 🌾",                 sparkReward: 15, isMystery: false, category: "cultural", isPremium: true },

  // ─── PREMIUM: Themed — January (New Year) ─────────────────────────────────
  { id: "t_jan1", text: "Wishing you a fresh start and brighter days ahead 🌟",  sparkReward: 20, isMystery: false, category: "themed", isPremium: true, months: [0] },
  { id: "t_jan2", text: "May this year bring you more of what makes you happy ✨", sparkReward: 20, isMystery: false, category: "themed", isPremium: true, months: [0] },
  { id: "t_jan3", text: "A new year is a new chance. You've got this 🚀",         sparkReward: 20, isMystery: false, category: "themed", isPremium: true, months: [0] },
  { id: "t_jan4", text: "Sending hope for your journey through this new year 🌙", sparkReward: 20, isMystery: false, category: "themed", isPremium: true, months: [0] },

  // ─── PREMIUM: Themed — February (Love & Kindness) ─────────────────────────
  { id: "t_feb1", text: "You deserve love — not just today, but every day 💝",   sparkReward: 20, isMystery: false, category: "themed", isPremium: true, months: [1] },
  { id: "t_feb2", text: "Kindness looks good on you 🌸",                         sparkReward: 20, isMystery: false, category: "themed", isPremium: true, months: [1] },
  { id: "t_feb3", text: "Sending warmth your way this season of love ❤️",        sparkReward: 20, isMystery: false, category: "themed", isPremium: true, months: [1] },
  { id: "t_feb4", text: "Love is more than romance — it's noticing you 💛",      sparkReward: 20, isMystery: false, category: "themed", isPremium: true, months: [1] },

  // ─── PREMIUM: Themed — March (Renewal) ────────────────────────────────────
  { id: "t_mar1", text: "Spring is coming — and so is something good for you 🌱", sparkReward: 20, isMystery: false, category: "themed", isPremium: true, months: [2] },
  { id: "t_mar2", text: "Renewal starts within. You're growing, even now 🌿",    sparkReward: 20, isMystery: false, category: "themed", isPremium: true, months: [2] },
  { id: "t_mar3", text: "Just like the season, you too are turning a corner 🌸", sparkReward: 20, isMystery: false, category: "themed", isPremium: true, months: [2] },
  { id: "t_mar4", text: "March forward — new things are blooming for you 🌼",    sparkReward: 20, isMystery: false, category: "themed", isPremium: true, months: [2] },

  // ─── PREMIUM: Themed — April (Earth Month) ────────────────────────────────
  { id: "t_apr1", text: "You are part of something beautiful — this world, this moment 🌍",  sparkReward: 20, isMystery: false, category: "themed", isPremium: true, months: [3] },
  { id: "t_apr2", text: "Spring rain brings new life — and so does your presence 🌧️🌱",     sparkReward: 20, isMystery: false, category: "themed", isPremium: true, months: [3] },
  { id: "t_apr3", text: "You belong here. On this Earth, in this moment 🌸",                sparkReward: 20, isMystery: false, category: "themed", isPremium: true, months: [3] },
  { id: "t_apr4", text: "Even small acts of kindness change the world 🌿",                  sparkReward: 20, isMystery: false, category: "themed", isPremium: true, months: [3] },
  { id: "t_apr5", text: "Sending you Earth Month energy — grow, bloom, thrive 🌻",          sparkReward: 20, isMystery: false, category: "themed", isPremium: true, months: [3] },

  // ─── PREMIUM: Themed — May (Growth) ───────────────────────────────────────
  { id: "t_may1", text: "May is for growth — and you're already doing amazing things 🌻", sparkReward: 20, isMystery: false, category: "themed", isPremium: true, months: [4] },
  { id: "t_may2", text: "Bloom where you are planted 🌸",                                sparkReward: 20, isMystery: false, category: "themed", isPremium: true, months: [4] },
  { id: "t_may3", text: "You are in full bloom this month and always 🌼",                 sparkReward: 20, isMystery: false, category: "themed", isPremium: true, months: [4] },
  { id: "t_may4", text: "Growth isn't always visible, but it's always happening 🌱",     sparkReward: 20, isMystery: false, category: "themed", isPremium: true, months: [4] },

  // ─── PREMIUM: Themed — June (Midsummer) ───────────────────────────────────
  { id: "t_jun1", text: "The longest days are for the biggest dreams ☀️",         sparkReward: 20, isMystery: false, category: "themed", isPremium: true, months: [5] },
  { id: "t_jun2", text: "Summer light finds its way in everywhere, just like you do 🌅", sparkReward: 20, isMystery: false, category: "themed", isPremium: true, months: [5] },
  { id: "t_jun3", text: "Wishing you golden days and easy evenings 🌻",           sparkReward: 20, isMystery: false, category: "themed", isPremium: true, months: [5] },
  { id: "t_jun4", text: "May your summer be full of moments that matter 🌊",      sparkReward: 20, isMystery: false, category: "themed", isPremium: true, months: [5] },

  // ─── PREMIUM: Themed — July (Summer Warmth) ───────────────────────────────
  { id: "t_jul1", text: "Mid-summer check-in: you're doing great 🌊",              sparkReward: 20, isMystery: false, category: "themed", isPremium: true, months: [6] },
  { id: "t_jul2", text: "Wishing you rest, adventure, and all things good this summer 🏖️", sparkReward: 20, isMystery: false, category: "themed", isPremium: true, months: [6] },
  { id: "t_jul3", text: "Hot days, cool vibes — hope you're thriving ✨",          sparkReward: 20, isMystery: false, category: "themed", isPremium: true, months: [6] },
  { id: "t_jul4", text: "Sending sunshine and good energy your way ☀️",            sparkReward: 20, isMystery: false, category: "themed", isPremium: true, months: [6] },

  // ─── PREMIUM: Themed — August (Late Summer) ───────────────────────────────
  { id: "t_aug1", text: "The last stretch of summer — make it count 🌾",           sparkReward: 20, isMystery: false, category: "themed", isPremium: true, months: [7] },
  { id: "t_aug2", text: "August energy: ease into what's coming next 🌅",          sparkReward: 20, isMystery: false, category: "themed", isPremium: true, months: [7] },
  { id: "t_aug3", text: "Long summer evenings are for deep breaths and gratitude 🌙", sparkReward: 20, isMystery: false, category: "themed", isPremium: true, months: [7] },
  { id: "t_aug4", text: "Savour this season — you've earned it 🍂",                sparkReward: 20, isMystery: false, category: "themed", isPremium: true, months: [7] },

  // ─── PREMIUM: Themed — September (Harvest) ────────────────────────────────
  { id: "t_sep1", text: "Autumn is here — a season to gather and be grateful 🍂",  sparkReward: 20, isMystery: false, category: "themed", isPremium: true, months: [8] },
  { id: "t_sep2", text: "What you've grown this year deserves to be celebrated 🌾", sparkReward: 20, isMystery: false, category: "themed", isPremium: true, months: [8] },
  { id: "t_sep3", text: "New season, new energy — you've got what it takes 🍁",    sparkReward: 20, isMystery: false, category: "themed", isPremium: true, months: [8] },
  { id: "t_sep4", text: "Sending cozy autumn warmth your way ☕",                  sparkReward: 20, isMystery: false, category: "themed", isPremium: true, months: [8] },

  // ─── PREMIUM: Themed — October (Reflection) ───────────────────────────────
  { id: "t_oct1", text: "October is for cozy moments and deeper thoughts 🍁",       sparkReward: 20, isMystery: false, category: "themed", isPremium: true, months: [9] },
  { id: "t_oct2", text: "Falling leaves remind us that letting go can be beautiful 🍂", sparkReward: 20, isMystery: false, category: "themed", isPremium: true, months: [9] },
  { id: "t_oct3", text: "This season is for slowing down. You deserve that pause 🕯️", sparkReward: 20, isMystery: false, category: "themed", isPremium: true, months: [9] },
  { id: "t_oct4", text: "Spooky season or not — you bring the magic 🌙",            sparkReward: 20, isMystery: false, category: "themed", isPremium: true, months: [9] },

  // ─── PREMIUM: Themed — November (Gratitude) ───────────────────────────────
  { id: "t_nov1", text: "Grateful for the people who make the world warmer — including you 🙏", sparkReward: 20, isMystery: false, category: "themed", isPremium: true, months: [10] },
  { id: "t_nov2", text: "This month is for counting blessings — you're one of mine 🌟",        sparkReward: 20, isMystery: false, category: "themed", isPremium: true, months: [10] },
  { id: "t_nov3", text: "Giving thanks for your kindness in this world 💛",                    sparkReward: 20, isMystery: false, category: "themed", isPremium: true, months: [10] },
  { id: "t_nov4", text: "Thanksgiving energy: you nourish everyone around you 🍽️",            sparkReward: 20, isMystery: false, category: "themed", isPremium: true, months: [10] },

  // ─── PREMIUM: Themed — December (Season of Light) ─────────────────────────
  { id: "t_dec1", text: "Wishing you warmth, light, and peace this December 🕯️",    sparkReward: 20, isMystery: false, category: "themed", isPremium: true, months: [11] },
  { id: "t_dec2", text: "The holidays are better because you're in this world 🌟",   sparkReward: 20, isMystery: false, category: "themed", isPremium: true, months: [11] },
  { id: "t_dec3", text: "Sending festive joy and winter warmth your way ❄️",         sparkReward: 20, isMystery: false, category: "themed", isPremium: true, months: [11] },
  { id: "t_dec4", text: "May the end of this year bring you hope for the next 🎊",   sparkReward: 20, isMystery: false, category: "themed", isPremium: true, months: [11] },
  { id: "t_dec5", text: "Whatever you celebrate, I hope it brings you joy 🌙",       sparkReward: 20, isMystery: false, category: "themed", isPremium: true, months: [11] },
];

export function getAccessibleGreetings(isPremium = false) {
  const month = new Date().getMonth();
  return ALL_GREETINGS.filter(g => {
    if (g.isPremium && !isPremium) return false;
    // Themed greetings: only show the current month's pack
    if (g.category === "themed" && g.months && !g.months.includes(month)) return false;
    return true;
  });
}

export function getGreetingsByCategory(isPremium = false) {
  const month = new Date().getMonth();
  const theme = MONTHLY_THEMES[month];
  const accessible = getAccessibleGreetings(isPremium);
  return GREETING_CATEGORIES.map((cat) => {
    // Give the themed category a dynamic label
    if (cat.id === "themed") {
      return {
        ...cat,
        label: theme?.name ?? "This Month",
        emoji: theme?.emoji ?? "🗓️",
        greetings: accessible.filter(g => g.category === "themed"),
      };
    }
    return { ...cat, greetings: accessible.filter(g => g.category === cat.id) };
  }).filter(cat => cat.greetings.length > 0);
}

export const MYSTERY_MESSAGES = [
  "You are someone's reason to smile today 🌟",
  "The world is genuinely better with you in it 💛",
  "Someone out there is rooting for you right now 🤝",
  "You matter more than you'll ever know ✨",
  "You bring something to this world no one else can 🌍",
  "Today, someone thought of you and smiled 😊",
  "You are seen. You are valued. You are enough 🙏",
];
