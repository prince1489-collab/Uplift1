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
import { X, Heart, MessageCircle, UserPlus, UserCheck, Loader2, Search, ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import { FLAG_MAP } from "./MicroAnimations";
import { readPublicProfile, searchProfiles } from "./publicProfile";
import { writeFailure } from "./writeFailure";
import { awardPoints, claimFirstToday } from "./points";
import { STICKERS } from "./StickerReactions";
import { computeSparkReward, ReportBlockBar } from "./UpliftRetentionFeatures";
import { apiUrl, authedPost } from "./apiBase";
import GifPicker from "./GifPicker";
import { isKlipyConfigured } from "./klipy";
import { hasReplied } from "./replyNudge";
import { useVisibleViewport, sheetBox, sheetCap } from "./viewport";
import { rowLine, ago, headline, dayLine } from "./kindMoments";
import { REPLY_FEEL, NOTE_FEEL, replyOpening, noteOpening, phrasesFrom, continuationsFor, STARTER_KIND } from "./feelingWords";

const POSTS_KEY = "seen_v2_local_posts";
const FOCUS_KEY = "seen_v2_focused_uids"; // legacy: bare uid array, migrated into FOLLOWS_KEY
const FOLLOWS_KEY = "seen_v2_follows";    // [{ uid, name, country, label }]
const MOMENTS_KEY = "seen_v2_kind_moments";
// Sticker reactions share the `reactions` subcollection with hearts, keyed by sticker id.
// This resolves an id back to its emoji and label so the panel can show what was actually sent.
const STICKER_BY_ID = Object.fromEntries(STICKERS.map((x) => [x.id, x]));

const LIKES_KEY = "seen_v2_board_likes";
const STORIES_KEY = "seen_v2_stories";
// 200, and 200 exactly, because that is where moderation stops rather than where the design
// does: api/moderate-message.js caps its input at 200 and silently truncates beyond it, so a
// longer limit would publish the back half of every long message to a world-readable feed
// without it having been read by anything. Raising this further means changing that first.
//
// 80 was demonstrably too tight: a Ganesh Chaturthi blessing — "Ganpati Bappa Morya! May Lord
// Ganesha bless your life with joy & prosperity" — reached 77 and had no room left for 🙏.
const MAX_LEN = 200;
const POST_SPARK_REWARD = 25; // base, before the streak multiplier
// Anonymous posting is level-gated per the roadmap: a brand-new account cannot immediately
// post without a name attached. 150 is level 3 ("It's Giving Kind") — roughly a week of
// ordinary use, low enough not to block real members, high enough that a throwaway account
// created to post anonymously has to earn it first.
const ANON_MIN_BALANCE = 150;

// A container that presents a message as a quotation adds the quotes itself. Proverbs used to
// arrive pre-quoted, which produced ""like this"" wherever one was rendered inside quotes — the
// stored text is plain now, and this covers the handful written before that.
const stripQuotes = (s = "") => String(s).replace(/^\s*[“"']+/, "").replace(/[”"']+\s*$/, "");

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
      limit(200)
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
// Fewer than this in 24 hours and the pulse counts the week instead (see `pulse` below).
const PULSE_THIN = 5;
export function WorldwideBoard({ messages = [], myUid, focusedUids = [], blockedUids, moments = [], stories = [], onOpenStory, onToggleFocus, onReplyPrivately, onOpenGlobe }) {
  const focusedSet = useMemo(() => new Set(focusedUids), [focusedUids]);
  // Blocking has to hold here too. It used to be applied only to the Focused Feed, so a
  // blocked person's messages kept rotating through the Worldwide strip.
  const isBlocked = useMemo(() => {
    const set = blockedUids instanceof Set ? blockedUids : new Set(blockedUids || []);
    return (uid) => Boolean(uid) && set.has(uid);
  }, [blockedUids]);
  // What the world did today, for when there is no stranger to show.
  //
  // This band is the FIRST thing on the home screen, and on a small user base it is empty by
  // construction: the rotation excludes everyone you follow (they belong in the Focused Feed
  // below), so once you follow the handful of people who are actually active, there is nobody
  // left to rotate. Every frame of every recording so far has opened on "Kind messages from
  // around the world will appear here" — an app about not being alone, whose first line is an
  // absence.
  //
  // So when there is nothing to rotate, say something true instead of apologising. Counted from
  // the same `messages` already in hand — no extra query — and deliberately counting EVERYONE,
  // including you and the people you follow, because this is a measure of the world rather than
  // a feed of it.
  //
  // On a thin day the 24-hour figure is "2 kind messages across 2 countries", which reads as an
  // empty room. So below PULSE_THIN it widens to the last seven days and SAYS so — "this week".
  // Still counted, never invented: the same rows, a longer window, an honest label. (App.jsx
  // loads the newest 50, so on a busy week the weekly figure is a floor — and on a busy week the
  // daily one is the one shown anyway.)
  const pulse = useMemo(() => {
    const now = Date.now();
    const real = messages.filter((m) => m?.uid && m.uid !== "system" && m.text && !isBlocked(m.uid));
    const within = (ms) => real.filter((m) => Number(m.timestamp) > now - ms);
    const summarise = (rows, window) =>
      ({ count: rows.length, countries: new Set(rows.map((m) => m.country).filter(Boolean)).size, window });
    const day = within(24 * 60 * 60 * 1000);
    if (day.length >= PULSE_THIN) return summarise(day, "today");
    const week = within(7 * 24 * 60 * 60 * 1000);
    return week.length > day.length ? summarise(week, "this week") : summarise(day, "today");
  }, [messages, isBlocked]);

  // Strangers' messages and stranger-to-stranger kind moments share one rotation, so a
  // moment takes its turn in the same slot instead of adding fixed height below it.
  const items = useMemo(() => {
    const msgs = messages
      // `isPersonal` used to be filtered out here, which meant a message someone had WRITTEN
      // THEMSELVES could only ever be seen by people already following them — the app's most
      // expressive act was also its least far-travelling, and the Worldwide Feed quietly showed
      // presets only. The data was always world-readable (firestore.rules: `allow read: if true`)
      // and the composer already tells the author it is public, so this was a display filter
      // rather than a privacy boundary. Every other exclusion below is deliberate and stays:
      // yourself, the synthetic system row, people you follow (they belong in the Focused Feed),
      // and anyone you have blocked.
      //
      // `hasMedia` is the newest exclusion and the only one that is about the AUDIENCE rather
      // than the source. A post carrying a GIF was promised to "people in your Focused Feed",
      // and this rotation is the one surface that shows you to strangers — so a post with
      // something attached does not enter it at all. Showing it here minus its GIF would be
      // worse than not showing it: a caption with nothing to caption reads as broken.
      //
      // firestore.rules enforces the same thing for anyone reading the database directly. This
      // filter is what makes the app agree with the rules rather than rely on them.
      .filter((m) => m.uid && m.uid !== myUid && m.uid !== "system" && m.text && !m.hasMedia && !focusedSet.has(m.uid) && !isBlocked(m.uid))
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
  // Set the first time somebody presses an arrow, and never cleared while the card is mounted.
  // See the rotation effect below for why it is one-way.
  const [manual, setManual] = useState(false);

  // Keep the index in range as the list changes.
  useEffect(() => { if (idx >= items.length) setIdx(0); }, [items.length, idx]);

  // Auto-rotate — paused while the actions are open so people can act without it moving, and
  // stopped outright once somebody has taken the wheel.
  //
  // `manual` is deliberately one-way. Somebody who presses an arrow is reading, not watching, and
  // a timer that pulls the card forward two seconds later is precisely what they pressed a button
  // to escape — a timeout that "resumes after a while" is the same bug with a delay on it. It
  // resets when the card unmounts, so leaving the tab and coming back starts the rotation again.
  useEffect(() => {
    if (manual || open || items.length <= 1) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % items.length), ROTATE_MS);
    return () => clearInterval(t);
  }, [manual, open, items.length]);

  // Wraps, so back from the first is the last. Without that, the two arrows are dead ends at both
  // ends of a list nobody can see the shape of.
  const step = (d) => {
    if (items.length <= 1) return;
    setManual(true);
    setOpen(false);
    setIdx((i) => (i + d + items.length) % items.length);
  };

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
    // Same bar as the Focused Feed header below it — shared `.seen-feed-header` background and
    // the same border, sizes and weights. This was a sky-tinted box with a 2px sky border, so
    // the two feed headings looked like parts of two different apps stacked on each other.
    // The heading keeps its own accent colour: that is what tells the two feeds apart, and it
    // is information rather than decoration.
    <div className="seen-feed-header border-b border-slate-200 px-3 py-2 flex-shrink-0">
      <div className="flex items-center justify-between px-1 pb-1">
        {/* The globe is the best thing in the app and it was three taps deep in an overflow
            menu, next to Sign out. This heading is already the word "worldwide" sitting on the
            home screen — so it is the one control in the product that should open it.

            It did not LOOK like one. Bare 11px text and a 9px chevron at 60% opacity next to a
            heading that is not a button ("Focused Feed") read as a label, so people did not
            press it. It is now a pill with a filled chevron, and the words carry the slow sweep
            from index.css — the same cue as the daily story below, so the screen has one way of
            saying "there is something here" rather than two. */}
        <button
          type="button"
          onClick={() => onOpenGlobe?.()}
          disabled={!onOpenGlobe}
          title={onOpenGlobe ? "Open the world map" : undefined}
          className={`flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide disabled:cursor-default ${
            onOpenGlobe
              ? "seen-world-pill rounded-full border py-1 pl-2 pr-1.5 active:scale-95 transition-transform"
              : "seen-feed-title--world"
          }`}>
          <span aria-hidden>🌍</span>
          <span className={onOpenGlobe ? "seen-attract" : undefined}>Worldwide Feed</span>
          {onOpenGlobe && (
            <span aria-hidden
              className="seen-world-pill__chev flex h-3.5 w-3.5 items-center justify-center rounded-full text-[8px] leading-none text-white">
              ▸
            </span>
          )}
        </button>
        {/* The counter was a read-only position in a rotation nobody could steer: a message that
            caught your eye on its way out was simply gone, and "12/30" said exactly how much of
            the feed you could not reach. The arrows make the number mean something — it is now a
            place in a list rather than a countdown.

            They flank the counter rather than sitting on the card, because the card itself is
            already a tap target (it opens the like/reply row) and a second gesture on the same
            surface would fight it. This row is a sibling of that button, so no stopPropagation
            is needed and none is implied.

            Hidden entirely below two items, on the same condition the counter already uses —
            one message with two dead arrows beside it is worse than no arrows. */}
        <span className="seen-feed-meta flex items-center gap-0.5 text-[10px] font-semibold">
          {items.length > 1 ? (
            <>
              <button type="button" onClick={() => step(-1)} aria-label="Previous message"
                className="-my-1 flex h-6 w-5 items-center justify-center rounded-full opacity-60 hover:opacity-100 active:scale-90 transition-all">
                <ChevronLeft size={13} />
              </button>
              <span className="tabular-nums">{idx + 1}/{items.length}</span>
              <button type="button" onClick={() => step(1)} aria-label="Next message"
                className="-my-1 flex h-6 w-5 items-center justify-center rounded-full opacity-60 hover:opacity-100 active:scale-90 transition-all">
                <ChevronRight size={13} />
              </button>
            </>
          ) : (
            items.length === 0 && pulse.count > 0 ? (pulse.window === "today" ? "today so far" : "this week") : "from strangers"
          )}
        </span>
      </div>

      {!item ? (
        pulse.count > 0 ? (
          // Never a live number that reads as zero: this branch only renders when count > 0.
          <div className="rounded-2xl bg-white/70 px-3 py-3 text-center text-[12px] leading-snug text-slate-600">
            🌍 <span className="font-bold">{pulse.count}</span> kind {pulse.count === 1 ? "message" : "messages"} sent
            {pulse.countries > 1 ? <> across <span className="font-bold">{pulse.countries}</span> countries</> : null} {pulse.window}.
          </div>
        ) : (
          <div className="rounded-2xl bg-white/70 px-3 py-3 text-center text-[12px] text-slate-500">
            💛 Kind messages from around the world will appear here.
          </div>
        )
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
            // Same bubble as a message from someone else in the Focused Feed —
            // `bg-teal-50 border-teal-200` with `text-teal-900` — rather than the white card
            // with a sky border this used to be. A message from a stranger and a message from
            // someone you follow are the same KIND of thing, and dressing them differently
            // made the two feeds look like two products.
            //
            // It also fixes dark mode for free: white/sky/slate here had uneven remap coverage,
            // whereas every teal-* class below is already remapped. Measured on both:
            // body 9.39:1 light / 12.55:1 dark, name and hint 6.17:1 / 8.35:1.
            className="w-full text-left rounded-2xl border border-teal-200 bg-teal-50 px-3 py-2 active:scale-[0.99] transition-transform"
            style={{ animation: "seenFadeUp 350ms ease both" }}>
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="text-sm">{flagFor(m.country)}</span>
              <span className="text-[11px] font-semibold text-teal-700 truncate flex-1">{firstName(m.sender)}</span>
              {likes[m.id] && <Heart size={11} className="text-rose-500 flex-shrink-0" fill="currentColor" />}
              <span className="text-[10px] text-teal-700 opacity-70 flex-shrink-0">{open ? "tap to close" : "tap to like or reply"}</span>
            </div>
            <p className="text-[13px] leading-snug text-teal-900 font-medium line-clamp-2">“{stripQuotes(m.text)}”</p>
          </button>

          {open && (
            <div className="mt-1.5 flex items-center gap-2" style={{ animation: "seenFadeUp 200ms ease both" }}>
              <button onClick={() => like(m.id)}
                className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${likes[m.id] ? "bg-rose-50 text-rose-600" : "bg-white border border-slate-200 text-slate-500"}`}>
                <Heart size={12} fill={likes[m.id] ? "currentColor" : "none"} /> {likes[m.id] ? "Liked" : "Like"}
              </button>
              {/* Once it is liked, Reply becomes the invitation it should have been all along:
                  a heart says it landed, a word says how — and the second is what makes the
                  writer feel seen. Not shown again once you have replied (replyNudge.js). */}
              <button onClick={() => onReplyPrivately?.(m)}
                className={`flex min-w-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                  likes[m.id] && !hasReplied(m.id) ? "bg-teal-600 text-white" : "bg-white border border-slate-200 text-slate-500"}`}>
                <MessageCircle size={12} className="flex-shrink-0" />
                <span className="truncate">{likes[m.id] && !hasReplied(m.id) ? `Tell ${firstName(m.sender)} what it meant` : "Reply"}</span>
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

// ── Kind moments (3.13) ──────────────────────────────────────────────────────────
// Anonymous by design: two countries and a time, never a name, the words or a distance.
// One card per day however busy it was (kindMoments.js decides the rows), each row a little
// journey — flag, an arc a heart travels along once, flag — so it reads as kindness MOVING.

// Bold the place names inside a row's line.
function PlacesText({ line }) {
  if (!line.places.length) return <>{line.text}</>;
  const re = new RegExp(`(${line.places.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
  return <>{line.text.split(re).map((part, i) =>
    line.places.some((p) => p.toLowerCase() === part.toLowerCase()) ? <strong key={i} className="font-semibold text-slate-900">{part}</strong> : part)}</>;
}

// The heart keeps travelling (3.14): sender → recipient, left flag to right, on a loop — fading
// in as it leaves and out as it lands — so the direction is always there to see. Where kindness
// went both ways (and always between two people in the same country) it goes back and forth.
// Rows start at different moments so three hearts never move in step. Still for reduced motion.
function MomentArc({ home = false, bothWays = false, delay = 0 }) {
  const path = home ? "M14 20 C14 2, 60 2, 60 20" : "M4 20 Q37 -6 70 20";
  const route = home ? "M14 17 C14 -1, 60 -1, 60 17" : "M4 17 Q37 -9 70 17"; // a touch above the line
  const line = home ? "#F472B6" : "#FFAD6E";
  const dot = home ? "#DB4E97" : "#E07C33";
  const still = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const begin = `${delay}s`;
  return (
    <svg viewBox="0 0 74 26" className="h-[22px] w-[58px] flex-shrink-0 overflow-visible" aria-hidden>
      <path d={path} fill="none" stroke={line} strokeWidth="2" strokeDasharray="3 4" strokeLinecap="round" />
      <circle cx={home ? 14 : 4} cy="20" r="2.5" fill={dot} />
      <circle cx={home ? 60 : 70} cy="20" r="2.5" fill={dot} />
      {still ? (
        <text x="37" y={home ? 7 : 11} fontSize="11" textAnchor="middle">❤️</text>
      ) : bothWays ? (
        // Hidden until its turn starts, or it would sit in the corner while it waits.
        <text fontSize="11" textAnchor="middle" dy="3" opacity="0">❤️
          <animateMotion dur="3.2s" begin={begin} repeatCount="indefinite" path={route}
            keyPoints="0;1;0" keyTimes="0;0.5;1" calcMode="linear" />
          <set attributeName="opacity" to="1" begin={begin} />
        </text>
      ) : (
        <text fontSize="11" textAnchor="middle" dy="3" opacity="0">❤️
          <animateMotion dur="3s" begin={begin} repeatCount="indefinite" path={route}
            keyPoints="0;1;1" keyTimes="0;0.73;1" calcMode="linear" />
          <animate attributeName="opacity" dur="3s" begin={begin} repeatCount="indefinite"
            values="0;1;1;0;0" keyTimes="0;0.1;0.62;0.73;1" />
        </text>
      )}
    </svg>
  );
}

function MomentRow({ row, now, index = 0 }) {
  const line = rowLine(row);
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[17px] leading-none">{flagFor(row.aCountry)}</span>
      <MomentArc home={row.same} bothWays={row.bothWays} delay={index * 0.7} />
      <span className="text-[17px] leading-none">{flagFor(row.bCountry)}</span>
      <div className="ml-1 min-w-0 flex-1">
        <p className="text-[12.5px] leading-snug text-slate-600">
          <PlacesText line={line} />
          {row.count > 1 && <span className="ml-1 rounded-full bg-orange-50 px-1.5 text-[10.5px] font-extrabold text-orange-700">×{row.count}</span>}
        </p>
        <p className="text-[10.5px] font-semibold text-slate-400">{row.count > 1 ? `latest ${ago(row.latest, now)}` : ago(row.latest, now)}</p>
      </div>
    </div>
  );
}

// A day of private kindness. Today: the full card. Earlier days: one line that opens on a tap.
// Today's card can be minimised to one line and opened again (3.16) — and the choice sticks on
// this device, so someone who'd rather keep the feed for messages only has to say so once.
const KM_COLLAPSED = "seen_km_collapsed";
const readCollapsed = () => { try { return localStorage.getItem(KM_COLLAPSED) === "1"; } catch { return false; } };
const writeCollapsed = (v) => { try { localStorage.setItem(KM_COLLAPSED, v ? "1" : "0"); } catch { /* ignore */ } };

export function KindMomentsDay({ day, onBeNext, onOpenGlobe }) {
  const [open, setOpen] = useState(() => day.isToday && !readCollapsed());
  const [now] = useState(() => Date.now());
  const toggleToday = (next) => { setOpen(next); writeCollapsed(!next); };
  if (!open && day.isToday) {
    const flags = [...new Set([...day.rows.flatMap((r) => [r.aCountry, r.bCountry]), ...(day.more?.countries || [])].filter(Boolean))].slice(0, 5);
    return (
      <button onClick={() => toggleToday(true)} aria-expanded="false"
        className="mb-2 flex w-full items-center gap-2 rounded-2xl border border-amber-100 bg-white px-3.5 py-2.5 text-left shadow-sm active:scale-[0.99]"
        style={{ animation: "seenFadeUp 250ms ease both" }}>
        <span aria-hidden>✨</span>
        <span className="min-w-0 truncate text-[12.5px] font-extrabold text-slate-800">{day.total} {day.total === 1 ? "kindness" : "kindnesses"} today</span>
        <span className="flex-shrink-0 text-[13px] tracking-wide">{flags.map(flagFor).join("")}</span>
        <span className="ml-auto flex flex-shrink-0 items-center gap-1 text-[10.5px] font-bold text-green-600">
          <span className="h-1.5 w-1.5 rounded-full bg-green-500" /> live
        </span>
        <ChevronDown size={16} className="flex-shrink-0 text-slate-400" aria-hidden />
      </button>
    );
  }
  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="mb-2 flex w-full items-center gap-2 rounded-2xl border border-slate-100 bg-white px-3.5 py-2.5 text-left text-[12px] text-slate-500 active:scale-[0.99]">
        <span aria-hidden>✨</span>
        <span className="min-w-0 flex-1"><span className="font-bold text-slate-700">{day.label}</span> · {dayLine(day)}</span>
        <span className="text-slate-300" aria-hidden>›</span>
      </button>
    );
  }
  return (
    <div className="mb-2.5 rounded-2xl border border-amber-100 bg-white px-3.5 pb-3 pt-3 shadow-sm" style={{ animation: "seenFadeUp 400ms ease both" }}>
      <div className="flex items-center gap-1.5">
        <span aria-hidden>✨</span>
        <p className="min-w-0 flex-1 text-[13px] font-extrabold leading-tight text-slate-800">
          {headline(day)}
          {day.countries > 1 && <span className="block text-[11px] font-semibold text-slate-400">across {day.countries} countries</span>}
        </p>
        {day.isToday ? (
          <>
            <span className="flex items-center gap-1 text-[10.5px] font-bold text-green-600">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500 shadow-[0_0_0_3px_rgba(34,197,94,0.18)]" /> live
            </span>
            <button onClick={() => toggleToday(false)} aria-expanded="true" aria-label="Minimise"
              className="-mr-1 grid h-7 w-7 place-items-center rounded-full text-slate-400 hover:bg-slate-50">
              <ChevronDown size={16} className="rotate-180" />
            </button>
          </>
        ) : (
          <button onClick={() => setOpen(false)} className="text-[11px] font-semibold text-slate-400">{day.label}</button>
        )}
      </div>
      <div className="mt-2 space-y-2">
        {day.rows.map((r, i) => <MomentRow key={r.key} row={r} now={now} index={i} />)}
      </div>
      {day.more && (
        <button onClick={onOpenGlobe}
          className="mt-2.5 flex w-full items-center gap-2 rounded-xl bg-orange-50/70 px-2.5 py-2 text-left text-[12px] text-slate-600">
          <span className="whitespace-nowrap text-[14px] tracking-wide">{day.more.countries.slice(0, 4).map(flagFor).join("")}</span>
          <span className="whitespace-nowrap font-bold text-slate-800">+{day.more.count} more</span>
          {onOpenGlobe && <span className="ml-auto whitespace-nowrap text-[11.5px] font-bold text-teal-600">See them on the globe →</span>}
        </button>
      )}
      <div className="mt-2.5 flex items-center border-t border-dashed border-amber-100 pt-2">
        <span className="text-[11px] text-slate-400">Names and words stay private.</span>
        {onBeNext && day.isToday && (
          <button onClick={onBeNext}
            className="ml-auto rounded-full px-3 py-1 text-[12px] font-extrabold text-white active:scale-95"
            style={{ background: "#D9692A", textShadow: "0 1px 1px rgba(120,50,10,.35)", boxShadow: "0 3px 10px rgba(224,124,51,.35)" }}>
            Be next ✨
          </button>
        )}
      </div>
    </div>
  );
}

// A single moment, for the Worldwide board's rotating slot.
export function KindMomentCard({ moment, compact = false }) {
  const [now] = useState(() => Date.now());
  const same = Boolean(moment.aCountry && moment.aCountry === moment.bCountry);
  const row = {
    key: moment.id || "m", same, bothWays: same,
    count: 1, latest: Number(moment.ts) || 0, aCountry: moment.aCountry || null, bCountry: moment.bCountry || null,
  };
  return (
    <div className={`rounded-2xl border border-amber-100 bg-white ${compact ? "px-3 py-2" : "mb-2 px-3.5 py-2.5"}`}
      style={{ animation: "seenFadeUp 400ms ease both" }}>
      <MomentRow row={row} now={now} />
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

// One bubble in a private thread. Yours are coral, theirs are pink. Outside the sheet so React
// does not see a new component type on every render.
function ThreadBubble({ mine, label, body }) {
  return (
    <div className={`rounded-xl border px-3 py-2 ${mine ? "bg-teal-50 border-teal-200" : "bg-sky-50 border-sky-200"}`}>
      <p className={`text-[10px] font-bold uppercase tracking-wide ${mine ? "text-teal-600" : "text-sky-600"}`}>{label}</p>
      <p className="mt-0.5 text-[14px] text-slate-700">{body}</p>
    </div>
  );
}

// Sentence openings for a first reply. Liking says "this landed"; these make it easy to say HOW,
// which is the message that makes somebody feel seen. They only start the sentence — the rest is
// the person's own words, and it is screened like everything else.
const REPLY_STARTERS = [
  "This made me smile because ",
  "I needed this today — ",
  "Thank you for ",
  "This reminded me of ",
];
// A kind note isn't a reply to anything — it's to a person you follow, about them. Its openings
// are about the person rather than about something they wrote.
const NOTE_STARTERS = [
  "I've been thinking about you because ",
  "Something I appreciate about you is ",
  "Just wanted to say ",
  "Thank you for ",
];
const REPLY_MAX = 200;

// Four shapes, decided from the document being opened:
//   first   — replying to someone's public message (no `answering`)
//   answer  — they replied to you; you may answer once           (`${id}__reply`)
//   final   — they answered your reply; you may write back once  (`${inReplyTo}__final`)
//   closed  — the last word has been said (you are reading a final)
// The rules enforce every limit here (firestore.rules privateReplies); the sheet only avoids
// offering a box the server would refuse.
export function PrivateReplySheet({ target, me, myUid, currentUser, db, blockedUids, answering = null, previous = [], onOpenConversation, onClose, onSent }) {
  const view = useVisibleViewport();
  const [text, setText] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const blocked = blockedUids instanceof Set ? blockedUids.has(target?.uid) : false;

  const mode = !answering ? "first"
    : answering.final ? "closed"
    : answering.inReplyTo ? "final"
    : "answer";
  // The first reply in this exchange, whichever side of it you are on.
  const rootId = mode === "answer" ? answering.id : answering?.inReplyTo ?? null;
  const other = firstName(answering ? answering.fromName : target?.sender);
  // A kind note: a first message to someone you follow that answers no post at all.
  const isNote = mode === "first" && (Boolean(target?.note) || !target?.id);
  const starters = isNote ? NOTE_STARTERS : REPLY_STARTERS;
  // 3.9 — easier words. A row of feelings writes the opening for you ("Your words made me feel
  // hopeful — "), and a quote chip offers a few of THEIR words back, which is the most specific
  // way in there is. The generic starters stay underneath for anyone who wants them.
  const feelRow = isNote ? NOTE_FEEL : REPLY_FEEL;
  const opening = isNote ? noteOpening : replyOpening;
  // A kind note to someone who has shared a "Right now…" line (3.15): offer it, so the note can
  // be about what's actually going on for them.
  const [theirLine, setTheirLine] = useState(null);
  useEffect(() => {
    if (!isNote || !db || !target?.uid) return undefined;
    let alive = true;
    readPublicProfile(db, target.uid).then((p) => { if (alive) setTheirLine(String(p?.rightNow || "").trim() || null); }).catch(() => {});
    return () => { alive = false; };
  }, [isNote, db, target?.uid]);
  const boxRef = useRef(null);
  // What was just started, and what kind of start it was — so "Finish the thought" can offer
  // endings that fit, for as long as the box still holds only that start (3.16).
  const [started, setStarted] = useState(null);
  const focusEnd = (t) => setTimeout(() => { const el = boxRef.current; if (el) { el.focus(); el.setSelectionRange(t.length, t.length); } }, 0);
  const begin = (t, kind = null) => {
    setText(t);
    setStarted(kind ? { text: t, kind } : null);
    // Focus with the cursor at the end, so the rest is all that's left to write.
    focusEnd(t);
  };
  const finish = (ending) => { const t = `${text}${ending}`.slice(0, REPLY_MAX); setText(t); setStarted(null); focusEnd(t); };
  // Their words, as up to three phrases to choose from — the most specific way in there is.
  const phrases = isNote ? [] : phrasesFrom(mode === "first" ? target?.text : answering?.text);
  const [moreIdeas, setMoreIdeas] = useState(false);

  // The rest of the thread, read once when the sheet opens. Your own messages are addressed to
  // THEM, so they never appear in your inbox — which is why these are reads, not props.
  //   root    — the first reply (needed in final + closed, where it is not the doc you opened)
  //   answer  — `${root}__reply` (needed in answer, to know if you already did; and in closed)
  //   last    — `${root}__final` (needed in final, to know if you already did)
  const [thread, setThread] = useState(() => (answering && db ? undefined : {}));
  useEffect(() => {
    if (!answering || !db || !rootId) return;
    let alive = true;
    const read = (id) => getDoc(doc(db, "privateReplies", id)).then((x) => (x.exists() ? x.data() : null)).catch(() => null);
    Promise.all([
      mode === "answer" ? Promise.resolve(null) : read(rootId),
      mode === "final" ? Promise.resolve(null) : mode === "answer" || mode === "closed" ? read(`${rootId}__reply`) : Promise.resolve(null),
      mode === "final" ? read(`${rootId}__final`) : Promise.resolve(null),
    ]).then(([root, answer, last]) => { if (alive) setThread({ root, answer, last }); });
    return () => { alive = false; };
  }, [db, answering, rootId, mode]);

  const checked = thread !== undefined;
  const exchangeComplete = mode === "closed"
    || (mode === "answer" && Boolean(thread?.answer))
    || (mode === "final" && Boolean(thread?.last));

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
      // Who it was to, so your own Messages list can name them even before they write back.
      toName: firstName(answering ? answering.fromName : target?.sender) || null,
      messageId: target.id ?? null,
      messageText: (target.text ?? "").slice(0, 120), // context for the recipient
      text: clean,
      ts: Date.now(),
      read: false,
    };

    let replyId;
    try {
      if (mode === "answer") {
        // DERIVED ids, not random ones. That is what caps the exchange: a second answer (or a
        // second last word) would be a write to a path that already exists, which Firestore
        // treats as an update, and the update rule allows only `read` to change.
        replyId = `${answering.id}__reply`;
        await setDoc(doc(db, "privateReplies", replyId), { ...payload, inReplyTo: answering.id });
      } else if (mode === "final") {
        replyId = `${rootId}__final`;
        await setDoc(doc(db, "privateReplies", replyId), { ...payload, inReplyTo: rootId, final: true });
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
    // Telling someone how their words landed is a way of making them feel seen — it counts as
    // the day, exactly like sending a message does.
    // theirText: the words being answered, so "Feel it" can offer a phrase of them back (3.10).
    const theirText = mode === "first" ? target?.text : answering?.text;
    try { onSent?.({ mode, toUid: target.uid, name: other, messageId: target.id ?? null, note: isNote, theirText: isNote ? null : theirText }); } catch { /* ignore */ }

    // Everything below here is best-effort and deliberately NOT awaited. The reply has
    // already landed; a failure to push a notification or write a celebratory card must
    // never make a delivered message look undelivered.

    // Push the recipient. Sends only the id — notify-reply reads the document itself to work
    // out who it is for and what to say, so nothing here can choose the notification text.
    authedPost(currentUser, "/api/notify-reply", { replyId }).catch(() => {});

    // Announce that kindness happened, without saying who or what — but only for a first
    // reply. The rest is the same two people in the same exchange.
    if (mode === "first") {
      recordKindMoment(db, {
        fromUid: myUid ?? currentUser.uid,
        toUid: target.uid,
        fromCountry: me?.country ?? null,
        toCountry: target.country ?? null,
      });
    }
    setTimeout(() => onClose?.(), 1200);
  };

  const title = isNote ? `Make ${firstName(target?.sender)} feel seen`
    : mode === "first" ? `Tell ${firstName(target?.sender)} how it landed`
    : mode === "answer" ? "Reply back"
    : mode === "final" ? "Write back one last time"
    : "Your exchange";
  const lastWordNote = mode === "answer"
    ? ` ${other} can write back once more, and then the exchange is complete.`
    : mode === "final" ? " This is the last word: once you send it, the exchange is complete." : "";

  return createPortal(
    <div data-portal className="fixed inset-0 z-[240] flex flex-col justify-end" style={sheetBox(view)}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative sheet-slide-up rounded-t-3xl bg-white shadow-2xl flex flex-col" style={sheetCap(view)} onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-center pt-3 pb-2"><div className="w-10 h-1 rounded-full bg-slate-200" /></div>
        <div className="px-5 pb-2 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800">
            {title} {flagFor(answering ? answering.fromCountry : target?.country)}
          </h2>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600" aria-label="Close"><X size={20} /></button>
        </div>
        <div className="px-5 pb-8 space-y-3 overflow-y-auto overscroll-contain">
          {answering ? (
            // The whole exchange, oldest first: the public message it began with, then each
            // private message in turn.
            <div className="space-y-2">
              {answering.messageText && (
                <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                    {mode === "final" ? `${other} wrote` : "You wrote"}
                  </p>
                  <p className="mt-0.5 text-[13px] text-slate-500 italic">“{stripQuotes(answering.messageText)}”</p>
                </div>
              )}
              {mode === "answer" && <ThreadBubble label={`${other} replied`} body={answering.text} />}
              {mode === "answer" && thread?.answer && <ThreadBubble mine label="You replied" body={thread.answer.text} />}
              {mode === "final" && thread?.root && <ThreadBubble mine label="You replied" body={thread.root.text} />}
              {mode === "final" && <ThreadBubble label={`${other} replied`} body={answering.text} />}
              {mode === "final" && thread?.last && <ThreadBubble mine label="You wrote back" body={thread.last.text} />}
              {mode === "closed" && thread?.root && <ThreadBubble label={`${other} replied`} body={thread.root.text} />}
              {mode === "closed" && thread?.answer && <ThreadBubble mine label="You replied" body={thread.answer.text} />}
              {mode === "closed" && <ThreadBubble label={`${other} wrote back`} body={answering.text} />}
            </div>
          ) : isNote ? null : (
            <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-[13px] text-slate-500 italic">“{stripQuotes(target?.text)}”</div>
          )}
          {/* What you already said about this message. Your own replies used to be invisible once
              sent, so a reply from this morning looked as if it had never happened. */}
          {mode === "first" && previous.length > 0 && (
            <div className="rounded-xl border border-teal-200 bg-teal-50 px-3 py-2">
              {previous.slice(0, 2).map((p) => (
                <div key={p.id} className="mb-1 last:mb-0">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-teal-600">
                    You replied {new Date(Number(p.ts) || 0).toLocaleString([], { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                  </p>
                  <p className="mt-0.5 text-[14px] text-slate-700">{p.text}</p>
                </div>
              ))}
              {onOpenConversation && (
                <button onClick={onOpenConversation} className="mt-1 text-[12px] font-semibold text-teal-700">
                  See your conversation with {firstName(target?.sender)} →
                </button>
              )}
            </div>
          )}
          {/* Say who can see it, and — before they write — how many messages are left, so
              finding out afterwards that it was the last one never feels like a trick. */}
          {mode !== "closed" && (
            <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2.5">
              <p className="text-[11px] text-sky-700 leading-relaxed">
                Only {mode === "first" ? firstName(target?.sender) : other} can read this — your words are never shown
                in any feed. It's screened first, and either of you can delete it.{lastWordNote}
              </p>
            </div>
          )}
          {exchangeComplete ? (
            <p className="text-center text-[12px] text-slate-500 leading-relaxed">
              This exchange is complete — three messages, and that's it. Kindness here isn't a
              conversation to keep up with.
            </p>
          ) : !checked ? (
            <div className="flex justify-center py-4"><Loader2 size={18} className="animate-spin text-slate-300" /></div>
          ) : (
            <>
              {/* No autoFocus: the sheet opens showing who it's to and what they wrote; the keyboard
                  comes up when you tap the box. */}
              <textarea ref={boxRef} value={text} onChange={(e) => setText(e.target.value.slice(0, REPLY_MAX))} rows={text.length > 60 ? 4 : 2}
                onFocus={(e) => { const el = e.currentTarget; setTimeout(() => el.scrollIntoView({ block: "nearest", behavior: "smooth" }), 250); }}
                placeholder={isNote ? "Something you appreciate about them…" : mode === "first" ? "What did their words mean to you?" : "A private word of kindness, just between you two…"}
                className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-[15px] text-slate-900 placeholder:text-slate-400 focus:border-teal-400 focus:outline-none" />
              {/* Finish the thought (3.16): while the box holds only the start you tapped, three
                  endings that fit it. Tap one, then make it your own. */}
              {started && text === started.text && !sent && (
                <div style={{ animation: "seenFadeUp 200ms ease both" }}>
                  <p className="mb-1 text-[11px] font-semibold text-slate-500">Finish the thought…</p>
                  <div className="flex flex-wrap gap-1.5">
                    {continuationsFor(started.kind, `${target?.id || target?.uid || ""}|${started.text}`).map((c) => (
                      <button key={c} type="button" onClick={() => finish(c)}
                        className="rounded-full border border-teal-200 bg-white px-2.5 py-1 text-[12.5px] font-semibold text-teal-700 shadow-sm active:scale-95 transition-all">
                        …{c}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {/* Ways in, only while the box is empty — a way in, not a template to fill. Their own
                  words come first (3.16): they were the small pill nobody noticed. */}
              {(mode === "first" || mode === "answer") && !text && !sent && (
                <div className="space-y-3">
                  {phrases.length > 0 && (
                    <div className="rounded-2xl border border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50/60 px-3 py-2.5">
                      <p className="text-[12.5px] font-extrabold text-orange-800">✨ Which of {firstName(mode === "first" ? target?.sender : other)}'s words stayed with you?</p>
                      <div className="mt-2 space-y-1.5">
                        {phrases.map((ph) => (
                          <button key={ph} type="button" onClick={() => begin(`“${ph}” stayed with me because `, "quote")}
                            className="flex w-full items-start gap-2 rounded-xl border border-orange-100 bg-white px-3 py-2 text-left shadow-sm active:scale-[0.99] transition-all">
                            <span className="-mt-1 font-serif text-[26px] leading-none text-orange-300" aria-hidden>“</span>
                            <span className="text-[13.5px] italic leading-snug text-slate-700">{ph}</span>
                          </button>
                        ))}
                      </div>
                      <p className="mt-1.5 text-[11px] text-orange-700/80">Tap a line, then say why it landed.</p>
                    </div>
                  )}
                  {theirLine && (
                    <div className="rounded-2xl border border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50/60 px-3 py-2.5">
                      <p className="text-[12.5px] font-extrabold text-orange-800">🌱 {firstName(target?.sender)} is working on…</p>
                      <button type="button" onClick={() => begin(`Rooting for you with “${theirLine}” — `, "rightNow")}
                        className="mt-2 flex w-full items-start gap-2 rounded-xl border border-orange-100 bg-white px-3 py-2 text-left shadow-sm active:scale-[0.99]">
                        <span className="text-[13.5px] leading-snug text-slate-700">{theirLine}</span>
                      </button>
                      <p className="mt-1.5 text-[11px] text-orange-700/80">Tap to cheer them on with it.</p>
                    </div>
                  )}
                  <div>
                    <p className="mb-1 text-[11px] font-semibold text-slate-500">{isNote ? "You make me feel…" : "Their words made you feel…"}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {feelRow.map((w) => (
                        <button key={w} type="button" onClick={() => begin(opening(w), isNote ? "noteFeel" : "feel")}
                          className="rounded-full border border-orange-200 bg-orange-50/70 px-2.5 py-1 text-[12.5px] font-semibold text-orange-700 active:scale-95 transition-all">
                          {w}
                        </button>
                      ))}
                    </div>
                  </div>
                  {mode === "first" && (
                    moreIdeas ? (
                      <div>
                        <p className="mb-1 text-[11px] font-semibold text-slate-400">Or start with…</p>
                        <div className="flex flex-wrap gap-1.5">
                          {starters.map((st) => (
                            <button key={st} type="button" onClick={() => begin(st, STARTER_KIND[st] === "thank" && isNote ? "thankNote" : STARTER_KIND[st] || null)}
                              className="rounded-full border border-teal-100 bg-teal-50/60 px-2.5 py-1 text-[12px] font-medium text-teal-700 hover:bg-teal-50 active:scale-95 transition-all">
                              {st.trim().replace(/[—\s]+$/, "")}…
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <button type="button" onClick={() => setMoreIdeas(true)} className="text-[12px] font-semibold text-slate-400">More ideas ›</button>
                    )
                  )}
                </div>
              )}
              {error && (
                <p className="rounded-xl bg-red-50 px-3 py-2 text-center text-xs font-semibold text-red-600" role="alert">{error}</p>
              )}
              {sent && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[12px] font-semibold text-amber-700">
                  Sent ✓ — only {mode === "first" ? firstName(target?.sender) : other} will see it.
                </div>
              )}
              <button onClick={send} disabled={!text.trim() || sent || busy}
                className="w-full rounded-2xl bg-teal-600 py-3.5 text-sm font-bold text-white hover:bg-teal-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {busy ? (<><Loader2 size={16} className="animate-spin" /> Checking…</>) : mode === "first" ? "Send privately" : mode === "final" ? "Send last word" : "Send reply"}
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
      {/* Search is named FIRST, and it used not to be named at all — this said only "tap Follow
          on someone in the Worldwide Feed", which teaches you to wait for the right stranger to
          drift past rather than to go and find the people you already know. Someone arriving
          because a friend told them about Seen needs to hear "search by name" on this screen. */}
      <p className="mt-1 text-[12px] text-slate-500 leading-relaxed">
        <strong>Search for anyone by name</strong> — or tap <strong>Follow</strong> on a message
        in the Worldwide Feed above. Whoever you choose, their messages arrive here instead of
        in with the strangers.
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
//
// PINNED, so it stays visible as you scroll and always tells you which feed you are looking at.
//
// A pinned bar has ONE hard requirement: be fully opaque, in both themes, so messages pass
// behind it rather than through it. Everything that requirement depends on — the background,
// `position`, `top` and `z-index` — lives together in index.css under `.seen-feed-header` and
// `.seen-feed-header--pinned`, deliberately NOT split between there and Tailwind utilities.
//
// That is not tidiness. Messages were drawn across this bar for three rounds of fixes, and the
// cause was never layering: a comment in index.css closed early and CSS error recovery silently
// swallowed the background rule that followed it. The bar rendered with no background at all,
// its text painting straight onto the messages behind, which looks exactly like a z-index bug
// and is not one. `scripts/check-css.cjs` now parses the built stylesheet and fails if that
// background rule goes missing again — the only thing that catches it, because the rule stays
// present in both the source and the build and only the parser drops it.
//
// z-index 40 is also load-bearing: the long-press reaction bar and three prompts in the same
// scroller are z-30, and an earlier z-[25] here sat underneath all of them.
//
// The background is owned by that class rather than a `bg-slate-50` utility for a second
// reason: the dark-shell remaps rewrite background utilities globally AND by combination, and
// `bg-slate-50` + `border-slate-200` together already match a rule meant for streak badges that
// would render this bar 6% opaque with nothing in this file changing.
//
// `-mx-3.5 px-3.5` cancels the scroller's horizontal padding so the bar runs edge to edge, which
// is what makes it match the Worldwide bar above. `pt-3.5` compensates for the negative `top`:
// the bar hangs 8px above the scrollport and that much is clipped away.
//
// It carried `bg-slate-50/95 backdrop-blur` once, which visibly wobbled during scroll — a
// backdrop-filter is re-sampled from a fractional scroll offset every frame and browsers round
// that inconsistently, worst in WebKit. Opaque and unblurred is both cheaper and steadier.
const TWO_FEEDS_KEY = "seen_two_feeds_intro_v1";

// One row of the card below. The glyph sits in a fixed-width column so both feed names start at
// the same x — the previous version was two ordinary sentences with the emphasis inline, so
// nothing lined up and the block read as ragged prose rather than as two things being told apart.
//
// Module scope, not nested inside TwoFeedsIntro: a component declared during render is a new type
// on every render, which remounts its subtree and is what react/no-unstable-nested-components is
// there to catch.
function TwoFeedsRow({ arrow, name, nameClass, what }) {
  return (
    <div className="flex items-start gap-2.5">
      <span aria-hidden className="w-4 shrink-0 pt-px text-center text-[13px] font-bold text-slate-400">{arrow}</span>
      <div className="min-w-0">
        <p className={`text-[12px] font-bold leading-snug ${nameClass}`}>{name}</p>
        <p className="text-[12px] leading-snug text-slate-600">{what}</p>
      </div>
    </div>
  );
}

// Two feeds sit on this screen and nothing ever said they were different things.
//
// Every explanation the app had was REACTIVE — it appeared only once someone was already
// confused. The empty-state card explains it, but only when the Focused Feed is empty. The
// header says "just you for now", but only at zero follows. The "find people you know"
// invitation is top priority and lives inside the bell, which a new user has no reason to open.
// So the common case was someone scrolling two stacked feeds without knowing why one was
// strangers and the other was not, and never learning that the second is something you build.
//
// This sits BETWEEN them, where the difference is physically on the screen and the arrows point
// at the real thing. Not a modal: the retired guided tour is proof enough that people dismiss an
// overlay standing between them and the app, and learn nothing from it.
//
// ── WHY IT LOOKED LIKE CLUTTER, WHICH WAS A COLOUR BUG AND NOT A LAYOUT ONE ───────────────────
// It was written as `bg-teal-50/60 border-teal-100 text-teal-700`, which reads as "a quiet mint
// note". It is not. index.html redefines Tailwind's palette for the sunset rebrand, so in this
// app `teal-50` is #FFF1F0 and `teal-700` is #A82E2C — and a stranger's message bubble is
// `bg-teal-50 border-teal-200`. The explainer was rendering in the EXACT fill of the messages it
// was explaining, wedged between two of them. Nothing about the code said so; you have to know
// the palette is remapped, and the class names actively tell you it is not.
//
// So the card now takes no accent fill at all. White, a slate hairline, a radius, and its own
// margins instead of the full-bleed `-mx-3.5 border-y` band it used to be — because a square
// edge-to-edge strip between two columns of rounded bubbles is the other half of "untidy".
//
// The two feed names carry `seen-feed-title--world` and `seen-feed-title--focus`, which are the
// SAME classes the two real headers use (index.css). That is the whole trick: the words in the
// explanation are the colour of the bars they are pointing at, so the mapping is visible rather
// than described, and dark mode needs nothing added here because those classes already carry
// their own [data-dark-shell] values.
export function TwoFeedsIntro({ onFindPeople }) {
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(TWO_FEEDS_KEY) === "1"; } catch { return false; }
  });
  if (dismissed) return null;

  const close = () => {
    setDismissed(true);
    try { localStorage.setItem(TWO_FEEDS_KEY, "1"); } catch { /* a private window just sees it again */ }
  };

  return (
    <div className="mb-2.5 mt-1 rounded-2xl border border-slate-200 bg-white px-3.5 py-3 shadow-sm">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-600">Two feeds, on purpose</p>
        <button onClick={close} aria-label="Got it" title="Got it"
          className="-mr-1.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
          <X size={13} />
        </button>
      </div>

      <div className="space-y-2.5">
        <TwoFeedsRow arrow="↑" name="Worldwide Feed (above)" nameClass="seen-feed-title--world"
          what="Kind words from strangers, anywhere in the world." />
        <TwoFeedsRow arrow="↓" name="Focused Feed (below)" nameClass="seen-feed-title--focus"
          what="Only the people you choose to follow." />
      </div>

      <button onClick={() => { close(); onFindPeople?.(); }}
        className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 py-1.5 text-[11px] font-bold text-slate-600 hover:bg-slate-100 active:scale-[0.98] transition-all">
        <Search size={11} />
        Find people you know
      </button>
    </div>
  );
}

export function FocusedFeedHeader({ count = 0, onManage }) {
  return (
    <div className="seen-feed-header seen-feed-header--pinned -mx-3.5 mb-2 flex items-center gap-2 border-b border-slate-200 px-3.5 pb-1.5 pt-3.5">
      <p className="seen-feed-title--focus text-[11px] font-bold uppercase tracking-wide">👥 Focused Feed</p>
      <span className="seen-feed-meta text-[10px] font-semibold">
        {count === 0 ? "· just you for now" : `· ${count} ${count === 1 ? "person" : "people"} you follow`}
      </span>
      {onManage && (
        <button onClick={onManage}
          className="seen-feed-title--focus ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold hover:bg-teal-50 transition-colors">
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
// `editing` turns this into an edit sheet for an existing post: pass the message document.
//
// The same component rather than a second sheet, and the reason is the moderation block below.
// Two fail-closed screening paths is how one of them quietly stops failing closed — the copy
// that nobody is looking at gets a well-meaning "just let it through if the service is down"
// six months later. An edit that skipped screening would also make screening optional for
// everyone: post something warm, rewrite it to anything. Reusing this keeps that impossible.
export function PostComposer({ profile, myUid, currentUser, db, streak = 0, sparkBalance = 0, editing = null, onPosted, onClose }) {
  const view = useVisibleViewport();
  const isEditing = Boolean(editing?.id);
  const [text, setText] = useState(editing?.text ?? "");
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
  const [gif, setGif] = useState(null);           // the chosen Klipy result, attached on submit
  const [showGifPicker, setShowGifPicker] = useState(false);
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

    // 2a. An EDIT is a different write and stops here.
    //
    // `editedAt` is not decoration and not optional — firestore.rules refuses a text change that
    // arrives without it. Anyone who already hearted this post keeps their heart, so the post has
    // to be honest that it is not the post they hearted.
    //
    // No drops, deliberately: the award belongs to the act of writing something, and rewording it
    // is not a second act. Awarding again would also make editing a way to farm them.
    if (isEditing) {
      try {
        await updateDoc(doc(db, "publicMessages", editing.id), { text: clean, editedAt: Date.now() });
      } catch (err) {
        setFailKind("unavailable");
        setReason(writeFailure(err, "That edit"));
        setState("rejected");
        return;
      }
      setState("done");
      onPosted?.();
      setTimeout(() => onClose?.(), 900);
      return;
    }

    // 2b. Publish. Same field shape the rest of the app writes, so the production build —
    //    which reads publicMessages unfiltered — renders it with no changes of its own.
    let posted;
    try {
      posted = await addDoc(collection(db, "publicMessages"), {
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

    // 3. The GIF, if there is one — written AFTER the message and flagged on it LAST.
    //
    // That order is the whole point. `hasMedia` is what tells every reader to go and fetch the
    // media document, so setting it before the document exists would publish a post that
    // promises a GIF nobody can load. Writing the media first and the flag last means the only
    // failure available is a post that is missing its GIF — degraded, but never broken, and
    // never inconsistent for anyone who reads it.
    //
    // Deliberately not rolled back or surfaced as an error: the words are the post and they are
    // already live. Refusing the whole thing, or making someone re-type it, because a decoration
    // did not attach would be the wrong trade in an app about saying something to a person.
    if (gif) {
      try {
        await setDoc(doc(db, "publicMessages", posted.id, "media", "item"), {
          uid: myUid ?? currentUser.uid,
          type: "gif",
          url: gif.url,
          previewUrl: gif.previewUrl,
          width: gif.width,
          height: gif.height,
          // Carried so the alt text survives without another Klipy call on every render.
          description: gif.description,
          klipyId: gif.id,
          createdAt: Date.now(),
        });
        await updateDoc(doc(db, "publicMessages", posted.id), { hasMedia: true });
      } catch (err) {
        console.error("[post] GIF attach failed, post stands without it:", err?.code || err?.message);
      }
    }

    // Waters the Kindness Tree, same as a reflection. This was missing entirely — the post
    // previously earned nothing on either ledger.
    //
    // The first one you write today is worth 500 and the rest 150; see THE 500s in points.js
    // for why only this one of the two 500s needs the guard. claimFirstToday marks as it reads,
    // so it is called exactly once, here, after the post has actually gone through.
    try { awardPoints(claimFirstToday("post") ? "postFirst" : "post"); } catch { /* ignore */ }
    setState("done");
    onPosted?.();
    setTimeout(() => onClose?.(), 900);
  };

  return createPortal(
    <div data-portal className="fixed inset-0 z-[240] flex flex-col justify-end" style={sheetBox(view)}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative sheet-slide-up rounded-t-3xl bg-white shadow-2xl flex flex-col overflow-y-auto overscroll-contain" style={sheetCap(view)} onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-center pt-3 pb-2"><div className="w-10 h-1 rounded-full bg-slate-200" /></div>
        <div className="px-5 pb-2 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800">{isEditing ? "Edit your message" : "Share some kindness"}</h2>
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
          {/* The chosen GIF, shown before it is sent rather than after. Capped in height so a
              tall one cannot push the Share button off the bottom of the sheet. */}
          {gif && (
            <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-50"
              style={{ animation: "seenFadeUp 200ms ease both" }}>
              <img src={gif.previewUrl} alt={gif.description}
                className="max-h-44 w-full object-contain" />
              <button onClick={() => setGif(null)} aria-label="Remove GIF"
                className="absolute right-2 top-2 rounded-full bg-black/55 p-1.5 text-white hover:bg-black/70 transition-colors">
                <X size={13} />
              </button>
              <p className="px-3 py-1.5 text-[10px] text-slate-400">
                Only people in your Focused Feed will see this
              </p>
            </div>
          )}

          {/* Hidden entirely when there is no Klipy key, rather than shown as a button that
              opens a sheet explaining it does not work. */}
          {!gif && !isEditing && isKlipyConfigured() && state !== "done" && (
            <button onClick={() => setShowGifPicker(true)}
              className="w-full rounded-xl border border-dashed border-teal-200 py-2 text-[12px] font-semibold text-teal-600 hover:border-teal-300 hover:bg-teal-50 transition-colors flex items-center justify-center gap-1.5">
              🎬 Add a GIF
            </button>
          )}

          <div className="flex items-center justify-between">
            {/* Hidden when editing. Whether a post carries your name is a property of the post as
                published — people saw it one way — and changing that after the fact is a separate
                decision that should not arrive free with a typo fix. firestore.rules agrees: the
                update rule permits text, editedAt and hasMedia, and `sender` is not among them. */}
            {isEditing ? <span /> : (
            <button onClick={() => { if (canAnon) setAnon((a) => !a); }} disabled={!canAnon}
              className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                !canAnon ? "border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed"
                : anon ? "border-violet-300 bg-violet-50 text-violet-700"
                : "border-slate-200 bg-white text-slate-500"}`}>
              {!canAnon ? "🔒 Posting as you" : anon ? "🕶️ Name hidden" : "👤 Posting as you"}
            </button>
            )}
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
            <div className="rounded-xl border border-teal-200 bg-teal-50 px-3 py-2.5 text-[12px] font-semibold text-teal-700">{isEditing ? "Saved ✓ — your message is updated" : "Shared ✓ — it's in the feed now"}</div>
          )}
          <button onClick={submit} disabled={!len || state === "checking"}
            className="w-full rounded-2xl bg-teal-600 py-3.5 text-sm font-bold text-white hover:bg-teal-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {state === "checking" ? (<><Loader2 size={16} className="animate-spin" /> Checking kindness…</>) : (isEditing ? "Save changes" : "Share")}
          </button>
          <p className="text-center text-[10px] text-slate-400 leading-relaxed">
            {isEditing
              ? "Edits are screened like new posts. Anyone who already reacted keeps their reaction, so your message will show that it was edited."
              : anon
              ? "Your name and country won't be shown. Posts are still linked to your account so they can be moderated, so this isn't fully anonymous."
              : "Every post is screened before anyone sees it. You can delete yours at any time."}
          </p>
        </div>
      </div>

      {showGifPicker && (
        <GifPicker onClose={() => setShowGifPicker(false)} onPick={(g) => setGif(g)} />
      )}
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
      // `emoji` is the document id, and the ids are NOT all emoji — stickers are stored in
      // this same subcollection under "sticker_hug", "sticker_clap" and so on. This loop used
      // to take the id verbatim, so a sticker reactor was listed in the Hearts section with the
      // literal text "sticker_hug" where the heart should be, and counted in "Hearts · N".
      //
      // Both kinds belong here — someone who sent a hug did feel something — but they are shown
      // as what they are, in their own section, with the sticker's real emoji.
      const rows = [];
      snap.forEach((d) => {
        const { uids = [], countries = {}, reactedAt = {} } = d.data() || {};
        const sticker = STICKER_BY_ID[d.id] ?? null;
        uids.forEach((uid) => rows.push({
          uid,
          emoji: sticker ? sticker.emoji : d.id,
          kind: sticker ? "sticker" : "heart",
          label: sticker ? sticker.label : null,
          country: countries[uid] ?? null,
          at: reactedAt[uid] ?? 0,
        }));
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

  // Split once, here, rather than filtering twice in the JSX. `reactors === null` means still
  // loading, which is a different thing from "nobody", so the null is preserved by the guards
  // below rather than collapsed into an empty array.
  const hearts = reactors ? reactors.filter((r) => r.kind === "heart") : [];
  const stickerReactors = reactors ? reactors.filter((r) => r.kind === "sticker") : [];

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
            <p className="text-[15px] leading-relaxed text-slate-800 font-medium">“{stripQuotes(message?.text)}”</p>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-2">
              Hearts {hearts ? `· ${hearts.length}` : ""}
            </p>
            {reactors === null ? (
              <div className="py-8 text-center text-sm text-slate-400 flex items-center justify-center gap-2">
                <Loader2 size={16} className="animate-spin" /> Loading…
              </div>
            ) : hearts.length === 0 ? (
              <div className="rounded-2xl border border-slate-100 bg-slate-50 py-8 text-center text-[13px] text-slate-400">
                <div className="text-2xl mb-1">🤍</div>
                No hearts yet — they often arrive a little later.
              </div>
            ) : (
              <div className="space-y-1">
                {hearts.map((r) => (
                  <div key={`${r.uid}_${r.kind}_${r.emoji}`} className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white px-3 py-2.5">
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

          {stickerReactors.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-2">
                Stickers · {stickerReactors.length}
              </p>
              <div className="space-y-1">
                {stickerReactors.map((r) => (
                  <div key={`${r.uid}_${r.kind}_${r.emoji}`} className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white px-3 py-2.5">
                    <div className="h-9 w-9 rounded-xl bg-teal-50 flex items-center justify-center flex-shrink-0">
                      <span style={{ fontSize: "15px" }}>{flagFor(r.country)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700 truncate">{r.name}</p>
                      {/* The sticker's own words — "Big hug", "Hang in there". More use than
                          the country line here: it says what they actually sent you. */}
                      {r.label && <p className="text-[11px] text-slate-400 truncate">{r.label}</p>}
                    </div>
                    <span className="text-[10px] text-slate-400 flex-shrink-0">{timeAgo(r.at)}</span>
                    <span className="text-sm flex-shrink-0">{r.emoji}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

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
