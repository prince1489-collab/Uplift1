// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.
//
// Feed2.jsx — v2 "Connect" tab pieces. The Worldwide Feed shows strangers' messages
// (people you haven't followed); the Focused Feed below it shows only the people you follow.
//
// REAL, all screened via /api/moderate-message before anything is written:
//   - free-text posts   -> publicMessages   (feed; production renders them too)
//   - shared reflections -> sharedReflections (readable by any signed-in member)
//   - private replies    -> privateReplies  (readable ONLY by the two people involved)
// Still SIMULATED (localStorage only): likes, and "kind moment" broadcasts — the latter
// deliberately, because announcing that two named people exchanged a PRIVATE message
// discloses the exchange itself. See the note on splitKindMoments.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  doc, onSnapshot, collection, addDoc, query, where, orderBy, limit, updateDoc,
  setDoc, deleteDoc, getDoc,
} from "firebase/firestore";
import { X, Heart, MessageCircle, UserPlus, UserCheck, Loader2, Search } from "lucide-react";
import { FLAG_MAP } from "./MicroAnimations";
import { readPublicProfile, searchProfiles } from "./publicProfile";
import { writeFailure } from "./writeFailure";
import { awardPoints } from "./points";
import { computeSparkReward, ReportBlockBar } from "./UpliftRetentionFeatures";
import { apiUrl, authedPost } from "./apiBase";

const POSTS_KEY = "seen_v2_local_posts";
const FOCUS_KEY = "seen_v2_focused_uids"; // legacy: bare uid array, migrated into FOLLOWS_KEY
const FOLLOWS_KEY = "seen_v2_follows";    // [{ uid, name, country, label }]
const MOMENTS_KEY = "seen_v2_kind_moments";
const LIKES_KEY = "seen_v2_board_likes";
const STORIES_KEY = "seen_v2_stories";
const MAX_LEN = 80;
const POST_SPARK_REWARD = 25; // base, before the streak multiplier
// Anonymous posting is level-gated per the roadmap: a brand-new account cannot immediately
// post without a name attached. 150 is level 3 ("It's Giving Kind") — roughly a week of
// ordinary use, low enough not to block real members, high enough that a throwaway account
// created to post anonymously has to earn it first.
const ANON_MIN_BALANCE = 150;

const readJSON = (k, fb) => { try { return JSON.parse(localStorage.getItem(k) || JSON.stringify(fb)); } catch { return fb; } };
const writeJSON = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } };

export const loadLocalPosts = () => readJSON(POSTS_KEY, []);
const saveLocalPosts = (l) => writeJSON(POSTS_KEY, l.slice(0, 30));

// ── Follows: who you follow, with a denormalized name/country and an optional label ──
// Suggested labels; users can also type their own via "Custom…".
export const FOLLOW_LABELS = ["Family", "Friend", "Work", "Neighbour"];

// Reads the cached follow list, migrating the legacy bare-uid array on first run so existing
// testers keep everyone they already followed.
//
// localStorage is now a CACHE, not the source of truth — see useFollows below. It is kept so
// the Focused Feed paints instantly on open rather than flashing empty while Firestore
// connects, and so the app still works offline.
export function loadFollows() {
  const stored = readJSON(FOLLOWS_KEY, null);
  if (Array.isArray(stored)) return stored;
  const legacy = readJSON(FOCUS_KEY, []);
  const migrated = (Array.isArray(legacy) ? legacy : [])
    .filter(Boolean)
    .map((uid) => ({ uid, name: "", country: null, label: null }));
  if (migrated.length) writeJSON(FOLLOWS_KEY, migrated);
  return migrated;
}
export const saveFollows = (list) => writeJSON(FOLLOWS_KEY, list.slice(0, 200));

// ── Follows, synced ──────────────────────────────────────────────────────────
// Who you follow used to live only in localStorage, which meant signing in on a second
// device gave you an empty Focused Feed and no way to recover the list except rebuilding it
// by hand. Follows are an account fact, not a device fact.
//
// They live at users/{uid}/follows/{followedUid} — the same owner-only subcollection shape
// as blockedUsers, so nobody can see who you follow. The doc id IS the followed uid, which
// makes follow/unfollow idempotent: following twice writes the same document rather than
// creating a duplicate.
//
// localStorage stays as a read-through cache so the feed paints immediately on open.
export function useFollows(db, currentUser) {
  const [follows, setFollows] = useState(() => loadFollows());
  const uid = currentUser?.uid ?? null;

  useEffect(() => {
    if (!db || !uid) return;
    const col = collection(db, "users", uid, "follows");

    // One-time lift of whatever this device already had. Without it, the first device to
    // load after this change would find an empty collection and silently wipe a follow list
    // the user spent time building.
    let migrated = false;
    const migrateOnce = async (serverIsEmpty) => {
      if (migrated || !serverIsEmpty) return;
      migrated = true;
      const local = loadFollows();
      if (!local.length) return;
      await Promise.all(local.slice(0, 200).map((f) =>
        setDoc(doc(col, f.uid), {
          uid: f.uid,
          name: f.name || "",
          country: f.country ?? null,
          label: f.label ?? null,
          ts: Date.now(),
        }).catch(() => {})
      ));
    };

    const unsub = onSnapshot(col, (snap) => {
      const rows = snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
      if (snap.empty && !snap.metadata.fromCache) { migrateOnce(true); return; }
      setFollows(rows);
      saveFollows(rows); // keep the cache warm for the next cold start
    }, (err) => {
      // Falling back to the cache is the right failure: a transient read error should not
      // look like "you follow nobody".
      console.error("[follows] listener failed:", err?.code, err?.message);
    });
    return unsub;
  }, [db, uid]);

  return follows;
}

// Follow / unfollow / relabel. Each writes one document and lets the listener update state,
// so every device converges on the same list without any of them holding a private copy.
export async function followUser(db, currentUser, { uid, name, country, label = null }) {
  if (!db || !currentUser?.uid || !uid || uid === currentUser.uid) return;
  await setDoc(doc(db, "users", currentUser.uid, "follows", uid), {
    uid, name: name || "", country: country ?? null, label, ts: Date.now(),
  }, { merge: true }).catch((err) => console.error("[follows] follow failed:", err?.code));
}

export async function unfollowUser(db, currentUser, uid) {
  if (!db || !currentUser?.uid || !uid) return;
  await deleteDoc(doc(db, "users", currentUser.uid, "follows", uid))
    .catch((err) => console.error("[follows] unfollow failed:", err?.code));
}

export async function setFollowLabelRemote(db, currentUser, uid, label) {
  if (!db || !currentUser?.uid || !uid) return;
  await setDoc(doc(db, "users", currentUser.uid, "follows", uid), { label }, { merge: true })
    .catch((err) => console.error("[follows] label failed:", err?.code));
}

export const loadKindMoments = () => readJSON(MOMENTS_KEY, []);

// ── Kind moments ─────────────────────────────────────────────────────────────
// A kind moment says that a private reply happened. It does NOT say who, and it never says
// what.
//
// The earlier version named both people, which was why it was left device-local and never
// broadcast: "Mahiman and Vidhi shared a kind moment" keeps the content of a private message
// private while making the fact of the contact public — and the reply sheet promises, at the
// moment you are typing, that nothing about it appears in any feed. Naming people would have
// broken a promise the user had just read.
//
// So moments are anonymous. Countries are kept because they carry the "this is happening all
// over the world" feeling that the card exists for, and a country is not an identity. The
// uids are stored for ROUTING ONLY — they decide which feed the card belongs in — and are
// never rendered. That is the whole design: enough to place the card, not enough to identify
// anyone.
// A month, matching the feed's own window. These were a week while messages were a week;
// leaving them behind would have meant month-old messages sitting beside no moments at all.
const MOMENT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

// Write a moment for a private reply that just went out. Best-effort: a private reply that
// succeeded must never be reported as failed because its celebratory side-effect didn't
// write. Returns nothing — the feed listener picks it up.
export async function recordKindMoment(db, { fromUid, toUid, fromCountry, toCountry }) {
  if (!db || !fromUid || !toUid) return;
  try {
    await addDoc(collection(db, "kindMoments"), {
      // Routing only. Never rendered — see KindMomentCard.
      aUid: fromUid,
      bUid: toUid,
      // Display. Countries only, no names, no text, no message id.
      aCountry: fromCountry ?? null,
      bCountry: toCountry ?? null,
      ts: Date.now(),
    });
  } catch (err) {
    console.error("[kindMoments] write failed:", err?.code, err?.message);
  }
}

