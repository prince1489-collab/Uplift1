// nativePush.js — iOS (Capacitor) push registration.
//
// On the native iOS build we register for push via the Firebase Messaging Capacitor plugin.
// The plugin uses the native Firebase iOS SDK, which maps the APNs device token to an FCM
// registration token — so we store that token in the SAME users/{uid}.fcmToken field the web
// app uses, and the existing FCM senders (api/send-reminder.js, api/notify-like.js) deliver to
// iOS unchanged (they just add an `apns` payload block so the alert displays).
//
// No-op on web/Android web — guarded by Capacitor.getPlatform() so the web bundle is unaffected.

import { Capacitor } from "@capacitor/core";
import { doc, setDoc } from "firebase/firestore";

export function isNativeIOS() {
  try {
    return Capacitor.getPlatform() === "ios";
  } catch {
    return false;
  }
}

let started = false;

// Call once after the user is authenticated. Idempotent.
export async function registerNativePush({ db, uid, onOpenLink } = {}) {
  if (!isNativeIOS() || !db || !uid || started) return;
  started = true;

  // Loaded lazily so the web bundle never pulls in native-only code.
  const { FirebaseMessaging } = await import("@capacitor-firebase/messaging");

  const saveToken = async (token) => {
    if (!token) return;
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    try {
      await setDoc(doc(db, "users", uid), { fcmToken: token, timezone }, { merge: true });
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
