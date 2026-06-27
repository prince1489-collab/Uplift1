// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.
// CommunityGreetings.jsx — crowdsourced greeting library: submit → admin-moderate → send.
// Approved submissions surface in the GreetingPicker "Community" tab; the community can
// upvote (sort/promote) and report (auto-hide past a threshold). Authors earn sparks on
// approval and a small bonus each time their greeting is sent.

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  addDoc, collection, doc, getDocs, onSnapshot, query,
  runTransaction, updateDoc, where,
} from "firebase/firestore";
import { X, Loader2, ThumbsUp, Flag, Sparkles, Trophy, Send, Info, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { FLAG_MAP } from "./MicroAnimations";

// ── Tunables ──────────────────────────────────────────────────────────────────
export const COMMUNITY_SPARK_REWARD = 12;  // sender earns this (scaled by streak)
export const APPROVAL_REWARD = 50;          // author earns on approval
export const AUTHOR_SEND_BONUS = 2;         // author earns each time it's sent (self-sends excluded)
export const REPORT_THRESHOLD = 3;          // auto-hide approved greeting once flagged this many times
export const MIN_LEN = 10;
export const MAX_LEN = 40;   // keep greetings to one line in the leaderboard
export const DAILY_SUBMISSION_LIMIT = 5;
// ── Weekly champions ──
export const CHAMPION_COUNT = 5;                          // top-N promoted each week
export const CHAMPION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // spotlight length (7 days)
export const CHAMPION_BONUS = 100;                        // sparks to author on promotion

const startOfTodayMs = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

// Shape a raw submission doc into a greeting object the picker/send-flow understands.
function toGreeting(s) {
  return {
    id: `comm_${s.id}`,
    submissionId: s.id,
    text: s.text,
    sparkReward: COMMUNITY_SPARK_REWARD,
    category: "community",
    isMystery: false,
    isPremium: false,
    authorUid: s.authorUid,
    authorName: s.authorName ?? "Someone",
    authorCountry: s.authorCountry ?? null,
    upvotes: s.upvotes ?? 0,
    voters: s.voters ?? {},
    sentCount: s.sentCount ?? 0,
    isFeatured: s.status === "champion",
    championUntil: s.championUntil ?? null,
  };
}

// ── Live approved community greetings ───────────────────────────────────────────
// Single-field equality filter only (no composite index needed); sorted client-side
// by upvotes desc. Auto-hides anything flagged >= REPORT_THRESHOLD.
export function useApprovedCommunityGreetings(db) {
  const [greetings, setGreetings] = useState([]);
  useEffect(() => {
    if (!db) return;
    const q = query(collection(db, "greetingSubmissions"), where("status", "==", "approved"));
    return onSnapshot(q, (snap) => {
      const items = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((s) => (s.reportCount ?? 0) < REPORT_THRESHOLD)
        .sort((a, b) => (b.upvotes ?? 0) - (a.upvotes ?? 0))
        .slice(0, 50)
        .map(toGreeting);
      setGreetings(items);
    }, () => {});
  }, [db]);
  return greetings;
}

// ── Champions — the weekly Top-5, sendable in the picker for 7 days ───────────────
// status == "champion" and still inside their spotlight window, sorted by winning vote score.
// Nothing surfaces in the picker until the admin promotes (no approved-greeting fallback).
export function useChampionGreetings(db) {
  const [greetings, setGreetings] = useState([]);
  useEffect(() => {
    if (!db) return;
    const q = query(collection(db, "greetingSubmissions"), where("status", "==", "champion"));
    return onSnapshot(q, (snap) => {
      const now = Date.now();
      const champions = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((s) => (s.reportCount ?? 0) < REPORT_THRESHOLD && (s.championUntil ?? 0) > now)
        .sort((a, b) => (b.upvotes ?? 0) - (a.upvotes ?? 0));
      setGreetings(champions.map(toGreeting));
    }, () => {});
  }, [db]);
  return greetings;
}

// ── Leaderboard candidates — the voting arena (status == "approved") ──────────────
export function useLeaderboardCandidates(db) {
  const [candidates, setCandidates] = useState([]);
  useEffect(() => {
    if (!db) return;
    const q = query(collection(db, "greetingSubmissions"), where("status", "==", "approved"));
    return onSnapshot(q, (snap) => {
      const items = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((s) => (s.reportCount ?? 0) < REPORT_THRESHOLD)
        .sort((a, b) => (b.upvotes ?? 0) - (a.upvotes ?? 0) || (a.createdAt ?? 0) - (b.createdAt ?? 0))
        .slice(0, 50)
        .map(toGreeting);
      setCandidates(items);
    }, () => {});
  }, [db]);
  return candidates;
}

// Count of pending submissions — drives the admin badge.
export function useCommunitySubmissionCount(db, enabled) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!db || !enabled) return;
    const q = query(collection(db, "greetingSubmissions"), where("status", "==", "pending"));
    return onSnapshot(q, (snap) => setCount(snap.size), () => {});
  }, [db, enabled]);
  return count;
}

