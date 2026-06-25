import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

function initAdmin() {
  if (!getApps().length) {
    initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)) });
  }
}

const APP_URL = "https://www.seenapp.app";

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
    const entries = snap.docs
      .map((d) => ({ uid: d.id, token: d.data().fcmToken }))
      .filter((e) => e.token);
    if (!entries.length) return res.status(200).json({ sent: 0, total: 0 });

    // FCM batch limit is 500 tokens per multicast call
    const chunks = [];
    for (let i = 0; i < entries.length; i += 500) chunks.push(entries.slice(i, i + 500));

    let sent = 0;
    const errors = [];
    const staleUids = [];
    for (const chunk of chunks) {
      const result = await getMessaging().sendEachForMulticast({
        tokens: chunk.map((e) => e.token),
        notification: { title: msg.title, body: msg.body },
        webpush: {
          notification: { title: msg.title, body: msg.body, icon: `${APP_URL}/icon-192.png`, badge: `${APP_URL}/icon-192.png` },
          fcmOptions: { link: APP_URL },
        },
      });
      sent += result.successCount;
      result.responses.forEach((r, i) => {
        if (!r.success) {
          errors.push(r.error?.code || "unknown");
          if (r.error?.code === "messaging/registration-token-not-registered") {
            staleUids.push(chunk[i].uid);
          }
        }
      });
    }

    // Best-effort cleanup of permanently dead tokens.
    await Promise.all(
      staleUids.map((uid) => db.collection("users").doc(uid).update({ fcmToken: "" }).catch(() => {}))
    );

    return res.status(200).json({ sent, total: entries.length, errors });
  } catch (err) {
    console.error("[send-reminder]", err?.code, err?.message);
    return res.status(500).json({ error: err?.code || "internal", message: err?.message });
  }
}
