// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.
//
// realLife.js — "Today, in real life" (3.25): the one kind thing to do away from the screen.
//
// ── WHY IT WAS GLOSSED OVER ──────────────────────────────────────────────────────────────────
// It sat fourth of four in the bar, styled like the others, and the other three are finished on
// the phone in a tap. This one cannot be done where you are when you read it. The prompts were
// habits rather than tasks — "Have you tried… letting someone be right about something small?"
// names no moment and no person, and you cannot tell when you have done it — and "Later today"
// was a vague promise whose only reminder was an opt-in one at eight in the evening, after the
// chances had passed. So now:
//
//   • it is its own card at the TOP of the bar until it is done (SeenBar.jsx);
//   • every prompt is an ACT with a moment you will recognise, plus the WORDS to say, because
//     "what do I even say" is what stops people in the moment;
//   • "Later today" became "When?" — this morning, at lunch, on the way home, this evening — and
//     Seen sends the act and the words AT that moment (api/send-reminder.js, realLifeMessage).
//     Deciding when in advance ("implementation intentions") is the best-evidenced way there is
//     of turning "I should" into "I did";
//   • the notification opens the bar, where the card is first and "Done it" is one tap, followed
//     by one warm line and nothing to fill in (3.28: nothing is asked after any act).
//
// ── EVERY ACT PASSES FIVE TESTS (from the old bank, still true) ──────────────────────────────
//   1. under five minutes          2. costs nothing        3. no specific place
//   4. no specific relationship — it works if you live alone and work alone
//   5. not embarrassing to do in public
// …and two more since 3.25:
//   6. you will recognise the moment when it comes      7. you can tell when you have done it
// Prompts from the old bank that failed 6 or 7 ("choosing the kinder interpretation", "letting
// someone change their mind without pointing it out") were dropped rather than forced.
//
// `say` is the words, without quotation marks (the card and the push add them). An ending of "…"
// means "finish it yourself" — the start is the hard part. Straight apostrophes, like the rest of
// the prompt banks. scripts/test-real-life.mjs guards the shape; only reading guards the meaning.

