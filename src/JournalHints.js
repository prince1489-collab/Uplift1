// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.
//
// JournalHints.js — three pointers for every Reflect prompt.
//
// ── WHY THESE ARE WRITTEN AND NOT DERIVED ────────────────────────────────────────────────────
// Every one of the 114 prompts opens with What, Who, How or Where, so hints COULD be generated
// from the shape — four families, no writing, always present. That was considered and rejected.
// Derived hints for "What are you carrying into today that you could put down?" would say
// something like "name one thing", which is the question again in smaller type. Written ones say
//
//     a worry that isn't yours · something you've already decided · a conversation you keep replaying
//
// and that is the difference between a hint and a restatement. The point of this file is to shorten
// the distance between reading the question and having something to write, and only the specific
// version does that.
//
// ── THE RULES THEY ARE WRITTEN TO ────────────────────────────────────────────────────────────
// 1. Three per prompt. Two feels thin, four is a menu to choose between rather than a nudge.
// 2. Fragments, not sentences, and never imperatives. These sit under a question in small grey
//    type; a full instruction would read as the app telling somebody how to do their own
//    reflecting, which is the tone the whole tab is written against.
// 3. They open a door, they do not answer. "a name first" is a pointer. "your mother" is a guess
//    about somebody's life.
// 4. At least one that lowers the bar — "however small", "you may never know", "the smallest
//    version counts". The commonest reason a box stays empty is thinking the answer has to be
//    good.
//
// ── KEYED BY THE PROMPT TEXT ─────────────────────────────────────────────────────────────────
// Rather than restructuring the banks into objects, which would touch pickDailyPrompt and every
// check that reads them. The failure mode of keying by text is a prompt being reworded and
// silently losing its pointers — so scripts/check-journal-prompts.cjs asserts that every prompt
// has an entry and that every entry names a real prompt. Neither can drift quietly.

