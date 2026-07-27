import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

function initAdmin() {
  if (!getApps().length) {
    initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)) });
  }
}

const APP_URL = "https://www.seenapp.app";

// One morning push per day. On Sundays we replace the daily kindness nudge with a combined
// weekly check-in. The Wellbeing Score uses the WHO-5 (a two-week recall window), so we only
// prompt the wellbeing part on ALTERNATE Sundays — nudging it weekly would ask for a check-in
// that isn't due yet. Off-weeks keep the community-vote + journal prompts.
const DAILY_MESSAGE  = { title: "Good morning ☀️", body: "Send a kind word to brighten someone's day." };
const WEEKLY_MESSAGE_WELLBEING = {
  title: "Your fortnightly check-in 🌱",
  body: "Vote for this week's community greetings, add a journal note, and update your Wellbeing score.",
};
const WEEKLY_MESSAGE_LITE = {
  title: "Your weekly check-in 🌱",
  body: "Vote for this week's community greetings and add a journal note.",
};

function localHour(timezone, now) {
  try {
    return parseInt(
      new Intl.DateTimeFormat("en-US", { timeZone: timezone, hour: "numeric", hour12: false }).format(now),
      10
    );
  } catch { return -1; }
}

function localDay(timezone, now) {
  try {
    return new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "short" }).format(now); // "Sun"…"Sat"
  } catch { return ""; }
}

export default async function handler(req, res) {
  // Vercel cron injects Authorization: Bearer <CRON_SECRET> automatically — and only when
  // CRON_SECRET is defined for that project.
  //
  // This used to read `if (secret && ...)`, so an UNSET secret skipped the check entirely
  // and left the endpoint callable by anyone. That matters more than it looks: this handler
  // pushes a notification to every user holding an FCM token, and vercel.json schedules it
  // 24x a day on every project the repo is deployed to. A preview project sharing
  // production's Firestore would therefore send a second copy of every reminder to every
  // real user — and a stranger who guessed the URL could fire one on demand.
  //
  // Failing closed also makes the preview safe by construction: production sets CRON_SECRET
  // so Vercel injects it and reminders send; preview does not set it, so no header is
  // injected and every call is refused. Do not set CRON_SECRET on a preview project.
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers["authorization"] !== `Bearer ${secret}`) {
    return res.status(401).end();
  }

  try {
    initAdmin();
    const db = getFirestore();
    const now = new Date();

    const snap = await db.collection("users").where("fcmToken", "!=", "").get();

    // Only send to users whose local time is 9am, and who have a stored timezone.
    const entries = snap.docs
      .map((d) => ({ uid: d.id, token: d.data().fcmToken, timezone: d.data().timezone }))
      .filter((e) => e.token && e.timezone)
      .map((e) => ({ ...e, hour: localHour(e.timezone, now), day: localDay(e.timezone, now) }))
      .filter((e) => e.hour === 9);

    if (!entries.length) return res.status(200).json({ sent: 0, total: snap.size, matched: 0 });

    // One morning push per user: Sundays get the combined weekly check-in, other days the daily nudge.
    // Fortnightly parity (UTC week index) decides whether this Sunday includes the wellbeing prompt.
    const wellbeingWeek = Math.floor(now.getTime() / (7 * 24 * 60 * 60 * 1000)) % 2 === 0;
    const groups = { daily: [], weekly: [] };
    for (const e of entries) {
      (e.day === "Sun" ? groups.weekly : groups.daily).push(e);
    }

    let sent = 0;
    const errors = [];
    const staleUids = [];

    for (const [key, group] of Object.entries(groups)) {
      if (!group.length) continue;
      const msg = key === "weekly" ? (wellbeingWeek ? WEEKLY_MESSAGE_WELLBEING : WEEKLY_MESSAGE_LITE) : DAILY_MESSAGE;
      // FCM batch limit is 500 tokens per multicast call
      for (let i = 0; i < group.length; i += 500) {
        const chunk = group.slice(i, i + 500);
        // Data-only so the compat SDK doesn't auto-show a duplicate notification.
        const result = await getMessaging().sendEachForMulticast({
          tokens: chunk.map((e) => e.token),
          // link is carried in data so native iOS can deep-link via notification.data.link.
          data: { title: msg.title, body: msg.body, link: APP_URL },
          webpush: { fcmOptions: { link: APP_URL } },
          // apns is applied only to APNs-backed (iOS) tokens; web tokens ignore it. The aps.alert
          // makes iOS display the notification (data-only would be delivered silently).
          apns: { payload: { aps: { alert: { title: msg.title, body: msg.body }, sound: "default" } } },
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
