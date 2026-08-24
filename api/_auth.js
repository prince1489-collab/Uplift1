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

export function pushEnvelope(token, body, platform) {
  const envelope = {
    token,
    data: { title: "Seen", body, link: APP_URL },
    webpush: { fcmOptions: { link: APP_URL } },
    apns: { payload: { aps: { alert: { title: "Seen", body }, sound: "default" } } },
  };
  if (platform === "android") envelope.android = androidNotification("Seen", body);
  return envelope;
}
