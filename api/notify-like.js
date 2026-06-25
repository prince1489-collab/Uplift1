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

    const messageId = await getMessaging().send({
      token,
      notification: { title: "Seen", body },
      webpush: {
        notification: { title: "Seen", body, icon: `${APP_URL}/icon-192.png`, badge: `${APP_URL}/icon-192.png` },
        fcmOptions: { link: APP_URL },
      },
    });
    return res.status(200).json({ ok: true, messageId });
  } catch (err) {
    console.error("[notify-like]", err?.code, err?.message);
    // Clean up tokens FCM has permanently rejected so we stop retrying them.
    if (err?.code === "messaging/registration-token-not-registered") {
      try {
        await getFirestore().collection("users").doc(ownerUid).update({ fcmToken: "" });
      } catch { /* ignore */ }
    }
    return res.status(500).json({ error: err?.code || "internal", message: err?.message });
  }
}
