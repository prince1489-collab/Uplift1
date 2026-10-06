// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.
//
// /api/understand — the server half of "Seen", the AI conversation pinned in Messages (3.15).
//
//   { mode: "reply" }    Seen answers the person's latest message: a short, specific
//                        acknowledgement of an answer, or an honest reply to a question about
//                        themselves. At most REPLIES_PER_DAY a day.
//   { mode: "reflect" }  When enough has been said since last time (_seen.js reflectionDue),
//                        Seen looks at what they SAID and DID and, if something is genuinely
//                        supported, writes a "Seen noticed" message with the evidence — plus a
//                        nudge back towards a real person when they named one.
//
// Everything is written to users/{uid}/seenChat (owner-readable; only this server writes Seen's
// side) and users/{uid}/understanding/state (themes, timing, the next follow-up question).
// The rules live in _seen.js and are tested in scripts/test-understanding.mjs; this file only
// reads, calls the model and writes. Anything that sounds like someone in difficulty is never
// sent for analysis: it gets a kind line and where to find support, and nothing else.

import Anthropic from "@anthropic-ai/sdk";
import { getFirestore } from "firebase-admin/firestore";
import { cors, requireCaller } from "./_auth.js";
import {
  safetyLevel, supportMessage, guardReply, guardReflection, buildDigest, validateReflections, mergeThemes,
  reflectionDue, replyAllowed, nudgeFor, parseJson, replyPrompt, reflectPrompt,
} from "./_seen.js";

const REPLY_MODEL = "claude-haiku-4-5-20251001";
const REFLECT_MODEL = "claude-sonnet-5-5";
const FALLBACK_REPLY = "Thank you for telling me. I've kept it with everything else you've shared.";
const DAY = 86400000;

const todayKey = (now, tz) => {
  try { return new Intl.DateTimeFormat("en-CA", { timeZone: tz || "UTC", year: "numeric", month: "2-digit", day: "2-digit" }).format(now); }
  catch { return new Date(now).toISOString().slice(0, 10); }
};

async function load(db, uid, now) {
  const userRef = db.collection("users").doc(uid);
  const [userSnap, chatSnap, feelSnap, stateSnap] = await Promise.all([
    userRef.get(),
    userRef.collection("seenChat").orderBy("createdAt", "desc").limit(60).get(),
    userRef.collection("feelings").orderBy("createdAt", "desc").limit(40).get(),
    userRef.collection("understanding").doc("state").get(),
  ]);
  const user = userSnap.exists ? userSnap.data() : {};
  const chat = chatSnap.docs.map((d) => ({ id: d.id, ...d.data() })).reverse();
  const feelings = feelSnap.docs.map((d) => d.data()).filter((f) => Number(f.createdAt) >= now - 30 * DAY);
  const state = stateSnap.exists ? stateSnap.data() : {};
  // Answers are the person's messages that followed a question from Seen.
  const answers = [];
  let lastQ = null;
  for (const m of chat) {
    if (m.role === "seen" && m.kind === "question") lastQ = m;
    if (m.role === "me" && m.kind === "answer") answers.push({ ...m, question: lastQ?.text || "" });
  }
  return { userRef, user, chat, feelings, state, answers };
}

