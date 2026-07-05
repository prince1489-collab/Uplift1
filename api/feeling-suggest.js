// Generates 3 short, tailored encouragement suggestions for a feeling status.
// Called ONCE per feeling by the poster's client at post time; the suggestions are stored
// on the feeling doc, so every viewer sees the same three (one AI call per feeling, not per
// viewer). Auth: any signed-in user (verified Firebase ID token). Falls back to a canned
// keyword-bucketed set when the AI is unavailable — the kindness loop must never be blocked.

import Anthropic from "@anthropic-ai/sdk";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

function initAdmin() {
  if (!getApps().length) {
    initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)) });
  }
}

const MAX_FEELING_LEN = 60;

// Keyword-bucketed fallbacks when the AI is unreachable. Ordered most-specific first; positive
// feelings get CELEBRATORY replies (not comfort), because "excited" shouldn't get "hang in there".
const FALLBACKS = [
  // ── positive / celebratory ──
  { match: /excit|can'?t wait|looking forward|pumped|thrilled/i, out: [
    "Love this energy — go make today yours! 🎉",
    "Whatever you're excited for, you've earned it. Enjoy every second ✨",
    "That spark is contagious — someone across the world just smiled reading this 🌍",
  ]},
  { match: /happy|great|amazing|wonderful|good day|feeling good|joy|cheer|smil/i, out: [
    "Your good day just reached someone far away — thank you for that 💛",
    "Hold onto this feeling. You deserve every bit of it ✨",
    "Days like this are worth savouring — soak it all in 🌞",
  ]},
  { match: /grateful|thankful|blessed|appreciat/i, out: [
    "Gratitude looks good on you 💛",
    "Noticing the good is a quiet superpower — keep it up 🌿",
    "Someone far away is grateful for you right now, too ✨",
  ]},
  { match: /proud|accomplish|achiev|did it|finished|passed|nailed|won/i, out: [
    "You did that — take a moment to feel proud 🎉",
    "Hard work meeting its moment. Well done, truly 💪",
    "Celebrating you from across the world right now ✨",
  ]},
  { match: /hopeful|optimis|excited for the future|new chapter|fresh start/i, out: [
    "Here's to what's coming — it's lucky to have you 🌅",
    "That hope will carry you further than you think 💛",
    "New chapters suit you. Go write a good one ✨",
  ]},
  // ── nervous / anxious ──
  { match: /nervous|anxious|anxiety|scared|worried|interview|first day|exam|test|presentation/i, out: [
    "You've prepared for this more than you realise — you've got this 💪",
    "Nerves just mean it matters. Breathe — you belong there 💛",
    "One step at a time. By tonight, this will be a story you tell ✨",
  ]},
  // ── sad / grief ──
  { match: /sad|down|low|blue|cry|grief|loss|heartbrok|lost|miss(ing)? (my|someone)/i, out: [
    "It's okay to feel this. You don't have to carry it alone 💛",
    "Sending you warmth from afar — gentler days are coming 🌤️",
    "You matter more than you know. One breath at a time 🤍",
  ]},
  // ── tired / overwhelmed ──
  { match: /tired|exhaust|drain|burn(t|ed| out)?|overwhelm|stress|so much|too much|swamp/i, out: [
    "Rest isn't quitting — it's how you keep going. Be gentle with yourself 🌿",
    "You've been carrying a lot. Permission to slow down today 💛",
    "Even on empty, you showed up. That counts for something ✨",
  ]},
  // ── lonely ──
  { match: /lonely|alone|isolat|no one|nobody/i, out: [
    "Someone across the world just read this and cares. You're not alone 🌍",
    "Sending you a little company from afar 💛",
    "This feeling is real, but so is this: someone's thinking of you right now 🤍",
  ]},
  // ── angry / frustrated ──
  { match: /angry|frustrat|annoy|mad|fed up|irritat|unfair/i, out: [
    "That frustration is valid — you're allowed to feel it 💛",
    "Take a breath. You'll find your footing again 🌿",
    "Whatever's testing you today, it doesn't get the last word ✨",
  ]},
  // ── unwell ──
  { match: /sick|ill|unwell|pain|hurt|poorly|headache|fever/i, out: [
    "Be kind to your body today — rest is allowed 🍵",
    "Sending you gentle get-well warmth from far away 💛",
    "Hope you feel more like yourself soon 🌿",
  ]},
];
const GENERIC = [
  "Whatever today holds, someone out here is rooting for you 💛",
  "You've made it through every day so far — that's a 100% record ✨",
  "Sending you a little warmth from across the world 🌍",
];

function fallbackFor(text) {
  const hit = FALLBACKS.find((f) => f.match.test(text));
  return hit ? hit.out : GENERIC;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).end();

  // Verify the caller is a signed-in user.
  try {
    initAdmin();
    const auth = req.headers["authorization"] || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) return res.status(401).json({ error: "unauthorised" });
    await getAuth().verifyIdToken(token);
  } catch {
    return res.status(401).json({ error: "unauthorised" });
  }

  const text = String(req.body?.text ?? "").trim().slice(0, MAX_FEELING_LEN);
  if (!text) return res.status(400).json({ error: "missing text" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(200).json({ suggestions: fallbackFor(text), source: "fallback" });

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      messages: [{
        role: "user",
        content:
          `Someone on a kindness app shared how they're feeling: "${text}"\n\n` +
          `Write exactly 3 short messages (each under 120 characters) a kind stranger could send ` +
          `in response. CRUCIAL: match the emotion. If they're happy/excited/proud/grateful, ` +
          `CELEBRATE with them — do NOT send comfort or "hang in there". If they're anxious/sad/` +
          `tired/lonely, offer warmth and steadiness. Always specific to what they actually said, ` +
          `human and warm — never clinical, preachy, or generic. No advice, no medical claims, no ` +
          `questions. At most one emoji each. Vary the three in tone.\n\n` +
          `Reply with ONLY a JSON array of 3 strings.`,
      }],
    });
    const raw = response.content[0]?.text ?? "";
    const match = raw.match(/\[[\s\S]*\]/);
    const parsed = match ? JSON.parse(match[0]) : null;
    const suggestions = Array.isArray(parsed)
      ? parsed.filter((s) => typeof s === "string" && s.trim()).map((s) => s.trim().slice(0, 120)).slice(0, 3)
      : [];
    if (suggestions.length !== 3) {
      return res.status(200).json({ suggestions: fallbackFor(text), source: "fallback" });
    }
    return res.status(200).json({ suggestions, source: "ai" });
  } catch (err) {
    console.error("[feeling-suggest]", err?.message);
    return res.status(200).json({ suggestions: fallbackFor(text), source: "fallback" });
  }
}