export const REAL_LIFE = [
  { act: "Thank someone who's just doing their job — a driver, a cashier, a cleaner.", say: "Thanks — you made that easy." },
  { act: "Let one person go ahead of you — in a queue, through a door, at a junction.", say: "After you." },
  { act: "Ask someone how they are, then ask once more and wait for the real answer.", say: "No, really — how are you doing?" },
  { act: "Reply to the message you've been putting off.", say: "Sorry for the slow reply — I wanted to answer properly." },
  { act: "Message someone who came into your head today, and tell them so.", say: "You came into my head today — hope you're well." },
  { act: "Say out loud the compliment you'd normally only think.", say: "I keep meaning to say — you're really good at this." },
  { act: "Thank someone for a thing nobody ever thanks them for.", say: "I don't think anyone says this enough — thank you." },
  { act: "Tell someone exactly what they did that helped you.", say: "It really helped when you…" },
  { act: "Ask someone about the thing they love talking about.", say: "How's it going with your…?" },
  { act: "Own up to a small mistake before anyone has to mention it.", say: "I got that wrong — sorry about that." },
  { act: "Put your phone away for one whole conversation.", say: "Hang on, let me put this down — go on." },
  { act: "When someone tells you something hard, don't fix it — just listen.", say: "That sounds really hard." },
  { act: "Thank someone in front of other people, not just in private.", say: "I want to say — they really helped me today." },
  { act: "Ask one more question instead of changing the subject.", say: "And then what happened?" },
  { act: "Next time you're about to correct something small, let it go.", say: "Fair point." },
  { act: "Check in on someone who's gone quiet.", say: "Haven't heard from you in a while — how are things?" },
  { act: "Say yes to a small favour you'd normally dodge.", say: "Sure, happy to." },
  { act: "Learn the name of someone you see all the time — and use it.", say: "I see you all the time — what's your name?" },
  { act: "Apologise without adding a \"but\" on the end.", say: "I'm sorry. That wasn't fair of me." },
  { act: "Ask someone what would help, instead of guessing.", say: "What would actually help right now?" },
  { act: "Ask about something someone told you the last time you spoke.", say: "How did that thing go — the one you mentioned?" },
  { act: "Send something useful to the one person it would help most.", say: "Saw this and thought of you." },
  { act: "Let someone help you, even when saying no would be easier.", say: "Thank you — that would really help." },
  { act: "Say the encouraging thing out loud instead of assuming they know.", say: "You've got this — I mean it." },
  { act: "Be the first to break the silence after a disagreement.", say: "I don't like us being off — can we talk?" },
  { act: "Ask someone older how they learned something they're good at.", say: "How did you learn to do that?" },
  { act: "Notice one thing someone got right today, and tell them.", say: "You got that exactly right." },
  { act: "Tell someone it was good to see them — and mean it.", say: "It was really good to see you." },
  { act: "Tell someone you're proud of them, and why.", say: "I'm proud of you for…" },
  { act: "Before giving advice, ask whether they want it.", say: "Do you want ideas, or shall I just listen?" },
  { act: "Bring the quietest person into the conversation.", say: "What do you think?" },
  { act: "Ask someone's opinion on something you'd usually decide alone.", say: "What would you do?" },
  { act: "Thank someone for being patient with you.", say: "Thanks for being so patient with me." },
  { act: "Check in on someone who seems to have plenty of people already.", say: "No reason — just thinking of you." },
  { act: "Be warm to someone who was short with you.", say: "Hope the rest of your day's easier." },
  { act: "Pass on something good you heard said about someone.", say: "Someone was saying great things about you." },
  { act: "Ask someone about the best part of their day.", say: "What was the best bit of your day?" },
  { act: "Say goodbye properly instead of drifting off.", say: "Take care — it was really good to talk." },
  { act: "Tell someone they don't need to explain themselves.", say: "You don't need to explain — it's fine." },
  { act: "Ask someone to show you the thing they're good at.", say: "Could you show me how you do that?" },
  { act: "End one message with something warm, not just the facts.", say: "Hope your day's going well." },
  { act: "Say the thing you've been meaning to say for weeks.", say: "I've been meaning to tell you…" },
  { act: "Ask someone what they're looking forward to.", say: "What are you looking forward to?" },
  { act: "Thank someone who taught you something you now do without thinking.", say: "I still do it the way you showed me — thank you." },
  { act: "Tell someone that something they said stayed with you.", say: "What you said the other day stayed with me." },
  { act: "Wish someone luck with something they told you about.", say: "Good luck today — you'll be great." },
  { act: "Send someone a photo of something that reminded you of them.", say: "This made me think of you." },
  { act: "Tell someone what you like about having them around.", say: "Things are better with you around." },
  { act: "Say good morning to someone you'd usually walk past.", say: "Morning — how's it going?" },
  { act: "Leave a thank-you or a kind review for someone who helped you.", say: "Thank you — you went out of your way." },
];

// ── When ─────────────────────────────────────────────────────────────────────────────────────
// Moments that already happen in most days, each with the local hour the reminder is sent at.
// `for` finishes "Planned for …" on the card and "Your kind thing for …" on the notification —
// api/send-reminder.js keeps the same four by id (PLAN_FOR), and test-real-life checks they match.
export const MOMENTS = [
  { id: "morning", label: "This morning", for: "this morning", hour: 9 },
  { id: "lunch", label: "At lunch", for: "lunch", hour: 12 },
  { id: "home", label: "On the way home", for: "the way home", hour: 17 },
  { id: "evening", label: "This evening", for: "this evening", hour: 19 },
];

export const momentById = (id) => MOMENTS.find((m) => m.id === id) || null;

// The moments still ahead today: one whose hour has already started can't be reminded about.
export function momentsLeft(now = new Date()) {
  const h = now.getHours();
  return MOMENTS.filter((m) => m.hour > h);
}

export function hourLabel(h) {
  if (h === 0) return "midnight";
  if (h === 12) return "noon";
  return h < 12 ? `${h}am` : `${h - 12}pm`;
}

// What goes on the user document (`realLifePlan`) for the reminder: the act and its words as they
// were shown, the moment, its hour and the LOCAL date — the date is the expiry, exactly like the
// evening cue (eveningCue.js): a plan nobody finished stops matching at their midnight.
export function planFor(item, moment, dateKey) {
  if (!item?.text || !moment || !dateKey) return null;
  return {
    text: String(item.text).slice(0, 160),
    say: item.say ? String(item.say).slice(0, 80) : null,
    moment: moment.id,
    hour: moment.hour,
    date: dateKey,
  };
}

// "Thank someone who's just doing their job — …." → "thank someone who's just doing their job —
// a driver, a cashier, a cleaner", for "Today you did something kind in real life (…)".
export function actAsPhrase(text) {
  const t = String(text || "").trim().replace(/[.!]+$/, "");
  return t ? t.charAt(0).toLowerCase() + t.slice(1) : "";
}
