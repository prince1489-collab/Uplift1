// notify-reply.js — push someone when they receive a private reply.
//
// This is the notification that should have existed first. A ❤️ pushed your phone; a private
// reply — a stranger writing you something personal, the most meaningful thing that happens in
// this app — arrived in complete silence. `useInboxReplies` had been written and exported but
// was never called anywhere, so there was no bell row either.
//
// Authenticated from the start, and nothing in the request body is trusted beyond the reply id:
// the server reads the reply document, requires the caller to be its author, and takes the
// recipient and the sender's name FROM that document. So you can only trigger a push for a
// reply you actually sent, and its text cannot be chosen by the caller.
//
// ── { messageId }: DELIVERING A MESSAGE TO A STRANGER (3.21) ────────────────────────────────
// The second thing this route does, because the project is at Vercel's twelve-function limit and
// it is the same shape of job: read a document the caller wrote, find who it is for, push them.
// Here the server also CHOOSES who it is for — see _kindness.js for who, what is checked, and why
// the client never gets a say. The answer tells the sender only the recipient's country.
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { cors, requireCaller, pushEnvelope, tokensFor, dropDeadToken, linkFor } from "./_auth.js";
import { deliverKindness, deliveryPush } from "./_kindness.js";
import { screenText } from "./_screen.js";

async function pushTo(db, uid, body, opts, tag) {
  const userSnap = await db.collection("users").doc(uid).get();
  const rows = tokensFor(userSnap.data());
  if (!rows.length) return { sent: 0, devices: 0 };
  const results = await Promise.allSettled(rows.map((r) => getMessaging().send(pushEnvelope(r.token, body, r.platform, opts))));
  let sent = 0;
  await Promise.all(results.map(async (result, i) => {
    if (result.status === "fulfilled") { sent += 1; return; }
    const code = result.reason?.code;
    console.error(`[${tag}]`, code, result.reason?.message);
    if (code === "messaging/registration-token-not-registered") await dropDeadToken(db, uid, rows[i]);
  }));
  return { sent, devices: rows.length };
}

async function deliver(req, res, callerUid, messageId) {
  try {
    const db = getFirestore();
    const result = await deliverKindness({
      db, uid: callerUid, messageId,
      screen: (text) => screenText(text, "delivered"),
    });
    if (result.delivered && result.toUid && !result.already) {
      const msg = (await db.collection("publicMessages").doc(String(messageId)).get()).data() || {};
      const { title, body } = deliveryPush(msg);
      // Best effort: the delivery is written whether or not a phone hears about it — the
      // message waits at the top of their app either way.
      await pushTo(db, result.toUid, body, { title, link: linkFor("kindness") }, "deliver").catch((err) => {
        console.error("[deliver] push", err?.code, err?.message);
      });
    }
    // Never the recipient's uid: the sender learns where their words went, not who has them.
    return res.status(200).json(result.delivered
      ? { delivered: true, country: result.country ?? null }
      : { delivered: false, reason: result.reason });
  } catch (err) {
    if (err?.status) return res.status(err.status).json({ error: err.message });
    console.error("[deliver]", err?.code, err?.message);
    return res.status(500).json({ error: err?.code || "internal" });
  }
}

export default async function handler(req, res) {
  if (!cors(req, res)) return;

  const callerUid = await requireCaller(req, res, "notify-reply");
  if (!callerUid) return;

  const { replyId, messageId } = req.body ?? {};
  if (messageId) return deliver(req, res, callerUid, messageId);
  if (!replyId) return res.status(400).json({ error: "missing replyId" });

  let toUid = null;
  try {
    const db = getFirestore();

    const snap = await db.collection("privateReplies").doc(String(replyId)).get();
    if (!snap.exists) return res.status(404).json({ error: "no such reply" });
    const reply = snap.data() || {};
    if (reply.fromUid !== callerUid) return res.status(403).json({ error: "not your reply" });

    toUid = reply.toUid;
    if (!toUid || toUid === callerUid) return res.status(400).json({ error: "bad recipient" });

    const userSnap = await db.collection("users").doc(toUid).get();
    const rows = tokensFor(userSnap.data());
    if (!rows.length) return res.status(200).json({ skipped: "no token" });

    // The two directions read differently, and the difference matters: one is a stranger
    // reaching out, the other is someone answering you. `inReplyTo` is what distinguishes
    // them, and it is set only on the single permitted reply back.
    const name = String(reply.fromName || "Someone").trim() || "Someone";
    // A first reply is someone telling you how your words landed — the strongest "you were seen"
    // this app can send, so it says so. A final is the last of the three messages.
    const body = reply.final
      ? `${name} wrote back one last time 💬`
      : reply.inReplyTo
      ? `${name} replied back 💬`
      : !reply.messageId
      ? `${name} sent you a kind note 💌`
      : `${name} told you how your words made them feel 💬`;

    const results = await Promise.allSettled(
      rows.map((r) => getMessaging().send(pushEnvelope(r.token, body, r.platform, {
        title: "Someone wrote to you 💬",
        link: linkFor("replies"),
      })))
    );
    let sent = 0;
    await Promise.all(results.map(async (result, i) => {
      if (result.status === "fulfilled") { sent += 1; return; }
      const code = result.reason?.code;
      console.error("[notify-reply]", code, result.reason?.message);
      if (code === "messaging/registration-token-not-registered") await dropDeadToken(db, toUid, rows[i]);
    }));
    return res.status(200).json({ ok: sent > 0, sent, devices: rows.length });
  } catch (err) {
    console.error("[notify-reply]", err?.code, err?.message);
    return res.status(500).json({ error: err?.code || "internal", message: err?.message });
  }
}
