import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

function initAdmin() {
  if (!getApps().length) {
    initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)) });
  }
}

const MESSAGES = [
  { title: "Good morning ☀️", body: "Send a kind word to brighten someone's day." },
  { title: "Afternoon check-in 💛", body: "How's your day going? Spread some kindness." },
  { title: "Evening wind-down 🌙", body: "End the day with kindness — someone needs it." },
];

export default async function handler(req, res) {
  // Vercel cron injects Authorization: Bearer <CRON_SECRET> automatically
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers["authorization"] !== `Bearer ${secret}`) {
    return res.status(401).end();
  }

  try {
    initAdmin();
    const db = getFirestore();
    const hour = new Date().getUTCHours();
    const msg = hour < 12 ? MESSAGES[0] : hour < 18 ? MESSAGES[1] : MESSAGES[2];

    const snap = await db.collection("users").where("fcmToken", "!=", "").get();
    const tokens = snap.docs.map((d) => d.data().fcmToken).filter(Boolean);
    if (!tokens.length) return res.status(200).json({ sent: 0 });

    // FCM batch limit is 500 tokens per multicast call
    const chunks = [];
    for (let i = 0; i < tokens.length; i += 500) chunks.push(tokens.slice(i, i + 500));

    let sent = 0;
    for (const chunk of chunks) {
      const result = await getMessaging().sendEachForMulticast({
        tokens: chunk,
        notification: { title: msg.title, body: msg.body, icon: "/icon-192.png" },
      });
      sent += result.successCount;
    }

    return res.status(200).json({ sent, total: tokens.length });
  } catch (err) {
    console.error("[send-reminder]", err?.message);
    return res.status(500).json({ error: "internal" });
  }
}
