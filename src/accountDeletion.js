// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.
//
// accountDeletion.js — the device's half of "Delete account" (3.20). The sheet is DeleteAccount.jsx;
// the deletion itself is /api/delete-account (api/_deleteAccount.js says what goes and what stays).
//
//   1. Sign in with Apple accounts on iOS: Apple requires the app to REVOKE the user's Apple
//      token when the account is deleted. That needs a fresh authorisation code, which only the
//      Apple sheet on the device can give — so the person confirms once with Apple, and the code
//      goes to Firebase's revoke endpoint with tokenType CODE (what Firebase's own iOS SDK sends;
//      the web SDK's revokeAccessToken only takes access tokens, which the native sheet doesn't
//      return). Best effort: if revocation fails the deletion still goes ahead — keeping someone's
//      data because Apple's endpoint hiccupped would be the worse failure. Cancelling the Apple
//      sheet, though, means "stop", and nothing is deleted.
//   2. The server deletes the account. While it does, accountDeletionInProgress() is true: the
//      presence heartbeat stops writing (it would otherwise put back the presence record the
//      server just removed) and App ignores the profile disappearing (which would otherwise flash
//      the sign-up form behind the sheet).
//   3. App shows "Your account has been deleted" (AccountDeletedScreen) from its own state, since
//      signing out swaps the whole screen and would take the sheet with it.
//   4. Behind the confirmation, this device forgets the account: sign out, local storage,
//      Firestore's offline cache. "Done" waits for that, then restarts the app into a clean start
//      (a terminated Firestore can't be used again).

import { signOut } from "firebase/auth";
import { terminate, clearIndexedDbPersistence } from "firebase/firestore";
import { authedPost } from "./apiBase";
import { isNativeIOS, isNativeApp } from "./nativePush";

export const isAppleUser = (user) => Boolean(user?.providerData?.some((p) => p?.providerId === "apple.com"));
export const needsAppleConfirm = (user) => isNativeIOS() && isAppleUser(user);

// Apple's "sub" claim — which Apple ID a token belongs to — read without verifying (the token
// goes straight to Firebase, which does verify it). Used only to make sure the person confirmed
// with the SAME Apple ID they signed in with, so we never revoke someone else's.
function appleSub(idToken) {
  try { return JSON.parse(atob(String(idToken).split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).sub || null; }
  catch { return null; }
}

export class Cancelled extends Error {}

export async function confirmAndRevokeApple(auth) {
  const user = auth.currentUser;
  if (!needsAppleConfirm(user)) return { skipped: true };
  const { FirebaseAuthentication } = await import("@capacitor-firebase/authentication");
  let result;
  try {
    result = await FirebaseAuthentication.signInWithApple({ skipNativeAuth: true });
  } catch (err) {
    // Closing the Apple sheet is a decision: the account stays.
    throw new Cancelled(err?.message || "cancelled");
  }
  const code = result?.credential?.authorizationCode;
  const signedInAs = user.providerData.find((p) => p?.providerId === "apple.com")?.uid;
  if (!code) return { revoked: false, reason: "no_code" };
  if (signedInAs && appleSub(result?.credential?.idToken) && appleSub(result.credential.idToken) !== signedInAs) {
    return { revoked: false, reason: "different_apple_id" };
  }
  try {
    const idToken = await user.getIdToken(true);
    const key = auth.app?.options?.apiKey;
    const res = await fetch(`https://identitytoolkit.googleapis.com/v2/accounts:revokeToken?key=${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ providerId: "apple.com", tokenType: "CODE", token: code, idToken }),
    });
    return { revoked: res.ok, reason: res.ok ? null : `http_${res.status}` };
  } catch {
    return { revoked: false, reason: "network" };
  }
}

let inProgress = false;
export const accountDeletionInProgress = () => inProgress;

export async function deleteMyAccount({ auth }) {
  const user = auth.currentUser;
  if (!user) throw new Error("not_signed_in");
  inProgress = true;
  try {
    await authedPost(user, "/api/delete-account", { confirm: "DELETE" });
  } catch (err) {
    inProgress = false;
    throw err;
  }
}

// The account is gone on the server; now let this device forget it too. Each step is independent
// and best effort — none of them can bring the account back.
let forgetting = null;
export function forgetThisDevice({ auth, db }) {
  forgetting = (async () => {
    try { await signOut(auth); } catch { /* already gone */ }
    if (isNativeApp()) {
      try { const { FirebaseAuthentication } = await import("@capacitor-firebase/authentication"); await FirebaseAuthentication.signOut(); } catch { /* not signed in natively */ }
    }
    // Let the signed-out render settle before Firestore is shut down under it.
    await new Promise((resolve) => setTimeout(resolve, 300));
    try { localStorage.clear(); sessionStorage.clear(); } catch { /* storage blocked */ }
    try { await terminate(db); await clearIndexedDbPersistence(db); } catch { /* cache already gone */ }
  })();
  return forgetting;
}
// "Done" on the confirmation waits for this before restarting the app.
export const deviceForgotten = () => forgetting || Promise.resolve();
