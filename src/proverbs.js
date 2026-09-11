// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.
//
// proverbs.js — one piece of borrowed wisdom a day, in a language that is not yours.
//
// WHY THIS EXISTS. The send sheet used to show four tabs of ready-made greetings, of which a
// UK user could reach fourteen. Two different people would open the app on the same morning,
// tap the same first option, and the feed would fill with the same sentence in three different
// handwritings. Presets kept the effort low, which is right, at the cost of the one thing the
// app is for — feeling that a person thought of you.
//
// A proverb fixes that differently from just adding more greetings. It is not a nicer way of
// saying "good morning"; it is something worth passing on. It changes every day, it comes from
// somewhere the sender has probably never been, and it arrives with its own translation — so
// sending one is a small act of carrying something across a border, which is the whole idea of
// the globe screen expressed in a single tap.
//
// ── THE SHAPE ────────────────────────────────────────────────────────────────────────────────
//   english      the translation, and the line that actually gets sent. Leads the display.
//   language     the language's English name, as a reader would say it.
//   original     the proverb in its own script.
//   romanisation how to say it — NULL for languages already written in Latin script, where a
//                transliteration would just repeat the line above it.
//   meaning      what it is telling you, in plain words. Not a second translation.
//
// ── CURATION RULES, and they are rules ───────────────────────────────────────────────────────
// 1. Uplifting, motivational, or a clear-eyed observation about living. Nothing about death,
//    suffering, punishment or fate.
// 2. No religious instruction. A proverb that merely arose in a religious culture is fine; one
//    that tells the reader what to believe is not. Seen is used by people of every faith and
//    none, and a daily message is the wrong place to be told.
// 3. Nothing that reads as a rebuke. These are sent BY one person TO another, so anything
//    faintly scolding ("a little learning is dangerous") becomes an insult on arrival.
// 4. Widely attested. If a proverb could not be found in more than one place, it is left out
//    rather than guessed at — a wrong translation sent to someone who speaks the language is
//    worse than no proverb at all.
//
// Sixty-two entries over forty-six languages: a fresh one every day for two months before any
// repeat. Extending it is just adding rows.

import { hytHash } from "./hytPrompts";

// sparkReward is flat across the set on purpose. Varying it would quietly rank some cultures'
// wisdom above others, which is an appalling thing to encode in a lookup table.
const R = 20;

