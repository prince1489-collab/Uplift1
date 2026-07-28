// publicProfile.js — the subset of a member's profile that other members may read.
//
// WHY THIS EXISTS
// `users/{uid}` was readable by any signed-in account, and it holds email, date of birth,
// WHO-5 wellbeing scores, FCM push token, timezone and spark balance. Nothing in the UI
// showed those to anyone else, but the rule allowed it, so the exposure was one `getDoc`
// away for anybody with the app open and a console.
//
// That was tolerable only while there was no way to enumerate accounts. Search-to-follow
// removes that: a name lookup over `users` would have turned a latent exposure into a
// browsable directory of every member's email and date of birth. So the readable fields move
// here, `users` closes to its owner, and search points at this collection instead.
//
// Everything in PUBLIC_FIELDS is already visible in the app to anyone who can see one of
// your messages. Nothing new is exposed by this file; what changes is that nothing *else*
// is exposed alongside it.

import { doc, getDoc, setDoc, collection, query, where, orderBy, limit, getDocs } from "firebase/firestore";

// The only fields that ever leave `users`. Adding to this list makes something public —
// think about it in those terms, and check it against what the app already displays.
export const PUBLIC_FIELDS = [
  "fullName",
  "country",
  "profilePhotoUrl",
  "mostDays",      // glimpse line, already shown on the glimpse card
  "anotherLife",   // glimpse line, ditto
  "reactionsReceivedCount", // powers "onward reach" in My Impact
];

// Firestore has no substring search, so the searchable form is a lowercased name and the
// query is a prefix range. "starts with" is the right shape for finding a person anyway —
// nobody looks someone up by the middle of their name.
export const searchKey = (name) => String(name || "").trim().toLowerCase();

function projection(profile) {
  const out = {};
  for (const f of PUBLIC_FIELDS) {
    if (profile?.[f] !== undefined && profile?.[f] !== null) out[f] = profile[f];
  }
  out.nameLower = searchKey(profile?.fullName);
  return out;
}

// Mirror the public fields of a profile into publicProfiles/{uid}.
// Best-effort by design: a failure here must never block the profile save that triggered it,
// because the authoritative copy is the one in `users`.
export async function syncPublicProfile(db, uid, profile) {
  if (!db || !uid || !profile) return;
  const data = projection(profile);
  if (!data.fullName) return; // nothing worth publishing yet
  try {
    await setDoc(doc(db, "publicProfiles", uid), { ...data, uid, updatedAt: Date.now() }, { merge: true });
  } catch { /* best-effort */ }
}

// Backfill on sign-in for accounts that predate this collection. Reads the user's OWN
// `users` doc, which they can always read, and publishes the projection if it's missing or
// has drifted from the name currently on the profile.
export async function ensurePublicProfile(db, uid) {
  if (!db || !uid) return;
  try {
    const [mine, pub] = await Promise.all([
      getDoc(doc(db, "users", uid)),
      getDoc(doc(db, "publicProfiles", uid)),
    ]);
    if (!mine.exists()) return;
    const profile = mine.data();
    if (pub.exists() && pub.data()?.nameLower === searchKey(profile?.fullName)) return;
    await syncPublicProfile(db, uid, profile);
  } catch { /* best-effort */ }
}

// Read another member's public profile. This replaces every cross-user read of `users`.
export async function readPublicProfile(db, uid) {
  if (!db || !uid) return null;
  try {
    const snap = await getDoc(doc(db, "publicProfiles", uid));
    return snap.exists() ? snap.data() : null;
  } catch {
    return null;
  }
}

// Prefix search by name. Excludes the caller — "follow yourself" is not a thing — and any
// uid the caller has blocked, so a blocked account can't be reached through search either.
export async function searchProfiles(db, term, { excludeUid = null, blockedUids = null, max = 15 } = {}) {
  const key = searchKey(term);
  if (!db || key.length < 2) return [];
  const blocked = blockedUids instanceof Set ? blockedUids : new Set(blockedUids || []);
  try {
    const q = query(
      collection(db, "publicProfiles"),
      where("nameLower", ">=", key),
      // U+F8FF is the last character in the Unicode BMP private-use area, so this bounds
      // the range to "keys beginning with `key`".
      where("nameLower", "<=", `${key}\uf8ff`),
      orderBy("nameLower"),
      limit(max + 10)
    );
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => ({ uid: d.id, ...d.data() }))
      .filter((p) => p.uid !== excludeUid && !blocked.has(p.uid))
      .slice(0, max);
  } catch {
    return [];
  }
}
