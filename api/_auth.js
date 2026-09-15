// _auth.js — shared Firebase Admin init and caller verification for the /api routes.
//
// The leading underscore matters: Vercel does not treat `api/_*` as a serverless function, so
// this is a shared module rather than a route. That is worth knowing here specifically —
// the project is at 11 of Hobby's 12 function limit, and a helper that accidentally became a
// route would eat the last slot.
//
// This exists because `notify-like` shipped with NO authentication at all: it took a target
// uid from the request body and sent that person a push. Anyone who knew a uid could push
// arbitrary text to them. Both push routes now go through here.
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

export function initAdmin() {
  if (!getApps().length) {
    initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)) });
  }
}

// Returns the caller's uid, or sends the response and returns null. Callers must bail out on
// null WITHOUT writing to `res` again.
//
// Admin-init failure and a bad token are reported differently on purpose — moderate-message
// learned this the hard way: when both returned 401, a missing FIREBASE_SERVICE_ACCOUNT_JSON
// was indistinguishable from a failed sign-in, so a broken deployment looked like every user
// suddenly being logged out.
export async function requireCaller(req, res, tag) {
  try {
    initAdmin();
  } catch (err) {
    console.error(`[${tag}] admin init failed — is FIREBASE_SERVICE_ACCOUNT_JSON set?`, err?.message);
    res.status(503).json({ error: "unavailable" });
    return null;
  }
  try {
    const header = req.headers["authorization"] || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!token) { res.status(401).json({ error: "unauthorised" }); return null; }
    const decoded = await getAuth().verifyIdToken(token);
    return decoded.uid;
  } catch {
    res.status(401).json({ error: "unauthorised" });
    return null;
  }
}

export function cors(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") { res.status(204).end(); return false; }
  if (req.method !== "POST") { res.status(405).end(); return false; }
  return true;
}

// One place for the FCM envelope the push routes send. Data-only so the compat SDK doesn't
// auto-show a duplicate — sw.js reads payload.data and calls showNotification() itself — plus
// an apns block, which only iOS tokens act on and which is what makes iOS display the alert.
export const APP_URL = "https://www.seenapp.app";

// `platform` is users/{uid}.pushPlatform, written next to the token by nativePush.js.
//
// WHY IT HAS TO BE PASSED IN. An FCM token is opaque: a token from the native Android app and one
// from Android Chrome are indistinguishable here, and they need OPPOSITE payloads. The web token
// must stay data-only, because sw.js renders the notification itself and a `notification` block
// would give that user TWO. The native Android token needs exactly that block, because there is no
// service worker in a webview and Android will not display a data-only message while the app is
// backgrounded — it arrives, silently, and the user never learns anyone wrote to them.
//
// Anything that is not "android" keeps the previous envelope byte for byte, so iOS and web are
// untouched, including every token stored before pushPlatform existed.
// Exported so send-reminder.js, which builds its own multicast payload, uses the SAME block.
// Two copies of this would drift, and the way you would find out is a user reporting that
// notifications stopped — months later, from the sender nobody remembered to update.
export function androidNotification(title, body) {
  return {
    priority: "high",
    notification: { title, body, sound: "default", clickAction: "FCM_PLUGIN_ACTIVITY" },
  };
}

