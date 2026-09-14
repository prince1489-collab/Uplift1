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
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { cors, requireCaller, pushEnvelope, tokensFor, dropDeadToken } from "./_auth.js";

export default async function handler(req, res) {
  if (!cors(req, res)) return;

  const callerUid = await requireCaller(req, res, "notify-reply");
  if (!callerUid) return;

  const { replyId } = req.body ?? {};
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
    const body = reply.inReplyTo
      ? `${name} replied back 💬`
      : `${name} sent you a private reply 💬`;

    const results = await Promise.allSettled(
      rows.map((r) => getMessaging().send(pushEnvelope(r.token, body, r.platform)))
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