// The heart of it, with the database and the model passed in so it can be tested without either.
export async function handle(body, { db, uid, ai, now = Date.now() }) {
  const ctx = await load(db, uid, now);
  const { userRef, user, chat, state } = ctx;
  if (!user?.seenAI?.consent) return { status: 403, json: { error: "not_enabled" } };
  const chatRef = userRef.collection("seenChat");
  const stateRef = userRef.collection("understanding").doc("state");
  const write = (msg) => chatRef.add({ role: "seen", read: false, createdAt: now, ...msg });
  const day = todayKey(now, user.timezone);
  const name = String(user.name || user.displayName || "").split(" ")[0] || null;

  if (body?.mode === "reply") {
    const last = chat[chat.length - 1];
    if (!last || last.role !== "me") return { status: 200, json: { skipped: "nothing_to_answer" } };
    // Difficulty first: no analysis, no model call — a kind line and where to find support.
    const level = safetyLevel(last.text);
    if (level !== "ok") {
      await write({ kind: "support", level, text: supportMessage(level) });
      await stateRef.set({ safetyAt: now, safety: level }, { merge: true });
      return { status: 200, json: { wrote: "support" } };
    }
    if (!replyAllowed(state, day)) {
      // Said once, then quiet until tomorrow.
      if ((state.replies?.n || 0) === 5) {
        await write({ kind: "reply", text: "I've loved hearing from you today. I'll be here tomorrow — and in the meantime, someone you know might like to hear from you too. 💛" });
        await stateRef.set({ replies: { day, n: 6 } }, { merge: true });
      }
      return { status: 200, json: { skipped: "daily_limit" } };
    }
    const evidence = buildDigest({ answers: ctx.answers, feelings: ctx.feelings, user, now });
    let text = null;
    try {
      const p = replyPrompt({ chat, themes: state.themes || [], evidence, name });
      text = guardReply(await ai({ model: REPLY_MODEL, system: p.system, user: p.user, max_tokens: 300 }));
    } catch (err) { console.error("[understand] reply model failed", err?.status || err?.message); }
    await write({ kind: "reply", text: text || FALLBACK_REPLY });
    const n = state.replies?.day === day ? (state.replies.n || 0) + 1 : 1;
    await stateRef.set({ replies: { day, n } }, { merge: true });
    return { status: 200, json: { wrote: "reply", fallback: !text } };
  }

  if (body?.mode === "reflect") {
    if (!reflectionDue({ answers: ctx.answers, lastReflect: state.lastReflect, now })) return { status: 200, json: { skipped: "not_due" } };
    // Never analyse while the last thing they said sounded like difficulty.
    if (now - Number(state.safetyAt || 0) < 3 * DAY) return { status: 200, json: { skipped: "care" } };
    const items = buildDigest({ answers: ctx.answers, feelings: ctx.feelings, user, now });
    const applied = new Set(state.appliedFeedback || []);
    const feedback = chat.filter((m) => m.kind === "reflection" && m.feedback && m.theme && !applied.has(m.id))
      .map((m) => ({ id: m.id, theme: m.theme, feedback: m.feedback }));
    let out = null;
    const p = reflectPrompt({ items, themes: state.themes || [], feedback });
    for (const model of [REFLECT_MODEL, REPLY_MODEL]) {
      try { out = parseJson(await ai({ model, system: p.system, user: p.user, max_tokens: 900 })); if (out) break; }
      catch (err) { console.error("[understand] reflect model failed", model, err?.status || err?.message); }
    }
    if (!out) return { status: 200, json: { skipped: "model_unavailable" } };
    if (out.safety === "crisis" || out.safety === "concern") {
      await write({ kind: "support", level: out.safety, text: supportMessage(out.safety) });
      await stateRef.set({ lastReflect: now, safetyAt: now, safety: out.safety }, { merge: true });
      return { status: 200, json: { wrote: "support" } };
    }
    const reflections = validateReflections(out.reflections, items);
    for (const r of reflections) await write({ kind: "reflection", text: r.text, theme: r.theme, evidence: r.evidence, feedback: null });
    const nudge = nudgeFor(user, day);
    if (reflections.length && nudge && !chat.some((m) => m.kind === "nudge" && m.name === nudge.name && now - Number(m.createdAt) < 3 * DAY)) {
      await write({ kind: "nudge", text: nudge.text, name: nudge.name });
    }
    const freshThemes = [...reflections.map((r) => r.theme), ...(Array.isArray(out.themes) ? out.themes : [])]
      .map((t) => guardReflection(t, 40)).filter(Boolean).map((t) => t.toLowerCase());
    const followUp = guardReflection(out.followUp, 120);
    await stateRef.set({
      lastReflect: now,
      themes: mergeThemes(state.themes || [], [...new Set(freshThemes)], feedback, now),
      appliedFeedback: [...applied, ...feedback.map((f) => f.id)].slice(-100),
      ...(followUp && /\?$/.test(followUp) ? { followUp: { q: followUp, at: now } } : {}),
    }, { merge: true });
    return { status: 200, json: { wrote: reflections.length } };
  }
  return { status: 400, json: { error: "unknown_mode" } };
}

export default async function handler(req, res) {
  if (!cors(req, res)) return;
  const uid = await requireCaller(req, res, "understand");
  if (!uid) return;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const client = apiKey ? new Anthropic({ apiKey }) : null;
  const ai = async ({ model, system, user, max_tokens }) => {
    if (!client) throw new Error("no_api_key");
    const r = await client.messages.create({ model, max_tokens, system, messages: [{ role: "user", content: user }] });
    return r.content?.find?.((c) => c.type === "text")?.text ?? "";
  };
  try {
    const { status, json } = await handle(req.body || {}, { db: getFirestore(), uid, ai });
    return res.status(status).json(json);
  } catch (err) {
    console.error("[understand] failed", err?.code || err?.message);
    return res.status(500).json({ error: "failed" });
  }
}
