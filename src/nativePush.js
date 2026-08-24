// nativePush.js — native (Capacitor) push registration, iOS and Android.
//
// On a native build we register for push via the Firebase Messaging Capacitor plugin.
// The plugin uses the native Firebase iOS SDK, which maps the APNs device token to an FCM
// registration token — so we store that token in the SAME users/{uid}.fcmToken field the web
// app uses, and the existing FCM senders (api/send-reminder.js, api/notify-like.js) deliver to
// iOS unchanged (they just add an `apns` payload block so the alert displays).
//
// No-op on the web — guarded by Capacitor.getPlatform() so the web bundle is unaffected, where
// the service-worker token path in App.jsx handles push instead.
//
// This was iOS-only, and not because Android was unsupported: every native branch in the app was
// written for iOS and gated on isNativeIOS(), so an Android Capacitor build registered nothing at
// all. google-services.json alone would not have fixed that — the plugin was never called.

import { Capacitor } from "@capacitor/core";
import { doc, setDoc } from "firebase/firestore";

export function isNativeIOS() {
  try {
    return Capacitor.getPlatform() === "ios";
  } catch {
    return false;
  }
}

// Any Capacitor shell — iOS or Android. Use this for anything that is true of a WEBVIEW rather
// than of Apple: auth initialisation, the native sign-in paths, push. Reserve isNativeIOS() for
// things that are genuinely iOS-only, such as the Apple sign-in button.
export function isNativeApp() {
  try {
    return Capacitor.getPlatform() !== "web";
  } catch {
    return false;
  }
}

// Stored alongside the token so the senders know which envelope shape to use. An FCM token is
// otherwise opaque: a native Android token and an Android web token look identical server-side,
// and they need OPPOSITE payloads — see pushEnvelope in api/_auth.js.
export function pushPlatform() {
  try {
    return Capacitor.getPlatform();
  } catch {
    return "web";
  }
}

let started = false;

// Call once after the user is authenticated. Idempotent.
export async function registerNativePush({ db, uid, onOpenLink } = {}) {
  if (!isNativeApp() || !db || !uid || started) return;
  started = true;

  // Loaded lazily so the web bundle never pulls in native-only code.
  const { FirebaseMessaging } = await import("@capacitor-firebase/messaging");

  const saveToken = async (token) => {
    if (!token) return;
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    try {
      await setDoc(doc(db, "users", uid), { fcmToken: token, timezone, pushPlatform: pushPlatform() }, { merge: true });
    } catch {
      /* best-effort */
    }
  };

  try {
    const perm = await FirebaseMessaging.requestPermissions();
    if (perm?.receive !== "granted") return;

    // Keep the stored token fresh.
    await FirebaseMessaging.addListener("tokenReceived", (event) => {
      saveToken(event?.token);
    });

    // Deep-link when the user taps a notification.
    await FirebaseMessaging.addListener("notificationActionPerformed", (event) => {
      const link =
        event?.notification?.data?.link ||
        event?.notification?.data?.fcmOptions?.link ||
        "/";
      if (typeof onOpenLink === "function") onOpenLink(link);
    });

    const { token } = await FirebaseMessaging.getToken();
    await saveToken(token);
  } catch {
    started = false; // allow a retry on a later mount
  }
}
