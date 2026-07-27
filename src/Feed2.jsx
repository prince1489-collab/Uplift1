// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.
//
// Feed2.jsx — v2 "Connect" tab pieces. The Worldwide Feed shows strangers' messages
// (people you haven't followed); the Focused Feed below it shows only the people you follow.
//
// Free-text posts ARE REAL: PostComposer screens each one via /api/moderate-message and
// writes it to publicMessages, so it reaches the Focused Feed here and the single feed in
// the production build. Likes, private replies and "kind moment" broadcasts are still
// SIMULATED (localStorage only) so the preview doesn't leak those into the real feed.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { doc, getDoc, onSnapshot, collection, addDoc } from "firebase/firestore";
import { X, Heart, MessageCircle, UserPlus, UserCheck, Loader2 } from "lucide-react";
import { FLAG_MAP } from "./MicroAnimations";
import { awardPoints } from "./points";
import { apiUrl, authedPost } from "./apiBase";

const POSTS_KEY = "seen_v2_local_posts";
const FOCUS_KEY = "seen_v2_focused_uids"; // legacy: bare uid array, migrated into FOLLOWS_KEY
const FOLLOWS_KEY = "seen_v2_follows";    // [{ uid, name, country, label }]
const MOMENTS_KEY = "seen_v2_kind_moments";
const LIKES_KEY = "seen_v2_board_likes";
const STORIES_KEY = "seen_v2_stories";
const MAX_LEN = 80;

const readJSON = (k, fb) => { try { return JSON.parse(localStorage.getItem(k) || JSON.stringify(fb)); } catch { return fb; } };
const writeJSON = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } };

export const loadLocalPosts = () => readJSON(POSTS_KEY, []);
const saveLocalPosts = (l) => writeJSON(POSTS_KEY, l.slice(0, 30));

// ── Follows: who you follow, with a denormalized name/country and an optional label ──
// Suggested labels; users can also type their own via "Custom…".
export const FOLLOW_LABELS = ["Family", "Friend", "Work", "Neighbour"];

// Reads the follow list, migrating the legacy bare-uid array on first run so existing
// testers keep everyone they already followed.
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

export const loadKindMoments = () => readJSON(MOMENTS_KEY, []);

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

// Preview-only: two-stranger moments can't arise on a single device (you're always one of
// the pair), so seed one purely so the Worldwide Feed routing is testable.
//
// As with sample reflections, this must never name real members — an earlier version paired
// two real feed authors, which read as a private exchange that never happened. Fictional
// uids only, labelled EXAMPLE. Device-local, never Firestore.
export function seedDemoKindMoments(messages = [], myUid) {
  const existing = loadKindMoments();
  if (existing.some((km) => km.demo)) return existing;
  const demo = {
    id: "km_example",
    aUid: "example_not_a_real_member_a", aName: "An example member", aCountry: null,
    bUid: "example_not_a_real_member_b", bName: "another example member", bCountry: null,
    demo: true,
    ts: Date.now() - 3600000,
  };
  const next = [...existing, demo].slice(0, 30);
  writeJSON(MOMENTS_KEY, next);
  return next;
}
// Private replies *received* on one of my messages, keyed by messageId. Real inbound
// replies are merge-time work — this store exists so the viewer is ready for them.
const REPLIES_IN_KEY = "seen_v2_replies_received";
export const loadRepliesReceived = (messageId) => {
  const all = readJSON(REPLIES_IN_KEY, {});
  return Array.isArray(all?.[messageId]) ? all[messageId] : [];
};
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

// Preview-only: you can't receive someone else's shared reflection on a single device, so
// seed one purely to make the Worldwide routing testable.
//
// IMPORTANT: sample content must NEVER be attributed to a real member. An earlier version
// borrowed a real feed author's name, which read as though that person had actually shared
// something — it hadn't happened. The example uses a fictional uid that can't collide with
// a real account, and is labelled EXAMPLE wherever it appears.
const EXAMPLE_UID = "example_not_a_real_member";
export function seedDemoStories(messages = [], myUid) {
  const existing = loadLocalStories();
  if (existing.some((s) => s.demo)) return existing;
  const demo = {
    id: "story_example",
    authorUid: EXAMPLE_UID, authorName: "Example member", country: null,
    anonymous: false, demo: true,
    text: "I nearly didn't send anything today. I did, and a stranger wrote back within the hour. I've read it about six times since.",
    enrich: [{ q: "What made this matter to you?", a: "It landed on a day I'd convinced myself nobody would notice either way." }],
    ts: Date.now() - 5400000,
  };
  const next = [...existing, demo].slice(0, 20);
  writeJSON(STORIES_KEY, next);
  return next;
}