// ── Vote / report (transactional, single-action-per-user) ───────────────────────
// Idempotent toggle: shouldVote=true adds the vote, false removes it. Self-votes blocked.
export async function voteGreeting(db, submissionId, uid, shouldVote = true) {
  if (!db || !uid || !submissionId) return;
  const ref = doc(db, "greetingSubmissions", submissionId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return;
    const data = snap.data();
    if (data.authorUid === uid) return;            // no self-voting
    const voters = { ...(data.voters ?? {}) };
    const has = !!voters[uid];
    if (shouldVote && !has) {
      voters[uid] = true;
      tx.update(ref, { voters, upvotes: (data.upvotes ?? 0) + 1 });
    } else if (!shouldVote && has) {
      delete voters[uid];
      tx.update(ref, { voters, upvotes: Math.max(0, (data.upvotes ?? 0) - 1) });
    }
  }).catch(() => {});
}

export async function reportGreeting(db, submissionId, uid) {
  if (!db || !uid || !submissionId) return;
  const ref = doc(db, "greetingSubmissions", submissionId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return;
    const data = snap.data();
    const reporters = { ...(data.reporters ?? {}) };
    if (reporters[uid]) return;                     // already reported
    reporters[uid] = true;
    tx.update(ref, { reporters, reportCount: (data.reportCount ?? 0) + 1 });
  }).catch(() => {});
}

// Best-effort: bump sentCount + credit the author a small spark bonus (self-sends excluded).
// Mirrors the cross-user sparkBalance write used by the existing gift feature. Never throws.
export async function recordCommunitySend(db, greeting, senderUid) {
  if (!db || !greeting?.submissionId) return;
  try {
    const subRef = doc(db, "greetingSubmissions", greeting.submissionId);
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(subRef);
      if (!snap.exists()) return;
      tx.update(subRef, { sentCount: (snap.data().sentCount ?? 0) + 1 });
    });
    if (greeting.authorUid && greeting.authorUid !== senderUid) {
      const authorRef = doc(db, "users", greeting.authorUid);
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(authorRef);
        const bal = Number(snap.exists() ? snap.data().sparkBalance ?? 0 : 0);
        tx.set(authorRef, { sparkBalance: bal + AUTHOR_SEND_BONUS }, { merge: true });
      });
    }
  } catch (_) { /* rewards are best-effort */ }
}

// ── Admin moderation ────────────────────────────────────────────────────────────
export async function approveSubmission(db, submission) {
  if (!db || !submission?.id) return;
  await updateDoc(doc(db, "greetingSubmissions", submission.id), {
    status: "approved",
    approvedAt: Date.now(),
  });
  // Author approval reward (cross-user sparkBalance write, same pattern as gifting).
  if (submission.authorUid) {
    try {
      const authorRef = doc(db, "users", submission.authorUid);
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(authorRef);
        const bal = Number(snap.exists() ? snap.data().sparkBalance ?? 0 : 0);
        tx.set(authorRef, { sparkBalance: bal + APPROVAL_REWARD }, { merge: true });
      });
    } catch (_) { /* reward best-effort */ }
  }
}

export async function rejectSubmission(db, submission) {
  if (!db || !submission?.id) return;
  await updateDoc(doc(db, "greetingSubmissions", submission.id), { status: "rejected" }).catch(() => {});
}

