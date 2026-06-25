import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

// Diagnostic endpoint: open in a browser to send a real test push and see the
// exact outcome (or error) per device. Guarded by CRON_SECRET so it can't be
// abused. Example: https://www.seenapp.app/api/test-push?secret=<CRON_SECRET>
//   - add &uid=<uid> to target a single user instead of everyone.

function initAdmin() {
  if (!getApps().length) {
    initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)) });
  }
}

const APP_URL = "https://www.seenapp.app";

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.query?.secret !== secret) {
    return res.status(401).json({ error: "unauthorized — append ?secret=<CRON_SECRET>" });
  }

  const steps = [];
  try {
    steps.push({ step: "env", hasServiceAccount: Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON) });
    initAdmin();
    steps.push({ step: "initAdmin", ok: true });

    const db = getFirestore();
    const uid = req.query?.uid;

    let entries;
    if (uid) {
      const doc = await db.collection("users").doc(uid).get();
      entries = [{ uid, token: doc.data()?.fcmToken }].filter((e) => e.token);
    } else {
      const snap = await db.collection("users").where("fcmToken", "!=", "").get();
      entries = snap.docs.map((d) => ({ uid: d.id, token: d.data().fcmToken })).filter((e) => e.token);
    }
    steps.push({ step: "tokens", count: entries.length });
    if (!entries.length) {
      return res.status(200).json({ ok: false, reason: "no fcm tokens found", steps });
    }

    const results = [];
    for (const e of entries) {
      try {
        const messageId = await getMessaging().send({
          token: e.token,
          notification: { title: "Seen — test ✅", body: "Push notifications are working." },
          webpush: {
            notification: {
              title: "Seen — test ✅",
              body: "Push notifications are working.",
              icon: `${APP_URL}/icon-192.png`,
              badge: `${APP_URL}/icon-192.png`,
            },
            fcmOptions: { link: APP_URL },
          },
        });
        results.push({ uid: e.uid, ok: true, messageId });
      } catch (err) {
        results.push({ uid: e.uid, ok: false, code: err?.code, message: err?.message });
      }
    }

    const sent = results.filter((r) => r.ok).length;
    return res.status(200).json({ ok: sent > 0, sent, total: entries.length, results, steps });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err?.code || "internal", message: err?.message, steps });
  }
}
