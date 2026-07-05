// Live AI safety review of user-written text before it's sent (custom encouragement replies
// and feeling statuses). Auth: any signed-in user (verified Firebase ID token).
//
// Fail-safe behaviour is decided by the CALLER via the returned "checked" flag:
//  - custom replies fail CLOSED (client blocks when checked=false — suggestions still work)
//  - feeling posts fail OPEN (client allows when checked=false — 60-char limit + user
//    reporting are the backstop; an AI outage must not block the core loop)

import Anthropic from "@anthropic-ai/sdk";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

function initAdmin() {
  if (!getApps().length) {
    initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)) });
  }
}

const MAX_LEN = 200; // hard input cap; callers enforce their own tighter limits

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
function wordlistCheck(text) {
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

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).end();

  try {
    initAdmin();
    const auth = req.headers["authorization"] || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) return res.status(401).json({ error: "unauthorised" });
    await getAuth().verifyIdToken(token);
  } catch {
    return res.status(401).json({ error: "unauthorised" });
  }

  const text = String(req.body?.text ?? "").trim().slice(0, MAX_LEN);
  const context = req.body?.context === "feeling" ? "feeling" : "reply";
  if (!text) return res.status(400).json({ error: "missing text" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  // No AI available → fall back to the word-list check (still a real check, so callers can send).
  if (!apiKey) {
    const wl = wordlistCheck(text);
    return res.status(200).json({ ok: wl.ok, reason: wl.reason || null, checked: true, source: "wordlist" });
  }

  try {
    const client = new Anthropic({ apiKey });
    const role = context === "feeling"
      ? "a short public status about how they're feeling"
      : "a short private encouragement message to someone who shared a difficult feeling";
    const response = await client.messages.create({
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
      return res.status(200).json({ ok: parsed.ok, reason: parsed.reason || null, checked: true });
    }
    // Malformed AI response → word-list fallback rather than blocking outright.
    const wl = wordlistCheck(text);
    return res.status(200).json({ ok: wl.ok, reason: wl.reason || null, checked: true, source: "wordlist" });
  } catch (err) {
    console.error("[moderate-message]", err?.message);
    const wl = wordlistCheck(text);
    return res.status(200).json({ ok: wl.ok, reason: wl.reason || null, checked: true, source: "wordlist" });
  }
}