// Live moments from the last week, newest first.
export function useKindMoments(db, currentUser, blockedUids) {
  const [moments, setMoments] = useState([]);
  useEffect(() => {
    if (!db || !currentUser?.uid) { setMoments([]); return; }
    const q = query(
      collection(db, "kindMoments"),
      where("ts", ">", Date.now() - MOMENT_MAX_AGE_MS),
      orderBy("ts", "desc"),
      limit(40)
    );
    const unsub = onSnapshot(q, (snap) => {
      const blocked = blockedUids instanceof Set ? blockedUids : new Set(blockedUids || []);
      // Blocking is device-local, so a blocked person's moments are filtered here. They are
      // anonymous on screen either way, but you shouldn't have to see that they were active.
      setMoments(snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        .filter((m) => !blocked.has(m.aUid) && !blocked.has(m.bUid)));
    }, (err) => {
      console.error("[kindMoments] listener failed:", err?.code, err?.message);
      setMoments([]);
    });
    return unsub;
  }, [db, currentUser?.uid, blockedUids]);
  return moments;
}

// Route a kind moment to the right feed. A moment belongs in your Focused Feed when either
// person in it is you or someone you follow; otherwise it's two strangers, so it broadcasts
// in the Worldwide Feed. Legacy moments predate the uids and were always your own, so they
// stay focused.
export function splitKindMoments(moments = [], focusedUids = [], myUid) {
  const near = new Set([...focusedUids, myUid].filter(Boolean));
  const focused = [], worldwide = [];
  for (const km of moments) {
    const known = km.aUid || km.bUid;
    const isNear = !known || near.has(km.aUid) || near.has(km.bUid);
    (isNear ? focused : worldwide).push(km);
  }
  return { focused, worldwide };
}

// Private replies received. Real now: they live in Firestore, readable only by the sender
// and the recipient (see the privateReplies rule). Blocked senders are filtered out here as
// well as by the rules, because blocking is device-local.
export function useRepliesReceived(db, currentUser, messageId, blockedUids) {
  const [replies, setReplies] = useState([]);
  useEffect(() => {
    if (!db || !currentUser?.uid) { setReplies([]); return; }
    const q = query(
      collection(db, "privateReplies"),
      where("toUid", "==", currentUser.uid),
      orderBy("ts", "desc"),
      limit(50)
    );
    const unsub = onSnapshot(q, (snap) => {
      const blocked = blockedUids instanceof Set ? blockedUids : new Set(blockedUids || []);
      setReplies(snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((r) => !blocked.has(r.fromUid))
        .filter((r) => !messageId || r.messageId === messageId));
    }, (err) => {
      // This used to be `() => setReplies([])`, which is how a missing composite index
      // presented itself as "the reply appeared for a second and then vanished": the local
      // cache answered first, the server then rejected the query, and this handler quietly
      // wiped the list. Silence made a configuration problem look like a data problem.
      console.error("[privateReplies] listener failed:", err?.code, err?.message);
      setReplies([]);
    });
    return unsub;
  }, [db, currentUser?.uid, messageId, blockedUids]);
  return replies;
}

// Everything addressed to me, newest first — powers the unread count and the inbox.
export function useInboxReplies(db, currentUser, blockedUids) {
  return useRepliesReceived(db, currentUser, null, blockedUids);
}
// ── Shared kindness journals ──────────────────────────────────────────────────
export const loadLocalStories = () => readJSON(STORIES_KEY, []);
// Add a shared journal (from a Reflect entry). Device-local; never Firestore.
export function addLocalStory(story) {
  const existing = loadLocalStories();
  const id = `story_${existing.length + 1}_${(story.text || "").length}_${(story.authorUid || "me").slice(0, 6)}`;
  const next = [{ id, ...story, ts: Date.now() }, ...existing].slice(0, 20);
  writeJSON(STORIES_KEY, next);
  return next;
}

// How a shared journal is announced in the feed. Anonymous shares never name the author.
export const storyAuthorLabel = (s) => (s?.anonymous ? "Someone" : (s?.authorName || "Someone"));

// Same routing rule as kind moments: yours or a followed author → Focused Feed;
// anyone else → Worldwide Feed. Legacy stories have no authorUid and were always yours.
export function splitStories(stories = [], focusedUids = [], myUid) {
  const near = new Set([...focusedUids, myUid].filter(Boolean));
  const focused = [], worldwide = [];
  for (const s of stories) {
    const isNear = !s.authorUid || near.has(s.authorUid);
    (isNear ? focused : worldwide).push(s);
  }
  return { focused, worldwide };
}

// Sample reflections and kind moments used to be seeded here so the Worldwide-vs-Focused
// routing could be tested on a single device, where a real stranger's content can never
// appear. The app is live now, and fiction shown as content is worse than an empty feed.
//
// Both seeders are gone. This runs in their place: testers already have the seeded rows in
// localStorage, so deleting the seeders alone would have left the example cards on their
// devices permanently.
export function purgeDemoContent() {
  const stories = loadLocalStories().filter((s) => !s.demo);
  writeJSON(STORIES_KEY, stories);
  const moments = loadKindMoments().filter((km) => !km.demo);
  writeJSON(MOMENTS_KEY, moments);
  return { stories, moments };
}

// ── Likes + comments on a shared journal (device-local) ──────────────────────
const STORY_ENGAGE_KEY = "seen_v2_story_engagement"; // { [storyId]: { likes: [], comments: [] } }
const loadEngageAll = () => readJSON(STORY_ENGAGE_KEY, {});
export function loadStoryEngagement(storyId) {
  const e = loadEngageAll()[storyId];
  return { likes: Array.isArray(e?.likes) ? e.likes : [], comments: Array.isArray(e?.comments) ? e.comments : [] };
}
export function toggleStoryLike(storyId, me) {
  const all = loadEngageAll();
  const cur = loadStoryEngagement(storyId);
  const mine = cur.likes.find((l) => l.uid === me?.uid);
  const likes = mine ? cur.likes.filter((l) => l.uid !== me?.uid)
    : [...cur.likes, { uid: me?.uid ?? "me", name: me?.name || "You", country: me?.country ?? null, ts: Date.now() }];
  all[storyId] = { ...cur, likes };
  writeJSON(STORY_ENGAGE_KEY, all);
  if (!mine) { try { awardPoints("like"); } catch { /* ignore */ } }
  return { ...cur, likes };
}
export function addStoryComment(storyId, me, text) {
  const all = loadEngageAll();
  const cur = loadStoryEngagement(storyId);
  const comments = [...cur.comments, { uid: me?.uid ?? "me", name: me?.name || "You", country: me?.country ?? null, text, ts: Date.now() }];
  all[storyId] = { ...cur, comments };
  writeJSON(STORY_ENGAGE_KEY, all);
  try { awardPoints("reply"); } catch { /* ignore */ }
  return { ...cur, comments };
}
const flagFor = (c) => (c && FLAG_MAP[c] ? FLAG_MAP[c] : "🌍");
const firstName = (n) => (n || "Someone").split(" ")[0];

