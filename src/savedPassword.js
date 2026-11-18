// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.
//
// savedPassword.js — Android remembers your Seen password (3.36).
//
// Signing in with an email and password inside the Android app never offered to save the
// password, so after signing out it had to be typed again in full. The app's web view doesn't
// trigger Android's own "save password?" on its own, so this asks Android's Credential Manager
// directly (@capgo/capacitor-autofill-save-password):
//   • after a successful email sign-in or sign-up, Android offers to save it (once per email on
//     this phone — signing in with the saved one never asks again);
//   • on the sign-in screen, "Use a saved password" lets you pick it and signs you in.
// Android only: iPhone needs extra Apple set-up (associated domains) and the web has the
// browser's own password manager.

import { Capacitor } from "@capacitor/core";

const OFFERED_KEY = "seen_pw_save_offered"; // emails already offered on this phone
const isAndroid = () => { try { return Capacitor.getPlatform() === "android"; } catch { return false; } };
const plugin = async () => (await import("@capgo/capacitor-autofill-save-password")).SavePassword;

export const canUseSavedPasswords = isAndroid;

export async function offerToSavePassword(email, password) {
  if (!isAndroid() || !email || !password) return;
  let offered = [];
  try { offered = JSON.parse(localStorage.getItem(OFFERED_KEY) || "[]"); } catch { /* none */ }
  if (offered.includes(email)) return;
  try {
    await (await plugin()).promptDialog({ username: email, password });
  } catch { /* declined, or no password manager on this phone */ }
  try { localStorage.setItem(OFFERED_KEY, JSON.stringify([...offered, email].slice(-10))); } catch { /* private mode */ }
}

// The password the person picks from Android's saved ones for Seen, or null.
export async function pickSavedPassword() {
  if (!isAndroid()) return null;
  try {
    const r = await (await plugin()).readPassword();
    return r?.username && r?.password ? { email: String(r.username), password: String(r.password) } : null;
  } catch { return null; }
}

// Remember that this email's password came from the saved ones — no need to offer to save it.
export function markSavedPasswordUsed(email) {
  if (!email) return;
  try {
    const offered = JSON.parse(localStorage.getItem(OFFERED_KEY) || "[]");
    if (!offered.includes(email)) localStorage.setItem(OFFERED_KEY, JSON.stringify([...offered, email].slice(-10)));
  } catch { /* private mode */ }
}
