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

export default async function handler(req, res) {
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
  if (!apiKey) return res.status(200).json({ ok: true, checked: false });

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
    return res.status(200).json({ ok: true, checked: false });
  } catch (err) {
    console.error("[moderate-message]", err?.message);
    return res.status(200).json({ ok: true, checked: false });
  }
}
