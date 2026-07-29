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

// Firestore has no substring search. The first version of this stored one lowercased name
// and did a prefix range over it, which meant searching a surname found nobody: "rathore"
// could never match "Mahiman S Rathore", because the range only ever tests the START of the
// whole string. If you know someone's name, that is a strange thing for search not to find.
//
// So each profile also stores every prefix of every word in the name, and search is a single
// array-contains against that. "rath" matches "Rathore"; "mah" matches "Mahiman". The cost is
// a handful of short strings per profile — a three-word name produces about fifteen.
export const searchKey = (name) => String(name || "").trim().toLowerCase();

const MIN_TOKEN = 2;   // one letter would match most of the directory
const MAX_TOKEN = 12;  // longer than this and people are typing the whole name anyway
const MAX_WORDS = 4;   // guards against a pathological "name" of many words

export function searchTokens(name) {
  const words = searchKey(name)
    // Punctuation becomes a space, so "o'brien" indexes as two words and is findable by
    // "brien". Not by "obrien" — a trade accepted rather than special-cased.
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, MAX_WORDS);
  const out = new Set();
  for (const w of words) {
    for (let i = MIN_TOKEN; i <= Math.min(w.length, MAX_TOKEN); i++) out.add(w.slice(0, i));
  }
  return [...out];
}

function projection(profile) {
  const out = {};
  for (const f of PUBLIC_FIELDS) {
    if (profile?.[f] !== undefined && profile?.[f] !== null) out[f] = profile[f];
  }
  out.nameLower = searchKey(profile?.fullName);
  out.nameTokens = searchTokens(profile?.fullName);
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
    // Re-sync when the name changed OR when the document predates nameTokens — otherwise
    // profiles written before search existed would stay permanently unfindable.
    const cur = pub.exists() ? pub.data() : null;
    const upToDate = cur?.nameLower === searchKey(profile?.fullName)
      && Array.isArray(cur?.nameTokens) && cur.nameTokens.length > 0;
    if (upToDate) return;
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
    // array-contains on the prefix tokens: matches any WORD of the name, not just the first.
    // No orderBy, so this needs only Firestore's automatic array index — sorting happens
    // below, where it is free.
    const snap = await getDocs(query(
      collection(db, "publicProfiles"),
      where("nameTokens", "array-contains", key),
      limit(max + 25)
    ));
    return snap.docs
      .map((d) => ({ uid: d.id, ...d.data() }))
      .filter((p) => p.uid !== excludeUid && !blocked.has(p.uid))
      // Names that START with what was typed first — someone searching "mah" almost
      // certainly wants Mahiman ahead of a Rathore whose middle name happens to match.
      .sort((a, b) => {
        const aStarts = (a.nameLower || "").startsWith(key) ? 0 : 1;
        const bStarts = (b.nameLower || "").startsWith(key) ? 0 : 1;
        return aStarts - bStarts || (a.nameLower || "").localeCompare(b.nameLower || "");
      })
      .slice(0, max);
  } catch (err) {
    console.error("[search] failed:", err?.code, err?.message);
    return [];
  }
}
