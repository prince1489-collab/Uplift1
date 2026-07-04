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

// Keyword-bucketed fallbacks when the AI is unreachable. Deliberately warm and generic.
const FALLBACKS = [
  { match: /nervous|anxious|anxiety|scared|worried|interview|first day|exam|test/i, out: [
    "You've prepared for this more than you realise — you've got this 💪",
    "Nerves just mean it matters. Breathe — you belong in that room 💛",
    "One step at a time. By tonight, this will be a story you tell ✨",
  ]},
  { match: /sad|down|low|blue|cry|grief|loss|heartbrok/i, out: [
    "It's okay to feel this. You don't have to carry it alone 💛",
    "Sending you warmth from afar — gentler days are coming 🌤️",
    "You matter more than you know. One breath at a time 🤍",
  ]},
  { match: /tired|exhausted|drained|burn|overwhelm|stress/i, out: [
    "Rest isn't quitting — it's how you keep going. Be kind to yourself 🌿",
    "You've been carrying a lot. Permission to slow down today 💛",
    "Even on empty, you showed up. That counts for something ✨",
  ]},
  { match: /lonely|alone|isolat|miss/i, out: [
    "Someone across the world just read this and cares. You're not alone 🌍",
    "Sending you a little company from afar 💛",
    "This feeling is real, but so is this: someone's thinking of you right now 🤍",
  ]},
];
const GENERIC = [
  "Whatever today holds, someone out here is rooting for you 💛",
  "You've made it through every hard day so far — that's a 100% record ✨",
  "Sending you a little strength from across the world 🌍",
];

function fallbackFor(text) {
  const hit = FALLBACKS.find((f) => f.match.test(text));
  return hit ? hit.out : GENERIC;
}

export default async function handler(req, res) {
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
          `Write exactly 3 short encouragement messages (each under 120 characters) that a kind ` +
          `stranger could send them. Rules: warm, specific to their feeling, human — not clinical ` +
          `or preachy. No advice-giving, no medical claims, no questions. At most one emoji each. ` +
          `Vary the tone across the three (one grounding, one uplifting, one companionable).\n\n` +
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