// ── Which devices to push, and pruning the ones that have died ───────────────────────────────
//
// A person is not a device. users/{uid}.fcmToken was ONE field written by two different
// registrations — the web app and the native app — so the last one to register owned every
// notification from then on. Open Seen in Chrome after installing it and the browser's token
// overwrote the phone's; from that moment every push went to the browser, and sw.js opens the
// website on tap. That is the whole of "notifications take me to the web link". Two phones on
// one account had the same problem, silently.
//
// users/{uid}.fcmTokens is keyed by a DEVICE id rather than by the token. Keying by token would
// leave an orphan behind every time FCM rotated one, and would put an opaque third-party string
// into a Firestore field path. A device id is ours, stable, and safe to use in a dot path when
// the entry has to be deleted.
//
// Reads UNION the map with the legacy single field, so nobody stops receiving notifications
// between this deploying and their next app open. The clients keep writing both for the same
// reason.
//
// ── WHY THIS IS A UNION AND NOT A FALLBACK ───────────────────────────────────────────────────
// It used to be `if (rows.length) return rows;` followed by the legacy field — an either/or. The
// comment above it claimed the legacy field was a fallback "so nobody stops receiving
// notifications", and that was true for someone with NO map entries at all. It was false, and
// silently so, for the case that actually matters: ONE MODERN CLIENT AND ONE OLD ONE.
//
// That is not a hypothetical. It was found from a screenshot of a phone that had both:
//
//   Chrome        → runs the current web build, writes an fcmTokens map entry
//   the Seen app  → on a build older than 1.5, writes only the legacy fcmToken scalar
//
// The map was non-empty, so `return rows` fired, the legacy field was never read, and the
// PHONE'S OWN TOKEN WAS INVISIBLE TO EVERY SENDER. Every notification went to the browser, which
// rendered it in Chrome and opened the website on tap — while the app sat there silent, looking
// like push was broken on Android.
//
// The failure mode is the worst shape available: it only appears once a user has upgraded ONE of
// their clients, it looks exactly like a native-push bug, and the user it hits most reliably is
// the developer testing on the web and the app at once.
//
// Deduplicated by TOKEN VALUE, not by device id, because current clients write both fields and
// the same token therefore appears in both places — matching on the id would miss that (the
// legacy row has no device id at all) and send to that device twice.
export function tokensFor(userData) {
  const rows = [];
  const seen = new Set();

  const map = userData?.fcmTokens;
  if (map && typeof map === "object") {
    for (const [deviceId, v] of Object.entries(map)) {
      if (!v || typeof v !== "object" || !v.token) continue;
      const token = String(v.token);
      if (seen.has(token)) continue;
      seen.add(token);
      rows.push({ deviceId, token, platform: v.platform ?? null });
    }
  }

  const legacy = userData?.fcmToken;
  if (legacy && !seen.has(String(legacy))) {
    rows.push({ deviceId: null, token: String(legacy), platform: userData?.pushPlatform ?? null });
  }

  return rows;
}

// FCM says a token is permanently gone. Remove just that device rather than blanking the field
// for all of them — which is what clearing `fcmToken` used to do, taking a working phone offline
// because a stale browser token happened to fail first.
export async function dropDeadToken(db, uid, row) {
  const { FieldValue } = await import("firebase-admin/firestore");
  const patch = {};
  if (row?.deviceId) patch[`fcmTokens.${row.deviceId}`] = FieldValue.delete();
  // Only clear the legacy field if it is the one that died, or it would silently disable a
  // device that has not migrated yet.
  const snap = await db.collection("users").doc(uid).get().catch(() => null);
  if (snap?.data()?.fcmToken && snap.data().fcmToken === row?.token) patch.fcmToken = "";
  if (Object.keys(patch).length) await db.collection("users").doc(uid).update(patch).catch(() => {});
}

// Where a notification should land when it is tapped.
//
// A CLOSED SET, deliberately. Every link here ends up in `window.location.assign` on native and
// `client.navigate` on the web, so it is worth being able to say exactly which destinations
// exist — a free-form id from a push payload is an instruction from outside the app about where
// to send the person holding the phone.
//
// The values name the EVENT rather than the screen. Both currently open the bell, because the
// bell is where replies and hearts are both listed, but a notification about a reply should not
// have to be rewritten the day that stops being true.
const OPEN_TARGETS = new Set(["replies", "hearts"]);

export function linkFor(target) {
  return OPEN_TARGETS.has(target) ? `${APP_URL}/?open=${target}` : APP_URL;
}

// `title` and `link` used to be hard-coded here: every envelope said "Seen" and pointed at the
// bare origin. So a like and a reply arrived under the same generic heading, and tapping either
// one opened the feed with no indication of what had happened or where to look — which is the
// complaint that started this, still true because the sender never put a path in.
export function pushEnvelope(token, body, platform, { title = "Seen", link = APP_URL } = {}) {
  const envelope = {
    token,
    data: { title, body, link },
    webpush: { fcmOptions: { link } },
    apns: { payload: { aps: { alert: { title, body }, sound: "default" } } },
  };
  if (platform === "android") envelope.android = androidNotification(title, body);
  return envelope;
}
