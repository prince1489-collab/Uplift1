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
//   theme        "people" | "living" | "effort". Not shown to anyone; it exists so the balance
//                described in rule 5 can be CHECKED rather than believed. See
//                scripts/check-proverbs.cjs, which fails the build if the mix drifts back.
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
// 5. Balanced by theme, and "effort" is capped. See below for why this rule had to be added.
// 6. Nothing that instructs the recipient how to live. This is rule 3 wearing a disguise, and
//    it needed saying separately because it is so easy to break by accident.
//
// ── WHY RULES 5 AND 6 EXIST ──────────────────────────────────────────────────────────────────
// They are the fix for something the first version of this file got wrong, and got wrong at
// scale. Counting the original sixty-two entries by what they actually SAID:
//
//     persistence / patience / practice / small steps ....... 42  (68%)
//     about other people ................................... 17  (27%)
//     everything else ....................................... 3   (5%)
//
// Nineteen of them were the same sentence in different languages — "little by little", "drop by
// drop", "grain by grain", "slowly slowly", "a drop wears away the stone", "grind away at iron",
// "persistent tapping breaks the stone". Somebody receiving one a day would work out inside a
// fortnight that the app mostly wanted to tell them to be patient and keep going. That is not
// borrowed wisdom, it is a fortune cookie on a loop.
//
// The second problem is worse and is the reason for rule 6. These are sent BY one person TO
// another. "Be patient", "don't rush", "everyone was once a beginner", "rest when you need to"
// are all ADVICE ABOUT HOW THE RECIPIENT SHOULD LIVE. Send one to someone having a hard week and
// it does not read as comfort; it reads as a suggestion that they should be trying harder. Rule
// 3 already forbade anything scolding — and then forty-two entries bent it, because a
// motivational proverb does not feel like a rebuke until you imagine receiving one unasked.
//
// What was already good in the set was the minority that was about PEOPLE: "a person is a person
// through other people", "a sorrow shared is half a sorrow", "the heavy is carried together".
// Those are about the relationship between the sender and the receiver, which is the entire
// subject of this app. So that is now the largest share by design, not by accident:
//
//     people ... connection, carrying each other, friendship, turning up
//     living ... perspective, humility, time, change, what endures
//     effort ... persistence and practice — capped at 25%, and currently 16%
//
// Ninety-four entries over sixty-seven languages: a fresh one every day for three months before
// any repeat. Extending it is just adding rows — subject to the six rules above.

import { hytHash } from "./hytPrompts";

// sparkReward is flat across the set on purpose. Varying it would quietly rank some cultures'
// wisdom above others, which is an appalling thing to encode in a lookup table.
const R = 20;