// ── Worldwide Feed — a compact, single-broadcast rotator ──────────────────────
// One stranger's message shows at a time (~2 lines), auto-rotating every few seconds.
// Tap the message to reveal Like / Reply / Follow — collapsed by default to save space.
// Tinted + pinned above the scroller so it reads as a distinct band, separate from the
// Focused Feed below it.
const ROTATE_MS = 5000;
export function WorldwideBoard({ messages = [], myUid, focusedUids = [], blockedUids, moments = [], stories = [], onOpenStory, onToggleFocus, onReplyPrivately }) {
  const focusedSet = useMemo(() => new Set(focusedUids), [focusedUids]);
  // Blocking has to hold here too. It used to be applied only to the Focused Feed, so a
  // blocked person's messages kept rotating through the Worldwide strip.
  const isBlocked = useMemo(() => {
    const set = blockedUids instanceof Set ? blockedUids : new Set(blockedUids || []);
    return (uid) => Boolean(uid) && set.has(uid);
  }, [blockedUids]);
  // Strangers' messages and stranger-to-stranger kind moments share one rotation, so a
  // moment takes its turn in the same slot instead of adding fixed height below it.
  const items = useMemo(() => {
    const msgs = messages
      // Personal posts are routed to the Focused Feed, so they never join this rotation.
      .filter((m) => m.uid && m.uid !== myUid && m.uid !== "system" && m.text && !m.isPersonal && !focusedSet.has(m.uid) && !isBlocked(m.uid))
      .slice(0, 25)
      .map((m) => ({ type: "message", id: m.id, ts: Number(m.timestamp) || 0, msg: m }));
    // A blocked person must not surface via a kind moment or a shared reflection either.
    const kms = moments.filter((km) => !isBlocked(km.aUid) && !isBlocked(km.bUid))
      .map((km) => ({ type: "moment", id: km.id, ts: Number(km.ts) || 0, moment: km }));
    const sts = stories.filter((s) => !isBlocked(s.authorUid))
      .map((s) => ({ type: "story", id: s.id, ts: Number(s.ts) || 0, story: s }));
    return [...msgs, ...kms, ...sts].sort((a, b) => b.ts - a.ts);
  }, [messages, myUid, focusedSet, isBlocked, moments, stories]);

  const [likes, setLikes] = useState(() => readJSON(LIKES_KEY, {}));
  const [idx, setIdx] = useState(0);
  const [open, setOpen] = useState(false); // actions revealed for the current message

  // Keep the index in range as the list changes.
  useEffect(() => { if (idx >= items.length) setIdx(0); }, [items.length, idx]);

  // Auto-rotate — paused while the actions are open so people can act without it moving.
  useEffect(() => {
    if (open || items.length <= 1) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % items.length), ROTATE_MS);
    return () => clearInterval(t);
  }, [open, items.length]);

  const like = (id) => {
    const nowLiked = !likes[id];
    const next = { ...likes, [id]: nowLiked }; setLikes(next); writeJSON(LIKES_KEY, next);
    if (nowLiked) { try { awardPoints("like"); } catch { /* ignore */ } } // waters the tree (device-local)
  };

  const item = items[Math.min(idx, Math.max(0, items.length - 1))];
  const m = item?.type === "message" ? item.msg : null;
  const following = m ? focusedSet.has(m.uid) : false;
  // A moment has no author to act on, so it just displays for its turn.
  useEffect(() => { if (item && item.type !== "message" && open) setOpen(false); }, [item?.type, open]);

  return (
    <div className="border-b-2 border-sky-100 bg-sky-50/60 px-3 py-2 flex-shrink-0">
      <div className="flex items-center justify-between px-1 pb-1">
        <p className="text-[11px] font-bold uppercase tracking-wide text-sky-600">🌍 Worldwide Feed</p>
        <span className="text-[10px] font-semibold text-sky-400">
          {items.length > 1 ? <span className="tabular-nums">{idx + 1}/{items.length}</span> : "from strangers"}
        </span>
      </div>

      {!item ? (
        <div className="rounded-2xl bg-white/70 px-3 py-3 text-center text-[12px] text-slate-500">
          💛 Kind messages from around the world will appear here.
        </div>
      ) : item.type === "moment" ? (
        <div key={item.id} style={{ animation: "seenFadeUp 350ms ease both" }}>
          <KindMomentCard moment={item.moment} compact />
        </div>
      ) : item.type === "story" ? (
        <div key={item.id} style={{ animation: "seenFadeUp 350ms ease both" }}>
          <SharedJournalCard story={item.story} onOpen={onOpenStory} compact />
        </div>
      ) : (
        <>
          <button
            key={m.id}
            onClick={() => setOpen((v) => !v)}
            className="w-full text-left rounded-2xl border border-sky-200 bg-white px-3 py-2 active:scale-[0.99] transition-transform"
            style={{ animation: "seenFadeUp 350ms ease both" }}>
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="text-sm">{flagFor(m.country)}</span>
              <span className="text-[11px] font-semibold text-slate-500 truncate flex-1">{firstName(m.sender)}</span>
              {likes[m.id] && <Heart size={11} className="text-rose-500 flex-shrink-0" fill="currentColor" />}
              <span className="text-[10px] text-slate-300 flex-shrink-0">{open ? "tap to close" : "tap to like or reply"}</span>
            </div>
            <p className="text-[13px] leading-snug text-slate-800 font-medium line-clamp-2">“{m.text}”</p>
          </button>

          {open && (
            <div className="mt-1.5 flex items-center gap-2" style={{ animation: "seenFadeUp 200ms ease both" }}>
              <button onClick={() => like(m.id)}
                className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${likes[m.id] ? "bg-rose-50 text-rose-600" : "bg-white border border-slate-200 text-slate-500"}`}>
                <Heart size={12} fill={likes[m.id] ? "currentColor" : "none"} /> {likes[m.id] ? "Liked" : "Like"}
              </button>
              <button onClick={() => onReplyPrivately?.(m)}
                className="flex items-center gap-1 rounded-full bg-white border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-500">
                <MessageCircle size={12} /> Reply
              </button>
              <button onClick={() => onToggleFocus?.(m)}
                className={`ml-auto flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold ${following ? "bg-teal-100 text-teal-700" : "bg-white border border-slate-200 text-slate-500"}`}>
                {following ? <UserCheck size={11} /> : <UserPlus size={11} />}{following ? "Following" : "Follow"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Kind-moment card ─────────────────────────────────────────────────────────
// Anonymous by design. No names are rendered here, and none are stored — see the note above
// recordKindMoment. Legacy device-local moments DID carry names; they are ignored rather
// than displayed, so an old row can't leak what a new one never would.
export function KindMomentCard({ moment, compact = false }) {
  const a = flagFor(moment.aCountry);
  const b = flagFor(moment.bCountry);
  // THREE cases, not two. This used to require the countries to DIFFER before naming them,
  // which quietly folded "both people are in India" in with "we have no idea where either
  // person is" and showed the same bare sentence for both. Same-country is the common case for
  // any app whose users cluster, so the most frequent kind moment was rendering as the least
  // informative one — while the app knew exactly where both people were.
  //
  // Unknown still stays generic: that one is honest, because there is nothing to say.
  const known = moment.aCountry && moment.bCountry;
  const places = !known ? null
    : moment.aCountry !== moment.bCountry
      ? <> between <strong className="text-slate-800">{a} {moment.aCountry}</strong> and <strong className="text-slate-800">{b} {moment.bCountry}</strong></>
      : <> between two people in <strong className="text-slate-800">{a} {moment.aCountry}</strong></>;
  return (
    <div className={`seen-grad-warm rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white flex items-center gap-2 ${compact ? "px-3 py-2" : "mb-2 px-4 py-2.5"}`}
      style={{ animation: "seenFadeUp 400ms ease both" }}>
      <span className={`flex-shrink-0 ${compact ? "text-base" : "text-lg"}`}>⭐</span>
      <p className="text-[12px] text-slate-600 leading-snug flex-1">
        Someone sent a private message of kindness{places}.
      </p>
    </div>
  );
}

// ── Private reply sheet — a real Firestore write to /privateReplies ───────────
// It no longer produces anything for the caller. It used to be simulated and pushed a local
// "kind moment" back through an onDone(nextMoments) callback; when replies became real
// documents that payload disappeared, but the prop and its call site did not. onDone?.()
// was left being invoked with no argument into `(next) => setKindMoments(next)`, which set
// the array to undefined and crashed the feed on its next render.
//
// That was invisible for as long as the write itself failed — the crash sat one line past a
// `return`. It only appeared once the Firestore rules were finally deployed and the write
// started succeeding. The prop is gone rather than guarded: a callback with nothing to say
// is not worth keeping alive.
// `answering` turns this sheet into the other half of the exchange: instead of replying to a
// stranger's public message, you are answering the private reply someone sent you. It is the
// same sheet rather than a second one because everything below the header is identical work —
// the moderation call, the writeFailure mapping, the busy/sent/error states — and two copies
// of that is how the safe path and the second path drift apart.
export function PrivateReplySheet({ target, me, myUid, currentUser, db, blockedUids, answering = null, onClose }) {
  const [text, setText] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const blocked = blockedUids instanceof Set ? blockedUids.has(target?.uid) : false;

  // Has this exchange already been answered? Your own answer is addressed to THEM, so it never
  // appears in your inbox and this cannot be worked out locally — hence one read when the sheet
  // opens. Purely for honesty in the UI: the cap itself is enforced by the rules, and a stale
  // answer here would be refused by the server rather than silently accepted.
  // `undefined` = still checking, `null` = not answered yet, object = the answer already sent.
  // Whether a check is needed is derived, not stored — setting state synchronously in the
  // effect body for the "nothing to check" case would cascade an extra render on every open.
  const needsAnswerCheck = Boolean(answering) && !answering.readOnly && Boolean(db);
  const [existingAnswer, setExistingAnswer] = useState(undefined);
  useEffect(() => {
    if (!needsAnswerCheck) return;
    let alive = true;
    getDoc(doc(db, "privateReplies", `${answering.id}__reply`))
      .then((s) => { if (alive) setExistingAnswer(s.exists() ? s.data() : null); })
      .catch(() => { if (alive) setExistingAnswer(null); }); // read failed → let the rules decide
    return () => { alive = false; };
  }, [db, answering, needsAnswerCheck]);

  const answerChecked = !needsAnswerCheck || existingAnswer !== undefined;
  // The exchange is over when you are looking at someone's answer to you, or you have already
  // sent yours. Either way there is nothing to write, so the composer is not shown at all
  // rather than shown and rejected.
  const exchangeComplete = Boolean(answering) && (answering.readOnly || Boolean(existingAnswer));

  const send = async () => {
    const clean = text.trim();
    if (!clean || sent || busy || !db || !currentUser || !target?.uid) return;
    if (target.uid === myUid) { setError("You can't reply privately to yourself."); return; }
    if (blocked) { setError("You've blocked this person, so you can't message them."); return; }
    setBusy(true);
    setError("");

    // Screened before delivery, like every other piece of free text. Fails CLOSED — a
    // private message to a stranger on a mental-health app is the last place to let
    // unreviewed text through because the checker happens to be down.
    try {
      const mod = await authedPost(currentUser, "/api/moderate-message", { text: clean, context: "reply" });
      if (!mod.checked || !mod.ok) {
        setError(mod.reason || "That didn't pass our kindness check. Try rewording it.");
        setBusy(false);
        return;
      }
    } catch (err) {
      const f = apiFailure(err, "kindness check");
      setError(f.reason);
      setBusy(false);
      return;
    }

    const payload = {
      fromUid: myUid ?? currentUser.uid,
      fromName: firstName(me?.fullName) || "Someone",
      fromCountry: me?.country ?? null,
      toUid: target.uid,
      messageId: target.id ?? null,
      messageText: (target.text ?? "").slice(0, 120), // context for the recipient
      text: clean,
      ts: Date.now(),
      read: false,
    };

    let replyId;
    try {
      if (answering) {
        // The one permitted answer goes to a DERIVED id, not a random one. That is what caps
        // the exchange at two messages: a second answer would be a write to a path that
        // already exists, which Firestore treats as an update, and the update rule allows
        // only `read` to change. So the limit is enforced by the rules rather than by this
        // component choosing not to offer the button again. See firestore.rules.
        replyId = `${answering.id}__reply`;
        await setDoc(doc(db, "privateReplies", replyId), { ...payload, inReplyTo: answering.id });
      } else {
        const ref = await addDoc(collection(db, "privateReplies"), payload);
        replyId = ref.id;
      }
    } catch (err) {
      setError(writeFailure(err, "Your reply"));
      setBusy(false);
      return;
    }

    setSent(true);
    setBusy(false);
    try { awardPoints("reply"); } catch { /* ignore */ }

    // Everything below here is best-effort and deliberately NOT awaited. The reply has
    // already landed; a failure to push a notification or write a celebratory card must
    // never make a delivered message look undelivered.

    // Push the recipient. Sends only the id — notify-reply reads the document itself to work
    // out who it is for and what to say, so nothing here can choose the notification text.
    authedPost(currentUser, "/api/notify-reply", { replyId }).catch(() => {});

    // Announce that kindness happened, without saying who or what — but only for a first
    // reply. An answer is the same two people in the same exchange, and recording a second
    // moment would show one interaction on the globe twice.
    if (!answering) {
      recordKindMoment(db, {
        fromUid: myUid ?? currentUser.uid,
        toUid: target.uid,
        fromCountry: me?.country ?? null,
        toCountry: target.country ?? null,
      });
    }
    setTimeout(() => onClose?.(), 1200);
  };

  return createPortal(
    <div data-portal className="fixed inset-0 z-[240] flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative sheet-slide-up rounded-t-3xl bg-white shadow-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-center pt-3 pb-2"><div className="w-10 h-1 rounded-full bg-slate-200" /></div>
        <div className="px-5 pb-2 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800">
            {answering ? "Reply back" : `Reply privately to ${firstName(target?.sender)}`} {flagFor(target?.country)}
          </h2>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600" aria-label="Close"><X size={20} /></button>
        </div>
        <div className="px-5 pb-8 space-y-3">
          {answering ? (
            // The exchange so far, oldest first, so it reads in order: what you wrote publicly,
            // then what they sent you privately. Without your own message above theirs, a reply
            // arriving days later has no context.
            <div className="space-y-2">
              {answering.messageText && (
                <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">You wrote</p>
                  <p className="mt-0.5 text-[13px] text-slate-500 italic">“{answering.messageText}”</p>
                </div>
              )}
              <div className="rounded-xl bg-sky-50 border border-sky-200 px-3 py-2">
                <p className="text-[10px] font-bold uppercase tracking-wide text-sky-600">
                  {firstName(answering.fromName)} replied {flagFor(answering.fromCountry)}
                </p>
                <p className="mt-0.5 text-[14px] text-slate-700">{answering.text}</p>
              </div>
            </div>
          ) : (
            <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-[13px] text-slate-500 italic">“{target?.text}”</div>
          )}
          {/* Real now — say who can see it, since "private" should mean something specific.
              For an answer it also has to say this is the last one, BEFORE they write it —
              finding out afterwards that you had one shot would feel like a trick. */}
          <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2.5">
            <p className="text-[11px] text-sky-700 leading-relaxed">
              Only {firstName(answering ? answering.fromName : target?.sender)} can read this — your words are never shown
              in any feed. It's screened first, and either of you can delete it.
              {answering && " This is a one-off reply, not a chat: once you send it, the exchange is complete."}
            </p>
          </div>
          {exchangeComplete ? (
            <>
              {existingAnswer && (
                <div className="rounded-xl border border-teal-200 bg-teal-50 px-3 py-2">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-teal-600">You replied</p>
                  <p className="mt-0.5 text-[14px] text-slate-700">{existingAnswer.text}</p>
                </div>
              )}
              <p className="text-center text-[12px] text-slate-500 leading-relaxed">
                This exchange is complete — one reply each, and that's it. Kindness here isn't a
                conversation to keep up with.
              </p>
            </>
          ) : !answerChecked ? (
            <div className="flex justify-center py-4"><Loader2 size={18} className="animate-spin text-slate-300" /></div>
          ) : (
            <>
              <textarea value={text} onChange={(e) => setText(e.target.value.slice(0, 120))} rows={2} autoFocus
                placeholder="A private word of kindness, just between you two…"
                className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-[15px] text-slate-900 placeholder:text-slate-400 focus:border-teal-400 focus:outline-none" />
              {error && (
                <p className="rounded-xl bg-red-50 px-3 py-2 text-center text-xs font-semibold text-red-600" role="alert">{error}</p>
              )}
              {sent && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[12px] font-semibold text-amber-700">
                  Sent ✓ — only {firstName(answering ? answering.fromName : target?.sender)} will see it.
                </div>
              )}
              <button onClick={send} disabled={!text.trim() || sent || busy}
                className="w-full rounded-2xl bg-teal-600 py-3.5 text-sm font-bold text-white hover:bg-teal-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {busy ? (<><Loader2 size={16} className="animate-spin" /> Checking…</>) : answering ? "Send reply" : "Send privately"}
              </button>
              <p className="text-center text-[10px] text-slate-400 leading-relaxed">
                Screened before delivery. Your words stay between you two — the feed only ever shows
                that a kind message happened, never who sent it or what it said.
              </p>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Focused-feed empty state ──────────────────────────────────────────────────
export function FocusedFeedEmpty() {
  return (
    <div className="mx-2 my-4 rounded-2xl border border-slate-200 bg-white px-4 py-6 text-center">
      <div className="text-3xl mb-2">👋</div>
      <p className="text-sm font-bold text-slate-800">Your focused feed is quiet</p>
      <p className="mt-1 text-[12px] text-slate-500 leading-relaxed">
        Tap <strong>Follow</strong> on someone in the Worldwide Feed above to see their kind
        messages here — just the people you choose.
      </p>
    </div>
  );
}

// ── People you follow — review, label and unfollow (⋯ menu) ───────────────────
export function FollowingPanel({ follows = [], messages = [], db, currentUser, blockedUids,
  onSetLabel, onUnfollow, onFollow, onClose }) {
  const [editing, setEditing] = useState(null); // uid whose label chips are open
  const [customFor, setCustomFor] = useState(null); // uid typing a custom label
  const [customText, setCustomText] = useState("");

  // ── Search ────────────────────────────────────────────────────────────────
  // Until now the only way to follow anyone was to wait for one of their messages to appear
  // in the Worldwide Feed and press it — so a new member's Focused Feed stayed empty unless
  // a stranger happened to post while they were looking.
  //
  // This searches publicProfiles, never `users`: see src/publicProfile.js for why that
  // distinction matters. Prefix match on a lowercased name, so it behaves like looking
  // someone up rather than browsing a directory.
  const [term, setTerm] = useState("");
  const [results, setResults] = useState(null); // null = idle, [] = searched and found nothing
  const [searching, setSearching] = useState(false);
  const followedUids = useMemo(() => new Set(follows.map((f) => f.uid)), [follows]);

  useEffect(() => {
    const q = term.trim();
    if (q.length < 2) { setResults(null); setSearching(false); return; }
    setSearching(true);
    // Debounced: a query per keystroke would be a read per keystroke, billed and rate-limited.
    let alive = true;
    const t = setTimeout(async () => {
      const found = await searchProfiles(db, q, {
        excludeUid: currentUser?.uid ?? null,
        blockedUids,
      });
      if (alive) { setResults(found); setSearching(false); }
    }, 300);
    return () => { alive = false; clearTimeout(t); };
  }, [term, db, currentUser?.uid, blockedUids]);

  // Follows saved before names were denormalized fall back to a live-message lookup.
  const nameFor = (f) => {
    if (f.name) return f.name;
    const hit = messages.find((m) => m.uid === f.uid && m.sender);
    return hit?.sender || "Someone";
  };
  const countryFor = (f) => f.country || messages.find((m) => m.uid === f.uid && m.country)?.country || null;

  const commitCustom = (uid) => {
    const t = customText.trim().slice(0, 20);
    if (t) onSetLabel?.(uid, t);
    setCustomFor(null); setCustomText(""); setEditing(null);
  };

  return createPortal(
    <div data-portal className="fixed inset-0 z-[160] flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative sheet-slide-up rounded-t-3xl bg-white shadow-2xl max-h-[85dvh] flex flex-col"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-center pt-3 pb-2 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-slate-200" />
        </div>
        <div className="px-5 pb-2 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800">👥 People you follow</h2>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600" aria-label="Close"><X size={20} /></button>
        </div>
        <p className="px-5 pb-3 text-xs text-slate-400">
          Only these people appear in your Focused Feed. Add a label to keep them organised — it's private to you.
        </p>

        <div className="px-5 pb-3">
          <div className="relative">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Search by name to follow someone"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-8 text-sm text-slate-800 placeholder:text-slate-400 focus:border-teal-400 focus:outline-none"
            />
            {term && (
              <button onClick={() => setTerm("")} aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-300 hover:text-slate-500">
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Results replace the follow list while searching, rather than sitting above it —
            two scrolling lists of people in one sheet is hard to tell apart. */}
        {results !== null ? (
          <div className="overflow-y-auto overscroll-contain px-3 pb-8">
            {searching ? (
              <p className="py-8 text-center text-[13px] text-slate-400">Searching…</p>
            ) : results.length === 0 ? (
              <div className="py-8 text-center text-[13px] text-slate-400">
                Nobody found matching “{term.trim()}”.
                <p className="mt-1 text-[11px]">
                  Try the start of any part of their name. People appear here once they've opened the app.
                </p>
              </div>
            ) : (
              results.map((p) => {
                const already = followedUids.has(p.uid);
                return (
                  <div key={p.uid} className="flex items-center gap-2.5 rounded-2xl px-2.5 py-2.5 hover:bg-slate-50">
                    <span style={{ fontSize: "15px" }}>{flagFor(p.country)}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-800">{p.fullName || "Someone"}</p>
                      {p.country && <p className="truncate text-[11px] text-slate-400">{p.country}</p>}
                    </div>
                    <button
                      disabled={already}
                      onClick={() => onFollow?.({ uid: p.uid, name: p.fullName || "", country: p.country ?? null })}
                      className={`flex-shrink-0 rounded-full px-3 py-1.5 text-[12px] font-bold transition-colors ${
                        already ? "bg-slate-100 text-slate-400" : "bg-teal-600 text-white hover:bg-teal-700"
                      }`}>
                      {already ? "Following" : "Follow"}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        ) : (
        <div className="overflow-y-auto overscroll-contain px-3 pb-8">
          {follows.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-400">
              <div className="text-3xl mb-2">🕊️</div>
              You're not following anyone yet.
              <p className="mt-1 text-[12px] text-slate-400">
                Search for someone by name above, or tap <strong>Follow</strong> on a message in the Worldwide Feed.
              </p>
            </div>
          ) : (
            follows.map((f) => {
              const isEditing = editing === f.uid;
              return (
                <div key={f.uid} className="rounded-2xl px-3 py-2.5 hover:bg-slate-50">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
                      <span style={{ fontSize: "15px" }}>{flagFor(countryFor(f))}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700 truncate">{nameFor(f)}</p>
                      <button onClick={() => { setEditing(isEditing ? null : f.uid); setCustomFor(null); }}
                        className="text-[11px] font-semibold text-teal-600 hover:text-teal-700">
                        {f.label ? `${f.label} · change` : "Add a label"}
                      </button>
                    </div>
                    <button onClick={() => onUnfollow?.(f.uid)}
                      className="text-xs font-semibold text-slate-400 hover:text-rose-500 px-3 py-1.5 rounded-full hover:bg-rose-50 flex-shrink-0">
                      Unfollow
                    </button>
                  </div>

                  {isEditing && (
                    <div className="mt-2 flex flex-wrap gap-1.5" style={{ animation: "seenFadeUp 200ms ease both" }}>
                      {FOLLOW_LABELS.map((l) => (
                        <button key={l} onClick={() => { onSetLabel?.(f.uid, l); setEditing(null); }}
                          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold border transition-colors ${
                            f.label === l ? "border-teal-400 bg-teal-50 text-teal-700" : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                          }`}>
                          {l}
                        </button>
                      ))}
                      {customFor === f.uid ? (
                        <div className="flex items-center gap-1.5 w-full mt-1">
                          <input autoFocus value={customText} maxLength={20}
                            onChange={(e) => setCustomText(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") commitCustom(f.uid); }}
                            placeholder="Your own label…"
                            className="flex-1 rounded-full border border-slate-200 px-3 py-1 text-[12px] text-slate-800 focus:border-teal-400 focus:outline-none" />
                          <button onClick={() => commitCustom(f.uid)}
                            className="rounded-full bg-teal-600 px-3 py-1 text-[11px] font-bold text-white">Save</button>
                        </div>
                      ) : (
                        <button onClick={() => { setCustomFor(f.uid); setCustomText(f.label && !FOLLOW_LABELS.includes(f.label) ? f.label : ""); }}
                          className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-500 hover:bg-slate-50">
                          Custom…
                        </button>
                      )}
                      {f.label && (
                        <button onClick={() => { onSetLabel?.(f.uid, null); setEditing(null); }}
                          className="rounded-full px-2.5 py-1 text-[11px] font-semibold text-slate-400 hover:text-rose-500">
                          Remove label
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
          <p className="pt-3 text-center text-[10px] text-slate-400">Preview: your follows and labels stay on this device.</p>
        </div>
        )}
      </div>
    </div>,
    document.body
  );
}

// ── Focused-feed section header — the boundary between strangers and your people ──
// Sticks to the top of the feed scroller so it stays visible while you scroll.
// `-mx-3.5 px-3.5` cancels the scroller's horizontal padding so the pinned bar runs edge
// to edge; `-top-2` with the matching `pt-3.5` cancels its `pt-2`, which would otherwise
// leave an 8px sliver above the bar for messages to scroll through.
//
// OPAQUE, AND NOT BLURRED, DELIBERATELY. This carried `bg-slate-50/95 backdrop-blur` and
// visibly wobbled during scroll. A backdrop-filter is re-sampled from a fractional scroll
// offset every frame and browsers round that inconsistently — worst in WebKit, which is why
// it showed up on iPhone. At 95% opacity the blur was imperceptible anyway, so it was paying
// a per-frame re-composite on the one element that is pinned while scrolling, for nothing.
// Dark mode made it worse again: `[data-dark-shell] main` is itself translucent, so the blur
// was sampling through a second translucent layer.
//
// The background is set by `.seen-focused-header` in index.css rather than a `bg-slate-50`
// utility, on purpose. This bar has ONE hard requirement — be fully opaque, in both themes,
// so nothing scrolls through it — and the dark-shell remaps rewrite Tailwind background
// utilities globally. `bg-slate-50` + `border-slate-200` together already match a rule meant
// for streak badges that would make this 6% opaque. Owning the colour here means a remap
// written for some other component cannot silently make this one see-through.
export function FocusedFeedHeader({ count = 0, onManage }) {
  return (
    <div className="seen-focused-header sticky -top-2 z-[25] -mx-3.5 mb-2 flex items-center gap-2 border-b border-slate-200 px-3.5 pb-1.5 pt-3.5">
      <p className="text-[11px] font-bold uppercase tracking-wide text-teal-600">👥 Focused Feed</p>
      <span className="text-[10px] font-semibold text-slate-400">
        {count === 0 ? "· just you for now" : `· ${count} ${count === 1 ? "person" : "people"} you follow`}
      </span>
      {onManage && (
        <button onClick={onManage}
          className="ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold text-teal-600 hover:bg-teal-50 transition-colors">
          Manage
        </button>
      )}
    </div>
  );
}

// A failed API call has three quite different causes needing three different fixes, and
// authedPost already attaches .status — so read it rather than collapsing all of them into
// one "couldn't reach" line. The code is shown inline because this is a preview build and
// knowing 503-vs-401 without opening Vercel is worth a little ugliness.
function apiFailure(err, what) {
  const status = err?.status ?? null;
  if (status === 503) return { reason: `The ${what} isn't set up on this deployment (503). It needs its server keys.`, status };
  if (status === 401) return { reason: `Your session has expired (401) — sign in again and retry.`, status };
  return { reason: `We couldn't reach the ${what}${status ? ` (${status})` : ""}. Your words are safe here — try again in a moment.`, status };
}

// ── Post composer — a real post, screened before it goes out ──────────────────
// Every post is reviewed by /api/moderate-message (the same endpoint that already guards
// feeling statuses and custom replies) BEFORE it is written. Unlike the feelings path,
// which allows a post through when moderation is unreachable, this one fails CLOSED: a
// feeling is 60 chars inside a constrained flow, this is free text going to a feed.
export function PostComposer({ profile, myUid, currentUser, db, streak = 0, sparkBalance = 0, onPosted, onClose }) {
  const [text, setText] = useState("");
  const [anon, setAnon] = useState(false);
  const [state, setState] = useState("idle");
  const [reason, setReason] = useState("");
  // "flagged" means rephrase; "unavailable" means try again — different problems needing
  // different things from the user, so they must not share one message.
  const [failKind, setFailKind] = useState(null);
  // Phrasing help runs on its own state. Sharing `state` would render a suggestion error
  // inside the "Not sent" banner, which would read as though the post had been rejected.
  const [phrasing, setPhrasing] = useState("idle"); // idle | loading | ready | none
  const [ideas, setIdeas] = useState([]);
  const [suggestNote, setSuggestNote] = useState("");
  const len = text.trim().length;
  const canAnon = Number(sparkBalance) >= ANON_MIN_BALANCE;

  const suggest = async () => {
    if (len < 8 || phrasing === "loading" || state === "checking" || state === "done") return;
    setPhrasing("loading");
    setIdeas([]);
    setSuggestNote("");
    try {
      const r = await authedPost(currentUser, "/api/post-suggest", { text: text.trim() });
      const list = Array.isArray(r.suggestions) ? r.suggestions.filter(Boolean) : [];
      setIdeas(list);
      setPhrasing(list.length ? "ready" : "none");
    } catch (err) {
      const f = apiFailure(err, "suggestions service");
      console.error("[post] suggest call failed:", f.status ?? err?.message);
      setSuggestNote(f.reason);
      setPhrasing("none");
    }
  };

  const submit = async () => {
    if (!len || state === "checking" || !db || !currentUser) return;
    setState("checking");
    setReason("");
    setFailKind(null);
    const clean = text.trim();

    // 1. Screen it. Any failure to get a clean verdict blocks the post.
    try {
      // Anonymous posts get a stricter review: less accountability, higher bar.
      const mod = await authedPost(currentUser, "/api/moderate-message",
        { text: clean, context: anon ? "post_anonymous" : "post" });
      if (!mod.checked) {
        setFailKind("unavailable");
        setReason("The kindness check couldn't give a verdict just now. Your words are safe here — try again in a moment.");
        setState("rejected");
        return;
      }
      if (!mod.ok) {
        setFailKind("flagged");
        setReason(mod.reason || "That didn't pass our kindness check. Try rephrasing it warmly.");
        setState("rejected");
        return;
      }
    } catch (err) {
      const f = apiFailure(err, "kindness check");
      console.error("[post] moderation call failed:", f.status ?? err?.message);
      setFailKind("unavailable");
      setReason(f.reason);
      // Both endpoints depend on the same server keys, so once one is known unreachable
      // don't keep offering a button that cannot work.
      setPhrasing("none");
      setState("rejected");
      return;
    }

    // 2. Publish. Same field shape the rest of the app writes, so the production build —
    //    which reads publicMessages unfiltered — renders it with no changes of its own.
    try {
      await addDoc(collection(db, "publicMessages"), {
        uid: myUid ?? currentUser.uid,
        sender: anon ? "Anonymous" : (profile?.fullName ?? "Someone"),
        text: clean,
        timestamp: Date.now(),
        country: anon ? null : (profile?.country ?? null),
        isMystery: false,
        isPremium: true,
        // Writing your own words is more effort than tapping a preset (base 20), so it earns
        // slightly more; still below a mystery (35-50). Streak-multiplied like every other send.
        sparkReward: computeSparkReward(POST_SPARK_REWARD, streak),
        isPersonal: true, // routes it to the Focused Feed in v2; ignored by production
      });
    } catch (err) {
      setFailKind("unavailable");
      setReason(writeFailure(err, "Your post"));
      setState("rejected");
      return;
    }

    // Waters the Kindness Tree, same as a reflection. This was missing entirely — the post
    // previously earned nothing on either ledger.
    try { awardPoints("post"); } catch { /* ignore */ }
    setState("done");
    onPosted?.();
    setTimeout(() => onClose?.(), 900);
  };

  return createPortal(
    <div data-portal className="fixed inset-0 z-[240] flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative sheet-slide-up rounded-t-3xl bg-white shadow-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-center pt-3 pb-2"><div className="w-10 h-1 rounded-full bg-slate-200" /></div>
        <div className="px-5 pb-2 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800">Share some kindness</h2>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600" aria-label="Close"><X size={20} /></button>
        </div>
        <div className="px-5 pb-8 space-y-3">
          <textarea value={text} onChange={(e) => setText(e.target.value.slice(0, MAX_LEN))} rows={3} autoFocus
            placeholder="Write something kind, hopeful, or honest…"
            className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-[15px] text-slate-900 placeholder:text-slate-400 focus:border-teal-400 focus:outline-none" />

          {/* Phrasing help — rewrites of your own words. Tapping one fills the box to edit;
              it never sends, and the result is still screened on submit like anything else. */}
          {state !== "done" && (
            <button onClick={suggest} disabled={len < 8 || phrasing === "loading" || state === "checking"}
              className="w-full rounded-xl border border-dashed border-violet-200 py-2 text-[12px] font-semibold text-violet-500 hover:border-violet-300 hover:bg-violet-50 disabled:opacity-40 disabled:hover:bg-transparent transition-colors flex items-center justify-center gap-1.5">
              {phrasing === "loading"
                ? (<><Loader2 size={13} className="animate-spin" /> Finding the words…</>)
                : "✨ Help me say this"}
            </button>
          )}
          {phrasing === "ready" && ideas.length > 0 && (
            <div className="space-y-1.5" style={{ animation: "seenFadeUp 200ms ease both" }}>
              <p className="px-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">Tap one to use it — you can still edit</p>
              {ideas.map((s2, i) => (
                <button key={i} onClick={() => { setText(s2.slice(0, MAX_LEN)); setPhrasing("idle"); setIdeas([]); }}
                  className="w-full rounded-xl border border-violet-100 bg-violet-50/60 px-3 py-2 text-left text-[13px] leading-snug text-slate-700 hover:bg-violet-50 active:scale-[0.99] transition-all">
                  {s2}
                </button>
              ))}
            </div>
          )}
          {phrasing === "none" && (
            <p className="text-center text-[11px] text-slate-400">
              {suggestNote || "Couldn't fetch suggestions just now — your own words are good."}
            </p>
          )}
          <div className="flex items-center justify-between">
            <button onClick={() => { if (canAnon) setAnon((a) => !a); }} disabled={!canAnon}
              className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                !canAnon ? "border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed"
                : anon ? "border-violet-300 bg-violet-50 text-violet-700"
                : "border-slate-200 bg-white text-slate-500"}`}>
              {!canAnon ? "🔒 Posting as you" : anon ? "🕶️ Name hidden" : "👤 Posting as you"}
            </button>
            <span className={`text-[11px] ${len > MAX_LEN - 10 ? "text-amber-600" : "text-slate-400"}`}>{len}/{MAX_LEN}</span>
          </div>
          {/* Say why it's locked rather than leaving a dead button. */}
          {!canAnon && (
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Posting without your name unlocks at {ANON_MIN_BALANCE} drops — it's held back for new accounts
              because there's less to trace if it's misused.
            </p>
          )}
          {state === "rejected" && (
            <div className={`rounded-xl border px-3 py-2.5 ${failKind === "unavailable" ? "border-amber-200 bg-amber-50" : "border-rose-200 bg-rose-50"}`} role="alert">
              <p className={`text-[12px] font-semibold ${failKind === "unavailable" ? "text-amber-700" : "text-rose-700"}`}>
                {failKind === "unavailable" ? "Not sent yet" : "Not sent 💛"}
              </p>
              <p className={`text-[11px] mt-0.5 ${failKind === "unavailable" ? "text-amber-600" : "text-rose-500"}`}>{reason}</p>
              {failKind === "unavailable" && (
                <button onClick={submit}
                  className="mt-2 rounded-lg bg-amber-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-amber-700 transition-colors">
                  Try again
                </button>
              )}
            </div>
          )}
          {state === "done" && (
            <div className="rounded-xl border border-teal-200 bg-teal-50 px-3 py-2.5 text-[12px] font-semibold text-teal-700">Shared ✓ — it's in the feed now</div>
          )}
          <button onClick={submit} disabled={!len || state === "checking"}
            className="w-full rounded-2xl bg-teal-600 py-3.5 text-sm font-bold text-white hover:bg-teal-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {state === "checking" ? (<><Loader2 size={16} className="animate-spin" /> Checking kindness…</>) : "Share"}
          </button>
          <p className="text-center text-[10px] text-slate-400 leading-relaxed">
            {anon
              ? "Your name and country won't be shown. Posts are still linked to your account so they can be moderated, so this isn't fully anonymous."
              : "Every post is screened before anyone sees it. You can delete yours at any time."}
          </p>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Shared-journal announcement card — sits inline in whichever feed it belongs to ──
export function SharedJournalCard({ story, onOpen, compact = false }) {
  const { likes, comments } = loadStoryEngagement(story.id);

  // Worldwide rotator: same two-line rhythm as a stranger's message card in the same slot
  // — a meta row, then a clamped body. "shared their reflection" leads the BODY rather than
  // sharing the meta row with the badge and the link, which is what truncated it mid-word.
  if (compact) {
    return (
      <button onClick={() => onOpen?.(story)}
        className="flex w-full items-center gap-1.5 seen-grad-warm rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white px-3 py-2 text-left active:scale-[0.99] transition-transform"
        style={{ animation: "seenFadeUp 400ms ease both" }}>
        <span className="flex-shrink-0 text-sm">📔</span>
        {/* The whole announcement as one sentence. line-clamp-2 rather than truncate, so a
            long name wraps instead of cutting the sentence off mid-word — it fits on one
            line in the ordinary case and never needs a third. The reflection's own words
            are left for the reader; this is a notice, not a preview.
            11px, not 12: measured, the sentence is 223px at 11px vs 243px at 12px, and a
            340px phone leaves 231px — so 12px wrapped on small screens and 11px does not.
            "Read" rather than "Read →" for the same reason: the arrow costs 12px, which is
            the difference between one line and two on a 340px phone. */}
        <p className="line-clamp-2 min-w-0 flex-1 text-[11px] leading-snug text-slate-600">
          <strong className="font-semibold text-slate-800">{storyAuthorLabel(story)}</strong> shared their reflection
        </p>
        <span className="flex-shrink-0 text-[10px] font-bold text-amber-600">Read</span>
      </button>
    );
  }

  return (
    <button onClick={() => onOpen?.(story)}
      className="mb-2 w-full seen-grad-warm rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white px-4 py-3 text-left"
      style={{ animation: "seenFadeUp 400ms ease both" }}>
      <div className="flex items-center gap-1.5 mb-1">
        <span className="flex-shrink-0 text-base">📔</span>
        <p className="flex-1 text-[12px] leading-snug text-slate-600">
          <strong className="text-slate-800">{storyAuthorLabel(story)}</strong>
          {!story.anonymous && story.country ? ` ${flagFor(story.country)}` : ""} shared their reflection.
        </p>
      </div>
      <p className="text-[13px] leading-snug text-slate-700 line-clamp-2 italic">“{story.text}”</p>
      <div className="mt-1.5 flex items-center gap-3 text-[10px] font-semibold text-amber-600">
        <span>Read it →</span>
        {likes.length > 0 && <span className="text-rose-500">❤️ {likes.length}</span>}
        {comments.length > 0 && <span className="text-slate-400">💬 {comments.length}</span>}
      </div>
    </button>
  );
}

// The shared journal opened up: read it, heart it, leave a comment. The author gets an
// extra row to see exactly who did. All device-local.
export function FeaturedStoryReader({ story, me, db, currentUser, onClose, onChanged }) {
  const [engage, setEngage] = useState(() => (story ? loadStoryEngagement(story.id) : { likes: [], comments: [] }));
  const [draft, setDraft] = useState("");
  const [showWho, setShowWho] = useState(false);
  if (!story) return null;

  const iLiked = engage.likes.some((l) => l.uid === me?.uid);
  const isMine = !story.authorUid || story.authorUid === me?.uid;
  const like = () => { setEngage(toggleStoryLike(story.id, me)); onChanged?.(); };
  const comment = () => {
    const t = draft.trim();
    if (!t) return;
    setEngage(addStoryComment(story.id, me, t.slice(0, 200)));
    setDraft(""); onChanged?.();
  };

  return createPortal(
    <div data-portal className="fixed inset-0 z-[260] flex flex-col bg-white">
      {/* Same iPhone status-bar clearance as every other full-screen overlay — see the note
          in MessageReactionsPanel below. */}
      <div className="seen-overlay-header flex items-center gap-3 border-b border-slate-100 px-4 py-3 flex-shrink-0">
        <button onClick={onClose} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100" aria-label="Close"><X size={18} /></button>
        <h2 className="flex-1 text-sm font-bold text-slate-800 flex items-center gap-1.5">📔 A shared reflection</h2>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-6">
        <div className="mx-auto max-w-md space-y-5">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{story.anonymous ? "🕊️" : flagFor(story.country)}</span>
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-800">{storyAuthorLabel(story)}</p>
              <p className="text-[11px] text-slate-400">{story.anonymous ? "Shared anonymously" : "Shared their reflection"}</p>
            </div>
          </div>

          <p className="text-lg leading-relaxed text-slate-800 font-medium whitespace-pre-wrap">“{story.text}”</p>
          {/* Reflections are real UGC now, so they need the same report/block path as
              messages. */}
          <ReportBlockBar
            db={db}
            currentUser={currentUser}
            targetUid={story.authorUid}
            targetName={storyAuthorLabel(story)}
            contentId={story.id}
            contentKind="reflection"
          />
          {Array.isArray(story.enrich) && story.enrich.map((e, i) => (
            <div key={i} className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-teal-600">{e.q}</p>
              <p className="mt-1 text-[15px] text-slate-700 leading-relaxed whitespace-pre-wrap">{e.a}</p>
            </div>
          ))}

          {/* Like + who-saw-it */}
          <div className="flex items-center gap-2 border-y border-slate-100 py-3">
            <button onClick={like}
              className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition-colors ${
                iLiked ? "bg-rose-50 text-rose-600" : "border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"}`}>
              <Heart size={14} fill={iLiked ? "currentColor" : "none"} /> {iLiked ? "Liked" : "Like"}
              {engage.likes.length > 0 && <span className="tabular-nums">· {engage.likes.length}</span>}
            </button>
            <span className="text-[11px] text-slate-400">
              {engage.comments.length > 0 ? `${engage.comments.length} comment${engage.comments.length === 1 ? "" : "s"}` : "No comments yet"}
            </span>
            {isMine && (
              <button onClick={() => setShowWho(true)}
                className="ml-auto rounded-full px-2.5 py-1 text-[11px] font-bold text-teal-600 hover:bg-teal-50 transition-colors">
                Who responded
              </button>
            )}
          </div>

          {/* Comments */}
          <div className="space-y-2">
            {engage.comments.map((c, i) => (
              <div key={i} className="rounded-2xl border border-slate-100 bg-slate-50 px-3.5 py-2.5">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-sm">{flagFor(c.country)}</span>
                  <span className="flex-1 truncate text-[11px] font-semibold text-slate-500">{firstName(c.name)}</span>
                  <span className="text-[10px] text-slate-400">{timeAgo(c.ts)}</span>
                </div>
                <p className="text-[13px] leading-snug text-slate-700">{c.text}</p>
              </div>
            ))}
          </div>

          <div className="flex items-end gap-2">
            <textarea value={draft} onChange={(e) => setDraft(e.target.value.slice(0, 200))} rows={2}
              placeholder="Say something kind…"
              className="flex-1 resize-none rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-[14px] text-slate-800 placeholder:text-slate-400 focus:border-teal-400 focus:outline-none" />
            <button onClick={comment} disabled={!draft.trim()}
              className="rounded-full bg-teal-600 px-4 py-2 text-[12px] font-bold text-white hover:bg-teal-700 transition-colors disabled:opacity-40">
              Send
            </button>
          </div>

          <p className="pt-2 text-center text-[10px] text-slate-400">
            Preview: shared reflections, likes and comments stay on this device.
          </p>
        </div>
      </div>

      {showWho && <StoryEngagementPanel story={story} engage={engage} onClose={() => setShowWho(false)} />}
    </div>,
    document.body
  );
}

