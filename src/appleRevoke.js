// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.
//
// appleRevoke.js — revoking Sign in with Apple when an account is deleted (3.20).
//
// Apple requires an app that offers Sign in with Apple to revoke the person's Apple token when
// they delete their account. Firebase does that in its iOS SDK, Auth.revokeToken(
// withAuthorizationCode:), which the auth plugin exposes as revokeAccessToken({ token }). Two
// things make it fiddly here:
//
//   • It needs a fresh authorisation code, which only the Apple sheet can give — so the person
//     confirms with Apple once.
//   • It runs on the NATIVE Firebase user, and this app otherwise signs in on the JavaScript side
//     only (skipNativeAuth). So this one sign-in is native as well, and is signed out again at the
//     end. (Calling the REST endpoint from JavaScript instead doesn't work for a native app: for
//     a code it wants the redirect URI of a web sign-in, which a native sign-in never had.)
//
// Best effort: if revocation fails, deletion still goes ahead — keeping someone's data because a
// revocation hiccupped would be the worse failure. Only closing the Apple sheet means "stop".
// No imports: the plugin is passed in, so scripts/test-delete-account.mjs runs this against a fake.

export class Cancelled extends Error {}

// Apple's "sub" claim — which Apple ID a token belongs to — read without verifying (Firebase
// verifies the token itself). Used only to make sure the person confirmed with the SAME Apple ID
// they signed up with, so we never revoke someone else's.
export function appleSub(idToken) {
  try { return JSON.parse(atob(String(idToken).split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).sub || null; }
  catch { return null; }
}

// ASAuthorizationErrorCanceled is 1001; the plugin passes Apple's message through with no code.
// Firebase's own errors come with an "auth/…" code, and are never the person's decision.
const isCancel = (err) => !String(err?.code || "").startsWith("auth/")
  && /AuthorizationError error 1001|cancel/i.test(String(err?.message || ""));

function withTimeout(promise, ms) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("timeout")), ms); }),
  ]).finally(() => clearTimeout(timer));
}

// Native calls that must never leave the delete sheet spinning: Firebase's revokeToken, for one,
// never calls back at all if there is no native user.
const quietly = async (fn, ms) => { try { await withTimeout(Promise.resolve().then(fn), ms); } catch { /* best effort */ } };

export async function revokeAppleSignIn({ plugin, user, timeoutMs = 15000 }) {
  let result;
  try {
    result = await plugin.signInWithApple({ skipNativeAuth: false });
  } catch (err) {
    if (isCancel(err)) throw new Cancelled(err?.message || "cancelled");
    await quietly(() => plugin.signOut(), timeoutMs);
    return { revoked: false, reason: err?.code || "apple_sign_in_failed" };
  }
  try {
    const signedInAs = user?.providerData?.find((p) => p?.providerId === "apple.com")?.uid || null;
    const confirmedAs = appleSub(result?.credential?.idToken);
    if (signedInAs && confirmedAs && confirmedAs !== signedInAs) {
      // A different Apple ID. If that sign-in just created an account, it is an empty one made by
      // accident here — remove it. An account that already existed is never touched.
      if (result?.additionalUserInfo?.isNewUser) await quietly(() => plugin.deleteUser(), timeoutMs);
      return { revoked: false, reason: "different_apple_id" };
    }
    const code = result?.credential?.authorizationCode;
    if (!code) return { revoked: false, reason: "no_code" };
    await withTimeout(plugin.revokeAccessToken({ token: code }), timeoutMs);
    return { revoked: true };
  } catch (err) {
    return { revoked: false, reason: err?.code || err?.message || "failed" };
  } finally {
    await quietly(() => plugin.signOut(), timeoutMs);
  }
}
