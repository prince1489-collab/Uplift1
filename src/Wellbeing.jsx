// Wellbeing.jsx — a 5-question wellbeing check-in (0–10 each) → a 0–100 Wellbeing Score.
// Captured as a baseline during onboarding, then re-taken weekly so users can watch their
// score trend up as they use the app. Stored per-user at users/{uid}/wellbeing/{id} (private).

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { collection, addDoc, onSnapshot, query, orderBy } from "firebase/firestore";
import { ArrowLeft, Loader2, TrendingUp } from "lucide-react";

export const WELLBEING_QUESTIONS = [
  { key: "happy",        emoji: "😊", metric: "Happiness",     q: "Over the past 7 days, how happy have you generally felt?" },
  { key: "hope",         emoji: "🌱", metric: "Hope",          q: "How hopeful do you feel about your future?" },
  { key: "selfKindness", emoji: "💛", metric: "Self-Kindness", q: "When things don't go as planned, how kind are you to yourself?" },
  { key: "connection",   emoji: "🤝", metric: "Connection",    q: "How connected do you feel to the people around you?" },
  { key: "gratitude",    emoji: "🌞", metric: "Gratitude",     q: "How often do you notice and appreciate the good things in your day?" },
];

export const RECHECK_DAYS = 7;
const WEEK_MS = RECHECK_DAYS * 24 * 60 * 60 * 1000;

// Overall score 0–100 from the five 0–10 answers.
export function computeScore(scores) {
  const sum = WELLBEING_QUESTIONS.reduce((acc, q) => acc + (Number(scores?.[q.key]) || 0), 0);
  return Math.round((sum / (WELLBEING_QUESTIONS.length * 10)) * 100);
}

export async function saveCheckin(db, uid, scores) {
  if (!db || !uid) return;
  await addDoc(collection(db, "users", uid, "wellbeing"), {
    scores, score: computeScore(scores), createdAt: Date.now(),
  });
}