export const PROVERBS = [
  // ── East Asia ──────────────────────────────────────────────────────────────────────────────
  { id: "zh_journey", language: "Chinese", original: "千里之行，始于足下", romanisation: "Qiān lǐ zhī xíng, shǐ yú zú xià",
    english: "A journey of a thousand miles begins with a single step.",
    meaning: "Big goals require you to start with small actions.", sparkReward: R },
  { id: "zh_fish", language: "Chinese", original: "授人以鱼不如授人以渔", romanisation: "Shòu rén yǐ yú bùrú shòu rén yǐ yú",
    english: "Better to teach someone to fish than to hand them a fish.",
    meaning: "Real help leaves a person more able than you found them.", sparkReward: R },
  { id: "ja_seven", language: "Japanese", original: "七転び八起き", romanisation: "Nana korobi ya oki",
    english: "Fall down seven times, stand up eight.",
    meaning: "What counts is not that you fall, but that you keep getting back up.", sparkReward: R },
  { id: "ja_monkey", language: "Japanese", original: "猿も木から落ちる", romanisation: "Saru mo ki kara ochiru",
    english: "Even monkeys fall from trees.",
    meaning: "Everyone gets it wrong sometimes, however good they are at it.", sparkReward: R },
  { id: "ja_stone", language: "Japanese", original: "石の上にも三年", romanisation: "Ishi no ue ni mo san nen",
    english: "Three years sitting on a rock.",
    meaning: "Stay with something long enough and even the cold stone warms.", sparkReward: R },
  { id: "ko_start", language: "Korean", original: "시작이 반이다", romanisation: "Sijagi banida",
    english: "Starting is half of it.",
    meaning: "Beginning is the hard part — once you have, you are already halfway.", sparkReward: R },
  { id: "ko_dust", language: "Korean", original: "티끌 모아 태산", romanisation: "Tikkeul moa taesan",
    english: "Gather specks of dust and you make a mountain.",
    meaning: "Amounts far too small to matter add up to something enormous.", sparkReward: R },

  // ── South Asia ─────────────────────────────────────────────────────────────────────────────
  { id: "hi_mind", language: "Hindi", original: "मन के हारे हार है, मन के जीते जीत", romanisation: "Man ke haare haar hai, man ke jeete jeet",
    english: "If the mind is defeated you lose; if the mind wins you win.",
    meaning: "How you meet a thing decides more of the outcome than the thing itself.", sparkReward: R },
  { id: "hi_practice", language: "Hindi", original: "करत करत अभ्यास के जड़मति होत सुजान", romanisation: "Karat karat abhyaas ke jadmati hot sujaan",
    english: "Through constant practice, even the slowest mind grows wise.",
    meaning: "Ability is built by repetition. Nobody arrives already good at it.", sparkReward: R },
  { id: "ur_effort", language: "Urdu", original: "کوشش کرنے والوں کی کبھی ہار نہیں ہوتی", romanisation: "Koshish karne wālon kī kabhī hār nahīn hotī",
    english: "Those who keep trying are never truly defeated.",
    meaning: "Continuing to try is itself a kind of winning.", sparkReward: R },
  { id: "bn_patience", language: "Bengali", original: "ধৈর্যের ফল মিষ্ট", romanisation: "Dhoirjer phol mishto",
    english: "The fruit of patience is sweet.",
    meaning: "What you wait properly for tastes better than what you rush.", sparkReward: R },
  { id: "ta_effort", language: "Tamil", original: "முயற்சி திருவினையாக்கும்", romanisation: "Muyaṟci tiruviṉaiyākkum",
    english: "Effort creates good fortune.",
    meaning: "Luck tends to arrive where someone has been working.", sparkReward: R },

  // ── Middle East & Central Asia ─────────────────────────────────────────────────────────────
  { id: "ar_patience", language: "Arabic", original: "الصبر مفتاح الفرج", romanisation: "Aṣ-ṣabru miftāḥu al-faraj",
    english: "Patience is the key to relief.",
    meaning: "Hard spells pass for those who can sit with them a while.", sparkReward: R },
  { id: "ar_haste", language: "Arabic", original: "في التأني السلامة وفي العجلة الندامة", romanisation: "Fī at-ta'annī as-salāma wa fī al-'ajala an-nadāma",
    english: "In taking your time there is safety; in haste there is regret.",
    meaning: "Almost nothing is improved by doing it faster than you can do it well.", sparkReward: R },
  { id: "fa_drop", language: "Persian", original: "قطره قطره جمع گردد وانگهی دریا شود", romanisation: "Qatre qatre jam' gardad, vāngahī daryā shavad",
    english: "Drop gathers to drop, and then it becomes a sea.",
    meaning: "Small things, collected patiently, become something vast.", sparkReward: R },
  { id: "he_beginnings", language: "Hebrew", original: "כל ההתחלות קשות", romanisation: "Kol ha-hatḥalot kashot",
    english: "All beginnings are hard.",
    meaning: "Finding the start difficult is normal — not a sign you should stop.", sparkReward: R },
  { id: "tr_drop", language: "Turkish", original: "Damlaya damlaya göl olur", romanisation: null,
    english: "Drop by drop, a lake forms.",
    meaning: "Contributions too small to notice are how large things get made.", sparkReward: R },
  { id: "tr_hands", language: "Turkish", original: "Bir elin nesi var, iki elin sesi var", romanisation: null,
    english: "What has one hand got? Two hands make a sound.",
    meaning: "Things start happening when people do them together.", sparkReward: R },

  // ── Africa ─────────────────────────────────────────────────────────────────────────────────
  { id: "sw_little", language: "Swahili", original: "Haba na haba, hujaza kibaba", romanisation: null,
    english: "Little by little, the measure is filled.",
    meaning: "Steady small effort finishes what one big push cannot.", sparkReward: R },
  { id: "sw_haraka", language: "Swahili", original: "Haraka haraka haina baraka", romanisation: null,
    english: "Hurry hurry has no blessing.",
    meaning: "Rushing costs you the quality you were rushing towards.", sparkReward: R },
  { id: "zu_ubuntu", language: "Zulu", original: "Umuntu ngumuntu ngabantu", romanisation: null,
    english: "A person is a person through other people.",
    meaning: "We become ourselves in the company of others, not apart from them.", sparkReward: R },
  { id: "yo_elder", language: "Yoruba", original: "Àgbà kì í wà lọ́jà kí orí ọmọ tuntun wọ́", romanisation: null,
    english: "An elder is not in the market while a newborn's head sits crooked.",
    meaning: "If you can see what someone needs and you are able, you help.", sparkReward: R },
  { id: "tw_hand", language: "Twi", original: "Nsa baako nkura adesoa", romanisation: null,
    english: "One hand cannot lift the load.",
    meaning: "Some things simply cannot be carried without someone else.", sparkReward: R },
  { id: "am_egg", language: "Amharic", original: "ቀስ በቀስ እንቁላል በእግሩ ይሄዳል", romanisation: "Qes be qes, enqulal be'egru yihedal",
    english: "Little by little, an egg will walk on its own legs.",
    meaning: "Given time and patience, even the impossible gets up and goes.", sparkReward: R },
  { id: "ha_slowly", language: "Hausa", original: "Sannu sannu ba ya hana zuwa", romanisation: null,
    english: "Slowly slowly does not prevent arrival.",
    meaning: "Going gently does not mean you will not get there.", sparkReward: R },
  { id: "ig_sibling", language: "Igbo", original: "Onye aghala nwanne ya", romanisation: null,
    english: "Let no one abandon their brother or sister.",
    meaning: "Nobody gets left behind — that is the whole of it.", sparkReward: R },

  // ── Europe: Romance ────────────────────────────────────────────────────────────────────────
  { id: "fr_nest", language: "French", original: "Petit à petit, l'oiseau fait son nid", romanisation: null,
    english: "Little by little, the bird builds its nest.",
    meaning: "Patience and small steps are how substantial things get built.", sparkReward: R },
  { id: "fr_union", language: "French", original: "L'union fait la force", romanisation: null,
    english: "Unity makes strength.",
    meaning: "Together people manage what none of them could alone.", sparkReward: R },
  { id: "es_bad", language: "Spanish", original: "No hay mal que por bien no venga", romanisation: null,
    english: "There is no bad thing that does not bring some good with it.",
    meaning: "Difficult stretches tend to leave something worth having behind them.", sparkReward: R },
  { id: "es_good", language: "Spanish", original: "Haz bien y no mires a quién", romanisation: null,
    english: "Do good, and don't look at whom.",
    meaning: "Be kind without first checking whether the person has earned it.", sparkReward: R },
  { id: "it_slow", language: "Italian", original: "Chi va piano, va sano e va lontano", romanisation: null,
    english: "Who goes gently goes safely, and goes far.",
    meaning: "A steady pace outlasts a fast one.", sparkReward: R },
  { id: "it_friend", language: "Italian", original: "Chi trova un amico trova un tesoro", romanisation: null,
    english: "Whoever finds a friend finds a treasure.",
    meaning: "A real friend is rare, and worth treating as rare.", sparkReward: R },
  { id: "pt_water", language: "Portuguese", original: "Água mole em pedra dura tanto bate até que fura", romanisation: null,
    english: "Soft water striking hard stone eventually bores through.",
    meaning: "Persistence beats force, given long enough.", sparkReward: R },
  { id: "ro_friend", language: "Romanian", original: "Prietenul la nevoie se cunoaște", romanisation: null,
    english: "A friend is known in time of need.",
    meaning: "Who turns up when it is difficult tells you everything.", sparkReward: R },
  { id: "ca_slowly", language: "Catalan", original: "A poc a poc i bona lletra", romanisation: null,
    english: "Slowly, and in good handwriting.",
    meaning: "Do it at the pace that lets you do it properly.", sparkReward: R },

  // ── Europe: Germanic ───────────────────────────────────────────────────────────────────────
  { id: "de_practice", language: "German", original: "Übung macht den Meister", romanisation: null,
    english: "Practice makes the master.",
    meaning: "Mastery is made of repetitions, not of talent.", sparkReward: R },
  { id: "de_shared", language: "German", original: "Geteiltes Leid ist halbes Leid", romanisation: null,
    english: "A sorrow shared is half a sorrow.",
    meaning: "Trouble shrinks the moment you tell someone about it.", sparkReward: R },
  { id: "nl_small", language: "Dutch", original: "Wie het kleine niet eert, is het grote niet weerd", romanisation: null,
    english: "Whoever does not honour small things does not deserve great ones.",
    meaning: "Pay attention to the small things — the large ones are made of them.", sparkReward: R },
  { id: "nl_neighbour", language: "Dutch", original: "Een goede buur is beter dan een verre vriend", romanisation: null,
    english: "A good neighbour is better than a distant friend.",
    meaning: "The people close enough to turn up are the ones who matter most.", sparkReward: R },
  { id: "sv_practice", language: "Swedish", original: "Övning ger färdighet", romanisation: null,
    english: "Practice gives skill.",
    meaning: "Ability is something you build, not something you were issued.", sparkReward: R },
  { id: "da_crawl", language: "Danish", original: "Man skal kravle, før man kan gå", romanisation: null,
    english: "One must crawl before one can walk.",
    meaning: "Being a beginner is a stage, not a verdict.", sparkReward: R },
  { id: "no_wait", language: "Norwegian", original: "Den som venter på noe godt, venter ikke forgjeves", romanisation: null,
    english: "Whoever waits for something good does not wait in vain.",
    meaning: "Some things are worth the waiting they ask of you.", sparkReward: R },
  { id: "is_patience", language: "Icelandic", original: "Þolinmæði þrautir vinnur allar", romanisation: null,
    english: "Patience overcomes every hardship.",
    meaning: "Staying with a difficulty is usually what gets you past it.", sparkReward: R },
  { id: "fi_smith", language: "Finnish", original: "Ei kukaan ole seppä syntyessään", romanisation: null,
    english: "No one is a blacksmith when they are born.",
    meaning: "Everyone was once new at the thing they are now good at.", sparkReward: R },

  // ── Europe: Slavic & Baltic ────────────────────────────────────────────────────────────────
  { id: "ru_patience", language: "Russian", original: "Терпение и труд всё перетрут", romanisation: "Terpeniye i trud vsyo peretrut",
    english: "Patience and work wear everything down.",
    meaning: "There is very little that steady effort will not eventually get through.", sparkReward: R },
  { id: "ru_friends", language: "Russian", original: "Не имей сто рублей, а имей сто друзей", romanisation: "Ne imey sto rubley, a imey sto druzey",
    english: "Don't have a hundred roubles — have a hundred friends.",
    meaning: "What you have in people is worth more than what you have in money.", sparkReward: R },
  { id: "uk_drop", language: "Ukrainian", original: "Крапля камінь точить", romanisation: "Kraplya kamin' tochyt'",
    english: "A drop wears away the stone.",
    meaning: "Gentle and repeated beats sudden and forceful.", sparkReward: R },
  { id: "pl_grain", language: "Polish", original: "Ziarnko do ziarnka, a zbierze się miarka", romanisation: null,
    english: "Grain by grain, and a measure is gathered.",
    meaning: "Small amounts, kept at, become a real quantity.", sparkReward: R },
  { id: "pl_friends", language: "Polish", original: "Prawdziwych przyjaciół poznajemy w biedzie", romanisation: null,
    english: "We come to know true friends in hard times.",
    meaning: "Difficulty quietly shows you who was really there.", sparkReward: R },
  { id: "cs_patience", language: "Czech", original: "Trpělivost růže přináší", romanisation: null,
    english: "Patience brings roses.",
    meaning: "The good part usually arrives after the waiting, not instead of it.", sparkReward: R },
  { id: "bg_step", language: "Bulgarian", original: "Работата не е вълк, в гората не бяга", romanisation: "Rabotata ne e valk, v gorata ne byaga",
    english: "Work is not a wolf — it will not run off into the forest.",
    meaning: "Rest when you need to. It will still be there, and so will you.", sparkReward: R },
  { id: "lt_together", language: "Lithuanian", original: "Kur du stos, visados daugiau padarys", romanisation: null,
    english: "Where two stand together, they will always do more.",
    meaning: "Two people are more than twice one.", sparkReward: R },

  // ── Europe: Celtic, Hellenic & Finno-Ugric ─────────────────────────────────────────────────
  { id: "ga_start", language: "Irish", original: "Tús maith, leath na hoibre", romanisation: null,
    english: "A good start is half the work.",
    meaning: "Beginning well makes everything after it easier.", sparkReward: R },
  { id: "cy_tap", language: "Welsh", original: "Dyfal donc a dyr y garreg", romanisation: null,
    english: "Persistent tapping breaks the stone.",
    meaning: "Keep going gently at the same spot and it gives way.", sparkReward: R },
  { id: "el_beginning", language: "Greek", original: "Η αρχή είναι το ήμισυ του παντός", romanisation: "I archí eínai to ímisy tou pantós",
    english: "The beginning is half of everything.",
    meaning: "Most of the difficulty is in getting started at all.", sparkReward: R },
  { id: "hu_dares", language: "Hungarian", original: "Aki mer, az nyer", romanisation: null,
    english: "Whoever dares, wins.",
    meaning: "Taking the chance is the part that makes the outcome possible.", sparkReward: R },

  // ── Southeast Asia ─────────────────────────────────────────────────────────────────────────
  { id: "vi_iron", language: "Vietnamese", original: "Có công mài sắt, có ngày nên kim", romanisation: null,
    english: "Grind away at iron, and one day you have a needle.",
    meaning: "Perseverance turns the impossible into the merely finished.", sparkReward: R },
  { id: "vi_trees", language: "Vietnamese", original: "Một cây làm chẳng nên non, ba cây chụm lại nên hòn núi cao", romanisation: null,
    english: "One tree makes no hill; three together make a mountain.",
    meaning: "What one person cannot manage, a few people quietly can.", sparkReward: R },
  { id: "th_slow", language: "Thai", original: "ช้า ๆ ได้พร้าเล่มงาม", romanisation: "Cháa cháa dâai phráa lêm ngaam",
    english: "Go slowly and you get a beautiful blade.",
    meaning: "Careful work produces something worth having.", sparkReward: R },
  { id: "id_little", language: "Indonesian", original: "Sedikit demi sedikit, lama-lama menjadi bukit", romanisation: null,
    english: "Little by little, in time it becomes a hill.",
    meaning: "Consistency quietly accumulates into something you can stand on.", sparkReward: R },
  { id: "tl_perseverance", language: "Filipino", original: "Kung may tiyaga, may nilaga", romanisation: null,
    english: "If there is perseverance, there is stew.",
    meaning: "Keep at it and you will eat — effort feeds you in the end.", sparkReward: R },
  { id: "ms_together", language: "Malay", original: "Berat sama dipikul, ringan sama dijinjing", romanisation: null,
    english: "The heavy is carried together, the light is carried together.",
    meaning: "You share what is hard and what is easy alike.", sparkReward: R },
];