export const PROVERBS = [
  // ── East Asia ───────────────────────────────────────────────────────────────────────────────────
  { id: "zh_journey", language: "Chinese", original: "千里之行，始于足下", romanisation: "Qiān lǐ zhī xíng, shǐ yú zú xià",
    english: "A journey of a thousand miles begins with a single step.",
    meaning: "Big goals require you to start with small actions.", theme: "effort", sparkReward: R },
  { id: "zh_fish", language: "Chinese", original: "授人以鱼不如授人以渔", romanisation: "Shòu rén yǐ yú bùrú shòu rén yǐ yú",
    english: "Better to teach someone to fish than to hand them a fish.",
    meaning: "Real help leaves a person more able than you found them.", theme: "people", sparkReward: R },
  { id: "zh_tree", language: "Chinese", original: "独木不成林", romanisation: "Dú mù bù chéng lín",
    english: "A single tree does not make a forest.",
    meaning: "One person alone cannot be everything. That is not a failing, it is the design.", theme: "people", sparkReward: R },
  { id: "zh_horse", language: "Chinese", original: "塞翁失马，焉知非福", romanisation: "Sài wēng shī mǎ, yān zhī fēi fú",
    english: "The old man lost his horse — and who is to say it was not good fortune?",
    meaning: "You often cannot tell at the time whether something was a setback or a turning.", theme: "living", sparkReward: R },
  { id: "ja_seven", language: "Japanese", original: "七転び八起き", romanisation: "Nana korobi ya oki",
    english: "Fall down seven times, stand up eight.",
    meaning: "What counts is not that you fall, but that you keep getting back up.", theme: "effort", sparkReward: R },
  { id: "ja_monkey", language: "Japanese", original: "猿も木から落ちる", romanisation: "Saru mo ki kara ochiru",
    english: "Even monkeys fall from trees.",
    meaning: "Everyone gets it wrong sometimes, however good they are at it.", theme: "living", sparkReward: R },
  { id: "ja_stone", language: "Japanese", original: "石の上にも三年", romanisation: "Ishi no ue ni mo san nen",
    english: "Three years sitting on a rock.",
    meaning: "Stay with something long enough and even the cold stone warms.", theme: "effort", sparkReward: R },
  { id: "ja_nasake", language: "Japanese", original: "情けは人の為ならず", romanisation: "Nasake wa hito no tame narazu",
    english: "Kindness is never only for the other person's sake.",
    meaning: "What you give away has a way of finding its way back to you.", theme: "people", sparkReward: R },
  { id: "ja_dango", language: "Japanese", original: "花より団子", romanisation: "Hana yori dango",
    english: "Dumplings rather than blossoms.",
    meaning: "The plain, useful, real thing is usually worth more than the impressive one.", theme: "living", sparkReward: R },
  { id: "ko_start", language: "Korean", original: "시작이 반이다", romanisation: "Sijagi banida",
    english: "Starting is half of it.",
    meaning: "Beginning is the hard part — once you have, you are already halfway.", theme: "effort", sparkReward: R },
  { id: "ko_paper", language: "Korean", original: "백지장도 맞들면 낫다", romanisation: "Baekjijangdo matdeulmyeon natda",
    english: "Even a sheet of paper is lighter when two people lift it.",
    meaning: "Help is worth accepting even when the task is small enough to manage alone.", theme: "people", sparkReward: R },
  { id: "ko_hardship", language: "Korean", original: "고생 끝에 낙이 온다", romanisation: "Gosaeng kkeute nagi onda",
    english: "At the end of hardship, ease arrives.",
    meaning: "Difficult stretches are stretches, not destinations.", theme: "living", sparkReward: R },

  // ── South and Southeast Asia ────────────────────────────────────────────────────────────────────
  { id: "hi_mind", language: "Hindi", original: "मन के हारे हार है, मन के जीते जीत", romanisation: "Man ke haare haar hai, man ke jeete jeet",
    english: "If the mind is defeated you lose; if the mind wins you win.",
    meaning: "How you meet a thing decides more of the outcome than the thing itself.", theme: "living", sparkReward: R },
  { id: "pa_two", language: "Punjabi", original: "ਇੱਕ ਤੋਂ ਦੋ ਭਲੇ", romanisation: "Ikk toṁ do bhale",
    english: "Two are better than one.",
    meaning: "Almost anything is lighter, and better, with somebody else in it.", theme: "people", sparkReward: R },
  { id: "gu_unity", language: "Gujarati", original: "સંપ ત્યાં જંપ", romanisation: "Samp tyāṁ jamp",
    english: "Where there is unity, there is peace.",
    meaning: "Getting along is not a nicety on top of a good life. It largely is one.", theme: "people", sparkReward: R },
  { id: "mr_help", language: "Marathi", original: "एकमेकां साह्य करू, अवघे धरू सुपंथ", romanisation: "Ekmekāṁ sāhya karū, avaghe dharū supanth",
    english: "Let us help one another, and all of us walk the good road.",
    meaning: "The way forward is something people find together or not at all.", theme: "people", sparkReward: R },
  { id: "te_pots", language: "Telugu", original: "కలిమి లేములు కావడి కుండలు", romanisation: "Kalimi lēmulu kāvaḍi kuṇḍalu",
    english: "Plenty and want are the two pots on a carrying pole.",
    meaning: "They swap ends. Neither one is the whole of your life.", theme: "living", sparkReward: R },
  { id: "ml_unity", language: "Malayalam", original: "ഒരുമയുണ്ടെങ്കിൽ ഉലക്കമേലും കിടക്കാം", romanisation: "Orumayuṇṭeṅkil ulakkamēlum kiṭakkām",
    english: "With unity you could sleep on a pestle.",
    meaning: "Together, people manage things that ought not to be manageable.", theme: "people", sparkReward: R },
  { id: "ta_kin", language: "Tamil", original: "யாதும் ஊரே யாவரும் கேளிர்", romanisation: "Yādhum ūrē yāvarum kēḷir",
    english: "Every town is my town; everyone is my kin.",
    meaning: "Belonging is not something a place grants you. You bring it with you.", theme: "people", sparkReward: R },
  { id: "ur_neki", language: "Urdu", original: "نیکی کر دریا میں ڈال", romanisation: "Nekī kar dariyā meṁ ḍāl",
    english: "Do the good thing, then throw it in the river.",
    meaning: "Do it and let it go. Kindness kept score of is a transaction.", theme: "people", sparkReward: R },
  { id: "bn_ten", language: "Bengali", original: "দশে মিলে করি কাজ, হারি জিতি নাহি লাজ", romanisation: "Dôśe mile kori kaj, hari jiti nahi laj",
    english: "When ten of us work together, there is no shame in losing or winning.",
    meaning: "Doing it side by side takes the sting out of how it turns out.", theme: "people", sparkReward: R },
  { id: "vi_iron", language: "Vietnamese", original: "Có công mài sắt, có ngày nên kim", romanisation: null,
    english: "Grind away at iron, and one day you have a needle.",
    meaning: "Perseverance turns the impossible into the merely finished.", theme: "effort", sparkReward: R },
  { id: "vi_trees", language: "Vietnamese", original: "Một cây làm chẳng nên non, ba cây chụm lại nên hòn núi cao", romanisation: null,
    english: "One tree makes no hill; three together make a mountain.",
    meaning: "What one person cannot manage, a few people quietly can.", theme: "people", sparkReward: R },
  { id: "vi_leaf", language: "Vietnamese", original: "Lá lành đùm lá rách", romanisation: null,
    english: "The whole leaf wraps around the torn one.",
    meaning: "Whoever has a little more that day looks after whoever has a little less.", theme: "people", sparkReward: R },
  { id: "th_slow", language: "Thai", original: "ช้า ๆ ได้พร้าเล่มงาม", romanisation: "Cháa cháa dâai phráa lêm ngaam",
    english: "Go slowly and you get a beautiful blade.",
    meaning: "Careful work produces something worth having.", theme: "effort", sparkReward: R },
  { id: "th_water", language: "Thai", original: "น้ำพึ่งเรือ เสือพึ่งป่า", romanisation: "Nam phueng ruea, suea phueng pa",
    english: "Water depends on the boat; the tiger depends on the forest.",
    meaning: "Everything is held up by something else. Needing people is the ordinary condition.", theme: "people", sparkReward: R },
  { id: "id_united", language: "Indonesian", original: "Bersatu kita teguh, bercerai kita runtuh", romanisation: null,
    english: "Together we stand firm; apart we fall.",
    meaning: "What holds is the company you keep, not how strong any one of you is.", theme: "people", sparkReward: R },
  { id: "ms_together", language: "Malay", original: "Berat sama dipikul, ringan sama dijinjing", romanisation: null,
    english: "The heavy is carried together, the light is carried together.",
    meaning: "You share what is hard and what is easy alike.", theme: "people", sparkReward: R },
  { id: "tl_broom", language: "Filipino", original: "Matibay ang walis, palibhasa'y magkabigkis", romanisation: null,
    english: "The broom is strong because it is bound together.",
    meaning: "A single strand bends; the bundle sweeps. Same strands.", theme: "people", sparkReward: R },

  // ── The Middle East and the Caucasus ────────────────────────────────────────────────────────────
  { id: "ar_patience", language: "Arabic", original: "الصبر مفتاح الفرج", romanisation: "Aṣ-ṣabru miftāḥu al-faraj",
    english: "Patience is the key to relief.",
    meaning: "Hard spells pass for those who can sit with them a while.", theme: "effort", sparkReward: R },
  { id: "ar_haste", language: "Arabic", original: "في التأني السلامة وفي العجلة الندامة", romanisation: "Fī at-ta'annī as-salāma wa fī al-'ajala an-nadāma",
    english: "In taking your time there is safety; in haste there is regret.",
    meaning: "Almost nothing is improved by doing it faster than you can do it well.", theme: "living", sparkReward: R },
  { id: "ar_neighbour", language: "Arabic", original: "الجار قبل الدار", romanisation: "Al-jār qabl ad-dār",
    english: "The neighbour before the house.",
    meaning: "Who is around you shapes your life more than where you are.", theme: "people", sparkReward: R },
  { id: "fa_drop", language: "Persian", original: "قطره قطره جمع گردد وانگهی دریا شود", romanisation: "Qatre qatre jam' gardad, vāngahī daryā shavad",
    english: "Drop gathers to drop, and then it becomes a sea.",
    meaning: "Small things, collected patiently, become something vast.", theme: "effort", sparkReward: R },
  { id: "fa_bani", language: "Persian", original: "بنی آدم اعضای یک پیکرند", romanisation: "Banī ādam a'zāye yek peykarand",
    english: "Human beings are limbs of one body.",
    meaning: "Another person's trouble is not happening somewhere else.", theme: "people", sparkReward: R },
  { id: "he_beginnings", language: "Hebrew", original: "כל ההתחלות קשות", romanisation: "Kol ha-hatḥalot kashot",
    english: "All beginnings are hard.",
    meaning: "Finding the start difficult is normal — not a sign you should stop.", theme: "living", sparkReward: R },
  { id: "tr_hands", language: "Turkish", original: "Bir elin nesi var, iki elin sesi var", romanisation: null,
    english: "What has one hand got? Two hands make a sound.",
    meaning: "Things start happening when people do them together.", theme: "people", sparkReward: R },
  { id: "tr_neighbour", language: "Turkish", original: "Komşu komşunun külüne muhtaçtır", romanisation: null,
    english: "A neighbour has need even of a neighbour's ashes.",
    meaning: "Nobody is so self-sufficient that the people nearby stop mattering.", theme: "people", sparkReward: R },
  { id: "hy_hand", language: "Armenian", original: "Մեկ ձեռքը ծափ չի տա", romanisation: "Mek dzerk'ə tsap' ch'i ta",
    english: "One hand gives no applause.",
    meaning: "Some things simply require another person to exist at all.", theme: "people", sparkReward: R },

  // ── Africa ──────────────────────────────────────────────────────────────────────────────────────
  { id: "sw_haraka", language: "Swahili", original: "Haraka haraka haina baraka", romanisation: null,
    english: "Hurry hurry has no blessing.",
    meaning: "Rushing costs you the quality you were rushing towards.", theme: "living", sparkReward: R },
  { id: "sw_umoja", language: "Swahili", original: "Umoja ni nguvu, utengano ni udhaifu", romanisation: null,
    english: "Unity is strength; division is weakness.",
    meaning: "What you can do together is a different order of thing from what you can do apart.", theme: "people", sparkReward: R },
  { id: "zu_ubuntu", language: "Zulu", original: "Umuntu ngumuntu ngabantu", romanisation: null,
    english: "A person is a person through other people.",
    meaning: "We become ourselves in the company of others, not apart from them.", theme: "people", sparkReward: R },
  { id: "xh_feathers", language: "Xhosa", original: "Intaka yakha ngoboya benye", romanisation: null,
    english: "A bird builds its nest with another bird's feathers.",
    meaning: "Everything anyone makes is made partly of what others gave them.", theme: "people", sparkReward: R },
  { id: "yo_elder", language: "Yoruba", original: "Àgbà kì í wà lọ́jà kí orí ọmọ tuntun wọ́", romanisation: null,
    english: "An elder is not in the market while a newborn's head sits crooked.",
    meaning: "If you can see what someone needs and you are able, you help.", theme: "people", sparkReward: R },
  { id: "yo_wash", language: "Yoruba", original: "Bí ọwọ́ bá wẹ ọwọ́, ọwọ́ á mọ́", romanisation: null,
    english: "If one hand washes the other, both come clean.",
    meaning: "Looking after someone else is not the opposite of being looked after.", theme: "people", sparkReward: R },
  { id: "ig_sibling", language: "Igbo", original: "Onye aghala nwanne ya", romanisation: null,
    english: "Let no one abandon their brother or sister.",
    meaning: "Nobody gets left behind — that is the whole of it.", theme: "people", sparkReward: R },
  { id: "ha_slowly", language: "Hausa", original: "Sannu sannu ba ya hana zuwa", romanisation: null,
    english: "Slowly slowly does not prevent arrival.",
    meaning: "Going gently does not mean you will not get there.", theme: "living", sparkReward: R },
  { id: "tw_hand", language: "Twi", original: "Nsa baako nkura adesoa", romanisation: null,
    english: "One hand cannot lift the load.",
    meaning: "Some things simply cannot be carried without someone else.", theme: "people", sparkReward: R },
  { id: "tw_sankofa", language: "Twi", original: "Sɛ wo werɛ fi na wosankɔfa a yɛnkyi", romanisation: null,
    english: "There is no shame in going back for what you forgot.",
    meaning: "Returning for something you left behind is not a step backwards.", theme: "living", sparkReward: R },
  { id: "am_egg", language: "Amharic", original: "ቀስ በቀስ እንቁላል በእግሩ ይሄዳል", romanisation: "Qes be qes, enqulal be'egru yihedal",
    english: "Little by little, an egg will walk on its own legs.",
    meaning: "Given time and patience, even the impossible gets up and goes.", theme: "effort", sparkReward: R },
  { id: "am_spider", language: "Amharic", original: "ድር ቢያብር አንበሳ ያስር", romanisation: "Dir bīyabr anbessa yasir",
    english: "When spider webs join together, they can tie up a lion.",
    meaning: "Small contributions that look negligible alone are not negligible together.", theme: "people", sparkReward: R },
  { id: "so_knowledge", language: "Somali", original: "Aqoon la'aani waa iftiin la'aan", romanisation: null,
    english: "To be without knowing is to be without light.",
    meaning: "Understanding something changes what you are able to see.", theme: "living", sparkReward: R },
  { id: "wo_remedy", language: "Wolof", original: "Nit nitay garabam", romanisation: null,
    english: "A person is another person's medicine.",
    meaning: "When something is wrong, the treatment is very often just company.", theme: "people", sparkReward: R },
  { id: "mg_spirit", language: "Malagasy", original: "Ny fanahy no maha-olona", romanisation: null,
    english: "It is the spirit that makes a person.",
    meaning: "What someone is like matters more than anything they have.", theme: "living", sparkReward: R },
  { id: "sn_thumb", language: "Shona", original: "Chara chimwe hachitswanyi inda", romanisation: null,
    english: "One thumb cannot crush a louse.",
    meaning: "Even the smallest job can need a second pair of hands.", theme: "people", sparkReward: R },
  { id: "af_unity", language: "Afrikaans", original: "Eendrag maak mag", romanisation: null,
    english: "Unity makes strength.",
    meaning: "Agreement between people is itself a kind of power.", theme: "people", sparkReward: R },

  // ── Western and Southern Europe ─────────────────────────────────────────────────────────────────
  { id: "fr_nest", language: "French", original: "Petit à petit, l'oiseau fait son nid", romanisation: null,
    english: "Little by little, the bird builds its nest.",
    meaning: "Patience and small steps are how substantial things get built.", theme: "effort", sparkReward: R },
  { id: "fr_union", language: "French", original: "L'union fait la force", romanisation: null,
    english: "Unity makes strength.",
    meaning: "Together people manage what none of them could alone.", theme: "people", sparkReward: R },
  { id: "es_bad", language: "Spanish", original: "No hay mal que por bien no venga", romanisation: null,
    english: "There is no bad thing that does not bring some good with it.",
    meaning: "Difficult stretches tend to leave something worth having behind them.", theme: "living", sparkReward: R },
  { id: "es_good", language: "Spanish", original: "Haz bien y no mires a quién", romanisation: null,
    english: "Do good, and don't look at whom.",
    meaning: "Be kind without first checking whether the person has earned it.", theme: "people", sparkReward: R },
  { id: "ca_slowly", language: "Catalan", original: "A poc a poc i bona lletra", romanisation: null,
    english: "Slowly, and in good handwriting.",
    meaning: "Do it at the pace that lets you do it properly.", theme: "living", sparkReward: R },
  { id: "pt_friends", language: "Portuguese", original: "Quem tem amigos não morre nunca", romanisation: null,
    english: "Whoever has friends never really dies.",
    meaning: "You go on existing in the people who were glad of you.", theme: "people", sparkReward: R },
  { id: "it_friend", language: "Italian", original: "Chi trova un amico trova un tesoro", romanisation: null,
    english: "Whoever finds a friend finds a treasure.",
    meaning: "A real friend is rare, and worth treating as rare.", theme: "people", sparkReward: R },
  { id: "ro_friend", language: "Romanian", original: "Prietenul la nevoie se cunoaște", romanisation: null,
    english: "A friend is known in time of need.",
    meaning: "Who turns up when it is difficult tells you everything.", theme: "people", sparkReward: R },
  { id: "el_beginning", language: "Greek", original: "Η αρχή είναι το ήμισυ του παντός", romanisation: "I archí eínai to ímisy tou pantós",
    english: "The beginning is half of everything.",
    meaning: "Most of the difficulty is in getting started at all.", theme: "effort", sparkReward: R },
  { id: "el_unity", language: "Greek", original: "Η ισχύς εν τη ενώσει", romanisation: "I ischýs en ti enósei",
    english: "Strength lies in union.",
    meaning: "People together are not a sum. They are a different quantity.", theme: "people", sparkReward: R },
  { id: "eu_mind", language: "Basque", original: "Asko balio du indarrak, gehiago buru azkarrak", romanisation: null,
    english: "Strength is worth a great deal; a quick mind is worth more.",
    meaning: "Forcing a thing is rarely the best available option.", theme: "living", sparkReward: R },
  { id: "de_shared", language: "German", original: "Geteiltes Leid ist halbes Leid", romanisation: null,
    english: "A sorrow shared is half a sorrow.",
    meaning: "Trouble shrinks the moment you tell someone about it.", theme: "people", sparkReward: R },
  { id: "de_joy", language: "German", original: "Geteilte Freude ist doppelte Freude", romanisation: null,
    english: "A joy shared is a joy doubled.",
    meaning: "Telling someone good news is not bragging. It is the other half of the good news.", theme: "people", sparkReward: R },
  { id: "nl_small", language: "Dutch", original: "Wie het kleine niet eert, is het grote niet weerd", romanisation: null,
    english: "Whoever does not honour small things does not deserve great ones.",
    meaning: "Pay attention to the small things — the large ones are made of them.", theme: "living", sparkReward: R },
  { id: "nl_neighbour", language: "Dutch", original: "Een goede buur is beter dan een verre vriend", romanisation: null,
    english: "A good neighbour is better than a distant friend.",
    meaning: "The people close enough to turn up are the ones who matter most.", theme: "people", sparkReward: R },
  { id: "nl_rain", language: "Dutch", original: "Na regen komt zonneschijn", romanisation: null,
    english: "After rain comes sunshine.",
    meaning: "Weather changes. So does almost everything that feels permanent.", theme: "living", sparkReward: R },

  // ── Northern Europe ─────────────────────────────────────────────────────────────────────────────
  { id: "da_home", language: "Danish", original: "Ude godt, men hjemme bedst", romanisation: null,
    english: "Out is good, but home is best.",
    meaning: "Going away is worth doing. So is having somewhere that is glad you came back.", theme: "living", sparkReward: R },
  { id: "sv_alone", language: "Swedish", original: "Ensam är inte stark", romanisation: null,
    english: "Alone is not strong.",
    meaning: "Managing by yourself is not the same as doing well.", theme: "people", sparkReward: R },
  { id: "no_weather", language: "Norwegian", original: "Det finnes ikke dårlig vær, bare dårlige klær", romanisation: null,
    english: "There is no bad weather, only bad clothing.",
    meaning: "Most of what looks like a bad day is a question of what you brought.", theme: "living", sparkReward: R },
  { id: "is_hands", language: "Icelandic", original: "Margar hendur vinna létt verk", romanisation: null,
    english: "Many hands make light work.",
    meaning: "The job did not get smaller. There are just more of you.", theme: "people", sparkReward: R },
  { id: "fi_smith", language: "Finnish", original: "Ei kukaan ole seppä syntyessään", romanisation: null,
    english: "No one is a blacksmith when they are born.",
    meaning: "Everyone was once new at the thing they are now good at.", theme: "effort", sparkReward: R },

  // ── Central and Eastern Europe ──────────────────────────────────────────────────────────────────
  { id: "pl_friends", language: "Polish", original: "Prawdziwych przyjaciół poznajemy w biedzie", romanisation: null,
    english: "We come to know true friends in hard times.",
    meaning: "Difficulty quietly shows you who was really there.", theme: "people", sparkReward: R },
  { id: "cs_patience", language: "Czech", original: "Trpělivost růže přináší", romanisation: null,
    english: "Patience brings roses.",
    meaning: "The good part usually arrives after the waiting, not instead of it.", theme: "effort", sparkReward: R },
  { id: "sk_heads", language: "Slovak", original: "Viac hláv, viac rozumu", romanisation: null,
    english: "More heads, more sense.",
    meaning: "Asking someone is not an admission. It is how thinking works.", theme: "people", sparkReward: R },
  { id: "hr_unity", language: "Croatian", original: "U slozi je snaga", romanisation: null,
    english: "In harmony there is strength.",
    meaning: "Getting on with each other is not the soft part. It is the load-bearing part.", theme: "people", sparkReward: R },
  { id: "hu_dares", language: "Hungarian", original: "Aki mer, az nyer", romanisation: null,
    english: "Whoever dares, wins.",
    meaning: "Taking the chance is the part that makes the outcome possible.", theme: "effort", sparkReward: R },
  { id: "hu_eyes", language: "Hungarian", original: "Több szem többet lát", romanisation: null,
    english: "More eyes see more.",
    meaning: "What you missed, someone else probably didn't.", theme: "people", sparkReward: R },
  { id: "bg_step", language: "Bulgarian", original: "Работата не е вълк, в гората не бяга", romanisation: "Rabotata ne e valk, v gorata ne byaga",
    english: "Work is not a wolf — it will not run off into the forest.",
    meaning: "Rest when you need to. It will still be there, and so will you.", theme: "living", sparkReward: R },
  { id: "ru_friends", language: "Russian", original: "Не имей сто рублей, а имей сто друзей", romanisation: "Ne imey sto rubley, a imey sto druzey",
    english: "Don't have a hundred roubles — have a hundred friends.",
    meaning: "What you have in people is worth more than what you have in money.", theme: "people", sparkReward: R },
  { id: "uk_agreement", language: "Ukrainian", original: "Де згода, там і сила", romanisation: "De zhoda, tam i syla",
    english: "Where there is agreement, there is strength.",
    meaning: "People who are with each other can do what people at odds cannot.", theme: "people", sparkReward: R },
  { id: "lt_together", language: "Lithuanian", original: "Kur du stos, visados daugiau padarys", romanisation: null,
    english: "Where two stand together, they will always do more.",
    meaning: "Two people are more than twice one.", theme: "people", sparkReward: R },
  { id: "et_help", language: "Estonian", original: "Kus viga näed laita, seal tule ja aita", romanisation: null,
    english: "Where you see a fault to criticise, go there and help instead.",
    meaning: "Noticing what is wrong is the easy half. Turning up is the other half.", theme: "living", sparkReward: R },

  // ── Britain and Ireland ─────────────────────────────────────────────────────────────────────────
  { id: "ga_shelter", language: "Irish", original: "Ar scáth a chéile a mhaireann na daoine", romanisation: null,
    english: "It is in the shelter of each other that people live.",
    meaning: "Not a nice idea about community — a description of how anyone gets through at all.", theme: "people", sparkReward: R },
  { id: "cy_three", language: "Welsh", original: "Tri chynnig i Gymro", romanisation: null,
    english: "Three tries for a Welshman.",
    meaning: "A first attempt that doesn't work is an attempt, not a verdict.", theme: "effort", sparkReward: R },
  { id: "gd_love", language: "Scottish Gaelic", original: "Thig crìoch air an t-saoghal ach mairidh gaol is ceòl", romanisation: null,
    english: "The world will pass, but love and music will last.",
    meaning: "Of everything people make, the things with no use at all are what endure.", theme: "living", sparkReward: R },

  // ── The Pacific and the Americas ────────────────────────────────────────────────────────────────
  { id: "mi_people", language: "Māori", original: "He aha te mea nui o te ao? He tangata, he tangata, he tangata", romanisation: null,
    english: "What is the greatest thing in the world? It is people, it is people, it is people.",
    meaning: "Asked and answered, three times, in case there was any doubt.", theme: "people", sparkReward: R },
  { id: "haw_together", language: "Hawaiian", original: "'A'ohe hana nui ke alu 'ia", romanisation: null,
    english: "No task is too large when everyone takes hold of it.",
    meaning: "Size is relative to how many of you there are.", theme: "people", sparkReward: R },
  { id: "nah_flowers", language: "Nahuatl", original: "Amo tlamiz noxochiuh, amo tlamiz nocuic", romanisation: null,
    english: "My flowers shall not end; my songs shall not cease.",
    meaning: "What you made and gave away outlasts the making of it.", theme: "living", sparkReward: R },
  { id: "ht_hands", language: "Haitian Creole", original: "Men anpil, chay pa lou", romanisation: null,
    english: "Many hands, and the load is not heavy.",
    meaning: "The weight did not change. The carrying did.", theme: "people", sparkReward: R },
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
// A prime stride, for the same reason pickDailyGreetings uses one (greetings.js). The array is
// grouped by region so it can be read and maintained, and walking it one step a day therefore
// walks it one REGION at a time: before this, a user got five consecutive days of Japanese and
// then two of Korean. "A language that is not yours, and a different one tomorrow" is the whole
// premise, so a week inside one country quietly cancels the feature.
//
// Striding by a number coprime with the length still visits every entry exactly once before any
// repeat — that is a property of coprimality, not an approximation — while landing somewhere
// else in the world each day. 37 is prime and does not divide 94. If the file grows to a
// multiple of 37 the cycle would short-circuit; scripts/check-proverbs.cjs walks a full
// PROVERBS.length days for several uids and fails if any of them sees a repeat, so that cannot
// ship unnoticed.
const STRIDE = 37;

export function pickDailyProverb({ uid = "anon", date = new Date(), swap = 0 } = {}) {
  const step = localDayNumber(date) + hytHash(uid) + Math.max(0, swap);
  const i = ((step * STRIDE) % PROVERBS.length + PROVERBS.length) % PROVERBS.length;
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
    // PLAIN, not pre-quoted. It used to be stored with its own curly quotes, which looked right
    // in the feed bubble and doubled up everywhere else — "Who felt this" renders “{message.text}”
    // and produced ""Those who keep trying are never truly defeated."" on screen. Six other call
    // sites quote the same way. The quotes belong to whichever container is presenting it.
    text: p.english,
    sparkReward: p.sparkReward ?? R,
    isMystery: false,
    category: "proverb",
    isPremium: false,
    proverb: p,
  };
}