export const PROMPT_HINTS = {
  // ── Morning — what you intend, or what is true now ──────────────────────────────
  "Who could use a kind word from you today?": ["someone you'll see anyway", "someone who's gone quiet", "it can be two sentences"],
  "What would make today feel like a good one?": ["set the bar low", "one thing, not five", "something within your reach"],
  "What act of kindness do you want to do today?": ["name it, so it's real", "who it's for", "when in the day it fits"],
  "Who are you hoping to see today?": ["what you want to ask them", "how long it's been", "what you'd tell them if there's time"],
  "What's one thing you'd like to have finished by tonight?": ["the smallest version counts", "what's been waiting longest", "what finishing would free up"],
  "Who have you been meaning to message?": ["how long it's been", "what you'd say", "why you haven't yet"],
  "What would you like to be more patient about today?": ["a person, a queue, yourself", "what usually tips it", "what you'd rather do instead"],
  "What's the first kind thing you could do this morning?": ["before you leave the house", "for someone in it", "or for yourself"],
  "Who might be having a harder day than they let on?": ["someone who always copes", "what you might do", "you don't need to be sure"],
  "What do you want to give your full attention to today?": ["a person or a piece of work", "for how long", "what you'd have to put down"],
  "What's one thing you could let go of before it starts?": ["a worry that isn't yours", "something you've already decided", "a conversation you keep replaying"],
  "Who would you like to thank today, if you get the chance?": ["what for", "in person or a message", "what you'd actually say"],
  "What would make today easier for someone you live or work with?": ["one thing you could take off them", "something they haven't asked for", "whether they'd notice"],
  "What's a small thing you could do now that tonight-you would thank you for?": ["five minutes, no more", "the one you keep postponing", "what tonight looks like without it"],
  "What are you looking forward to?": ["today, this week, or further", "who's in it", "what makes it worth waiting for"],
  "What's one thing you'd like to be kinder to yourself about today?": ["what you keep criticising", "what you'd say to a friend", "what would change if you let it go"],
  "Who could you check in on this week?": ["someone who's been quiet", "someone going through something", "a name is enough to start"],
  "What would you like today to be about?": ["one word is fine", "what you'd like to remember", "what would have to go right"],
  "Who are you glad is in your life right now?": ["a name", "what they bring", "whether they know"],
  "What's working well in your life right now?": ["something you'd have wished for once", "it needn't be big", "who helped make it so"],
  "What are you carrying into today that you could put down?": ["a worry that isn't yours", "something you've already decided", "a conversation you keep replaying"],
  "How are you, actually?": ["the real answer, not the polite one", "no need to fix it", "name it and leave it there"],
  "What's something you're better at than you were a year ago?": ["a skill, or a way of being", "who'd notice", "what got you there"],
  "What's one thing you don't have to worry about today?": ["something that used to worry you", "something already handled", "someone looking after it"],
  "What does your body need from you today?": ["water, sleep, food, movement, rest", "what you've been ignoring", "the smallest version of it"],
  "What's something you have that you once hoped for?": ["a person, a place, a skill", "when you were hoping", "whether you still notice it"],
  "Where in your life are you being looked after?": ["a person, a system, a routine", "what it quietly saves you", "who you'd thank for it"],
  "What's true today that wasn't true a year ago?": ["about you, or about your life", "whether you saw it coming", "how you feel about it"],
  "What's a small win from this week?": ["something you nearly didn't do", "something nobody praised", "why it counted"],
  "What feels steady at the moment?": ["a person, a habit, a place", "what it holds up", "how long it's been there"],

  // ── Evening — looking back (gratitude) ──────────────────────────────────────────
  "What went better than you expected today?": ["a conversation you'd been dreading", "something that just worked", "a worry that didn't happen"],
  "Who made today easier?": ["someone who did their job well", "a person who didn't have to", "whoever took something off you"],
  "What would you tell someone having the day you just had?": ["the thing you needed to hear", "say it plainly", "no advice — just the truth"],
  "What did you get through that you were dreading?": ["how long you'd put it off", "what it was actually like", "what you'd tell yourself next time"],
  "What's one thing you'd do again tomorrow?": ["however small", "the part that felt right", "something you barely noticed doing"],
  "Who crossed your mind today, and why?": ["a name, then the reason", "someone far away", "someone you haven't told"],
  "What was the best five minutes of your day?": ["where you were", "who was there", "what made it that one"],
  "What did someone say to you today that stuck?": ["their words, not yours", "why it landed", "even if they meant nothing by it"],
  "What did you decide today that you're glad about?": ["a small yes", "a small no", "something you nearly didn't"],
  "What's one thing today that was easier than it used to be?": ["compared with a year ago", "something you once dreaded", "what changed — you or it"],
  "Where did you notice you'd changed?": ["a reaction that surprised you", "something that used to bother you", "what past-you would say"],
  "What were you doing the last time you lost track of time?": ["what pulled you in", "who you were with", "how long it turned out to be"],
  "Who made you smile today?": ["a name", "what they did", "whether they know"],
  "What small beauty did you notice today?": ["light, weather, a face", "something that lasted a second", "somewhere ordinary"],
  "What's something your body let you do today?": ["walk, carry, taste, rest", "something you don't usually thank it for", "however unremarkable"],
  "What made you feel safe or comfortable recently?": ["a place, a person, a routine", "when you noticed it", "what it let you stop doing"],
  "What sound, smell, or taste did you enjoy today?": ["pick one and be specific", "what it reminded you of", "where you were"],
  "Who helped you out lately, even in a tiny way?": ["a stranger counts", "something they'd have forgotten", "whether you thanked them"],
  "What's something you usually take for granted?": ["something you'd miss immediately", "a person or a thing", "why it's easy to stop seeing"],
  "What made you laugh recently?": ["what set it off", "who was there", "whether it still works"],
  "What part of today are you glad happened?": ["a moment, not the whole day", "where you were", "what nearly stopped it"],
  "What comfort did you have today that others might not?": ["warmth, quiet, company, food", "something ordinary to you", "who came to mind"],
  "What surprised you this week?": ["someone's reaction", "something you learned", "something about yourself"],
  "What's a small luxury you enjoyed today?": ["it doesn't have to cost anything", "what made it feel like one", "when you noticed"],
  "What did nature give you today?": ["sky, air, a tree, a bird", "even through a window", "what it did to your mood"],
  "What's a tool or thing that made your day easier?": ["the unglamorous one", "what it saved you", "how long you've had it"],
  "What did you eat today that you enjoyed?": ["what it tasted of", "who made it", "whether you were hurrying"],
  "What's something you're proud of, however small?": ["something nobody praised", "something you nearly skipped", "why it counts"],
  "What gave you a moment of peace today?": ["where you were", "how long it lasted", "what quietened"],
  "What's something good that you almost didn't notice?": ["what nearly took your attention", "what made you look up", "who else saw it"],
  "What made today a little easier than yesterday?": ["one thing, not everything", "someone who helped", "something you did for yourself"],

  // ── Evening — looking back (kindness) ───────────────────────────────────────────
  "Who did you give your full attention to today?": ["phone down, properly", "how long it lasted", "what you noticed that you'd have missed"],
  "What did you let go of that you could have made a point of?": ["what you nearly said", "why you didn't", "how it felt afterwards"],
  "Who would say you made their day easier?": ["they might not have said so", "what you actually did", "whether it cost you anything"],
  "What did you say yes to that you'd usually avoid?": ["what made you hesitate", "what happened", "whether you'd do it again"],
  "Where were you more patient than you felt?": ["who with", "what it took", "what they saw versus what you felt"],
  "Who did you think of and actually tell?": ["the gap between thinking and sending", "what you said", "what came back"],
  "What did you do today that nobody will know about?": ["no audience, no credit", "why you did it anyway", "who it was for"],
  "Who needed you to just listen, and did you?": ["what you wanted to say instead", "what they needed", "how it ended"],
  "What did you notice someone else doing kindly?": ["a stranger counts", "what made you notice", "whether you said so"],
  "Where did you choose the generous reading of someone?": ["what you could have assumed", "what you assumed instead", "what it changed"],
  "Who did you thank for something ordinary?": ["the thing nobody thanks them for", "how you said it", "how they took it"],
  "What would you do differently if today started again?": ["one moment, not the whole day", "what you'd say instead", "be kind about it"],
  "How did you show someone you cared today?": ["it may not have been words", "who it was for", "whether they noticed"],
  "Who did you really listen to recently?": ["what you learned", "what you didn't say", "how they seemed after"],
  "What's a small act of kindness you noticed someone else do?": ["what you saw", "who it was for", "what it would have cost them"],
  "How did you make someone's day a little lighter?": ["one thing you took off them", "or one thing you added", "how you knew they needed it"],
  "What did you share with someone lately?": ["food, time, news, space", "who with", "why them"],
  "Who did you thank, and how?": ["a name and the words", "in person or not", "whether it landed"],
  "How did you help someone without being asked?": ["how you noticed", "what you did", "whether they knew it was you"],
  "How did you make someone feel seen today?": ["what you noticed about them", "how you said it", "what changed in their face"],
  "Who did you check in on recently?": ["someone who always says fine", "what you asked", "what they said"],
  "What did you do for a stranger, however small?": ["held, moved, waited, spoke", "where you were", "whether you'd do it again"],
  "How were you kind to yourself today?": ["rest, food, a boundary, a break", "what you stopped demanding", "whether it felt allowed"],
  "Who did you forgive, or want to?": ["what for", "what forgiving would cost", "you don't have to have finished"],
  "What's something generous you did this week?": ["time, money, attention, patience", "who for", "what you gave up to do it"],
  "How did you make someone laugh or smile?": ["what you said or did", "who it was", "whether you meant to"],
  "Who did you encourage when they doubted themselves?": ["what they were doubting", "what you said", "whether they believed you"],
  "What did you give your time or attention to?": ["a person, a task, a place", "how long", "what you gave up for it"],
  "How did you include someone who might have felt left out?": ["how you noticed", "what you did", "how they responded"],
  "What's a gentle thing you said to someone today?": ["their name and the words", "what you could have said instead", "how they took it"],
  "Who did you help feel less alone?": ["what they were carrying", "what you did", "you may not know if it worked"],
  "How did you show patience with someone?": ["what tested it", "what you did instead", "what it cost you"],
  "What did you do to make a space kinder for others?": ["home, work, a queue, a chat", "what you changed", "who benefited"],
  "Who did you celebrate this week?": ["what they'd done", "how you marked it", "whether anyone else had"],
  "How did you respond kindly when it was hard to?": ["what made it hard", "what you nearly did", "what you did"],
  "What small thing did you do that you hope made a difference?": ["you may never know", "what you did", "who it was for"],
  "Who did you reach out to first?": ["what made you go first", "how long it had been", "what came back"],
  "How did you say thank you in a way that mattered?": ["what made it land", "what you were thanking them for", "how they reacted"],
  "Who did you comfort when they were struggling?": ["what they were facing", "what you said or didn't", "what they needed most"],
  "How did you turn a small moment into a kind one?": ["what the moment was", "what you added", "how long it took"],
  "What did you do today that the world needs more of?": ["however ordinary", "why it matters", "who saw it"],

  // ── Anytime — memory ────────────────────────────────────────────────────────────
  "Who would you thank if they were here right now?": ["a name first", "the thing you'd thank them for", "whether they knew at the time"],
  "What's a memory that still warms you?": ["where it happened", "who was there", "what you can still hear or smell"],
  "What's something kind your past self did for you?": ["a decision that still holds", "something they got through", "what you'd say to them now"],
  "Who taught you something worth knowing?": ["what they taught you", "whether they meant to", "where you use it"],
  "Who in your life is easy to be around?": ["what makes it easy", "how you feel afterwards", "whether you've told them"],
  "What's a place that feels good to be in?": ["what it looks like", "what you hear there", "when you were last"],
  "What's a song, show, or book you're thankful for?": ["when it found you", "what it got you through", "who gave it to you"],
  "What's a kindness someone did for you that you'd like to pass on?": ["what they did", "what it cost them", "who could use it now"],
  "Who showed up for you when it mattered?": ["what was happening", "what they actually did", "whether you've said so"],
  "What's the kindest thing anyone has ever said to you?": ["their words as near as you can", "who said it", "why it stayed"],
  "What did someone once do for you that you've never told them about?": ["what they did", "why you never said", "whether you still could"],
  "Who knew you before you were who you are now?": ["what they'd recognise", "what would surprise them", "what you'd want them to know"],
};
