// Journal.jsx — a private gratitude & kindness journal.
// Users log entries of two types: "Grateful" (thankful for something) or "Kindness"
// (an act of kindness given/received), each with a date, building a log over time.
// Stored per-user at users/{uid}/journal/{entryId} (private to the owner).

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc } from "firebase/firestore";
import { ArrowLeft, Trash2, BookOpen, Flame } from "lucide-react";
import { useSparkCounter } from "./MicroAnimations";

const TYPES = [
  { id: "grateful", label: "Grateful", emoji: "🙏", color: "#f59e0b", placeholder: "What are you grateful for today?" },
  { id: "kindness", label: "Kindness", emoji: "💚", color: "#10b981", placeholder: "Describe an act of kindness you gave or received." },
];

const MILESTONES = [1, 3, 7, 14, 30, 50, 100];

function pad(n) { return String(n).padStart(2, "0"); }
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function fmtDate(s) {
  try {
    const [y, m, d] = String(s).split("-").map(Number);
    if (!y || !m || !d) return s;
    return new Date(y, m - 1, d).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
  } catch { return s; }
}

// Current streak = consecutive days (ending today or yesterday) with ≥1 entry.
function computeStreak(dateSet) {
  if (!dateSet.size) return 0;
  const key = (dt) => `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
  const d = new Date();
  if (!dateSet.has(key(d))) d.setDate(d.getDate() - 1); // grace: today not done yet
  let streak = 0;
  while (dateSet.has(key(d))) { streak++; d.setDate(d.getDate() - 1); }
  return streak;
}

// ── Celebration confetti (reuses the global seenConfettiFall keyframe) ───────────
function Confetti() {
  const colors = ["#f59e0b", "#10b981", "#14b8a6", "#fb7185", "#a78bfa", "#fbbf24"];
  return (
    <div className="pointer-events-none fixed inset-0 z-[320] overflow-hidden">
      {Array.from({ length: 28 }).map((_, i) => {
        const left = Math.random() * 100;
        const delay = Math.random() * 0.3;
        const dur = 1.2 + Math.random() * 0.8;
        const rot = Math.random() * 720 - 360;
        const size = 6 + Math.random() * 6;
        return (
          <span key={i} style={{
            position: "absolute", top: "-6%", left: `${left}%`,
            width: size, height: size * 0.6, background: colors[i % colors.length],
            borderRadius: 2, "--rot": `${rot}deg`,
            animation: `seenConfettiFall ${dur}s cubic-bezier(0.3,0.7,0.5,1) ${delay}s forwards`,
          }} />
        );
      })}
    </div>
  );
}

// ── Month heatmap of journaling days ─────────────────────────────────────────────
function MonthHeatmap({ counts }) {
  const now = new Date();
  const year = now.getFullYear(), month = now.getMonth();
  const startWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = now.getDate();
  const tint = (c) => (c >= 3 ? "#0d9488" : c === 2 ? "#2dd4bf" : c === 1 ? "#99f6e4" : "#f1f5f9");
  const keyFor = (d) => `${year}-${pad(month + 1)}-${pad(d)}`;
  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="rounded-2xl border border-slate-100 bg-white px-3 py-3 shadow-sm">
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-2">
        {now.toLocaleDateString([], { month: "long" })} · your rhythm
      </p>
      <div className="grid grid-cols-7 gap-1">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <span key={`h${i}`} className="text-[8px] text-center text-slate-300">{d}</span>
        ))}
        {cells.map((d, i) => d === null ? <span key={`b${i}`} /> : (
          <div key={d} title={`${counts[keyFor(d)] || 0} on ${d}`}
            className="aspect-square rounded-[4px] flex items-center justify-center text-[8px] font-semibold"
            style={{
              background: tint(counts[keyFor(d)] || 0),
              color: (counts[keyFor(d)] || 0) >= 2 ? "#fff" : "#94a3b8",
              outline: d === today ? "2px solid #0d9488" : "none",
              outlineOffset: "-2px",
            }}>
            {d}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function JournalPanel({ db, currentUser, onClose }) {
  const uid = currentUser?.uid;
  const [type, setType] = useState("grateful");
  const [date, setDate] = useState(todayStr());
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [entries, setEntries] = useState([]);
  const [celebrate, setCelebrate] = useState(false);
  const prevCount = useRef(null);

  useEffect(() => {
    if (!db || !uid) return;
    const q = query(collection(db, "users", uid, "journal"), orderBy("createdAt", "desc"));
    return onSnapshot(q, (snap) => {
      setEntries(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, () => {});
  }, [db, uid]);

  // Milestone confetti — fire when the total crosses a milestone (not on first load).
  useEffect(() => {
    const n = entries.length;
    if (prevCount.current === null) { prevCount.current = n; return; }
    if (n > prevCount.current && MILESTONES.includes(n)) {
      setCelebrate(true);
      const t = setTimeout(() => setCelebrate(false), 1700);
      prevCount.current = n;
      return () => clearTimeout(t);
    }
    prevCount.current = n;
  }, [entries.length]);

  const activeType = TYPES.find((t) => t.id === type) ?? TYPES[0];

  // Derived stats
  const counts = {};
  let gratefulCount = 0, kindnessCount = 0;
  const dateSet = new Set();
  entries.forEach((e) => {
    if (e.date) { counts[e.date] = (counts[e.date] || 0) + 1; dateSet.add(e.date); }
    if (e.type === "kindness") kindnessCount++; else gratefulCount++;
  });
  const streak = computeStreak(dateSet);
  const { displayed: totalDisp } = useSparkCounter(entries.length);

  const handleSave = async () => {
    const trimmed = text.trim();
    if (!trimmed || saving || !db || !uid) return;
    setSaving(true);
    try {
      await addDoc(collection(db, "users", uid, "journal"), { type, text: trimmed, date, createdAt: Date.now() });
      setText("");
    } catch (_) { /* best-effort */ }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    if (!db || !uid) return;
    try { await deleteDoc(doc(db, "users", uid, "journal", id)); } catch (_) {}
  };

  return createPortal(
    <div data-portal className="fixed inset-0 z-[250] flex flex-col bg-white">
      {celebrate && <Confetti />}
      <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 flex-shrink-0">
        <button onClick={onClose} className="rounded-full p-1.5 hover:bg-slate-100 transition-colors">
          <ArrowLeft size={18} className="text-slate-600" />
        </button>
        <h2 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
          <BookOpen size={15} className="text-teal-500" /> Journal
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Stats & streak header */}
        {entries.length > 0 && (
          <div className="rounded-2xl bg-gradient-to-br from-amber-50 to-emerald-50 border border-amber-100 px-4 py-3">
            <div className="flex items-center">
              <div className="flex-1 text-center">
                <p className="text-2xl font-extrabold text-slate-800 tabular-nums">{totalDisp}</p>
                <p className="text-[10px] text-slate-500">entries</p>
              </div>
              <div className="flex-1 text-center">
                <div className="inline-flex items-center justify-center gap-1 rounded-full px-2 py-0.5"
                  style={streak > 0 ? { animation: "seenStreakPulse 2.2s ease 1" } : undefined}>
                  <Flame size={16} className="text-orange-400" />
                  <span className="text-2xl font-extrabold text-orange-500 tabular-nums">{streak}</span>
                </div>
                <p className="text-[10px] text-slate-500">day streak</p>
              </div>
              <div className="flex-1 text-center">
                <p className="text-sm font-bold text-slate-700">🙏 {gratefulCount} · 💚 {kindnessCount}</p>
                <p className="text-[10px] text-slate-500">grateful · kindness</p>
              </div>
            </div>
          </div>
        )}

        {/* Heatmap */}
        {entries.length > 0 && <MonthHeatmap counts={counts} />}

        {/* New entry */}
        <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-3 space-y-3">
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Build a log of gratitude and kindness over time. Pick a type, choose a date, and write your entry.
          </p>
          <div className="flex gap-2">
            {TYPES.map((t) => (
              <button
                key={t.id}
                onClick={() => setType(t.id)}
                className={`flex-1 rounded-xl py-2 text-sm font-semibold border transition-all ${
                  type === t.id ? "border-transparent text-white" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                }`}
                style={type === t.id ? { background: t.color } : undefined}>
                {t.emoji} {t.label}
              </button>
            ))}
          </div>
          <input
            type="date"
            value={date}
            max={todayStr()}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-teal-400 focus:outline-none"
          />
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            placeholder={activeType.placeholder}
            className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 focus:border-teal-400 focus:outline-none"
          />
          <button
            onClick={handleSave}
            disabled={saving || !text.trim()}
            className="w-full rounded-full bg-teal-600 py-2.5 text-sm font-bold text-white hover:bg-teal-700 transition-colors disabled:opacity-50">
            {saving ? "Saving…" : "Add entry"}
          </button>
        </div>

        {/* Log */}
        <div>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2">Your entries</p>
          {entries.length === 0 ? (
            <p className="text-center text-xs text-slate-400 py-6 leading-relaxed">
              No entries yet.<br />Start your gratitude &amp; kindness log above. 🌱
            </p>
          ) : (
            <div className="space-y-2">
              {entries.map((e) => {
                const t = TYPES.find((x) => x.id === e.type) ?? TYPES[0];
                return (
                  <div key={e.id} className="rounded-2xl border border-slate-100 bg-white shadow-sm px-3.5 py-3 relative overflow-hidden"
                    style={{ animation: "seenFadeUp 300ms ease both" }}>
                    <span aria-hidden className="absolute -right-2 -bottom-3 text-5xl opacity-[0.06] select-none">{t.emoji}</span>
                    <div className="flex items-center justify-between mb-1 relative">
                      <span className="text-[11px] font-bold rounded-full px-2 py-0.5" style={{ background: `${t.color}18`, color: t.color }}>
                        {t.emoji} {t.label}
                      </span>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-[10px] text-slate-400">{fmtDate(e.date)}</span>
                        <button onClick={() => handleDelete(e.id)} title="Delete" className="text-slate-300 hover:text-red-400 transition-colors">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                    <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed relative">{e.text}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
