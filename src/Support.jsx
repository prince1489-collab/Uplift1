import React, { useState } from "react";
import { CONDITIONS, QUESTIONNAIRES, getResources, getAffiliateApps, COPING_TIPS } from "./SupportData";

// ── Screen identifiers ────────────────────────────────────────────────────────
// landing → assessment → results → resources

function ProgressDots({ total, current }) {
  return (
    <div className="flex gap-1.5 justify-center my-2">
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className="rounded-full transition-all duration-300"
          style={{
            width: i === current ? 20 : 8,
            height: 8,
            background: i <= current ? "#14b8a6" : "#e2e8f0",
          }}
        />
      ))}
    </div>
  );
}

// ── Landing: pick condition ───────────────────────────────────────────────────
function LandingScreen({ onSelect }) {
  return (
    <div className="flex flex-col h-full overflow-y-auto px-4 py-5">
      <div className="text-center mb-6">
        <span className="text-4xl">💚</span>
        <h2 className="text-xl font-bold text-slate-800 mt-2">How can we support you?</h2>
        <p className="text-sm text-slate-500 mt-1">
          Select what resonates most — you'll get a short check-in and personalised next steps.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {CONDITIONS.map((c) => (
          <button
            key={c.id}
            onClick={() => onSelect(c)}
            className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-white px-4 py-3.5 text-left shadow-sm active:scale-[0.98] transition-transform"
          >
            <span
              className="text-2xl w-10 h-10 flex items-center justify-center rounded-xl flex-shrink-0"
              style={{ background: `${c.color}18` }}
            >
              {c.emoji}
            </span>
            <div>
              <p className="font-semibold text-slate-800 text-sm">{c.label}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">{c.description}</p>
            </div>
          </button>
        ))}
      </div>

      <p className="text-[10px] text-center text-slate-400 mt-6 px-2">
        All responses stay on your device. Nothing is shared or stored.
      </p>
    </div>
  );
}