// Every field is rendered, so a missing one would print a broken line to a real person. The set
// is static and bundled, so this is checked once at module load rather than per render.
if (import.meta?.env?.DEV) {
  const seen = new Set();
  for (const p of PROVERBS) {
    for (const k of ["id", "language", "original", "english", "meaning"]) {
      if (!p[k]) console.error(`[proverbs] ${p.id ?? "?"} is missing ${k}`);
    }
    if (seen.has(p.id)) console.error(`[proverbs] duplicate id: ${p.id}`);
    seen.add(p.id);
  }
}

// Days elapsed in the reader's OWN timezone, so the proverb turns over at their local midnight
// rather than at UTC — the same boundary todayKey() draws for Practice and the Journal prompt.
function localDayNumber(d) {
  return Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / 86400000);
}

// The one proverb for today.
//
// This COUNTS days rather than hashing them, and the difference is not academic. Hashing the
// date string and taking it modulo the list length looks equivalent and is not: hashes collide,
// so over the first 62 days only 21 distinct proverbs appeared — a repeat every third day in a
// set built to last two months. Stepping one place per day instead guarantees every proverb is
// seen exactly once before any is seen twice.
//
// The uid is still hashed, but as a per-person OFFSET into the cycle, which is what makes two
// people on the same morning open different proverbs while each still gets the full set.
//
// `swap` advances one place rather than re-rolling. Re-rolling would let someone shop for a
// proverb they liked better, which turns a gift into a browse.
export function pickDailyProverb({ uid = "anon", date = new Date(), swap = 0 } = {}) {
  const i = (localDayNumber(date) + hytHash(uid) + Math.max(0, swap)) % PROVERBS.length;
  return PROVERBS[i];
}

// A proverb travels as a greeting, so it has to satisfy the same shape the send path expects —
// `text` is what lands in the feed and it is the ENGLISH line, because that is the part every
// recipient can read. The original, its romanisation and the meaning ride alongside as their own
// fields and are rendered under the bubble, so nothing is lost and nothing needs parsing back
// out of a single string later.
export function proverbAsGreeting(p) {
  if (!p) return null;
  return {
    id: `proverb_${p.id}`,
    text: `“${p.english}”`,
    sparkReward: p.sparkReward ?? R,
    isMystery: false,
    category: "proverb",
    isPremium: false,
    proverb: p,
  };
}
