// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.
//
// hytPrompts.js — the "Have you tried?" prompt bank: small, concrete, doable-today
// acts of kindness across 15 areas of life. Written to feel like a warm nudge from a
// friend, never homework. The bank ships in the bundle (like greetings.js); daily
// selection is deterministic (date + uid), so no server or cron is needed.
//
// Starter bank (~8 per area). Grows toward 20–30 per area over time.

export const HYT_AREAS = [
  {
    id: "work",
    emoji: "💼",
    label: "Work life",
    prompts: [
      "Have you tried… telling a colleague specifically what they did well this week?",
      "Have you tried… replying to that message you've been putting off — kindly and briefly?",
      "Have you tried… crediting someone by name for an idea in a meeting?",
      "Have you tried… asking a quiet teammate how their week is actually going?",
      "Have you tried… writing a two-line thank-you to someone who helped you at work?",
      "Have you tried… letting someone finish their point without jumping in?",
      "Have you tried… sharing something useful you learned instead of keeping it to yourself?",
      "Have you tried… assuming good intent the next time an email reads badly?",
    ],
  },
  {
    id: "home",
    emoji: "🏠",
    label: "Home & family",
    prompts: [
      "Have you tried… doing a chore that isn't yours, without mentioning it?",
      "Have you tried… asking a family member about their day and listening to the whole answer?",
      "Have you tried… leaving a small note for someone at home to find?",
      "Have you tried… making someone's morning easier — tea, breakfast, a packed bag?",
      "Have you tried… calling an older relative just to say hello?",
      "Have you tried… saying sorry first, even if it wasn't all your fault?",
      "Have you tried… telling a family member one thing you appreciate about them?",
      "Have you tried… putting your phone away for one whole mealtime?",
    ],
  },
  {
    id: "friends",
    emoji: "🤝",
    label: "Friendship",
    prompts: [
      "Have you tried… messaging the friend you keep meaning to reply to?",
      "Have you tried… remembering something a friend was worried about and asking how it went?",
      "Have you tried… sending a friend a photo that made you think of them?",
      "Have you tried… being the one to suggest a date, time and place — not just 'we should meet up'?",
      "Have you tried… celebrating a friend's small win like it was a big one?",
      "Have you tried… checking in on the friend who's usually the strong one?",
      "Have you tried… forgiving a small thing without needing to mention it?",
      "Have you tried… telling a friend why you're glad they're your friend?",
    ],
  },
  {
    id: "romance",
    emoji: "💗",
    label: "Romantic life",
    prompts: [
      "Have you tried… thanking your partner for something they do so often it's become invisible?",
      "Have you tried… asking 'how can I make your day easier?' and meaning it?",
      "Have you tried… putting your phone down the moment they start talking?",
      "Have you tried… recreating one tiny thing from your early days together?",
      "Have you tried… complimenting them on who they are, not just how they look?",
      "Have you tried… taking one thing off their plate today without being asked?",
      "Have you tried… saying what you appreciated out loud instead of just thinking it?",
      "Have you tried… planning a small surprise — the size doesn't matter?",
    ],
  },
  {
    id: "hobbies",
    emoji: "⚽",
    label: "Hobbies & sport",
    prompts: [
      "Have you tried… encouraging a beginner instead of correcting them?",
      "Have you tried… thanking a coach, organiser or volunteer who makes it all happen?",
      "Have you tried… inviting someone new to join your hobby?",
      "Have you tried… congratulating an opponent sincerely?",
      "Have you tried… lending or giving away kit you no longer use?",
      "Have you tried… cheering loudest for the person who came last?",
      "Have you tried… teaching someone one small thing you're good at?",
      "Have you tried… showing up for a teammate's big moment?",
    ],
  },
  {
    id: "strangers",
    emoji: "🌍",
    label: "Strangers & public",
    prompts: [
      "Have you tried… letting someone go ahead of you in a queue and meaning it?",
      "Have you tried… giving a genuine compliment to a stranger — and moving on?",
      "Have you tried… smiling at the person serving you and using their name?",
      "Have you tried… helping someone who looks lost, carrying something, or holding a door?",
      "Have you tried… picking up a piece of litter that isn't yours?",
      "Have you tried… giving up your seat before anyone has to ask?",
      "Have you tried… telling a busker or street artist you enjoyed it?",
      "Have you tried… being extra patient with someone who's clearly having a bad day?",
    ],
  },
  {
    id: "digital",
    emoji: "📱",
    label: "Digital life",
    prompts: [
      "Have you tried… leaving a kind comment where you'd normally just scroll past?",
      "Have you tried… messaging someone a genuine 'this made me think of you'?",
      "Have you tried… leaving a five-star review for a small business you love?",
      "Have you tried… not forwarding the gossip, even when it's juicy?",
      "Have you tried… unfollowing accounts that make you unkind, and following ones that don't?",
      "Have you tried… replying to the person everyone else ignored in the group chat?",
      "Have you tried… sharing someone's work with credit and praise?",
      "Have you tried… writing the correction kindly — or not at all?",
    ],
  },
  {
    id: "transactional",
    emoji: "🧾",
    label: "Everyday transactions",
    prompts: [
      "Have you tried… thanking the delivery driver by name from the doorbell screen or in person?",
      "Have you tried… being the kindest customer a stressed worker meets today?",
      "Have you tried… tipping a little extra when someone clearly tried hard?",
      "Have you tried… telling a manager when an employee was brilliant?",
      "Have you tried… cancelling politely and early instead of just not showing up?",
      "Have you tried… being patient when the queue is long and it's nobody's fault?",
      "Have you tried… returning the trolley — and someone else's too?",
      "Have you tried… saying 'no rush' to someone who's rushing for you — and meaning it?",
    ],
  },
  {
    id: "neighbourhood",
    emoji: "🏘️",
    label: "Neighbourhood",
    prompts: [
      "Have you tried… greeting a neighbour by name?",
      "Have you tried… offering to grab something from the shop for a neighbour?",
      "Have you tried… taking a neighbour's bin out or bringing it back in?",
      "Have you tried… checking in on an elderly or new neighbour?",
      "Have you tried… sharing extra food you've cooked or grown?",
      "Have you tried… reporting the broken thing instead of walking past it?",
      "Have you tried… welcoming someone who just moved in?",
      "Have you tried… keeping the shared space a little nicer than you found it?",
    ],
  },
  {
    id: "money",
    emoji: "💷",
    label: "Money life",
    prompts: [
      "Have you tried… giving a small amount to a cause you actually care about?",
      "Have you tried… buying from the small shop instead of the giant, just today?",
      "Have you tried… paying someone promptly who's probably too polite to chase you?",
      "Have you tried… buying a suspended coffee or meal for a stranger?",
      "Have you tried… passing on something valuable for free — freecycle, not landfill?",
      "Have you tried… sponsoring a friend's charity thing, even a little?",
      "Have you tried… teaching someone younger one money lesson you wish you'd known?",
      "Have you tried… being generous quietly, without anyone finding out?",
    ],
  },
  {
    id: "care",
    emoji: "🫶",
    label: "Care life",
    prompts: [
      "Have you tried… sitting with someone who's struggling, without trying to fix it?",
      "Have you tried… offering a lift, an errand, or an hour to someone caring for others?",
      "Have you tried… asking someone ill or grieving what would actually help — then doing it?",
      "Have you tried… sending 'no need to reply' support to someone going through it?",
      "Have you tried… remembering the hard anniversary someone's quietly carrying?",
      "Have you tried… cooking for someone who can't right now?",
      "Have you tried… visiting someone who doesn't get many visitors?",
      "Have you tried… thanking a nurse, carer or teacher for what they do?",
    ],
  },
  {
    id: "learning",
    emoji: "📚",
    label: "Learning & mentoring",
    prompts: [
      "Have you tried… answering a beginner's question without a hint of 'obviously'?",
      "Have you tried… offering 20 minutes of your experience to someone starting out?",
      "Have you tried… recommending a book, course or video to exactly the right person?",
      "Have you tried… telling a former teacher or mentor what they did for you?",
      "Have you tried… sharing your notes or template so someone else doesn't start from zero?",
      "Have you tried… asking a young person what THEY think — and taking it seriously?",
      "Have you tried… admitting 'I don't know' so someone else feels safe to say it too?",
      "Have you tried… celebrating someone's progress instead of their perfection?",
    ],
  },
  {
    id: "self",
    emoji: "🌤️",
    label: "Self life",
    prompts: [
      "Have you tried… speaking to yourself today the way you'd speak to a friend?",
      "Have you tried… taking a ten-minute walk with no phone and no purpose?",
      "Have you tried… drinking a glass of water and taking three slow breaths — right now?",
      "Have you tried… writing down one thing you did well today, however small?",
      "Have you tried… going to bed 30 minutes earlier tonight, as a gift to tomorrow-you?",
      "Have you tried… saying no to one thing you don't have room for?",
      "Have you tried… forgiving yourself for the thing you keep replaying?",
      "Have you tried… doing one small thing today that future-you will thank you for?",
    ],
  },
  {
    id: "nature",
    emoji: "🐦",
    label: "Nature & animals",
    prompts: [
      "Have you tried… leaving water out for birds on a warm day?",
      "Have you tried… taking a bag on your walk and picking up a little litter?",
      "Have you tried… feeding the birds or planting something bee-friendly?",
      "Have you tried… giving a pet ten minutes of undivided attention?",
      "Have you tried… choosing the walk over the drive, just today?",
      "Have you tried… learning the name of one tree, bird or plant near your home?",
      "Have you tried… donating or volunteering for an animal shelter?",
      "Have you tried… letting the spider live?",
    ],
  },
  {
    id: "legacy",
    emoji: "🕯️",
    label: "Legacy life",
    prompts: [
      "Have you tried… writing down one piece of advice you'd want a younger you to hear?",
      "Have you tried… telling someone the story of a person who shaped you?",
      "Have you tried… planting something that will outlive the season?",
      "Have you tried… writing a letter to be read later — by them, or by future you?",
      "Have you tried… passing a skill down to someone younger?",
      "Have you tried… recording an older relative's favourite memory?",
      "Have you tried… starting the tiny tradition you wish existed?",
      "Have you tried… doing one kind thing today that nobody will ever trace back to you?",
    ],
  },
];

