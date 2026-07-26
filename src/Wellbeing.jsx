// Wellbeing.jsx — a gentle personal "how have you been feeling?" check-in based on the five WHO-5
// well-being statements ("past two weeks" recall) → a 0–100 personal reflection score. Offered as a
// first check-in during onboarding, then again roughly fortnightly so you can look back on your own
// reflections over time. Stored per-user at users/{uid}/wellbeing/{id} (private, for the user's own
// eyes). IMPORTANT: this is a personal wellbeing reflection — NOT a medical test, diagnosis, screening
// or monitoring tool, and not a substitute for professional care.
// Based on the WHO-5 Well-Being Index · © World Health Organization (attribution required).

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { collection, addDoc, onSnapshot, query, orderBy } from "firebase/firestore";
import { playCheckIn } from "./sounds";
import { ArrowLeft, Loader2, TrendingUp, LifeBuoy, Info } from "lucide-react";

// WHO-5: five statements, each rated 0–5 for how true it's been over the past two weeks.
// Display order follows a deliberate arc from stillness to energy — how at-peace you've felt
// (calm → rested), rising through mood (cheerful) and engagement (interested) to how alive you've
// felt (active & vigorous). The score is a plain sum, so order never affects the result, and the
// stored keys are unchanged.
export const WELLBEING_QUESTIONS = [
  { key: "calm",     emoji: "🌿", metric: "Calm",         q: "I have felt calm and relaxed" },
  { key: "rest",     emoji: "🛌", metric: "Rest",         q: "I woke up feeling fresh and rested" },
  { key: "cheer",    emoji: "☀️", metric: "Good spirits", q: "I have felt cheerful and in good spirits" },
  { key: "interest", emoji: "🌻", metric: "Interest",     q: "My daily life has been filled with things that interest me" },
  { key: "energy",   emoji: "⚡", metric: "Energy",       q: "I have felt active and vigorous" },
];

// WHO-5 response options (0–5) for the past two weeks.
export const WHO5_LABELS = {
  5: "All of the time",
  4: "Most of the time",
  3: "More than half the time",
  2: "Less than half the time",
  1: "Some of the time",
  0: "At no time",
};

export const RECHECK_DAYS = 14; // fortnightly — matches the WHO-5 two-week recall window
const PERIOD_MS = RECHECK_DAYS * 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

// Raw WHO-5 sum (0–25).
export function computeRaw(scores) {
  return WELLBEING_QUESTIONS.reduce((acc, q) => acc + (Number(scores?.[q.key]) || 0), 0);
}
// Percentage score (0–100) — the standard WHO-5 score is the raw sum × 4.
export function computeScore(scores) {
  return computeRaw(scores) * 4;
}
// A lower personal score just prompts us to gently offer supportive resources — never a diagnosis.
export function isLowWellbeing(score) {
  return typeof score === "number" && score <= 50;
}

export async function saveCheckin(db, uid, scores) {
  if (!db || !uid) return;
  const raw = computeRaw(scores);
  await addDoc(collection(db, "users", uid, "wellbeing"), {
    scores,                 // raw item responses { cheer:4, calm:3, … } (0–5 each)
    who5Raw: raw,           // 0–25
    score: raw * 4,         // 0–100 (display + trend)
    lowWellbeingReflection: raw < 13, // gentle low-score prompt for supportive resources (not a clinical flag)
    instrument: "WHO5",
    version: 1,
    createdAt: Date.now(),
  });
}

// Put every entry on the 0–100 axis. WHO-5 entries: raw×4. Legacy custom-5q entries (each item 0–10)
// were stored as a 0–10 average — lift them to 0–100 so the trend doesn't visually break.
function normaliseScore(data) {
  if (data?.instrument === "WHO5") {
    if (typeof data.who5Raw === "number") return data.who5Raw * 4;
    if (data?.scores) return computeScore(data.scores);
  }
  // Legacy custom 5-question entry (no instrument tag, item scores 0–10).
  if (data?.scores && data.instrument == null) {
    const vals = Object.values(data.scores).map((v) => Number(v) || 0);
    const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0; // 0–10
    return Math.round(avg * 10); // → 0–100
  }
  const s = Number(data?.score) || 0;
  return s <= 10 ? Math.round(s * 10) : Math.round(s); // legacy /10 → ×10
}

