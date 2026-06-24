import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

function initAdmin() {
  if (!getApps().length) {
    initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)) });
  }
}

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

    await getMessaging().send({
      token,
      notification: { title: "Seen", body, icon: "/icon-192.png" },
    });
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("[notify-like]", err?.message);
    return res.status(500).json({ error: "internal" });
  }
}
