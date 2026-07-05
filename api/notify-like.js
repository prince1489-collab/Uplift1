import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

function initAdmin() {
  if (!getApps().length) {
    initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)) });
  }
}

const APP_URL = "https://www.seenapp.app";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).end();

  const { ownerUid, reactorName, country } = req.body ?? {};
  if (!ownerUid) return res.status(400).json({ error: "missing ownerUid" });

  try {
    initAdmin();
    const db = getFirestore();
    const userSnap = await db.collection("users").doc(ownerUid).get();
    const token = userSnap.data()?.fcmToken;
    if (!token) return res.status(200).json({ skipped: "no token" });

    const name = (reactorName || "Someone").trim();
    const body = country
      ? `${name} from ${country} liked your message ❤️`
      : `${name} liked your message ❤️`;

    // Data-only message so the compat SDK doesn't auto-show a duplicate.
    // The sw.js onBackgroundMessage handler reads payload.data and calls showNotification().
    const messageId = await getMessaging().send({
      token,
      // link in data lets native iOS deep-link via notification.data.link.
      data: { title: "Seen", body, link: APP_URL },
      webpush: { fcmOptions: { link: APP_URL } },
      // apns applies only to iOS tokens (web ignores it); aps.alert makes iOS display the alert.
      apns: { payload: { aps: { alert: { title: "Seen", body }, sound: "default" } } },
    });
    return res.status(200).json({ ok: true, messageId });
  } catch (err) {
    console.error("[notify-like]", err?.code, err?.message);
    if (err?.code === "messaging/registration-token-not-registered") {
      try {
        await getFirestore().collection("users").doc(ownerUid).update({ fcmToken: "" });
      } catch { /* ignore */ }
    }
    return res.status(500).json({ error: err?.code || "internal", message: err?.message });
  }
}
