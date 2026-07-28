// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.
//
// ModerationQueue.jsx — the screen that makes a report mean something.
//
// Reports have been written to /reports since the app launched, but nothing ever read them:
// the only query against that collection was inside the admin "delete everything" routine,
// which read them in order to destroy them. Meanwhile public/child-safety.html states that
// "All user-generated content is subject to our community guidelines", and Play's UGC policy
// expects reports to be actionable — not merely collectable.
//
// Admin-only, enforced in firestore.rules (isAdmin() gates read on /reports), so a non-admin
// opening this sees an empty list rather than other people's reports.

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  collection, query, orderBy, limit, onSnapshot,
  doc, updateDoc, deleteDoc, getDoc,
} from "firebase/firestore";
import { X, Shield, Loader2, ExternalLink } from "lucide-react";

// Where each kind of reported content actually lives, so "delete the content" can reach it.
const COLLECTION_FOR = {
  message: "publicMessages",
  reflection: "sharedReflections",
  reply: "privateReplies",
};

const timeAgo = (ts) => {
  if (!ts) return "";
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

function ReportRow({ db, report, onDone }) {
  const [content, setContent] = useState(undefined); // undefined = loading, null = gone
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const coll = COLLECTION_FOR[report.kind] ?? (report.messageId ? "publicMessages" : null);
  const contentId = report.contentId ?? report.messageId ?? null;

  // Pull the reported item so the decision is made against the actual words, not just a
  // reason code. A missing document usually means it was already deleted.
  useEffect(() => {
    let alive = true;
    if (!db || !coll || !contentId) { setContent(null); return; }
    getDoc(doc(db, coll, contentId))
      .then((snap) => { if (alive) setContent(snap.exists() ? snap.data() : null); })
      .catch(() => { if (alive) setContent(null); });
    return () => { alive = false; };
  }, [db, coll, contentId]);

  const resolve = async (action) => {
    if (busy) return;
    setBusy(action);
    setError("");
    try {
      if (action === "remove" && coll && contentId) {
        await deleteDoc(doc(db, coll, contentId));
      }
      await updateDoc(doc(db, "reports", report.id), {
        status: action === "remove" ? "actioned" : "dismissed",
        resolvedAt: Date.now(),
      });
      onDone?.(report.id);
    } catch (e) {
      setError(`Couldn't ${action === "remove" ? "remove that" : "dismiss it"} — ${e?.code || "try again"}.`);
    }
    setBusy("");
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 space-y-2">
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-rose-600">
          {report.reason || "Reported"}
        </span>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
          {report.kind || "message"}
        </span>
        <span className="ml-auto text-[10px] text-slate-400">{timeAgo(report.timestamp)}</span>
      </div>

      {content === undefined ? (
        <p className="text-[12px] text-slate-400">Loading the reported content…</p>
      ) : content === null ? (
        <p className="rounded-xl bg-slate-50 px-3 py-2 text-[12px] italic text-slate-400">
          Content no longer exists — already deleted, or removed by its author.
        </p>
      ) : (
        <div className="rounded-xl bg-slate-50 px-3 py-2">
          <p className="text-[13px] leading-snug text-slate-800">“{content.text}”</p>
          <p className="mt-1 text-[10px] text-slate-400">
            by {content.sender || content.authorName || content.fromName || "unknown"}
            {content.anonymous ? " (posted anonymously)" : ""}
          </p>
        </div>
      )}

      <p className="text-[10px] text-slate-400">
        author <span className="font-mono">{(report.reportedUid || "?").slice(0, 10)}…</span>
        {"  ·  "}reporter <span className="font-mono">{(report.reporterUid || "?").slice(0, 10)}…</span>
      </p>

      {error && <p className="text-[11px] font-semibold text-rose-600" role="alert">{error}</p>}

      <div className="flex gap-2 pt-0.5">
        <button onClick={() => resolve("remove")} disabled={!!busy || content === null}
          className="flex-1 rounded-xl bg-rose-600 py-2 text-[12px] font-bold text-white hover:bg-rose-700 disabled:opacity-40 flex items-center justify-center gap-1.5">
          {busy === "remove" ? <Loader2 size={13} className="animate-spin" /> : null}
          Remove content
        </button>
        <button onClick={() => resolve("dismiss")} disabled={!!busy}
          className="flex-1 rounded-xl border border-slate-200 py-2 text-[12px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40">
          {busy === "dismiss" ? "…" : "Dismiss"}
        </button>
      </div>
    </div>
  );
}

export default function ModerationQueue({ db, darkMode = false, onClose }) {
  const [reports, setReports] = useState(null); // null = loading
  const [resolved, setResolved] = useState(() => new Set());

  useEffect(() => {
    if (!db) { setReports([]); return; }
    const q = query(collection(db, "reports"), orderBy("timestamp", "desc"), limit(100));
    const unsub = onSnapshot(q,
      (snap) => setReports(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      () => setReports([]) // non-admin: the rules refuse the read
    );
    return unsub;
  }, [db]);

  // Reports predating the status field have no `status`, so treat missing as open rather
  // than hiding them — those are exactly the ones that have never been looked at.
  const open = (reports ?? []).filter((r) => !r.status || r.status === "open").filter((r) => !resolved.has(r.id));

  return createPortal(
    <div data-portal {...(darkMode ? { "data-dark-shell": "" } : {})}
      className="fixed inset-0 z-[260] flex flex-col bg-white">
      <div className="seen-overlay-header flex items-center gap-3 border-b border-slate-100 px-4 py-3 flex-shrink-0">
        <Shield size={18} className="text-rose-500" />
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-bold text-slate-800">Reported content</h2>
          <p className="text-[11px] text-slate-500">
            {reports === null ? "Loading…" : `${open.length} open · ${reports.length} total`}
          </p>
        </div>
        <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600" aria-label="Close"><X size={20} /></button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {reports === null ? (
          <p className="text-center text-[13px] text-slate-400 py-8">Loading reports…</p>
        ) : open.length === 0 ? (
          <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-8 text-center">
            <p className="text-[14px] font-semibold text-slate-600">Nothing waiting</p>
            <p className="mt-1 text-[12px] text-slate-400">
              Reports from members appear here so they can be actioned.
            </p>
          </div>
        ) : (
          open.map((r) => (
            <ReportRow key={r.id} db={db} report={r}
              onDone={(id) => setResolved((prev) => new Set(prev).add(id))} />
          ))
        )}

        <p className="pt-2 text-center text-[10px] leading-relaxed text-slate-400">
          <ExternalLink size={10} className="inline" /> Removing content deletes it for everyone.
          Blocking is separate and belongs to each member individually.
        </p>
      </div>
    </div>,
    document.body
  );
}