// Who liked and commented on a journal you shared — only the author can open this.
export function StoryEngagementPanel({ story, engage, onClose }) {
  const Row = ({ icon, name, country, ts, text }) => (
    <div className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-white px-3 py-2.5">
      <div className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-xl bg-slate-50 text-[15px]">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-700">{name}</p>
        {text ? <p className="mt-0.5 text-[13px] leading-snug text-slate-600">{text}</p>
              : country && <p className="text-[11px] text-slate-400">{country}</p>}
      </div>
      <span className="flex-shrink-0 text-[10px] text-slate-400">{timeAgo(ts)}</span>
    </div>
  );
  return createPortal(
    <div data-portal className="fixed inset-0 z-[270] flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative sheet-slide-up flex max-h-[85dvh] flex-col rounded-t-3xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex flex-shrink-0 justify-center pt-3 pb-2"><div className="h-1 w-10 rounded-full bg-slate-200" /></div>
        <div className="flex items-center justify-between px-5 pb-2">
          <h2 className="text-lg font-bold text-slate-800">Who responded</h2>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600" aria-label="Close"><X size={20} /></button>
        </div>
        <p className="px-5 pb-3 text-xs text-slate-400">Only you can see this — it's your reflection.</p>
        <div className="space-y-3 overflow-y-auto overscroll-contain px-3 pb-8">
          <div>
            <p className="px-2 pb-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">Hearts · {engage.likes.length}</p>
            {engage.likes.length === 0
              ? <p className="px-2 py-3 text-center text-[13px] text-slate-400">No hearts yet.</p>
              : <div className="space-y-1">{engage.likes.map((l, i) => <Row key={i} icon={flagFor(l.country)} name={l.name} country={l.country} ts={l.ts} />)}</div>}
          </div>
          <div>
            <p className="px-2 pb-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">Comments · {engage.comments.length}</p>
            {engage.comments.length === 0
              ? <p className="px-2 py-3 text-center text-[13px] text-slate-400">No comments yet.</p>
              : <div className="space-y-1">{engage.comments.map((c, i) => <Row key={i} icon="💬" name={firstName(c.name)} ts={c.ts} text={c.text} />)}</div>}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── "Who felt this" — who liked / replied to ONE of my messages ────────────────
// Opens only from the ❤️ badge on your own message, so it's private to you by
// construction. The likes are REAL Firestore data (publicMessages/{id}/reactions/❤️
// stores uids + countries + reactedAt and is world-readable); names are resolved from
// users/{uid}.fullName behind a cache. Private replies read the local store above.
const timeAgo = (ts) => {
  if (!ts) return "";
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return days < 7 ? `${days}d ago` : new Date(ts).toLocaleDateString([], { day: "numeric", month: "short" });
};

export function MessageReactionsPanel({ db, message, currentUser, blockedUids, onClose }) {
  const [reactors, setReactors] = useState(null); // null = loading
  const nameCache = useRef({});
  // Real inbound replies for this message, live from Firestore.
  const replies = useRepliesReceived(db, currentUser, message?.id, blockedUids);

  // Opening the panel is the moment you read them, so clear the unread flag. Best-effort:
  // the rules let the recipient change nothing but `read`, so a failure here is harmless.
  useEffect(() => {
    for (const r of replies) {
      if (r.read) continue;
      updateDoc(doc(db, "privateReplies", r.id), { read: true }).catch(() => {});
    }
  }, [db, replies]);

  useEffect(() => {
    if (!db || !message?.id) { setReactors([]); return; }
    let alive = true;
    const unsub = onSnapshot(collection(db, "publicMessages", message.id, "reactions"), async (snap) => {
      const rows = [];
      snap.forEach((d) => {
        const { uids = [], countries = {}, reactedAt = {} } = d.data() || {};
        uids.forEach((uid) => rows.push({ uid, emoji: d.id, country: countries[uid] ?? null, at: reactedAt[uid] ?? 0 }));
      });
      rows.sort((a, b) => (b.at || 0) - (a.at || 0));
      const resolved = await Promise.all(rows.map(async (r) => {
        if (nameCache.current[r.uid]) return { ...r, name: nameCache.current[r.uid] };
        try {
          const us = await readPublicProfile(db, r.uid);
          const name = (us?.fullName || "").trim() || "Someone";
          nameCache.current[r.uid] = name;
          return { ...r, name, country: r.country || us?.country || null };
        } catch { return { ...r, name: "Someone" }; }
      }));
      if (alive) setReactors(resolved);
    }, () => { if (alive) setReactors([]); });
    return () => { alive = false; unsub(); };
  }, [db, message?.id]);

  return createPortal(
    <div data-portal className="fixed inset-0 z-[250] flex flex-col bg-white">
      {/* seen-overlay-header is what keeps this clear of the iPhone status bar. Without it the
          header sits at top:0 and the close button ends up physically behind the clock —
          unreachable, with no way out of the panel. Only shows on notched iPhones, which is
          why it survived Android testing. */}
      <div className="seen-overlay-header flex items-center gap-3 border-b border-slate-100 px-4 py-3 flex-shrink-0">
        <button onClick={onClose} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100" aria-label="Close"><X size={18} /></button>
        <h2 className="flex-1 text-sm font-bold text-slate-800 flex items-center gap-1.5">
          <Heart size={15} className="text-rose-500" fill="currentColor" /> Who felt this
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="mx-auto max-w-md space-y-5">
          <div className="rounded-2xl border border-teal-100 bg-teal-50 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-teal-600 mb-1">Your message</p>
            <p className="text-[15px] leading-relaxed text-slate-800 font-medium">“{message?.text}”</p>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-2">
              Hearts {reactors ? `· ${reactors.length}` : ""}
            </p>
            {reactors === null ? (
              <div className="py-8 text-center text-sm text-slate-400 flex items-center justify-center gap-2">
                <Loader2 size={16} className="animate-spin" /> Loading…
              </div>
            ) : reactors.length === 0 ? (
              <div className="rounded-2xl border border-slate-100 bg-slate-50 py-8 text-center text-[13px] text-slate-400">
                <div className="text-2xl mb-1">🤍</div>
                No hearts yet — they often arrive a little later.
              </div>
            ) : (
              <div className="space-y-1">
                {reactors.map((r) => (
                  <div key={`${r.uid}_${r.emoji}`} className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white px-3 py-2.5">
                    <div className="h-9 w-9 rounded-xl bg-rose-50 flex items-center justify-center flex-shrink-0">
                      <span style={{ fontSize: "15px" }}>{flagFor(r.country)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700 truncate">{r.name}</p>
                      {r.country && <p className="text-[11px] text-slate-400 truncate">{r.country}</p>}
                    </div>
                    <span className="text-[10px] text-slate-400 flex-shrink-0">{timeAgo(r.at)}</span>
                    <span className="text-sm flex-shrink-0">{r.emoji}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-2">
              Private replies {replies.length ? `· ${replies.length}` : ""}
            </p>
            {replies.length === 0 ? (
              <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-5 text-center text-[12px] text-slate-400 leading-relaxed">
                💬 Private replies to this message will appear here — only you can see them.
              </div>
            ) : (
              <div className="space-y-1">
                {replies.map((rep) => (
                  <div key={rep.id} className="rounded-2xl border border-amber-100 bg-amber-50/60 px-3.5 py-2.5">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      {/* fromName/fromCountry — the Firestore shape. The old localStorage
                          preview used name/country, so both are read for older entries. */}
                      <span className="text-sm">{flagFor(rep.fromCountry ?? rep.country)}</span>
                      <span className="text-[11px] font-semibold text-slate-500 flex-1 truncate">{firstName(rep.fromName ?? rep.name)}</span>
                      <span className="text-[10px] text-slate-400">{timeAgo(rep.ts)}</span>
                    </div>
                    <p className="text-[13px] text-slate-700 leading-snug">“{rep.text}”</p>
                    {/* A private message from a stranger with no way to report it was the
                        sharpest gap in the UGC surface. */}
                    <div className="mt-1.5">
                      <ReportBlockBar
                        db={db}
                        currentUser={currentUser}
                        targetUid={rep.fromUid}
                        targetName={firstName(rep.fromName ?? rep.name)}
                        contentId={rep.id}
                        contentKind="reply"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <p className="pb-6 text-center text-[10px] text-slate-400">Only you can see who felt your message. 💛</p>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── One of your own personalised messages, inline in the Focused Feed ─────────
// Yours, so it sits with your people rather than in a separate strip. Rendered as its
// own card (not a real message bubble) because it has no Firestore doc behind it —
// long-pressing a bubble writes reactions, and a local post has nothing to write to.
export function LocalPostCard({ post, onDelete }) {
  return (
    <div className="mb-2" style={{ animation: "seenFadeUp 400ms ease both" }}>
      <div className="mb-1 flex items-center gap-1.5 px-1 text-[10px] font-semibold text-slate-400">
        <span>You</span>
        {post.anon && <span className="rounded-full bg-violet-50 px-1.5 py-px text-[9px] font-bold text-violet-500">anonymous</span>}
        <span className="rounded-full bg-slate-100 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-slate-400">only you see this</span>
        {onDelete && (
          <button onClick={() => onDelete(post.id)}
            className="ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-semibold text-slate-300 hover:text-rose-500 transition-colors">
            Remove
          </button>
        )}
      </div>
      <div className="rounded-2xl border border-violet-200 bg-violet-50/50 px-4 py-2.5">
        <p className="text-[15px] font-medium leading-snug text-slate-800">{post.text}</p>
      </div>
    </div>
  );
}