// Drop any sample content that was attributed to a real member before the fix above.
export function purgeMisattributedDemos() {
  const stories = loadLocalStories();
  const cleanStories = stories.filter((s) => !s.demo || s.authorUid === EXAMPLE_UID);
  if (cleanStories.length !== stories.length) writeJSON(STORIES_KEY, cleanStories);
  const moments = loadKindMoments();
  const cleanMoments = moments.filter((km) => !km.demo || km.aUid === `${EXAMPLE_UID}_a`);
  if (cleanMoments.length !== moments.length) writeJSON(MOMENTS_KEY, cleanMoments);
  return { stories: cleanStories, moments: cleanMoments };
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

// ── Kind-moment card (a consented "shared a kind moment") ─────────────────────
export function KindMomentCard({ moment, compact = false }) {
  return (
    <div className={`seen-grad-warm rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white flex items-center gap-2 ${compact ? "px-3 py-2" : "mb-2 px-4 py-2.5"}`}
      style={{ animation: "seenFadeUp 400ms ease both" }}>
      <span className={`flex-shrink-0 ${compact ? "text-base" : "text-lg"}`}>⭐</span>
      <p className="text-[12px] text-slate-600 leading-snug flex-1">
        <strong className="text-slate-800">{moment.aName} {flagFor(moment.aCountry)}</strong> and{" "}
        <strong className="text-slate-800">{moment.bName} {flagFor(moment.bCountry)}</strong> shared a kind moment.
      </p>
      {moment.demo && (
        <span className="flex-shrink-0 rounded-full bg-white/70 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-amber-500">example</span>
      )}
    </div>
  );
}

// ── Private reply sheet (simulated) → creates a kind moment on send ───────────
export function PrivateReplySheet({ target, me, myUid, onDone, onClose }) {
  const [text, setText] = useState("");
  const [sent, setSent] = useState(false);
  const send = () => {
    if (!text.trim() || sent) return;
    setSent(true);
    // uids drive which feed the broadcast lands in (see splitKindMoments).
    const moment = {
      id: `km_${Date.now()}`,
      aUid: myUid ?? null, aName: firstName(me?.fullName) || "You", aCountry: me?.country ?? null,
      bUid: target?.uid ?? null, bName: firstName(target?.sender), bCountry: target?.country ?? null,
      ts: Date.now(),
    };
    const next = [moment, ...loadKindMoments()].slice(0, 30);
    writeJSON(MOMENTS_KEY, next);
    try { awardPoints("reply"); } catch { /* ignore */ } // waters the tree (device-local)
    onDone?.(next);
    setTimeout(() => onClose?.(), 1000);
  };
  return createPortal(
    <div data-portal className="fixed inset-0 z-[240] flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative sheet-slide-up rounded-t-3xl bg-white shadow-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-center pt-3 pb-2"><div className="w-10 h-1 rounded-full bg-slate-200" /></div>
        <div className="px-5 pb-2 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800">Reply privately to {firstName(target?.sender)} {flagFor(target?.country)}</h2>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600" aria-label="Close"><X size={20} /></button>
        </div>
        <div className="px-5 pb-8 space-y-3">
          <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-[13px] text-slate-500 italic">“{target?.text}”</div>
          <textarea value={text} onChange={(e) => setText(e.target.value.slice(0, 120))} rows={2} autoFocus
            placeholder="A private word of kindness, just between you two…"
            className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-[15px] text-slate-900 placeholder:text-slate-400 focus:border-teal-400 focus:outline-none" />
          {sent && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[12px] font-semibold text-amber-700">
              Saved on this device — nothing was sent. Real private replies arrive with the full release. ⭐
            </div>
          )}
          <button onClick={send} disabled={!text.trim() || sent}
            className="w-full rounded-2xl bg-teal-600 py-3.5 text-sm font-bold text-white hover:bg-teal-700 transition-colors disabled:opacity-50">
            Send privately
          </button>
          <p className="text-center text-[10px] text-slate-400 leading-relaxed">
            Preview: private replies are simulated on this device. Only the two of you would see the message;
            a small “shared a kind moment ⭐” note appears in the feed.
          </p>
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
export function FollowingPanel({ follows = [], messages = [], onSetLabel, onUnfollow, onClose }) {
  const [editing, setEditing] = useState(null); // uid whose label chips are open
  const [customFor, setCustomFor] = useState(null); // uid typing a custom label
  const [customText, setCustomText] = useState("");

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

        <div className="overflow-y-auto overscroll-contain px-3 pb-8">
          {follows.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-400">
              <div className="text-3xl mb-2">🕊️</div>
              You're not following anyone yet.
              <p className="mt-1 text-[12px] text-slate-400">Tap <strong>Follow</strong> on a message in the Worldwide Feed.</p>
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
export function FocusedFeedHeader({ count = 0, onManage }) {
  return (
    <div className="sticky -top-2 z-[25] -mx-3.5 mb-2 flex items-center gap-2 border-b border-slate-200 bg-slate-50/95 px-3.5 pb-1.5 pt-3.5 backdrop-blur">
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

// ── Post composer — a real post, screened before it goes out ──────────────────
// Every post is reviewed by /api/moderate-message (the same endpoint that already guards
// feeling statuses and custom replies) BEFORE it is written. Unlike the feelings path,
// which allows a post through when moderation is unreachable, this one fails CLOSED: a
// feeling is 60 chars inside a constrained flow, this is free text going to a feed.
export function PostComposer({ profile, myUid, currentUser, db, onPosted, onClose }) {
  const [text, setText] = useState("");
  const [anon, setAnon] = useState(false);
  const [state, setState] = useState("idle");
  const [reason, setReason] = useState("");
  // "flagged" means rephrase; "unavailable" means try again — different problems needing
  // different things from the user, so they must not share one message.
  const [failKind, setFailKind] = useState(null);
  const len = text.trim().length;

  const submit = async () => {
    if (!len || state === "checking" || !db || !currentUser) return;
    setState("checking");
    setReason("");
    setFailKind(null);
    const clean = text.trim();

    // 1. Screen it. Any failure to get a clean verdict blocks the post.
    try {
      const mod = await authedPost(currentUser, "/api/moderate-message", { text: clean, context: "post" });
      if (!mod.checked) {
        setFailKind("unavailable");
        setReason("We couldn't run the kindness check just now. Your words are safe here — try again in a moment.");
        setState("rejected");
        return;
      }
      if (!mod.ok) {
        setFailKind("flagged");
        setReason(mod.reason || "That didn't pass our kindness check. Try rephrasing it warmly.");
        setState("rejected");
        return;
      }
    } catch {
      setFailKind("unavailable");
      setReason("We couldn't reach the kindness check. Your words are safe here — try again in a moment.");
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
        sparkReward: 0,
        isPersonal: true, // routes it to the Focused Feed in v2; ignored by production
      });
    } catch {
      setFailKind("unavailable");
      setReason("Couldn't share that — check your connection and try again.");
      setState("rejected");
      return;
    }

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
          <div className="flex items-center justify-between">
            <button onClick={() => setAnon((a) => !a)}
              className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12px] font-semibold ${anon ? "border-violet-300 bg-violet-50 text-violet-700" : "border-slate-200 bg-white text-slate-500"}`}>
              {anon ? "🕶️ Name hidden" : "👤 Posting as you"}
            </button>
            <span className={`text-[11px] ${len > MAX_LEN - 10 ? "text-amber-600" : "text-slate-400"}`}>{len}/{MAX_LEN}</span>
          </div>
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
            No EXAMPLE badge here: the sample author is literally named "Example member"
            and the reader carries the explicit "not a real member" banner, so the badge
            was only costing the line width that made the sentence wrap.
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
        {story.demo && (
          <span className="flex-shrink-0 rounded-full bg-white/70 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-amber-500">example</span>
        )}
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
export function FeaturedStoryReader({ story, me, onClose, onChanged }) {
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
      <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 flex-shrink-0">
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

          {story.demo && (
            <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-2.5">
              <p className="text-[12px] font-bold text-amber-700">Example card — not a real member</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-amber-700/80">
                Sample content showing how a shared reflection looks. Nobody actually wrote this.
              </p>
            </div>
          )}
          <p className="text-lg leading-relaxed text-slate-800 font-medium whitespace-pre-wrap">“{story.text}”</p>
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

export function MessageReactionsPanel({ db, message, onClose }) {
  const [reactors, setReactors] = useState(null); // null = loading
  const nameCache = useRef({});
  const replies = useMemo(() => loadRepliesReceived(message?.id), [message?.id]);

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
          const us = await getDoc(doc(db, "users", r.uid));
          const name = (us.data()?.fullName || "").trim() || "Someone";
          nameCache.current[r.uid] = name;
          return { ...r, name, country: r.country || us.data()?.country || null };
        } catch { return { ...r, name: "Someone" }; }
      }));
      if (alive) setReactors(resolved);
    }, () => { if (alive) setReactors([]); });
    return () => { alive = false; unsub(); };
  }, [db, message?.id]);

  return createPortal(
    <div data-portal className="fixed inset-0 z-[250] flex flex-col bg-white">
      <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 flex-shrink-0">
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
                {replies.map((rep, i) => (
                  <div key={i} className="rounded-2xl border border-amber-100 bg-amber-50/60 px-3.5 py-2.5">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-sm">{flagFor(rep.country)}</span>
                      <span className="text-[11px] font-semibold text-slate-500 flex-1 truncate">{firstName(rep.name)}</span>
                      <span className="text-[10px] text-slate-400">{timeAgo(rep.ts)}</span>
                    </div>
                    <p className="text-[13px] text-slate-700 leading-snug">“{rep.text}”</p>
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