// ── deterministic daily selection ─────────────────────────────────────────────
// Same idea as the journal/greeting daily rotation: a stable hash of (uid + date
// + slot) picks prompts, so the "daily 3" is consistent all day on a device with
// no server involvement, and differs between users.

export function hytHash(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
  return h;
}

export function todayKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Returns today's three picks: [focus-area prompt, rotating-area prompt, self prompt].
// `focusIds` = the user's chosen focus areas (3–5). `swaps` bumps a slot to its next
// prompt ("try another") without repeating until the area's bank cycles.
export function pickDaily({ uid = "anon", date = new Date(), focusIds = [], swaps = {} }) {
  const day = todayKey(date);
  const areas = HYT_AREAS;
  const byId = Object.fromEntries(areas.map((a) => [a.id, a]));

  const validFocus = focusIds.filter((id) => byId[id] && id !== "self");
  const focusPool = validFocus.length ? validFocus : areas.filter((a) => a.id !== "self").map((a) => a.id);
  const focusArea = byId[focusPool[hytHash(`${uid}|${day}|focus`) % focusPool.length]];

  const otherPool = areas.filter((a) => a.id !== "self" && a.id !== focusArea.id);
  const rotatingArea = otherPool[hytHash(`${uid}|${day}|rotate`) % otherPool.length];

  const selfArea = byId.self;

  const pick = (area, slot) => {
    const offset = swaps[slot] ?? 0;
    const idx = (hytHash(`${uid}|${day}|${slot}|prompt`) + offset) % area.prompts.length;
    return { areaId: area.id, emoji: area.emoji, label: area.label, slot, text: area.prompts[idx] };
  };

  return [pick(focusArea, "focus"), pick(rotatingArea, "rotate"), pick(selfArea, "self")];
}
