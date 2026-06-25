import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

function initAdmin() {
  if (!getApps().length) {
    initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)) });
  }
}

const APP_URL = "https://www.seenapp.app";

const MESSAGES = {
  9:  { title: "Good morning ☀️", body: "Send a kind word to brighten someone's day." },
  21: { title: "Evening wind-down 🌙", body: "End the day with kindness — someone needs it." },
};

function localHour(timezone, now) {
  try {
    return parseInt(
      new Intl.DateTimeFormat("en-US", { timeZone: timezone, hour: "numeric", hour12: false }).format(now),
      10
    );
  } catch { return -1; }
}

export default async function handler(req, res) {
  // Vercel cron injects Authorization: Bearer <CRON_SECRET> automatically
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers["authorization"] !== `Bearer ${secret}`) {
    return res.status(401).end();
  }

  try {
    initAdmin();
    const db = getFirestore();
    const now = new Date();

    const snap = await db.collection("users").where("fcmToken", "!=", "").get();

    // Only send to users whose local time is 9am or 9pm, and who have a stored timezone.
    const entries = snap.docs
      .map((d) => ({ uid: d.id, token: d.data().fcmToken, timezone: d.data().timezone }))
      .filter((e) => e.token && e.timezone)
      .map((e) => ({ ...e, hour: localHour(e.timezone, now) }))
      .filter((e) => e.hour === 9 || e.hour === 21);

    if (!entries.length) return res.status(200).json({ sent: 0, total: snap.size, matched: 0 });

    // Group by message (morning vs evening) then multicast each group.
    const groups = { 9: [], 21: [] };
    for (const e of entries) {
      const key = e.hour >= 15 ? 21 : 9;
      groups[key].push(e);
    }

    let sent = 0;
    const errors = [];
    const staleUids = [];

    for (const [hourStr, group] of Object.entries(groups)) {
      if (!group.length) continue;
      const msg = MESSAGES[parseInt(hourStr, 10)];
      // FCM batch limit is 500 tokens per multicast call
      for (let i = 0; i < group.length; i += 500) {
        const chunk = group.slice(i, i + 500);
        // Data-only so the compat SDK doesn't auto-show a duplicate notification.
        const result = await getMessaging().sendEachForMulticast({
          tokens: chunk.map((e) => e.token),
          data: { title: msg.title, body: msg.body },
          webpush: { fcmOptions: { link: APP_URL } },
        });
        sent += result.successCount;
        result.responses.forEach((r, idx) => {
          if (!r.success) {
            errors.push(r.error?.code || "unknown");
            if (r.error?.code === "messaging/registration-token-not-registered") {
              staleUids.push(chunk[idx].uid);
            }
          }
        });
      }
    }

    // Best-effort cleanup of permanently dead tokens.
    await Promise.all(
      staleUids.map((uid) => db.collection("users").doc(uid).update({ fcmToken: "" }).catch(() => {}))
    );

    return res.status(200).json({ sent, matched: entries.length, total: snap.size, errors });
  } catch (err) {
    console.error("[send-reminder]", err?.code, err?.message);
    return res.status(500).json({ error: err?.code || "internal", message: err?.message });
  }
}
