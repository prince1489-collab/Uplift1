// Rewrites a user's own draft post into three warmer, clearer versions of the SAME thought.
// Auth: any signed-in user (verified Firebase ID token).
//
// Unlike /api/feeling-suggest, which writes replies TO someone's text, this rewrites the
// user's own words — so there is no canned fallback. A fixed string cannot rewrite a
// specific sentence, and offering generic filler as "your message, improved" would be worse
// than saying the helper is unavailable. With no API key it returns an empty list and the
// composer says so.
//
// Nothing here publishes anything: the caller drops a chosen suggestion into the textarea,
// and the post is still screened by /api/moderate-message on submit like any other.

import Anthropic from "@anthropic-ai/sdk";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

function initAdmin() {
  if (!getApps().length) {
    initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)) });
  }
}

const MAX_IN = 200;  // generous input cap — the user's draft, before tightening
const MAX_OUT = 80;  // must match MAX_LEN in src/Feed2.jsx, or a suggestion won't fit the box

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).end();

  try {
    initAdmin();
  } catch (err) {
    console.error("[post-suggest] admin init failed — is FIREBASE_SERVICE_ACCOUNT_JSON set?", err?.message);
    return res.status(503).json({ error: "suggest_unavailable" });
  }
  try {
    const auth = req.headers["authorization"] || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) return res.status(401).json({ error: "unauthorised" });
    await getAuth().verifyIdToken(token);
  } catch {
    return res.status(401).json({ error: "unauthorised" });
  }

  const text = String(req.body?.text ?? "").trim().slice(0, MAX_IN);
  if (!text) return res.status(400).json({ error: "missing text" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(200).json({ suggestions: [], source: "unavailable" });

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      messages: [{
        role: "user",
        content:
          `Someone is writing a short public message for a kindness app. Their draft is:\n\n` +
          `"${text}"\n\n` +
          `Rewrite it as exactly 3 alternatives. CRUCIAL: keep THEIR meaning and THEIR voice — ` +
          `you are tidying and warming up what they already said, not replacing it with your own ` +
          `message. Fix awkward phrasing, clumsy grammar and texting shorthand. Keep it ` +
          `recognisably theirs: if they wrote about Monday mornings, all three are about Monday ` +
          `mornings. Each MUST be under ${MAX_OUT} characters — this is a hard limit, count them. ` +
          `No advice, no medical claims, no questions, nothing preachy. At most one emoji each. ` +
          `Vary the three slightly in warmth and rhythm.\n\n` +
          `Reply with ONLY a JSON array of 3 strings.`,
      }],
    });
    const raw = response.content[0]?.text ?? "";
    const match = raw.match(/\[[\s\S]*\]/);
    const parsed = match ? JSON.parse(match[0]) : null;
    // The model overshoots the character limit routinely, so enforce it here rather than
    // trusting the prompt — a suggestion longer than the box is useless.
    const suggestions = Array.isArray(parsed)
      ? parsed
          .filter((s) => typeof s === "string" && s.trim())
          .map((s) => s.trim().slice(0, MAX_OUT))
          .slice(0, 3)
      : [];
    return res.status(200).json({ suggestions, source: suggestions.length ? "ai" : "unavailable" });
  } catch (err) {
    console.error("[post-suggest]", err?.message);
    return res.status(200).json({ suggestions: [], source: "unavailable" });
  }
}