export function useWellbeingHistory(db, uid) {
  const [history, setHistory] = useState([]);
  useEffect(() => {
    if (!db || !uid) return;
    const q = query(collection(db, "users", uid, "wellbeing"), orderBy("createdAt", "asc"));
    return onSnapshot(q, (snap) => {
      setHistory(snap.docs.map((d) => { const data = d.data(); return { id: d.id, ...data, score: normaliseScore(data), instrument: data.instrument ?? "legacy" }; }));
    }, () => {});
  }, [db, uid]);
  return history;
}

// 0–100 colour bands.
function scoreColour(score) {
  if (score >= 75) return "#10b981";
  if (score >= 50) return "#14b8a6";
  if (score >= 30) return "#f59e0b";
  return "#fb7185";
}

// ── Small ⓘ toggle explaining how the scoring works (used in the form + panel) ──
function ScoringInfo({ label = null, center = false }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <div className={`flex items-center gap-2 ${center ? "justify-center" : ""}`}>
        {label}
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
          aria-label="How is this scored?"
          className={`inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border transition-colors ${open ? "border-teal-300 bg-teal-50 text-teal-600" : "border-slate-200 text-slate-400 hover:bg-slate-100"}`}>
          <Info size={11} />
        </button>
      </div>
      {open && (
        <div className="mt-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 text-left">
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Each statement is scored from <b>0</b> (at no time) to <b>5</b> (all of the time) for the past
            two weeks, adding up to a personal score out of <b>100</b> — higher just means you've been
            feeling better lately. It's only for your own reflection: it isn't a medical test, a diagnosis,
            or a way to screen for or monitor any condition. Based on the WHO-5 Well-Being Index.
          </p>
        </div>
      )}
    </div>
  );
}

