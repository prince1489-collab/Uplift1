// _screen.js — the text reviewer, shared (3.21).
//
// Moved out of moderate-message.js unchanged, because a second caller arrived: a message sent to
// "a stranger, anywhere in the world" is now DELIVERED to one real person's private inbox
// (_kindness.js), and nothing reaches a person's inbox unscreened. The preset greetings never
// went through this at all — they are the app's own words — but a client can write any text it
// likes to publicMessages, so the delivery screens what it delivers rather than trusting how it
// was made. One reviewer for both, so they can never disagree about what passes.
//
// Contract, unchanged for moderate-message's callers: { ok, reason, checked: true } from the
// model, or the same with source: "wordlist" when the model is unavailable, unparseable or
// throws. Text is always `checked` — see moderate-message.js for why images are not.

import Anthropic from "@anthropic-ai/sdk";

// Lightweight safety net used when the AI is unavailable, so custom encouragement still works
// (rather than being hard-blocked). Catches the obvious stuff; the AI does the nuanced work when
// it's reachable, and user reporting is the final backstop.
// HARD = profanity/slurs: matched even when EMBEDDED / spaced / leetspeak / stretched
// ("motherfucker", "f u c k", "sh1t", "fuuuck"). SOFT = insults: whole-word only, so kind
// phrasing like "you're not stupid" isn't wrongly blocked. The AI is the real reviewer.
const HARD_WORDS = [
  "fuck", "motherfuck", "shit", "bitch", "cunt", "asshole", "arsehole", "bastard",
  "slut", "whore", "wank", "bollock", "twat", "nigger", "nigga", "faggot", "molest",
  "kkk", "nazi", "killyourself",
];
const SOFT_WORDS = ["loser", "idiot", "stupid", "ugly", "worthless", "pathetic", "retard", "dickhead", "hate you"];
function normalize(s) {
  return s.toLowerCase()
    .replace(/[@4]/g, "a").replace(/0/g, "o").replace(/[1!|]/g, "i").replace(/3/g, "e")
    .replace(/[$5]/g, "s").replace(/7/g, "t").replace(/[^a-z]/g, "");
}
export function wordlistCheck(text) {
  // Contact-info / spam fishing: emails, URLs, long digit runs (phone numbers).
  if (/https?:\/\/|www\.|\b[\w.+-]+@[\w-]+\.[\w.-]+\b/.test(text)) {
    return { ok: false, reason: "Let's keep links and contact details out 💛" };
  }
  if (/\d[\d\s().-]{7,}\d/.test(text)) {
    return { ok: false, reason: "Let's keep phone numbers private 💛" };
  }
  const flat = normalize(text);
  const collapsed = flat.replace(/(.)\1+/g, "$1");
  if (HARD_WORDS.find((w) => flat.includes(w) || collapsed.includes(w))) {
    return { ok: false, reason: "Let's keep it kind — try gentler words 💛" };
  }
  const spaced = ` ${text.toLowerCase().replace(/[^a-z\s]/g, " ")} `;
  if (SOFT_WORDS.find((w) => spaced.includes(` ${w} `))) {
    return { ok: false, reason: "Let's keep it kind — try gentler words 💛" };
  }
  return { ok: true };
}

// What the person was writing, in the reviewer's words. "delivered" is the 3.21 case: a kind
// message going privately to one person who did not choose to receive it, which is the most
// targeted thing in the app and is held to the strictest reading.
const ROLES = {
  feeling: "a short public status about how they're feeling",
  post: "a short message in their own words, shared to the public kindness feed where anyone can read it",
  post_anonymous:
    "a short message in their own words, shared ANONYMOUSLY to the public kindness feed. " +
    "Because their name is hidden there is less accountability, so apply the rules STRICTLY: " +
    "anything borderline should be flagged rather than allowed through",
  delivered:
    "a short kind message that will be delivered PRIVATELY to one stranger, who did not choose to " +
    "receive it and will be notified on their phone. Apply the rules STRICTLY: anything borderline " +
    "should be flagged rather than allowed through",
  reply: "a short private encouragement message to someone who shared a difficult feeling",
};

export async function screenText(text, context = "reply", { apiKey = process.env.ANTHROPIC_API_KEY, client = null } = {}) {
  const fallback = () => {
    const wl = wordlistCheck(text);
    return { ok: wl.ok, reason: wl.reason || null, checked: true, source: "wordlist" };
  };
  // No AI available → fall back to the word-list check (still a real check, so callers can send).
  if (!apiKey && !client) return fallback();

  try {
    const ai = client || new Anthropic({ apiKey });
    const role = ROLES[context] || ROLES.reply;
    const response = await ai.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 150,
      messages: [{
        role: "user",
        content:
          `You are the safety reviewer for a kindness app used by people who may be vulnerable. ` +
          `A user wrote ${role}:\n\n"${text}"\n\n` +
          `Flag it ONLY if it contains: harassment/insults/mockery, hate speech, sexual content, ` +
          `encouragement of self-harm, threats, requests for or offers of contact details / money ` +
          `/ links, spam or advertising. Ordinary sadness, worry, venting, or imperfect grammar is ` +
          `FINE and must pass.\n\n` +
          `Reply with ONLY JSON: {"ok": true} or {"ok": false, "reason": "<ten words max, gentle, ` +
          `user-facing>"}.`,
      }],
    });
    const raw = response.content[0]?.text ?? "";
    const match = raw.match(/\{[\s\S]*\}/);
    const parsed = match ? JSON.parse(match[0]) : null;
    if (parsed && typeof parsed.ok === "boolean") {
      return { ok: parsed.ok, reason: parsed.reason || null, checked: true };
    }
    // Malformed AI response → word-list fallback rather than blocking outright.
    return fallback();
  } catch (err) {
    console.error("[screen]", err?.message);
    return fallback();
  }
}