export function useWellbeingHistory(db, uid) {
  const [history, setHistory] = useState([]);
  useEffect(() => {
    if (!db || !uid) return;
    const q = query(collection(db, "users", uid, "wellbeing"), orderBy("createdAt", "asc"));
    return onSnapshot(q, (snap) => {
      setHistory(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, () => {});
  }, [db, uid]);
  return history;
}

function scoreColour(score) {
  if (score >= 75) return "#10b981";
  if (score >= 50) return "#14b8a6";
  if (score >= 30) return "#f59e0b";
  return "#fb7185";
}

// ── The 5-slider check-in form (reused by onboarding + the panel) ────────────────
export function WellbeingCheckin({ onComplete, intro, submitLabel = "See my score" }) {
  const [scores, setScores] = useState(() =>
    Object.fromEntries(WELLBEING_QUESTIONS.map((q) => [q.key, 5]))
  );
  const [submitting, setSubmitting] = useState(false);
  const set = (key, val) => setScores((s) => ({ ...s, [key]: Number(val) }));
  const preview = computeScore(scores);

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    try { await onComplete(scores); } catch (_) {}
    setSubmitting(false);
  };

  return (
    <div className="space-y-4">
      {intro && <p className="text-[13px] text-slate-500 leading-relaxed">{intro}</p>}
      {WELLBEING_QUESTIONS.map((q) => (
        <div key={q.key} className="rounded-2xl border border-slate-100 bg-white px-3.5 py-3 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{q.emoji} {q.metric}</span>
            <span className="text-sm font-extrabold text-teal-600 tabular-nums">{scores[q.key]}</span>
          </div>
          <p className="text-sm text-slate-700 leading-snug mb-2">{q.q}</p>
          <input
            type="range" min={0} max={10} step={1}
            value={scores[q.key]}
            onChange={(e) => set(q.key, e.target.value)}
            className="w-full accent-teal-600"
          />
          <div className="flex justify-between text-[9px] text-slate-400 mt-0.5">
            <span>Not at all</span><span>Always</span>
          </div>
        </div>
      ))}
      <div className="flex items-center justify-between rounded-2xl bg-teal-50 border border-teal-100 px-4 py-2.5">
        <span className="text-xs font-semibold text-teal-700">Your score</span>
        <span className="text-lg font-extrabold tabular-nums" style={{ color: scoreColour(preview) }}>{preview}<span className="text-xs text-slate-400">/100</span></span>
      </div>
      <button
        onClick={handleSubmit}
        disabled={submitting}
        className="w-full rounded-full bg-teal-600 py-3 text-sm font-bold text-white hover:bg-teal-700 transition-colors disabled:opacity-50">
        {submitting ? "Saving…" : submitLabel}
      </button>
    </div>
  );
}

// ── Mini trend — one bar per check-in, latest highlighted ────────────────────────
function TrendBars({ history }) {
  if (history.length < 2) return null;
  const recent = history.slice(-12);
  return (
    <div className="flex items-end gap-1 h-16">
      {recent.map((h, i) => {
        const pct = Math.max(4, h.score ?? 0);
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
export function WellbeingPanel({ db, currentUser, onClose }) {
  const uid = currentUser?.uid;
  const history = useWellbeingHistory(db, uid);
  const [checkingIn, setCheckingIn] = useState(false);

  const baseline = history[0] ?? null;
  const latest = history[history.length - 1] ?? null;
  const current = latest?.score ?? null;
  const delta = baseline && latest ? latest.score - baseline.score : null;
  const lastAt = latest?.createdAt ?? 0;
  const msSince = Date.now() - lastAt;
  const canRecheck = !latest || msSince >= WEEK_MS;
  const daysLeft = Math.max(0, Math.ceil((WEEK_MS - msSince) / (24 * 60 * 60 * 1000)));

  const handleComplete = async (scores) => {
    await saveCheckin(db, uid, scores);
    setCheckingIn(false);
  };

  return createPortal(
    <div data-portal className="fixed inset-0 z-[250] flex flex-col bg-white">
      <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 flex-shrink-0">
        <button onClick={onClose} className="rounded-full p-1.5 hover:bg-slate-100 transition-colors">
          <ArrowLeft size={18} className="text-slate-600" />
        </button>
        <h2 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
          <TrendingUp size={15} className="text-teal-500" /> Wellbeing Score
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {checkingIn ? (
          <WellbeingCheckin
            intro="Answer honestly — there are no right answers. We'll add this to your trend."
            submitLabel="Save check-in"
            onComplete={handleComplete}
          />
        ) : latest ? (
          <>
            {/* Current score */}
            <div className="rounded-2xl bg-gradient-to-br from-teal-50 to-emerald-50 border border-teal-100 px-5 py-5 text-center">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1">Your wellbeing score</p>
              <p className="text-5xl font-extrabold tabular-nums" style={{ color: scoreColour(current) }}>{current}<span className="text-lg text-slate-300">/100</span></p>
              {delta !== null && history.length > 1 && (
                <p className={`text-xs font-semibold mt-1 ${delta > 0 ? "text-emerald-600" : delta < 0 ? "text-rose-500" : "text-slate-400"}`}>
                  {delta > 0 ? `▲ +${delta}` : delta < 0 ? `▼ ${delta}` : "no change"} since your baseline ({baseline.score})
                </p>
              )}
            </div>

            {/* Trend */}
            {history.length > 1 && (
              <div className="rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-sm">
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-2">Your trend</p>
                <TrendBars history={history} />
                <p className="text-[10px] text-slate-400 mt-1 text-center">{history.length} check-ins</p>
              </div>
            )}

            {/* Per-metric (latest vs baseline) */}
            <div className="rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-sm space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">By dimension</p>
              {WELLBEING_QUESTIONS.map((q) => {
                const now = Number(latest.scores?.[q.key] ?? 0);
                const base = baseline ? Number(baseline.scores?.[q.key] ?? 0) : null;
                const d = base !== null ? now - base : null;
                return (
                  <div key={q.key} className="flex items-center gap-2">
                    <span className="text-[12px] w-28 flex-shrink-0 text-slate-600">{q.emoji} {q.metric}</span>
                    <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${now * 10}%`, background: "linear-gradient(90deg,#14b8a6,#10b981)" }} />
                    </div>
                    <span className="text-[11px] font-semibold tabular-nums text-slate-500 w-6 text-right">{now}</span>
                    {d !== null && history.length > 1 && (
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
                Next check-in available in {daysLeft} {daysLeft === 1 ? "day" : "days"} — come back then to keep your trend going. 🌱
              </p>
            )}
          </>
        ) : (
          /* No baseline yet (existing users) */
          <>
            <p className="text-[13px] text-slate-500 leading-relaxed text-center px-2">
              Take a quick wellbeing check-in to set your baseline. We'll check in weekly so you can see
              how you're doing over time.
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
