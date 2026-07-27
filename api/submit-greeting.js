// Self-serve community-greeting submission with INSTANT AI moderation (replaces admin approval).
// A signed-in user posts a greeting; we moderate it here (Anthropic Haiku, multilingual — swearing
// in any language, slurs/racism, hate, sexual content, harassment, contact-info/spam), and if it's
// clean we write it straight to greetingSubmissions with status:"approved" (so it appears on the
// leaderboard immediately and flows into the weekly champion rotation) and award the author sparks.
// If it fails, nothing is written and the user gets a gentle "doesn't meet guidelines" reason.
//
// The write happens via the Admin SDK (bypasses Firestore rules), and firestore.rules forbids client
// creates, so moderation can't be bypassed by writing to Firestore directly.

import Anthropic from "@anthropic-ai/sdk";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function initAdmin() {
  if (!getApps().length) {
    initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)) });
  }
}

const MIN_LEN = 10;
const MAX_LEN = 80;
const DAILY_SUBMISSION_LIMIT = 5;
const APPROVAL_REWARD = 50;

function startOfTodayMs() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

// English word-list fallback (used only when the AI is unavailable). The AI is the real,
// multilingual reviewer; this catches the obvious English cases (including EMBEDDED / spaced /
// leetspeak / stretched variants — e.g. "motherfucker", "f u c k", "sh1t", "fuuuck") so the
// feature stays safe without the AI. Words chosen so substring-matching rarely false-positives.
const BAD_WORDS = [
  "fuck", "motherfuck", "shit", "bitch", "cunt", "asshole", "arsehole", "bastard",
  "slut", "whore", "wank", "bollock", "twat", "nigger", "nigga", "faggot", "molest",
  "kkk", "nazi", "killyourself", "retard", "dickhead",
];
function normalize(s) {
  return s.toLowerCase()
    .replace(/[@4]/g, "a").replace(/0/g, "o").replace(/[1!|]/g, "i").replace(/3/g, "e")
    .replace(/[$5]/g, "s").replace(/7/g, "t")
    .replace(/[^a-z]/g, ""); // drop spaces/punctuation → catches "f u c k", "f.u.c.k", "sh!t"
}
function wordlistCheck(text) {
  if (/https?:\/\/|www\.|\b[\w.+-]+@[\w-]+\.[\w.-]+\b/i.test(text)) {
    return { ok: false, reason: "Please keep links and contact details out." };
  }
  const flat = normalize(text);                     // "hellomotherfucker"
  const collapsed = flat.replace(/(.)\1+/g, "$1");  // "fuuuck" → "fuck", "shhhit" → "shit"
  const hit = BAD_WORDS.find((w) => flat.includes(w) || collapsed.includes(w));
  if (hit) return { ok: false, reason: "Please keep it kind and clean for everyone." };
  return { ok: true };
}

async function moderate(text) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return wordlistCheck(text);
  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 150,
      messages: [{
        role: "user",
        content:
          `You review submissions to a PUBLIC library of kind greetings that any user (including ` +
          `vulnerable people and children) can send to strangers. A user submitted this greeting:\n\n` +
          `"${text}"\n\n` +
          `REJECT it if it contains ANY of these, IN ANY LANGUAGE (check non-English swear words and ` +
          `slurs too): profanity/swearing, racial or ethnic slurs, hate or degrading content toward any ` +
          `group, sexual or crude content, harassment/insults/threats, self-harm encouragement, ` +
          `contact details, links, or advertising/spam. It must read as a warm, kind, universally ` +
          `shareable greeting. Ordinary imperfect grammar is fine.\n\n` +
          `Reply with ONLY JSON: {"ok": true} or {"ok": false, "reason": "<max 12 words, gentle, ` +
          `user-facing>"}.`,
      }],
    });
    const raw = response.content[0]?.text ?? "";
    const match = raw.match(/\{[\s\S]*\}/);
    const parsed = match ? JSON.parse(match[0]) : null;
    if (parsed && typeof parsed.ok === "boolean") {
      return { ok: parsed.ok, reason: parsed.reason || "This greeting doesn't meet our community guidelines." };
    }
    return wordlistCheck(text); // malformed AI response → fall back rather than block outright
  } catch (err) {
    console.error("[submit-greeting] moderation", err?.message);
    return wordlistCheck(text);
  }
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).end();

  let uid;
  try {
    initAdmin();
  } catch (err) {
    console.error("[submit-greeting] admin init failed — is FIREBASE_SERVICE_ACCOUNT_JSON set?", err?.message);
    return res.status(503).json({ error: "moderation_unavailable" });
  }
  try {
    const auth = req.headers["authorization"] || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) return res.status(401).json({ error: "unauthorised" });
    uid = (await getAuth().verifyIdToken(token)).uid;
  } catch {
    return res.status(401).json({ error: "unauthorised" });
  }

  const text = String(req.body?.text ?? "").trim();
  if (text.length < MIN_LEN) return res.status(200).json({ ok: false, reason: `Please write at least ${MIN_LEN} characters.` });
  if (text.length > MAX_LEN) return res.status(200).json({ ok: false, reason: `Keep it under ${MAX_LEN} characters.` });

  try {
    const db = getFirestore();

    // Daily-limit + exact-duplicate guard (server-authoritative).
    const mineSnap = await db.collection("greetingSubmissions").where("authorUid", "==", uid).get();
    const since = startOfTodayMs();
    const todayCount = mineSnap.docs.filter((d) => (d.data().createdAt ?? 0) >= since).length;
    if (todayCount >= DAILY_SUBMISSION_LIMIT) {
      return res.status(200).json({ ok: false, reason: "You've reached today's submission limit — try again tomorrow!" });
    }
    if (mineSnap.docs.some((d) => (d.data().text ?? "").trim().toLowerCase() === text.toLowerCase())) {
      return res.status(200).json({ ok: false, reason: "You've already submitted this one." });
    }

    // Instant AI moderation.
    const verdict = await moderate(text);
    if (!verdict.ok) {
      return res.status(200).json({ ok: false, reason: verdict.reason || "This greeting doesn't meet our community guidelines." });
    }

    // Author display fields from the authoritative profile doc.
    const userSnap = await db.collection("users").doc(uid).get();
    const u = userSnap.exists ? userSnap.data() : {};

    // Write it live (approved) + award the author sparks.
    const ref = await db.collection("greetingSubmissions").add({
      text,
      category: "community",
      authorUid: uid,
      authorName: u.fullName ?? "Someone",
      authorCountry: u.country ?? null,
      status: "approved",
      createdAt: Date.now(),
      approvedAt: Date.now(),
      upvotes: 0,
      voters: {},
      sentCount: 0,
      reportCount: 0,
      reporters: {},
    });

    try {
      await db.runTransaction(async (tx) => {
        const userRef = db.collection("users").doc(uid);
        const snap = await tx.get(userRef);
        const bal = Number(snap.exists ? snap.data().sparkBalance ?? 0 : 0);
        tx.set(userRef, { sparkBalance: bal + APPROVAL_REWARD }, { merge: true });
      });
    } catch (_) { /* reward best-effort */ }

    return res.status(200).json({ ok: true, id: ref.id, reward: APPROVAL_REWARD });
  } catch (err) {
    console.error("[submit-greeting]", err?.message);
    return res.status(500).json({ ok: false, reason: "Couldn't submit right now — please try again." });
  }
}
