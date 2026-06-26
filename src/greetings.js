// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.

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
  { id: "local",     label: "Local",         emoji: "🗣️",  isPremium: true  },
  { id: "community", label: "Community",     emoji: "🌱",  isPremium: false },
];

// Maps a user's country (as stored in profile.country, matching COUNTRY_OPTIONS) to a
// language key used to filter LOCAL_GREETINGS. Countries not listed fall back to "global".
export const LANGUAGE_MAP = {
  "United Kingdom": "en-GB",
  "Ireland": "en-GB",
  "United States": "en-US",
  "Canada": "en-US",
  "Australia": "en-AU",
  "New Zealand": "en-AU",
  "South Africa": "en-AU",
  "France": "fr",
  "Belgium": "fr",
  "Switzerland": "fr",
  "Monaco": "fr",
  "Spain": "es",
  "Mexico": "es",
  "Colombia": "es",
  "Argentina": "es",
  "Chile": "es",
  "Peru": "es",
  "Venezuela": "es",
  "Ecuador": "es",
  "Bolivia": "es",
  "Paraguay": "es",
  "Uruguay": "es",
  "Cuba": "es",
  "Dominican Republic": "es",
  "Guatemala": "es",
  "Honduras": "es",
  "El Salvador": "es",
  "Nicaragua": "es",
  "Costa Rica": "es",
  "Panama": "es",
  "Germany": "de",
  "Austria": "de",
  "Japan": "ja",
  "South Korea": "ko",
  "China": "zh",
  "Taiwan": "zh",
  "Brazil": "pt-BR",
  "Portugal": "pt-BR",
  "India": "hi",
  "Nepal": "hi",
  "Saudi Arabia": "ar",
  "Egypt": "ar",
  "Morocco": "ar",
  "Algeria": "ar",
  "Tunisia": "ar",
  "Jordan": "ar",
  "Lebanon": "ar",
  "Syria": "ar",
  "Iraq": "ar",
  "Kuwait": "ar",
  "United Arab Emirates": "ar",
  "Qatar": "ar",
  "Bahrain": "ar",
  "Oman": "ar",
  "Yemen": "ar",
  "Libya": "ar",
  "Sudan": "ar",
  "Pakistan": "ur",
  "Bangladesh": "bn",
  "Russia": "ru",
  "Ukraine": "uk",
  "Belarus": "ru",
  "Kazakhstan": "ru",
  "Nigeria": "yo",
  "Kenya": "sw",
  "Tanzania": "sw",
  "Uganda": "sw",
  "Ghana": "tw",
  "Indonesia": "id",
  "Malaysia": "id",
  "Turkey": "tr",
  "Netherlands": "nl",
  "Italy": "it",
  "Poland": "pl",
  "Sweden": "sv",
  "Norway": "no",
  "Denmark": "da",
  "Finland": "fi",
  "Greece": "el",
  "Romania": "ro",
  "Hungary": "hu",
  "Czech Republic": "cs",
  "Thailand": "th",
  "Vietnam": "vi",
  "Philippines": "tl",
  "Ethiopia": "am",
};

