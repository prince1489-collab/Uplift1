// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.
//
// _deleteAccount.js — everything Seen holds about one person, deleted (3.20).
//
// App Store Guideline 5.1.1(v) rejected build 76: "Delete Account" linked to a web page that
// asked people to email us, and only highly-regulated apps may make deletion a customer-service
// errand. This is the real thing, run from the app: one call, and the account and what it made
// are gone. No network or Firebase here — api/delete-account.js passes in the database, Auth,
// Storage and Stripe, and scripts/test-delete-account.mjs runs it against fakes.
//
// WHAT GOES (everything that is theirs or about them):
//   users/{uid} and every subcollection under it (journal, feelings, follows, Seen conversation
//   and what it noticed, wellbeing, reactions received, …) · publicProfiles/{uid} ·
//   presence/{uid} · the legacy top-level feelings/{uid} · their referral marker ·
//   their public messages, with the reactions, gifts and media under them · private replies and
//   kind notes they sent OR received · waves either way · kind moments either side ·
//   shared reflections and greeting submissions they wrote · their reactions on other people's
//   messages · what those reactions left in other people's spaces (the "hearts received" rows
//   with their first name, ripple records) · other people's follow-list entries for them (which
//   carry their name) · their profile photos · an active supporter subscription (cancelled) ·
//   and, last, the sign-in itself.
//
// WHAT STAYS, and why:
//   reports — about other people's behaviour, kept as safety records (the privacy policy says so);
//   gift markers on other people's messages — named by the giver's id and holding only an amount
//     and a time, they say nothing about anyone once the account they point to is gone, and
//     there is no way to query them by giver;
//   payment records held by Stripe, for tax and accounting.
//
// Idempotent: every step deletes what is still there, so a retry after a partial failure finishes
// the job. The sign-in goes LAST, so a failure part-way leaves someone able to sign in and try
// again rather than with half an account they can no longer reach.

export const CONFIRM_WORD = "DELETE";

export async function deleteAccountData({ db, uid, deleteAuthUser, deleteStoragePrefix, cancelSubscription, log = () => {} }) {
  if (!db || !uid || typeof uid !== "string") throw new Error("missing uid");
  const counts = {};
  const gone = async (label, refs) => {
    counts[label] = (counts[label] || 0) + refs.length;
    for (const ref of refs) await db.recursiveDelete(ref);
  };
  const where = async (coll, field) => (await db.collection(coll).where(field, "==", uid).get()).docs.map((d) => d.ref);
  const group = async (name, field) => (await db.collectionGroup(name).where(field, "==", uid).get()).docs.map((d) => d.ref);
  const soft = async (label, fn) => {
    try { await fn(); } catch (err) { counts[label] = `failed: ${err?.code || err?.message || err}`; log(label, err); }
  };
  // Take this person out of a shared reaction document, in a transaction so a reaction someone
  // else adds at the same moment isn't lost. True if they were in it.
  const takeOutOf = (ref) => db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return false;
    const data = snap.data() || {};
    const before = Array.isArray(data.uids) ? data.uids : [];
    const uids = before.filter((u) => u !== uid);
    if (uids.length === before.length) return false;
    const countries = { ...(data.countries || {}) };
    const reactedAt = { ...(data.reactedAt || {}) };
    delete countries[uid];
    delete reactedAt[uid];
    if (uids.length === 0) tx.delete(ref);
    else tx.update(ref, { count: uids.length, uids, countries, reactedAt });
    return true;
  });

  // 0. What we need from the profile before it goes.
  const userRef = db.collection("users").doc(uid);
  const userSnap = await userRef.get();
  const user = userSnap.exists ? userSnap.data() || {} : {};

  // 1. A supporter subscription stops billing. Best effort: a Stripe outage must not keep
  //    someone's data on our servers.
  if (user.stripeSubscriptionId && cancelSubscription) {
    await soft("subscription", async () => { await cancelSubscription(user.stripeSubscriptionId); counts.subscription = "cancelled"; });
  }

  // 2. What they made, wherever it lives.
  await gone("publicMessages", await where("publicMessages", "uid"));
  await gone("privateRepliesSent", await where("privateReplies", "fromUid"));
  await gone("privateRepliesReceived", await where("privateReplies", "toUid"));
  await gone("wavesSent", await where("waves", "fromUid"));
  await gone("wavesReceived", await where("waves", "toUid"));
  await gone("kindMomentsA", await where("kindMoments", "aUid"));
  await gone("kindMomentsB", await where("kindMoments", "bUid"));
  await gone("sharedReflections", await where("sharedReflections", "authorUid"));
  await gone("greetingSubmissions", await where("greetingSubmissions", "authorUid"));
  // Their reactions on other people's messages. A reaction document is one per KIND of reaction
  // ("❤️", "sticker_hug", …) and holds everyone who gave it — { count, uids, countries,
  // reactedAt }, see src/reactions.js — so this person is taken OUT of it; the document is
  // everyone else's too, and goes only when they were the last one in it. (Reactions on their
  // own messages went with the messages, above.)
  //
  // Collection-group queries from here on need the field overrides in firestore.indexes.json,
  // so each is soft: an index still building must not stop the rest of the deletion.
  await soft("reactionsGiven", async () => {
    const snap = await db.collectionGroup("reactions").where("uids", "array-contains", uid).get();
    let n = 0;
    for (const d of snap.docs) if (await takeOutOf(d.ref)) n++;
    counts.reactionsGiven = n;
  });
  // What their reactions and replies left in other people's spaces: the "hearts received" row on
  // the owner's bell (with the reactor's first name) and the ripple record on the person they
  // answered. And other people's follow-list entries for them, which carry their name.
  await soft("reactionsReceivedByOthers", async () => gone("reactionsReceivedByOthers", await group("reactionsReceived", "reactorUid")));
  await soft("ripplesOnOthers", async () => gone("ripplesOnOthers", await group("ripples", "responderUid")));
  await soft("followedByOthers", async () => gone("followedByOthers", await group("follows", "uid")));

  // 3. Documents named by their id.
  for (const coll of ["publicProfiles", "presence", "feelings", "referrals"]) {
    const ref = db.collection(coll).doc(uid);
    const snap = await ref.get();
    if (snap.exists) await gone(coll, [ref]); else counts[coll] = 0;
  }

  // 4. Their own space, and everything under it.
  await gone("user", userSnap.exists ? [userRef] : []);
  // recursiveDelete also clears subcollections whose parent document never existed.
  if (!userSnap.exists) await db.recursiveDelete(userRef);

  // 5. Their photos.
  if (deleteStoragePrefix) await soft("profilePhotos", async () => { await deleteStoragePrefix(`profilePhotos/${uid}/`); counts.profilePhotos = "deleted"; });

  // 6. Last: the sign-in. Already gone counts as done.
  if (deleteAuthUser) {
    try { await deleteAuthUser(uid); counts.auth = "deleted"; }
    catch (err) {
      if (err?.code === "auth/user-not-found") counts.auth = "already deleted";
      else throw err;
    }
  }
  return counts;
}
