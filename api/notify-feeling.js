// Push notifications for the Kindness Loop. Two types:
//   { type: "reply", posterUid }            → the feeling's poster: "someone sent you encouragement"
//   { type: "ack", responderUids: [...] }   → each responder: "your words helped, right when needed"
// Mirrors notify-like.js (fcmToken lookup, data-only payload + apns block, stale-token cleanup)
// but requires a verified Firebase ID token — acks fan out to many users, so the endpoint must
// not be open. Best-effort: the client fires and forgets.

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { getAuth } from "firebase-admin/auth";

function initAdmin() {
  if (!getApps().length) {
    initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)) });
  }
}

const APP_URL = "https://www.seenapp.app";
const MAX_ACK_FANOUT = 30;

async function sendTo(db, uid, body) {
  const snap = await db.collection("users").doc(uid).get();
  const token = snap.data()?.fcmToken;
  if (!token) return { uid, skipped: "no token" };
  try {
    await getMessaging().send({
      token,
      data: { title: "Seen", body, link: APP_URL },
      webpush: { fcmOptions: { link: APP_URL } },
      apns: { payload: { aps: { alert: { title: "Seen", body }, sound: "default" } } },
    });
    return { uid, ok: true };
  } catch (err) {
    if (err?.code === "messaging/registration-token-not-registered") {
      try { await db.collection("users").doc(uid).update({ fcmToken: "" }); } catch { /* ignore */ }
    }
    return { uid, error: err?.code || "send failed" };
  }
}

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

  const { type } = req.body ?? {};
  const db = getFirestore();

  try {
    if (type === "reply") {
      const posterUid = String(req.body?.posterUid ?? "");
      if (!posterUid) return res.status(400).json({ error: "missing posterUid" });
      const result = await sendTo(db, posterUid, "💛 Someone sent you encouragement — open Seen to read it");
      return res.status(200).json(result);
    }
    if (type === "ack") {
      const uids = Array.isArray(req.body?.responderUids)
        ? req.body.responderUids.filter((u) => typeof u === "string" && u).slice(0, MAX_ACK_FANOUT)
        : [];
      if (!uids.length) return res.status(400).json({ error: "missing responderUids" });
      const results = await Promise.all(
        uids.map((uid) => sendTo(db, uid, "🌟 Your words helped — right when they were needed"))
      );
      return res.status(200).json({ results });
    }
    return res.status(400).json({ error: "unknown type" });
  } catch (err) {
    console.error("[notify-feeling]", err?.message);
    return res.status(500).json({ error: err?.code || "internal" });
  }
}
