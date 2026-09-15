import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
// Shared with notify-like/notify-reply so the Android payload shape exists in exactly one place.
import { androidNotification, tokensFor, dropDeadToken, linkFor, APP_URL } from "./_auth.js";

function initAdmin() {
  if (!getApps().length) {
    initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)) });
  }
}

// APP_URL is imported rather than redeclared. It was a second copy of the same string, and two
// copies of a base URL drift exactly once — silently, in whichever file nobody remembered.

// One morning push per day. On Sundays we replace the daily kindness nudge with a combined
// weekly check-in. The Wellbeing Score uses the WHO-5 (a two-week recall window), so we only
// prompt the wellbeing part on ALTERNATE Sundays — nudging it weekly would ask for a check-in
// that isn't due yet. Off-weeks keep the community-vote + journal prompts.
const DAILY_MESSAGE  = { title: "Good morning ☀️", body: "Send a kind word to brighten someone's day." };
// Both of these used to open with "Vote for this week's community greetings." There is no
// voting screen: CommunityArena is imported in App.jsx and never rendered, and the picker's
// community category was retired. So every user was sent to a feature that does not exist,
// twice a month, for as long as they had notifications on. A reminder must only ever name
// something the app can actually do.
const WEEKLY_MESSAGE_WELLBEING = {
  title: "Your fortnightly check-in 🌱",
  body: "Add a line to your journal, and see how the last two weeks have felt.",
};
const WEEKLY_MESSAGE_LITE = {
  title: "Your weekly check-in 🌱",
  body: "A quiet minute to look back — add a line to your journal.",
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

// ── What actually happened to this person ────────────────────────────────────────────────────
//
// The daily push has said the same sentence six days a week since it shipped, and it names
// nothing that happened: not who wrote to you, not who was moved by something you said. A
// notification that never varies becomes wallpaper inside a fortnight, and this is Seen's only
// re-engagement channel — so it is worth the two extra reads to make it true.
//
// Both queries are bounded and use indexes that already exist. `read` and `reactedAt` are
// filtered in memory on purpose: a where() on either would need a new composite index, and an
// index that has to be deployed separately is a way for this to silently stop working.
//
// COST: two reads per recipient per morning. At tens of users that is nothing. Past a few
// hundred it is worth batching by timezone slice or denormalising a counter onto the user doc —
// noting it here rather than discovering it on a bill.
async function personalNews(db, uid, since) {
  const news = { replies: 0, replyName: null, hearts: 0, heartName: null, heartCountry: null };
  try {
    const rs = await db.collection("privateReplies")
      .where("toUid", "==", uid).orderBy("ts", "desc").limit(10).get();
    const unread = rs.docs.map((d) => d.data()).filter((r) => r && r.read === false);
    news.replies = unread.length;
    news.replyName = unread[0]?.fromName || null;
  } catch (err) { console.error("[send-reminder] replies", err?.code); }
  try {
    const hs = await db.collection("users").doc(uid).collection("reactionsReceived")
      .orderBy("reactedAt", "desc").limit(10).get();
    const recent = hs.docs.map((d) => d.data()).filter((r) => Number(r?.reactedAt) > since);
    news.hearts = recent.length;
    news.heartName = recent[0]?.reactorName || null;
    news.heartCountry = recent[0]?.country || null;
  } catch (err) { console.error("[send-reminder] hearts", err?.code); }
  return news;
}

// A private reply outranks a heart: somebody wrote to you, personally, and is waiting for you to
// read it. A heart outranks the generic line. Every one of these is a STATEMENT of something
// true — never "your streak is at risk", never a countdown. The roadmap is explicit that guilt is
// not a mechanic in a wellbeing app, and a notification is the easiest place in a product to
// break that rule by accident.
export function newsMessage(news) {
  if (news.replies > 0) {
    return news.replies === 1
      ? { title: "Someone wrote to you 💬", body: `${news.replyName || "Someone"} sent you a private word of kindness.`, open: "replies" }
      : { title: "Someone wrote to you 💬", body: `${news.replies} private replies are waiting for you.`, open: "replies" };
  }
  if (news.hearts > 0) {
    const who = news.heartName && news.heartCountry
      ? `${news.heartName} in ${news.heartCountry}`
      : (news.heartName || "Someone");
    return news.hearts === 1
      ? { title: "Your words landed ❤️", body: `${who} felt something you wrote.`, open: "hearts" }
      : { title: "Your words landed ❤️", body: `${news.hearts} people felt something you wrote.`, open: "hearts" };
  }
  return null;
}

// One query, shared by everyone with no personal news — so the fallback still says something
// true rather than repeating yesterday's sentence. Kindness happening elsewhere is the closest
// thing Seen has to a reason to open it on a quiet day.
async function worldOvernight(db, since) {
  try {
    const snap = await db.collection("publicMessages").where("timestamp", ">", since).limit(500).get();
    const countries = new Set();
    snap.docs.forEach((d) => { const c = d.data()?.country; if (c) countries.add(c); });
    return { count: snap.size, countries: countries.size };
  } catch (err) {
    console.error("[send-reminder] world", err?.code);
    return { count: 0, countries: 0 };
  }
}

export function worldMessage(world) {
  if (world.count < 5) return null; // too few to be worth saying out loud
  return {
    title: "Good morning ☀️",
    body: world.countries > 1
      ? `${world.count} kind messages crossed the world overnight, from ${world.countries} countries.`
      : `${world.count} kind messages were sent overnight.`,
  };
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

    // Was `.where("fcmToken", "!=", "")`, which cannot see a user whose only registration lives
    // in the fcmTokens map. Reading all users and filtering here costs a full collection scan,
    // which at this size is cheaper than maintaining a second index — and tokensFor() then
    // resolves either shape.
    const snap = await db.collection("users").get();

    // Only send to users whose local time is 9am, and who have a stored timezone.
    const entries = snap.docs
      .map((d) => ({ uid: d.id, rows: tokensFor(d.data()), timezone: d.data().timezone }))
      .filter((e) => e.rows.length && e.timezone)
      .map((e) => ({ ...e, hour: localHour(e.timezone, now), day: localDay(e.timezone, now) }))
      .filter((e) => e.hour === 9);

    if (!entries.length) return res.status(200).json({ sent: 0, total: snap.size, matched: 0 });

    // Fortnightly parity (UTC week index) decides whether this Sunday includes the wellbeing prompt.
    const wellbeingWeek = Math.floor(now.getTime() / (7 * 24 * 60 * 60 * 1000)) % 2 === 0;
    const since = now.getTime() - 24 * 60 * 60 * 1000;

    let sent = 0;
    const errors = [];
    const dead = [];

    // Send one payload to one person, across every device they have. Each device carries its own
    // platform because the envelope differs: native Android needs an android.notification block
    // (no service worker in a webview, and a data-only message is delivered silently while
    // backgrounded), while a web token must NOT have one or sw.js draws a second notification.
    const pushTo = async (uid, rows, msg) => {
      const results = await Promise.allSettled(rows.map((r) => {
        // Only the personal messages have somewhere specific to go. The world line and the
        // evergreen one are about nobody in particular, so they open the app and stop there —
        // sending those to the bell would promise an event that is not in it.
        const link = msg.open ? linkFor(msg.open) : APP_URL;
        const payload = {
          token: r.token,
          data: { title: msg.title, body: msg.body, link },
          webpush: { fcmOptions: { link } },
          apns: { payload: { aps: { alert: { title: msg.title, body: msg.body }, sound: "default" } } },
        };
        if (r.platform === "android") payload.android = androidNotification(msg.title, msg.body);
        return getMessaging().send(payload);
      }));
      results.forEach((result, i) => {
        if (result.status === "fulfilled") { sent += 1; return; }
        const code = result.reason?.code || "unknown";
        errors.push(code);
        // Carry the owner through: a token row knows its device, not whose it is.
        if (code === "messaging/registration-token-not-registered") dead.push({ uid, row: rows[i] });
      });
    };

    // The generic line is the same sentence for everybody, so it is worth computing once.
    const world = await worldOvernight(db, since);
    const worldMsg = worldMessage(world);

    // Ordering, most specific first: something a person did FOR YOU beats the Sunday ritual,
    // which beats what the world did, which beats the evergreen line. Telling someone about the
    // journal while an unread private message sits waiting would be the wrong thing to say.
    let personalised = 0;
    for (const e of entries) {
      const news = await personalNews(db, e.uid, since);
      const personal = newsMessage(news);
      if (personal) personalised += 1;
      const weekly = e.day === "Sun" ? (wellbeingWeek ? WEEKLY_MESSAGE_WELLBEING : WEEKLY_MESSAGE_LITE) : null;
      const msg = personal ?? weekly ?? worldMsg ?? DAILY_MESSAGE;
      await pushTo(e.uid, e.rows, msg);
    }

    // Prune only the devices that actually died. This used to blank `fcmToken` for the whole
    // user, so one stale browser registration could take a working phone offline.
    await Promise.all(dead.map(({ uid, row }) => dropDeadToken(db, uid, row).catch(() => {})));

    return res.status(200).json({ sent, matched: entries.length, personalised, total: snap.size, world, errors });
  } catch (err) {
    console.error("[send-reminder]", err?.code, err?.message);
    return res.status(500).json({ error: err?.code || "internal", message: err?.message });
  }
}