// ── Submit modal ─────────────────────────────────────────────────────────────────
export function SubmitGreetingModal({ db, currentUser, profile, onClose }) {
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const trimmed = text.trim();
  const len = trimmed.length;

  const handleSubmit = async () => {
    if (submitting || !db || !currentUser) return;
    setError("");
    if (len < MIN_LEN) { setError(`Please write at least ${MIN_LEN} characters.`); return; }
    if (len > MAX_LEN) { setError(`Keep it under ${MAX_LEN} characters.`); return; }
    setSubmitting(true);
    try {
      // Daily-limit + exact-duplicate guard across this user's own submissions.
      const mineSnap = await getDocs(query(
        collection(db, "greetingSubmissions"),
        where("authorUid", "==", currentUser.uid),
      ));
      const since = startOfTodayMs();
      const todayCount = mineSnap.docs.filter((d) => (d.data().createdAt ?? 0) >= since).length;
      if (todayCount >= DAILY_SUBMISSION_LIMIT) {
        setError("You've reached today's submission limit — try again tomorrow!");
        setSubmitting(false);
        return;
      }
      const dup = mineSnap.docs.some(
        (d) => (d.data().text ?? "").trim().toLowerCase() === trimmed.toLowerCase()
      );
      if (dup) { setError("You've already submitted this one."); setSubmitting(false); return; }

      await addDoc(collection(db, "greetingSubmissions"), {
        text: trimmed,
        category: "community",
        authorUid: currentUser.uid,
        authorName: profile?.fullName ?? "Someone",
        authorCountry: profile?.country ?? null,
        status: "pending",
        createdAt: Date.now(),
        approvedAt: null,
        upvotes: 0,
        voters: {},
        sentCount: 0,
        reportCount: 0,
        reporters: {},
      });
      setDone(true);
    } catch (_) {
      setError("Couldn't submit — please try again.");
    }
    setSubmitting(false);
  };

  return createPortal(
    <div data-portal className="fixed inset-0 z-[260] flex items-end justify-center sm:items-center"
      style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
      onClick={onClose}>
      <div className="w-full max-w-sm rounded-t-3xl sm:rounded-3xl bg-white p-5 shadow-2xl"
        style={{ animation: "seenSheetRise 320ms cubic-bezier(0.34,1.56,0.64,1) both", paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
            <Sparkles size={15} className="text-teal-500" /> Suggest a greeting
          </h3>
          <button onClick={onClose} className="rounded-full p-1.5 hover:bg-slate-100 transition-colors">
            <X size={16} className="text-slate-500" />
          </button>
        </div>

        {done ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-teal-100">
              <Send size={20} className="text-teal-600" />
            </div>
            <p className="text-sm font-bold text-slate-800">Thank you! 💛</p>
            <p className="text-xs text-slate-500 leading-relaxed">
              Your greeting is in the queue. Once it's approved it'll appear in the Community tab —
              you'll earn <strong>{APPROVAL_REWARD} sparks</strong> and a bonus every time someone sends it.
            </p>
            <button onClick={onClose}
              className="mt-2 rounded-full bg-teal-600 px-6 py-2 text-sm font-semibold text-white hover:bg-teal-700 transition-colors">
              Done
            </button>
          </div>
        ) : (
          <>
            <p className="text-[11px] text-slate-500 leading-relaxed mb-2">
              Write a short, kind message for others to send. Keep it warm, supportive, and for everyone.
            </p>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, MAX_LEN + 20))}
              rows={3}
              autoFocus
              placeholder="e.g. You're doing better than you think 🌱"
              className="w-full resize-none rounded-2xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 focus:border-teal-400 focus:outline-none"
            />
            <div className="flex items-center justify-between mt-1.5">
              <span className={`text-[11px] font-semibold ${len > MAX_LEN ? "text-red-500" : "text-slate-400"}`}>
                {len}/{MAX_LEN}
              </span>
              <span className="text-[11px] text-teal-600 font-semibold">+{APPROVAL_REWARD} sparks if approved</span>
            </div>
            {error && (
              <p className="text-xs font-semibold text-red-500 bg-red-50 rounded-xl px-3 py-2 mt-2">{error}</p>
            )}
            <button
              onClick={handleSubmit}
              disabled={submitting || len < MIN_LEN || len > MAX_LEN}
              className="mt-3 w-full rounded-full bg-teal-600 py-2.5 text-sm font-bold text-white hover:bg-teal-700 transition-colors disabled:opacity-50">
              {submitting ? "Submitting…" : "Submit for review"}
            </button>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}

// ── Contributor leaderboard ──────────────────────────────────────────────────────
// Derived from the live approved greetings list — top authors by total sends.
export function CommunityLeaderboard({ greetings }) {
  const byAuthor = {};
  (greetings ?? []).forEach((g) => {
    if (!g.authorUid) return;
    if (!byAuthor[g.authorUid]) byAuthor[g.authorUid] = { name: g.authorName, sends: 0, count: 0 };
    byAuthor[g.authorUid].sends += g.sentCount ?? 0;
    byAuthor[g.authorUid].count += 1;
  });
  const top = Object.values(byAuthor)
    .filter((a) => a.sends > 0)
    .sort((a, b) => b.sends - a.sends)
    .slice(0, 5);
  if (top.length === 0) return null;

  const medals = ["🥇", "🥈", "🥉"];
  return (
    <div className="rounded-2xl border border-amber-100 bg-amber-50/60 px-3 py-2.5 mb-2">
      <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wide flex items-center gap-1 mb-1.5">
        <Trophy size={11} /> Top contributors
      </p>
      <div className="space-y-1">
        {top.map((a, i) => (
          <div key={i} className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 min-w-0">
              <span className="w-4 text-center">{medals[i] ?? `${i + 1}.`}</span>
              <span className="font-semibold text-slate-700 truncate">{a.name}</span>
            </span>
            <span className="text-[11px] text-amber-600 font-semibold flex-shrink-0">
              {a.sends} {a.sends === 1 ? "send" : "sends"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Community greeting row (used inside the picker's Community tab) ───────────────
export function CommunityGreetingRow({ greeting, streak, computeSparkReward, currentUser, db, isSending, onSelect }) {
  const [voted, setVoted] = useState(false);
  const [reported, setReported] = useState(false);
  const uid = currentUser?.uid;
  const isMine = greeting.authorUid === uid;
  const hasVoted = voted || (uid && greeting.voters?.[uid]);

  return (
    <div className={`w-full rounded-xl border px-3 py-2.5 ${
      isSending ? "border-slate-100 bg-slate-50" : "border-slate-200 bg-white"
    }`}>
      <button
        onClick={() => !isSending && onSelect(greeting)}
        disabled={isSending}
        className="w-full text-left disabled:cursor-not-allowed">
        <span className={`text-sm font-semibold ${isSending ? "text-slate-400" : "text-slate-800"}`}>
          {greeting.text}
        </span>
        <span className="ml-2 text-xs text-teal-600">
          +{computeSparkReward(greeting.sparkReward, streak)} sparks
          {streak >= 3 && <span className="ml-1 text-orange-500">🔥</span>}
        </span>
      </button>
      <div className="flex items-center justify-between mt-1.5">
        <span className="text-[10px] text-slate-400 truncate">by {greeting.authorName}</span>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => { if (!isMine && !hasVoted) { setVoted(true); voteGreeting(db, greeting.submissionId, uid); } }}
            disabled={isMine || hasVoted}
            title={isMine ? "Your greeting" : "Upvote"}
            className={`flex items-center gap-1 text-[11px] font-semibold transition-colors ${
              hasVoted ? "text-teal-600" : "text-slate-400 hover:text-teal-600"
            } disabled:opacity-60`}>
            <ThumbsUp size={11} /> {(greeting.upvotes ?? 0) + (voted && !greeting.voters?.[uid] ? 1 : 0)}
          </button>
          {!isMine && (
            <button
              onClick={() => { if (!reported) { setReported(true); reportGreeting(db, greeting.submissionId, uid); } }}
              disabled={reported}
              title={reported ? "Reported" : "Report"}
              className="text-slate-300 hover:text-red-400 transition-colors disabled:opacity-60">
              <Flag size={11} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Countdown to the next weekly promotion (Mondays 00:00 UTC) ───────────────────
function nextMondayMs() {
  const now = new Date();
  const day = now.getUTCDay();                  // 0 Sun … 1 Mon
  const daysUntilMon = (8 - day) % 7 || 7;      // always 1–7 days ahead
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysUntilMon, 0, 0, 0, 0));
  return next.getTime();
}

function PromotionCountdown() {
  const [remaining, setRemaining] = useState(nextMondayMs() - Date.now());
  useEffect(() => {
    const iv = setInterval(() => setRemaining(nextMondayMs() - Date.now()), 60000);
    return () => clearInterval(iv);
  }, []);
  const totalMin = Math.max(0, Math.floor(remaining / 60000));
  const d = Math.floor(totalMin / 1440);
  const h = Math.floor((totalMin % 1440) / 60);
  const m = totalMin % 60;
  const label = d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m`;
  return (
    <span className="text-[11px] font-semibold text-amber-700">⏳ New Top 5 in {label}</span>
  );
}

// ── Community arena — the voting leaderboard (a top-level tab) ─────────────────────
// Candidates (approved) compete here; each week the Top-5 graduate into the Send-Greetings
// "Community" category for 7 days, then retire permanently. Champions show in a header strip.
const PAGE_SIZE = 10;

export function CommunityArena({ db, currentUser, profile, isAdmin = false, candidates = [], champions = [] }) {
  const [showSubmit, setShowSubmit] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [page, setPage] = useState(0);
  const [pendingVotes, setPendingVotes] = useState({}); // submissionId → desired voted bool (optimistic)
  const [reportedIds, setReportedIds] = useState({});
  const [removedIds, setRemovedIds] = useState({});     // admin-removed, hidden instantly
  const uid = currentUser?.uid;

  const featured = champions.filter((c) => c.isFeatured); // true champions only (not the fallback)

  // Apply optimistic vote state, then re-sort by effective votes so the voter sees an
  // instant re-rank (the live Firestore snapshot reconciles a moment later for everyone).
  const ranked = candidates
    .filter((g) => !removedIds[g.submissionId])
    .map((g) => {
      const serverVoted = !!(uid && g.voters?.[uid]);
      const desired = pendingVotes[g.submissionId];
      const voted = desired !== undefined ? desired : serverVoted;
      const delta = voted === serverVoted ? 0 : (voted ? 1 : -1);
      return { ...g, _voted: voted, _votes: Math.max(0, (g.upvotes ?? 0) + delta) };
    })
    .sort((a, b) => b._votes - a._votes);

  const totalPages = Math.max(1, Math.ceil(ranked.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);       // clamp if the live list shrank
  const pageItems = ranked.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const toggleVote = (g) => {
    if (g.authorUid === uid) return;                      // no self-voting
    const next = !g._voted;
    setPendingVotes((p) => ({ ...p, [g.submissionId]: next }));
    voteGreeting(db, g.submissionId, uid, next);
  };
  const handleReport = (g) => {
    if (g.authorUid === uid || reportedIds[g.submissionId]) return;
    setReportedIds((p) => ({ ...p, [g.submissionId]: true }));
    reportGreeting(db, g.submissionId, uid);
  };
  const handleAdminRemove = (g) => {
    if (!isAdmin) return;
    if (!window.confirm(`Remove this greeting from the board?\n\n"${g.text}"`)) return;
    setRemovedIds((p) => ({ ...p, [g.submissionId]: true }));
    rejectSubmission(db, { id: g.submissionId });
  };

  return (
    <main className="flex-1 overflow-y-auto bg-slate-50/60 px-4 py-4 space-y-3">
      {/* Compact header — explanation tucked behind the ⓘ toggle */}
      <div className="rounded-2xl border border-teal-100 bg-gradient-to-br from-teal-50 to-emerald-50 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-1 flex-1 min-w-0">
            🌱 Community Greetings
            <button
              onClick={() => setShowInfo((v) => !v)}
              aria-label="How it works"
              className={`rounded-full p-0.5 transition-colors ${showInfo ? "text-teal-600" : "text-slate-400 hover:text-teal-600"}`}>
              <Info size={14} />
            </button>
          </h2>
          <button
            onClick={() => setShowSubmit(true)}
            className="rounded-full bg-teal-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-teal-700 transition-colors flex items-center gap-1 flex-shrink-0">
            <Sparkles size={11} /> Suggest
          </button>
        </div>
        <div className="flex items-center justify-between mt-1.5">
          <PromotionCountdown />
        </div>
        {showInfo && (
          <p className="text-[11px] text-slate-500 leading-relaxed mt-2 border-t border-teal-100 pt-2">
            Vote for your favourite greetings. Every week the <strong>Top 5</strong> become sendable in
            the greeting picker for 7 days — then they retire and fresh ones take their place. Write your
            own to join the board!
          </p>
        )}
      </div>

      {/* This week's champions */}
      {featured.length > 0 && (
        <div>
          <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wide flex items-center gap-1 mb-1">
            <Trophy size={11} /> This week's champions
          </p>
          <div className="space-y-1">
            {featured.filter((g) => !removedIds[g.submissionId]).map((g) => (
              <div key={g.id} className="rounded-xl border border-amber-200 bg-amber-50/70 px-2.5 py-1.5">
                <div className="flex items-start gap-2">
                  <p className="text-[13px] font-semibold text-slate-800 line-clamp-2 leading-snug flex-1 min-w-0">{g.text}</p>
                  <span className="text-[11px] text-amber-600 font-semibold flex items-center gap-1 flex-shrink-0 mt-0.5">
                    <ThumbsUp size={10} /> {g.upvotes ?? 0}
                  </span>
                  {isAdmin && (
                    <button
                      onClick={() => handleAdminRemove(g)}
                      title="Remove greeting (admin)"
                      className="text-amber-400 hover:text-red-500 transition-colors flex-shrink-0">
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
                <span className="text-[9px] text-amber-700 font-semibold">⭐ Featured · by {g.authorName}{g.authorCountry && FLAG_MAP[g.authorCountry] ? ` ${FLAG_MAP[g.authorCountry]}` : ""}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Leaderboard */}
      <div>
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">
          Leaderboard · vote for next week
        </p>
        {candidates.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white px-3 py-6 text-center">
            <p className="text-xs text-slate-400 leading-relaxed">
              No greetings in the running yet.<br />Be the first to suggest one! 🌱
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {pageItems.map((g, i) => {
              const rank = safePage * PAGE_SIZE + i;     // global rank across pages
              const isMine = g.authorUid === uid;
              const hasReported = reportedIds[g.submissionId];
              return (
                <div key={g.id} className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5">
                  <div className="flex items-start gap-2">
                    <span className="w-5 text-center text-[12px] font-bold text-slate-400 flex-shrink-0 mt-0.5">
                      {rank + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-slate-800 line-clamp-2 leading-snug">{g.text}</p>
                      <span className="text-[9px] text-slate-400 truncate">by {g.authorName}{g.authorCountry && FLAG_MAP[g.authorCountry] ? ` ${FLAG_MAP[g.authorCountry]}` : ""}</span>
                    </div>
                    <button
                      onClick={() => toggleVote(g)}
                      disabled={isMine}
                      title={isMine ? "Your greeting" : g._voted ? "Tap to remove your vote" : "Upvote"}
                      className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold transition-colors flex-shrink-0 mt-0.5 ${
                        g._voted ? "bg-teal-100 text-teal-700" : "bg-slate-100 text-slate-500 hover:bg-teal-50 hover:text-teal-600"
                      } disabled:opacity-60`}>
                      <ThumbsUp size={11} /> {g._votes}
                    </button>
                    {isAdmin ? (
                      <button
                        onClick={() => handleAdminRemove(g)}
                        title="Remove greeting (admin)"
                        className="text-slate-300 hover:text-red-500 transition-colors flex-shrink-0 mt-1">
                        <Trash2 size={12} />
                      </button>
                    ) : !isMine && (
                      <button
                        onClick={() => handleReport(g)}
                        disabled={hasReported}
                        title={hasReported ? "Reported" : "Report"}
                        className="text-slate-300 hover:text-red-400 transition-colors disabled:opacity-60 flex-shrink-0 mt-1">
                        <Flag size={10} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Pagination */}
            {candidates.length > PAGE_SIZE && (
              <div className="flex items-center justify-center gap-4 pt-2">
                <button
                  onClick={() => setPage(Math.max(0, safePage - 1))}
                  disabled={safePage === 0}
                  className="flex items-center gap-0.5 text-[11px] font-semibold text-slate-500 disabled:opacity-30 hover:text-teal-600 transition-colors">
                  <ChevronLeft size={13} /> Prev
                </button>
                <span className="text-[11px] font-semibold text-slate-400">
                  Page {safePage + 1} of {totalPages}
                </span>
                <button
                  onClick={() => setPage(Math.min(totalPages - 1, safePage + 1))}
                  disabled={safePage >= totalPages - 1}
                  className="flex items-center gap-0.5 text-[11px] font-semibold text-slate-500 disabled:opacity-30 hover:text-teal-600 transition-colors">
                  Next <ChevronRight size={13} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {showSubmit && (
        <SubmitGreetingModal db={db} currentUser={currentUser} profile={profile} onClose={() => setShowSubmit(false)} />
      )}
    </main>
  );
}