// ── Assessment ────────────────────────────────────────────────────────────────
function AssessmentScreen({ condition, onDone, onBack }) {
  const qKey = condition.questionnaire;
  const q = QUESTIONNAIRES[qKey];
  const [answers, setAnswers] = useState(Array(q.questions.length).fill(null));
  const [current, setCurrent] = useState(0);
  const [showCrisisAlert, setShowCrisisAlert] = useState(false);

  const answer = (score) => {
    const next = [...answers];
    next[current] = score;
    setAnswers(next);

    // Crisis check on PHQ-9 Q9
    if (q.crisisQuestion === current && score >= q.crisisThreshold) {
      setShowCrisisAlert(true);
      return;
    }

    if (current < q.questions.length - 1) {
      setCurrent(current + 1);
    } else {
      onDone(next);
    }
  };

  const continueCrisis = () => {
    setShowCrisisAlert(false);
    if (current < q.questions.length - 1) {
      setCurrent(current + 1);
    } else {
      onDone(answers);
    }
  };

  if (showCrisisAlert) {
    return (
      <div className="flex flex-col h-full px-4 py-8 items-center justify-center text-center">
        <span className="text-5xl mb-4">🆘</span>
        <h2 className="text-xl font-bold text-red-600 mb-2">You're not alone</h2>
        <p className="text-sm text-slate-700 mb-6">
          If you're having thoughts of harming yourself, please reach out right now. You matter, and help is available.
        </p>
        <div className="w-full space-y-3 mb-6">
          <a
            href="tel:116123"
            className="flex items-center gap-3 rounded-2xl bg-red-50 border border-red-200 px-4 py-3 w-full"
          >
            <span className="text-xl">📞</span>
            <div className="text-left">
              <p className="font-bold text-red-700 text-sm">Call Samaritans (UK)</p>
              <p className="text-xs text-red-500">116 123 — free, 24/7</p>
            </div>
          </a>
          <a
            href="sms:85258?body=SHOUT"
            className="flex items-center gap-3 rounded-2xl bg-red-50 border border-red-200 px-4 py-3 w-full"
          >
            <span className="text-xl">💬</span>
            <div className="text-left">
              <p className="font-bold text-red-700 text-sm">Text SHOUT to 85258 (UK)</p>
              <p className="text-xs text-red-500">Free crisis text line, 24/7</p>
            </div>
          </a>
          <a
            href="tel:988"
            className="flex items-center gap-3 rounded-2xl bg-red-50 border border-red-200 px-4 py-3 w-full"
          >
            <span className="text-xl">📞</span>
            <div className="text-left">
              <p className="font-bold text-red-700 text-sm">Call 988 (US)</p>
              <p className="text-xs text-red-500">Suicide & Crisis Lifeline, 24/7</p>
            </div>
          </a>
        </div>
        <button
          onClick={continueCrisis}
          className="text-sm text-slate-500 underline"
        >
          Continue assessment
        </button>
      </div>
    );
  }

  const progress = current / q.questions.length;

  return (
    <div className="flex flex-col h-full px-4 py-5">
      <div className="flex items-center gap-2 mb-4">
        <button onClick={onBack} className="text-slate-400 hover:text-slate-600 p-1">
          ←
        </button>
        <div className="flex-1">
          <p className="text-[11px] font-medium text-slate-400">{q.title}</p>
          <div className="mt-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${progress * 100}%`, background: "#14b8a6" }}
            />
          </div>
        </div>
        <span className="text-xs text-slate-400">{current + 1}/{q.questions.length}</span>
      </div>

      <div className="flex-1 flex flex-col justify-center">
        <p className="text-[11px] text-slate-400 mb-3">{q.instruction}</p>

        <div className="rounded-2xl bg-white border border-slate-100 shadow-sm p-5 mb-6">
          <p className="text-base font-semibold text-slate-800 leading-snug">
            {q.questions[current]}
          </p>
        </div>

        <div className="flex flex-col gap-2.5">
          {q.options.map((opt, i) => (
            <button
              key={i}
              onClick={() => answer(q.scores[i])}
              className="rounded-2xl border border-slate-200 bg-white py-3 px-4 text-sm text-slate-700 text-left font-medium active:scale-[0.98] hover:border-teal-300 hover:bg-teal-50 transition-all"
            >
              {opt}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Results ───────────────────────────────────────────────────────────────────
function ResultsScreen({ condition, answers, onViewResources, onBack }) {
  const qKey = condition.questionnaire;
  const q = QUESTIONNAIRES[qKey];

  let conditionId = condition.id;
  let severity = null;
  let totalScore = null;

  if (qKey === "TRIAGE") {
    conditionId = q.triage(answers);
    const resolvedCondition = CONDITIONS.find(c => c.id === conditionId);
    const resolvedQ = QUESTIONNAIRES[{ depression: "PHQ-9", anxiety: "GAD-7", loneliness: "UCLA-3", stress: "PSS-4", burnout: "BURNOUT-5" }[conditionId]];
    severity = resolvedQ ? { level: "moderate", label: "Moderate", color: "#f59e0b" } : null;
  } else {
    totalScore = q.score(answers);
    severity = q.severity(totalScore);
  }

  const tips = COPING_TIPS[conditionId]?.[severity?.level] || [];
  const conditionLabel = CONDITIONS.find(c => c.id === conditionId)?.label || condition.label;

  return (
    <div className="flex flex-col h-full overflow-y-auto px-4 py-5">
      <div className="flex items-center gap-2 mb-4">
        <button onClick={onBack} className="text-slate-400 hover:text-slate-600 p-1">←</button>
        <p className="text-sm font-semibold text-slate-700">Your results</p>
      </div>

      {/* Score card */}
      <div
        className="rounded-2xl p-5 mb-4 text-white"
        style={{ background: `linear-gradient(135deg, ${severity?.color}dd, ${severity?.color})` }}
      >
        <p className="text-xs font-semibold opacity-80 mb-1">{conditionLabel}</p>
        <p className="text-3xl font-bold mb-0.5">{severity?.label}</p>
        {totalScore !== null && (
          <p className="text-xs opacity-70">Score: {totalScore}</p>
        )}
        <p className="text-xs opacity-80 mt-2">
          {severity?.level === "minimal" || severity?.level === "low"
            ? "You're doing well. Keep nurturing these habits."
            : severity?.level === "mild"
            ? "A few changes could make a real difference. You've got this."
            : severity?.level === "moderate"
            ? "It's worth taking this seriously. Support is available."
            : "Please don't face this alone. Professional support can help."}
        </p>
      </div>

      {/* Coping tips */}
      {tips.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Steps you can take now</p>
          <div className="flex flex-col gap-2">
            {tips.map((tip, i) => (
              <div key={i} className="flex items-start gap-2.5 rounded-xl bg-white border border-slate-100 shadow-sm px-3.5 py-3">
                <span className="text-teal-500 font-bold text-sm flex-shrink-0 mt-0.5">✓</span>
                <p className="text-sm text-slate-700">{tip}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={() => onViewResources(conditionId, severity)}
        className="w-full rounded-2xl py-3.5 text-sm font-bold text-white transition-all active:scale-[0.98]"
        style={{ background: "linear-gradient(135deg, #14b8a6, #0d9488)" }}
      >
        See resources &amp; apps →
      </button>

      <p className="text-[10px] text-center text-slate-400 mt-4">
        This is a screening tool, not a diagnosis. If you're concerned, please speak to a healthcare professional.
      </p>
    </div>
  );
}

// ── Resources ─────────────────────────────────────────────────────────────────
function ResourcesScreen({ conditionId, severity, country, onBack, onRestart }) {
  const resources = getResources(country);
  const apps = getAffiliateApps(conditionId);
  const isSevere = ["severe", "moderateSevere", "high"].includes(severity?.level);

  return (
    <div className="flex flex-col h-full overflow-y-auto px-4 py-5">
      <div className="flex items-center gap-2 mb-4">
        <button onClick={onBack} className="text-slate-400 hover:text-slate-600 p-1">←</button>
        <p className="text-sm font-semibold text-slate-700">Support &amp; Resources</p>
      </div>

      {/* Crisis section for severe scores */}
      {isSevere && resources.crisis?.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-bold text-red-500 uppercase tracking-wide mb-2">If you need help right now</p>
          <div className="flex flex-col gap-2">
            {resources.crisis.map((r, i) => (
              <a
                key={i}
                href={r.phone ? `tel:${r.phone.replace(/\s/g, "")}` : r.url}
                target={r.phone ? undefined : "_blank"}
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-2xl bg-red-50 border border-red-200 px-4 py-3"
              >
                <span className="text-xl">{r.phone ? "📞" : "🌐"}</span>
                <div>
                  <p className="font-bold text-red-700 text-sm">{r.name}</p>
                  {r.phone && <p className="text-xs text-red-500">{r.phone}</p>}
                  {r.free && <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 rounded px-1">FREE</span>}
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Professional support */}
      {resources.mental?.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Professional support{country ? ` in ${country}` : ""}</p>
          <div className="flex flex-col gap-2">
            {resources.mental.map((r, i) => (
              <a
                key={i}
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between rounded-2xl bg-white border border-slate-100 shadow-sm px-4 py-3"
              >
                <div>
                  <p className="font-semibold text-slate-800 text-sm">{r.name}</p>
                  {r.phone && <p className="text-xs text-slate-400">{r.phone}</p>}
                </div>
                <span className="text-slate-300 text-lg">→</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Affiliate apps */}
      {apps.length > 0 && (
        <div className="mb-6">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Apps that can help</p>
          <div className="flex flex-col gap-2">
            {apps.map((app) => (
              <a
                key={app.id}
                href={app.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3.5 rounded-2xl bg-white border border-slate-100 shadow-sm px-4 py-3"
              >
                <span
                  className="text-2xl w-10 h-10 flex items-center justify-center rounded-xl flex-shrink-0"
                  style={{ background: `${app.color}18` }}
                >
                  {app.emoji}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-slate-800 text-sm">{app.name}</p>
                    <span
                      className="text-[10px] font-bold rounded px-1.5 py-0.5 flex-shrink-0"
                      style={{ background: `${app.color}18`, color: app.color }}
                    >
                      {app.badge}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 truncate">{app.tagline}</p>
                </div>
                <span className="text-slate-300 text-lg">→</span>
              </a>
            ))}
          </div>
          <p className="text-[10px] text-slate-400 mt-2 text-center">
            Some links may be affiliate links — they don't cost you anything extra.
          </p>
        </div>
      )}

      <button
        onClick={onRestart}
        className="w-full rounded-2xl py-3 text-sm font-semibold text-teal-600 border border-teal-200 bg-teal-50 active:scale-[0.98] transition-transform"
      >
        Check in again
      </button>
    </div>
  );
}

// ── Main Support component ────────────────────────────────────────────────────
export default function Support({ country }) {
  const [screen, setScreen] = useState("landing");   // landing | assessment | results | resources
  const [selectedCondition, setSelectedCondition] = useState(null);
  const [assessmentAnswers, setAssessmentAnswers] = useState(null);
  const [resolvedConditionId, setResolvedConditionId] = useState(null);
  const [resolvedSeverity, setResolvedSeverity] = useState(null);

  const handleSelectCondition = (condition) => {
    setSelectedCondition(condition);
    setScreen("assessment");
  };

  const handleAssessmentDone = (answers) => {
    setAssessmentAnswers(answers);
    setScreen("results");
  };

  const handleViewResources = (condId, sev) => {
    setResolvedConditionId(condId);
    setResolvedSeverity(sev);
    setScreen("resources");
  };

  const restart = () => {
    setScreen("landing");
    setSelectedCondition(null);
    setAssessmentAnswers(null);
    setResolvedConditionId(null);
    setResolvedSeverity(null);
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-slate-50/60">
      {screen === "landing" && (
        <LandingScreen onSelect={handleSelectCondition} />
      )}
      {screen === "assessment" && selectedCondition && (
        <AssessmentScreen
          condition={selectedCondition}
          onDone={handleAssessmentDone}
          onBack={() => setScreen("landing")}
        />
      )}
      {screen === "results" && selectedCondition && assessmentAnswers && (
        <ResultsScreen
          condition={selectedCondition}
          answers={assessmentAnswers}
          onViewResources={handleViewResources}
          onBack={() => setScreen("assessment")}
        />
      )}
      {screen === "resources" && (
        <ResourcesScreen
          conditionId={resolvedConditionId}
          severity={resolvedSeverity}
          country={country}
          onBack={() => setScreen("results")}
          onRestart={restart}
        />
      )}
    </div>
  );
}
