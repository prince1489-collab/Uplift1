// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.
//
// savedPassword.js — Android remembers your Seen password (3.36, fixed in 3.36.2).
//
// Signing in with an email and password inside the Android app never offered to save the
// password, so after signing out it had to be typed again in full. The app's web view doesn't
// trigger Android's own "save password?" on its own, so this asks Android's Credential Manager
// directly (@capgo/capacitor-autofill-save-password):
//   • after a successful email sign-in or sign-up, Android offers to save it. It keeps offering
//     (up to MAX_TRIES times) until the save actually goes through;
//   • on the sign-in screen, "Use a saved password" lets you pick it and signs you in. If there
//     is nothing saved yet, it says so instead of doing nothing.
// Android only: iPhone needs extra Apple set-up (associated domains) and the web has the
// browser's own password manager.
//
// Passwords saved from Chrome are filed under seenapp.app, and Android gives an app only its own
// passwords unless the site and the app say they belong together (3.36.3): the site in
// public/.well-known/assetlinks.json (delegate_permission/common.get_login_creds), the app in an
// asset_statements entry the Android build adds to the manifest (codemagic.yaml).

import { Capacitor } from "@capacitor/core";

// 3.36.2: new keys. The first version recorded an email as "offered" even when the save never
// happened, so those phones never got offered again. These keys start clean.
const SAVED_KEY = "seen_pw_saved";      // emails the phone has confirmed it saved
const TRIES_KEY = "seen_pw_save_tries"; // offers that didn't save, per email
const MAX_TRIES = 3;
// What happened the last time Android was asked to save (3.36.3): "saved", "closed", or the
// reason it failed. Kept through sign-out (deviceOwner.js KEEP) so that when "Use a saved
// password" finds nothing, the message can say whether a save was ever attempted on this phone.
const LAST_KEY = "seen_pw_last_save";
const readLast = () => { try { return localStorage.getItem(LAST_KEY) || ""; } catch { return ""; } };
const writeLast = (v) => { try { localStorage.setItem(LAST_KEY, String(v).slice(0, 160)); } catch { /* private mode */ } };
const withLast = (detail) => [detail, `last save: ${readLast() || "not tried on this phone"}`].filter(Boolean).join("; ");
const NONE_SAVED = "No saved password for Seen on this phone yet. Sign in with your password once, and if Android offers to save it, tap Save.";

const isAndroid = () => { try { return Capacitor.getPlatform() === "android"; } catch { return false; } };
const plugin = async () => (await import("@capgo/capacitor-autofill-save-password")).SavePassword;
const readObj = (key) => { try { return JSON.parse(localStorage.getItem(key) || "{}") || {}; } catch { return {}; } };
const writeObj = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode */ } };

export const canUseSavedPasswords = isAndroid;

export async function offerToSavePassword(email, password) {
  if (!isAndroid() || !email || !password) return;
  const saved = readObj(SAVED_KEY);
  if (saved[email]) return;
  const tries = readObj(TRIES_KEY);
  if ((tries[email] || 0) >= MAX_TRIES) return;
  let done = false;
  let why = "";
  try {
    await (await plugin()).promptDialog({ username: email, password });
    done = true;
  } catch (e) { why = String(e?.message || e || "unknown"); } // declined, or no password manager
  writeLast(done ? "saved" : /cancel/i.test(why) ? "closed" : `failed (${why})`);
  if (done) writeObj(SAVED_KEY, { ...saved, [email]: true });
  else writeObj(TRIES_KEY, { ...tries, [email]: (tries[email] || 0) + 1 });
}

// What the person picks from Android's saved ones for Seen:
//   { email, password }  — got one;
//   { error, detail? }   — nothing saved, or the picker failed (say why);
//   null                 — they closed the picker, so there is nothing to say.
export async function pickSavedPassword() {
  if (!isAndroid()) return { error: "Saved passwords work on Android only." };
  try {
    const r = await (await plugin()).readPassword();
    if (r?.username && r?.password) return { email: String(r.username), password: String(r.password) };
    return { error: NONE_SAVED, detail: withLast("") };
  } catch (e) {
    const detail = String(e?.message || e || "");
    if (/cancel/i.test(detail)) return null;
    return { error: NONE_SAVED, detail: withLast(detail) };
  }
}

// Remember that this email's password is saved on this phone — no need to offer to save it again.
export function markSavedPasswordUsed(email) {
  if (!email) return;
  writeObj(SAVED_KEY, { ...readObj(SAVED_KEY), [email]: true });
}