// ── The WHO-5 check-in form (reused by onboarding + the panel) ───────────────────
export function WellbeingCheckin({ onComplete, intro, submitLabel = "See my score" }) {
  const [scores, setScores] = useState(() =>
    Object.fromEntries(WELLBEING_QUESTIONS.map((q) => [q.key, null]))
  );
  const [submitting, setSubmitting] = useState(false);
  const set = (key, val) => setScores((s) => ({ ...s, [key]: Number(val) }));
  const allAnswered = WELLBEING_QUESTIONS.every((q) => scores[q.key] !== null);
  const preview = allAnswered ? computeScore(scores) : null;

  const handleSubmit = async () => {
    if (submitting || !allAnswered) return;
    setSubmitting(true);
    try { await onComplete(scores); } catch (_) {}
    setSubmitting(false);
  };

  return (
    <div className="space-y-4">
      {intro && <p className="text-[13px] text-slate-500 leading-relaxed">{intro}</p>}
      <p className="text-[11px] text-slate-500 leading-relaxed rounded-xl bg-slate-50 border border-slate-100 px-3 py-2">
        A personal check-in to help you notice how you've been feeling — not a medical or diagnostic
        assessment, and not a substitute for advice from a doctor or other health professional. If you're
        worried about your mental health, please speak to your GP or a qualified professional.
      </p>
      <ScoringInfo label={<p className="text-[12px] font-bold uppercase tracking-wide text-teal-600">Over the past two weeks…</p>} />
      {WELLBEING_QUESTIONS.map((q) => (
        <div key={q.key} className="rounded-2xl border border-slate-100 bg-white px-3.5 py-3 shadow-sm">
          <p className="text-sm text-slate-700 leading-snug mb-2">{q.emoji} {q.q}</p>
          <div className="grid grid-cols-6 gap-1">
            {[0, 1, 2, 3, 4, 5].map((v) => {
              const active = scores[q.key] === v;
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => set(q.key, v)}
                  className={`rounded-lg py-1.5 text-sm font-bold tabular-nums transition-colors ${active ? "bg-teal-600 text-white shadow-sm" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
                  {v}
                </button>
              );
            })}
          </div>
          <div className="flex justify-between text-[9px] text-slate-400 mt-1">
            <span>At no time</span><span>All of the time</span>
          </div>
          {scores[q.key] !== null && (
            <p className="text-[10px] font-semibold text-teal-600 mt-0.5 text-center">{WHO5_LABELS[scores[q.key]]}</p>
          )}
        </div>
      ))}
      <div className="flex items-center justify-between rounded-2xl bg-teal-50 border border-teal-100 px-4 py-2.5">
        <span className="text-xs font-semibold text-teal-700">Your score</span>
        <span className="text-lg font-extrabold tabular-nums" style={{ color: preview === null ? "#94a3b8" : scoreColour(preview) }}>
          {preview === null ? "—" : preview}<span className="text-xs text-slate-400">/100</span>
        </span>
      </div>
      <button
        onClick={handleSubmit}
        disabled={submitting || !allAnswered}
        className="w-full rounded-full bg-teal-600 py-3 text-sm font-bold text-white hover:bg-teal-700 transition-colors disabled:opacity-50">
        {submitting ? "Saving…" : allAnswered ? submitLabel : "Answer all five to continue"}
      </button>
      <p className="text-[9px] text-slate-300 text-center">WHO-5 Well-Being Index · © World Health Organization</p>
    </div>
  );
}

// ── Mini trend — one bar per check-in, latest highlighted (0–100) ────────────────
function TrendBars({ history }) {
  if (history.length < 2) return null;
  const recent = history.slice(-12);
  return (
    <div className="flex items-end gap-1 h-16">
      {recent.map((h, i) => {
        const pct = Math.max(4, Math.min(100, h.score ?? 0));
        const last = i === recent.length - 1;
        return (
          <div key={h.id} className="flex-1 rounded-t" title={`${h.score}/100`}
            style={{
              height: `${pct}%`,
              background: last
                ? "linear-gradient(180deg,#0d9488,#10b981)"
                : "linear-gradient(180deg,#99f6e4,#5eead4)",
            }} />
        );
      })}
    </div>
  );
}

// ── The dedicated Wellbeing panel (opened from the ⋯ menu) ───────────────────────
export function WellbeingPanel({ db, currentUser, onClose, onSupport }) {
  const uid = currentUser?.uid;
  const history = useWellbeingHistory(db, uid);
  const [checkingIn, setCheckingIn] = useState(false);

  // Compare like-for-like: the headline baseline→now delta uses WHO-5 entries once we have them.
  const who5 = history.filter((h) => h.instrument === "WHO5");
  const trackForDelta = who5.length >= 1 ? who5 : history;
  const baseline = trackForDelta[0] ?? null;
  const latest = history[history.length - 1] ?? null;
  const current = latest?.score ?? null;
  const showDelta = baseline && latest && trackForDelta.length > 1;
  const delta = showDelta ? Math.round(latest.score - baseline.score) : null;
  const lastAt = latest?.createdAt ?? 0;
  const msSince = Date.now() - lastAt;
  const canRecheck = !latest || msSince >= PERIOD_MS;
  const daysLeft = Math.max(0, Math.ceil((PERIOD_MS - msSince) / DAY_MS));
  const low = isLowWellbeing(current);

  const [saveError, setSaveError] = useState("");
  const handleComplete = async (scores) => {
    try {
      setSaveError("");
      await saveCheckin(db, uid, scores);
    } catch {
      // Five answered questions is real effort — never drop it without saying so.
      setSaveError("Couldn't save your check-in — check your connection and try again.");
      return;
    }
    playCheckIn();
    setCheckingIn(false);
  };

  return createPortal(
    <div data-portal className="fixed inset-0 z-[250] flex flex-col bg-white">
      <div className="seen-overlay-header flex items-center gap-3 border-b border-slate-100 px-4 py-3 flex-shrink-0">
        <button onClick={onClose} className="rounded-full p-1.5 hover:bg-slate-100 transition-colors">
          <ArrowLeft size={18} className="text-slate-600" />
        </button>
        <h2 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
          <TrendingUp size={15} className="text-teal-500" /> Wellbeing check-in
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {saveError && (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-center text-xs font-semibold text-red-600" role="alert">{saveError}</p>
        )}
        {checkingIn ? (
          <WellbeingCheckin
            intro="There are no right answers — just how things have actually been. We'll add this to your trend."
            submitLabel="Save check-in"
            onComplete={handleComplete}
          />
        ) : latest ? (
          <>
            {/* Current score */}
            <div className="seen-grad-cool rounded-2xl bg-gradient-to-br from-teal-50 to-emerald-50 border border-teal-100 px-5 py-5 text-center">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1">How you've been feeling</p>
              <p className="text-5xl font-extrabold tabular-nums" style={{ color: scoreColour(current) }}>{current}<span className="text-lg text-slate-300">/100</span></p>
              {showDelta ? (
                <p className={`text-xs font-semibold mt-1 ${delta > 0 ? "text-emerald-600" : delta < 0 ? "text-rose-500" : "text-slate-400"}`}>
                  {delta > 0 ? `▲ +${delta}` : delta < 0 ? `▼ ${delta}` : "no change"} since your first check-in ({baseline.score})
                </p>
              ) : (
                <p className="text-xs text-slate-400 mt-1">First check-in recorded — your reflections build from here. 🌱</p>
              )}
              <div className="mt-2">
                <ScoringInfo center label={<span className="text-[10px] font-semibold text-slate-400">How is this worked out?</span>} />
              </div>
              <p className="text-[10px] text-slate-400 mt-2 leading-relaxed">
                A personal reflection of how you've been feeling — not a medical test, diagnosis or monitoring tool.
              </p>
            </div>

            {/* Low-wellbeing safeguarding */}
            {low && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                <p className="text-[13px] text-amber-800 leading-snug">
                  Scores like this are really common and they can change. If you'd like a little support, there are
                  gentle tools and people here for you.
                </p>
                <p className="text-[11px] text-amber-700 leading-snug mt-1.5">
                  Seen isn't an emergency service. If you need urgent help, call 999 or NHS 111 (choose the
                  mental-health option). You can talk to Samaritans free any time on 116 123, or text SHOUT to 85258.
                </p>
                {onSupport && (
                  <button onClick={onSupport}
                    className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-amber-500 px-4 py-1.5 text-xs font-bold text-white hover:bg-amber-600 transition-colors">
                    <LifeBuoy size={13} /> Explore support
                  </button>
                )}
              </div>
            )}

            {/* Trend */}
            {history.length > 1 && (
              <div className="rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-sm">
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-2">Your trend</p>
                <TrendBars history={history} />
                <p className="text-[10px] text-slate-400 mt-1 text-center">{history.length} check-ins · every two weeks</p>
              </div>
            )}

            {/* Per-metric (latest vs baseline), WHO-5 items are 0–5 */}
            <div className="rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-sm space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">By dimension</p>
              {WELLBEING_QUESTIONS.map((q) => {
                const now = Number(latest.scores?.[q.key] ?? 0);
                const base = baseline ? Number(baseline.scores?.[q.key] ?? 0) : null;
                const d = base !== null && showDelta ? now - base : null;
                return (
                  <div key={q.key} className="flex items-center gap-2">
                    <span className="text-[12px] w-28 flex-shrink-0 text-slate-600">{q.emoji} {q.metric}</span>
                    <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${now * 20}%`, background: "linear-gradient(90deg,#14b8a6,#10b981)" }} />
                    </div>
                    <span className="text-[11px] font-semibold tabular-nums text-slate-500 w-8 text-right">{now}/5</span>
                    {d !== null && (
                      <span className={`text-[10px] font-semibold w-7 text-right ${d > 0 ? "text-emerald-600" : d < 0 ? "text-rose-500" : "text-slate-300"}`}>
                        {d > 0 ? `+${d}` : d < 0 ? d : "·"}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Re-check */}
            {canRecheck ? (
              <button onClick={() => setCheckingIn(true)}
                className="w-full rounded-full bg-teal-600 py-3 text-sm font-bold text-white hover:bg-teal-700 transition-colors">
                Check in again
              </button>
            ) : (
              <p className="text-center text-xs text-slate-400 py-1">
                Next check-in in {daysLeft} {daysLeft === 1 ? "day" : "days"} — we check in every two weeks so each score reflects a fresh fortnight. 🌱
              </p>
            )}
            <p className="text-[9px] text-slate-300 text-center">WHO-5 Well-Being Index · © World Health Organization</p>
          </>
        ) : (
          /* No baseline yet (existing users) */
          <>
            <p className="text-[13px] text-slate-500 leading-relaxed text-center px-2">
              Take a quick wellbeing check-in to set your baseline. We'll check in every couple of weeks so you can
              see how you're doing over time.
            </p>
            <WellbeingCheckin
              submitLabel="Set my baseline"
              onComplete={handleComplete}
            />
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
