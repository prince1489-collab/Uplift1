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
import { X, Loader2, ThumbsUp, Flag, Sparkles, Trophy, Send } from "lucide-react";

// ── Tunables ──────────────────────────────────────────────────────────────────
export const COMMUNITY_SPARK_REWARD = 12;  // sender earns this (scaled by streak)
export const APPROVAL_REWARD = 50;          // author earns on approval
export const AUTHOR_SEND_BONUS = 2;         // author earns each time it's sent (self-sends excluded)
export const REPORT_THRESHOLD = 3;          // auto-hide approved greeting once flagged this many times
export const MIN_LEN = 10;
export const MAX_LEN = 120;
export const DAILY_SUBMISSION_LIMIT = 5;

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
    upvotes: s.upvotes ?? 0,
    voters: s.voters ?? {},
    sentCount: s.sentCount ?? 0,
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
export async function voteGreeting(db, submissionId, uid) {
  if (!db || !uid || !submissionId) return;
  const ref = doc(db, "greetingSubmissions", submissionId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return;
    const data = snap.data();
    if (data.authorUid === uid) return;            // no self-voting
    const voters = { ...(data.voters ?? {}) };
    if (voters[uid]) return;                        // already voted
    voters[uid] = true;
    tx.update(ref, { voters, upvotes: (data.upvotes ?? 0) + 1 });
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