export const LOCAL_GREETINGS = [
  // ─── English (UK flavour) ──────────────────────────────────────────────────
  { id: "loc_en_gb_1", language: "en-GB", category: "local", isPremium: true, sparkReward: 15,
    text: "Have a lovely day! ☀️" },
  { id: "loc_en_gb_2", language: "en-GB", category: "local", isPremium: true, sparkReward: 15,
    text: "Sending you good vibes! 🌟" },
  { id: "loc_en_gb_3", language: "en-GB", category: "local", isPremium: true, sparkReward: 15,
    text: "Hope today treats you well 💛" },
  { id: "loc_en_gb_4", language: "en-GB", category: "local", isPremium: true, sparkReward: 15,
    text: "Chin up — you've got this! 💪" },
  { id: "loc_en_gb_5", language: "en-GB", category: "local", isPremium: true, sparkReward: 15,
    text: "Just checking in — hope you're alright 🤍" },

  // ─── English (US/Canada flavour) ──────────────────────────────────────────
  { id: "loc_en_us_1", language: "en-US", category: "local", isPremium: true, sparkReward: 15,
    text: "Have an awesome day! ✨" },
  { id: "loc_en_us_2", language: "en-US", category: "local", isPremium: true, sparkReward: 15,
    text: "You've totally got this 💪" },
  { id: "loc_en_us_3", language: "en-US", category: "local", isPremium: true, sparkReward: 15,
    text: "Hope your day is amazing! 🌟" },
  { id: "loc_en_us_4", language: "en-US", category: "local", isPremium: true, sparkReward: 15,
    text: "Rooting for you today! 🙌" },
  { id: "loc_en_us_5", language: "en-US", category: "local", isPremium: true, sparkReward: 15,
    text: "Sending good energy your way ⚡" },

  // ─── English (Australia/NZ/South Africa) ──────────────────────────────────
  { id: "loc_en_au_1", language: "en-AU", category: "local", isPremium: true, sparkReward: 15,
    text: "Hope your day's a good one! ☀️" },
  { id: "loc_en_au_2", language: "en-AU", category: "local", isPremium: true, sparkReward: 15,
    text: "You're doing brilliantly 🌟" },
  { id: "loc_en_au_3", language: "en-AU", category: "local", isPremium: true, sparkReward: 15,
    text: "Good on ya — keep going! 💪" },
  { id: "loc_en_au_4", language: "en-AU", category: "local", isPremium: true, sparkReward: 15,
    text: "Wishing you a ripper day! 🦘" },

  // ─── French ───────────────────────────────────────────────────────────────
  { id: "loc_fr_1", language: "fr", category: "local", isPremium: true, sparkReward: 20,
    text: "Bonne journée ! ☀️\n(Have a lovely day!)" },
  { id: "loc_fr_2", language: "fr", category: "local", isPremium: true, sparkReward: 20,
    text: "Prends soin de toi 💛\n(Take care of yourself)" },
  { id: "loc_fr_3", language: "fr", category: "local", isPremium: true, sparkReward: 20,
    text: "Tu n'es pas seul(e) 🤝\n(You are not alone)" },
  { id: "loc_fr_4", language: "fr", category: "local", isPremium: true, sparkReward: 20,
    text: "Courage ! Tu peux le faire 💪\n(Courage! You can do it)" },
  { id: "loc_fr_5", language: "fr", category: "local", isPremium: true, sparkReward: 20,
    text: "Je pense à toi aujourd'hui 🌸\n(Thinking of you today)" },

  // ─── Spanish ──────────────────────────────────────────────────────────────
  { id: "loc_es_1", language: "es", category: "local", isPremium: true, sparkReward: 20,
    text: "¡Que tengas un buen día! 🌞\n(Have a great day!)" },
  { id: "loc_es_2", language: "es", category: "local", isPremium: true, sparkReward: 20,
    text: "¡Ánimo, tú puedes! 💪\n(You've got this!)" },
  { id: "loc_es_3", language: "es", category: "local", isPremium: true, sparkReward: 20,
    text: "Estoy pensando en ti hoy 💭\n(Thinking of you today)" },
  { id: "loc_es_4", language: "es", category: "local", isPremium: true, sparkReward: 20,
    text: "¡Cuídate mucho! 🌺\n(Take good care of yourself!)" },
  { id: "loc_es_5", language: "es", category: "local", isPremium: true, sparkReward: 20,
    text: "No estás solo/a 🤝\n(You are not alone)" },

  // ─── German ───────────────────────────────────────────────────────────────
  { id: "loc_de_1", language: "de", category: "local", isPremium: true, sparkReward: 20,
    text: "Schönen Tag noch! ☀️\n(Have a lovely day!)" },
  { id: "loc_de_2", language: "de", category: "local", isPremium: true, sparkReward: 20,
    text: "Pass auf dich auf 💛\n(Take care of yourself)" },
  { id: "loc_de_3", language: "de", category: "local", isPremium: true, sparkReward: 20,
    text: "Du schaffst das! 💪\n(You can do it!)" },
  { id: "loc_de_4", language: "de", category: "local", isPremium: true, sparkReward: 20,
    text: "Ich denke heute an dich 🌸\n(Thinking of you today)" },

  // ─── Japanese ─────────────────────────────────────────────────────────────
  { id: "loc_ja_1", language: "ja", category: "local", isPremium: true, sparkReward: 20,
    text: "良い一日を！🌸\n(Have a wonderful day!)" },
  { id: "loc_ja_2", language: "ja", category: "local", isPremium: true, sparkReward: 20,
    text: "お大事に 🍵\n(Take care of yourself)" },
  { id: "loc_ja_3", language: "ja", category: "local", isPremium: true, sparkReward: 20,
    text: "頑張って！💪\n(You've got this!)" },
  { id: "loc_ja_4", language: "ja", category: "local", isPremium: true, sparkReward: 20,
    text: "あなたのことを思っています 💛\n(Thinking of you today)" },

  // ─── Korean ───────────────────────────────────────────────────────────────
  { id: "loc_ko_1", language: "ko", category: "local", isPremium: true, sparkReward: 20,
    text: "좋은 하루 되세요! 🌸\n(Have a nice day!)" },
  { id: "loc_ko_2", language: "ko", category: "local", isPremium: true, sparkReward: 20,
    text: "힘내세요! 💪\n(Keep going!)" },
  { id: "loc_ko_3", language: "ko", category: "local", isPremium: true, sparkReward: 20,
    text: "오늘도 당신을 응원해요 🌟\n(Cheering you on today)" },

  // ─── Chinese (Mandarin) ───────────────────────────────────────────────────
  { id: "loc_zh_1", language: "zh", category: "local", isPremium: true, sparkReward: 20,
    text: "祝你今天愉快！☀️\n(Wishing you a happy day!)" },
  { id: "loc_zh_2", language: "zh", category: "local", isPremium: true, sparkReward: 20,
    text: "加油！💪\n(Keep going! You've got this!)" },
  { id: "loc_zh_3", language: "zh", category: "local", isPremium: true, sparkReward: 20,
    text: "今天想到你了 💛\n(Thinking of you today)" },

  // ─── Hindi ────────────────────────────────────────────────────────────────
  { id: "loc_hi_1", language: "hi", category: "local", isPremium: true, sparkReward: 20,
    text: "आपका दिन शुभ हो! 🙏\n(May your day be auspicious!)" },
  { id: "loc_hi_2", language: "hi", category: "local", isPremium: true, sparkReward: 20,
    text: "ख्याल रखना 💛\n(Take care of yourself)" },
  { id: "loc_hi_3", language: "hi", category: "local", isPremium: true, sparkReward: 20,
    text: "आप अकेले नहीं हैं 🤝\n(You are not alone)" },
  { id: "loc_hi_4", language: "hi", category: "local", isPremium: true, sparkReward: 20,
    text: "हिम्मत रखो, आप कर सकते हो! 💪\n(Stay strong, you can do it!)" },

  // ─── Arabic ───────────────────────────────────────────────────────────────
  { id: "loc_ar_1", language: "ar", category: "local", isPremium: true, sparkReward: 20,
    text: "يومك سعيد ✨\n(May your day be happy)" },
  { id: "loc_ar_2", language: "ar", category: "local", isPremium: true, sparkReward: 20,
    text: "الله يحفظك 🌙\n(May God protect you)" },
  { id: "loc_ar_3", language: "ar", category: "local", isPremium: true, sparkReward: 20,
    text: "أنت لست وحدك 🤝\n(You are not alone)" },
  { id: "loc_ar_4", language: "ar", category: "local", isPremium: true, sparkReward: 20,
    text: "اعتني بنفسك 💛\n(Take care of yourself)" },

  // ─── Urdu ─────────────────────────────────────────────────────────────────
  { id: "loc_ur_1", language: "ur", category: "local", isPremium: true, sparkReward: 20,
    text: "آپ کا دن مبارک ہو! 🌟\n(May your day be blessed!)" },
  { id: "loc_ur_2", language: "ur", category: "local", isPremium: true, sparkReward: 20,
    text: "اپنا خیال رکھیں 💛\n(Take care of yourself)" },

  // ─── Bengali ──────────────────────────────────────────────────────────────
  { id: "loc_bn_1", language: "bn", category: "local", isPremium: true, sparkReward: 20,
    text: "আপনার দিনটি শুভ হোক! 🌸\n(May your day be wonderful!)" },
  { id: "loc_bn_2", language: "bn", category: "local", isPremium: true, sparkReward: 20,
    text: "নিজের যত্ন নিন 💛\n(Take care of yourself)" },

  // ─── Portuguese (Brazil/Portugal) ─────────────────────────────────────────
  { id: "loc_pt_br_1", language: "pt-BR", category: "local", isPremium: true, sparkReward: 20,
    text: "Tenha um ótimo dia! 🌟\n(Have a great day!)" },
  { id: "loc_pt_br_2", language: "pt-BR", category: "local", isPremium: true, sparkReward: 20,
    text: "Cuida-te bem 💛\n(Take good care of yourself)" },
  { id: "loc_pt_br_3", language: "pt-BR", category: "local", isPremium: true, sparkReward: 20,
    text: "Você não está sozinho/a 🤝\n(You are not alone)" },
  { id: "loc_pt_br_4", language: "pt-BR", category: "local", isPremium: true, sparkReward: 20,
    text: "Vai com tudo! 💪\n(Go for it!)" },

  // ─── Russian ──────────────────────────────────────────────────────────────
  { id: "loc_ru_1", language: "ru", category: "local", isPremium: true, sparkReward: 20,
    text: "Хорошего тебе дня! ☀️\n(Have a good day!)" },
  { id: "loc_ru_2", language: "ru", category: "local", isPremium: true, sparkReward: 20,
    text: "Береги себя 💛\n(Take care of yourself)" },
  { id: "loc_ru_3", language: "ru", category: "local", isPremium: true, sparkReward: 20,
    text: "Ты справишься! 💪\n(You'll handle it!)" },

  // ─── Ukrainian ────────────────────────────────────────────────────────────
  { id: "loc_uk_1", language: "uk", category: "local", isPremium: true, sparkReward: 20,
    text: "Гарного тобі дня! ☀️\n(Have a lovely day!)" },
  { id: "loc_uk_2", language: "uk", category: "local", isPremium: true, sparkReward: 20,
    text: "Бережи себе 💛\n(Take care of yourself)" },

  // ─── Swahili (East Africa) ────────────────────────────────────────────────
  { id: "loc_sw_1", language: "sw", category: "local", isPremium: true, sparkReward: 20,
    text: "Uwe na siku njema! 🌍\n(Have a great day!)" },
  { id: "loc_sw_2", language: "sw", category: "local", isPremium: true, sparkReward: 20,
    text: "Jitunze 💛\n(Take care of yourself)" },
  { id: "loc_sw_3", language: "sw", category: "local", isPremium: true, sparkReward: 20,
    text: "Uko na nguvu! 💪\n(You are strong!)" },

  // ─── Yoruba (Nigeria) ─────────────────────────────────────────────────────
  { id: "loc_yo_1", language: "yo", category: "local", isPremium: true, sparkReward: 20,
    text: "Ẹ káàárọ̀! 🌅\n(Good morning — wishing you well!)" },
  { id: "loc_yo_2", language: "yo", category: "local", isPremium: true, sparkReward: 20,
    text: "Ṣe dáadáa 💛\n(Take care of yourself)" },

  // ─── Twi (Ghana) ──────────────────────────────────────────────────────────
  { id: "loc_tw_1", language: "tw", category: "local", isPremium: true, sparkReward: 20,
    text: "Mema wo akye! ☀️\n(Good morning to you!)" },
  { id: "loc_tw_2", language: "tw", category: "local", isPremium: true, sparkReward: 20,
    text: "Fa wo ho ban 💛\n(Take care of yourself)" },

  // ─── Indonesian/Malay ─────────────────────────────────────────────────────
  { id: "loc_id_1", language: "id", category: "local", isPremium: true, sparkReward: 20,
    text: "Semoga harimu menyenangkan! ☀️\n(Hope your day is wonderful!)" },
  { id: "loc_id_2", language: "id", category: "local", isPremium: true, sparkReward: 20,
    text: "Jaga diri ya 💛\n(Take care of yourself)" },

  // ─── Turkish ──────────────────────────────────────────────────────────────
  { id: "loc_tr_1", language: "tr", category: "local", isPremium: true, sparkReward: 20,
    text: "İyi günler! ☀️\n(Have a good day!)" },
  { id: "loc_tr_2", language: "tr", category: "local", isPremium: true, sparkReward: 20,
    text: "Kendine iyi bak 💛\n(Take care of yourself)" },

  // ─── Dutch ────────────────────────────────────────────────────────────────
  { id: "loc_nl_1", language: "nl", category: "local", isPremium: true, sparkReward: 20,
    text: "Fijne dag! ☀️\n(Have a lovely day!)" },
  { id: "loc_nl_2", language: "nl", category: "local", isPremium: true, sparkReward: 20,
    text: "Zorg goed voor jezelf 💛\n(Take care of yourself)" },

  // ─── Italian ──────────────────────────────────────────────────────────────
  { id: "loc_it_1", language: "it", category: "local", isPremium: true, sparkReward: 20,
    text: "Buona giornata! ☀️\n(Have a good day!)" },
  { id: "loc_it_2", language: "it", category: "local", isPremium: true, sparkReward: 20,
    text: "Prenditi cura di te 💛\n(Take care of yourself)" },

  // ─── Polish ───────────────────────────────────────────────────────────────
  { id: "loc_pl_1", language: "pl", category: "local", isPremium: true, sparkReward: 20,
    text: "Miłego dnia! ☀️\n(Have a lovely day!)" },
  { id: "loc_pl_2", language: "pl", category: "local", isPremium: true, sparkReward: 20,
    text: "Dbaj o siebie 💛\n(Take care of yourself)" },

  // ─── Swedish ──────────────────────────────────────────────────────────────
  { id: "loc_sv_1", language: "sv", category: "local", isPremium: true, sparkReward: 20,
    text: "Ha en fin dag! ☀️\n(Have a lovely day!)" },
  { id: "loc_sv_2", language: "sv", category: "local", isPremium: true, sparkReward: 20,
    text: "Ta hand om dig 💛\n(Take care of yourself)" },

  // ─── Thai ─────────────────────────────────────────────────────────────────
  { id: "loc_th_1", language: "th", category: "local", isPremium: true, sparkReward: 20,
    text: "ขอให้มีวันที่ดี! 🌸\n(Have a great day!)" },
  { id: "loc_th_2", language: "th", category: "local", isPremium: true, sparkReward: 20,
    text: "ดูแลตัวเองด้วยนะ 💛\n(Take care of yourself)" },

  // ─── Vietnamese ───────────────────────────────────────────────────────────
  { id: "loc_vi_1", language: "vi", category: "local", isPremium: true, sparkReward: 20,
    text: "Chúc bạn một ngày tốt lành! ☀️\n(Wishing you a wonderful day!)" },
  { id: "loc_vi_2", language: "vi", category: "local", isPremium: true, sparkReward: 20,
    text: "Hãy tự chăm sóc bản thân nhé 💛\n(Take care of yourself)" },

  // ─── Global fallback (shown when no language match found) ─────────────────
  { id: "loc_global_1", language: "global", category: "local", isPremium: true, sparkReward: 15,
    text: "Wishing you a wonderful day, wherever you are 🌍" },
  { id: "loc_global_2", language: "global", category: "local", isPremium: true, sparkReward: 15,
    text: "Sending warmth across the miles 💛" },
  { id: "loc_global_3", language: "global", category: "local", isPremium: true, sparkReward: 15,
    text: "You are seen, you are valued 🌟" },
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
