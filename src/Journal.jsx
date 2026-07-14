// Journal.jsx — a private gratitude & kindness journal.
// Users log entries of two types: "Grateful" (thankful for something) or "Kindness"
// (an act of kindness given/received), each with a date, building a log over time.
// Framed as a GENTLE FEW-TIMES-A-WEEK reflective practice (research shows daily gratitude
// journaling habituates and that guilt-driven daily streaks cause drop-off), with rotating
// specific prompts and an "on this day" resurfacing card. Stored per-user at
// users/{uid}/journal/{entryId} (private to the owner).

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc } from "firebase/firestore";
import { playCheckIn } from "./sounds";
import { ArrowLeft, Trash2, BookOpen, Sprout, History, ChevronRight, Folder } from "lucide-react";
import { useSparkCounter } from "./MicroAnimations";
import { pickDailyPrompt } from "./JournalPrompts";

const TYPES = [
  { id: "grateful", label: "Grateful", emoji: "🙏", color: "#f59e0b" },
  { id: "kindness", label: "Kindness", emoji: "💚", color: "#10b981" },
];

const WEEKLY_GOAL = 3; // a gentle "few times a week" target — never punitive
const WEEKS_ACTIVE_MILESTONES = [4, 8, 12, 26, 52];

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

// ── Week helpers (Monday-anchored) ───────────────────────────────────────────────
function weekStartKey(y, m, d) {
  const dt = new Date(y, m, d);
  const mondayOffset = (dt.getDay() + 6) % 7; // Mon=0 … Sun=6
  dt.setDate(dt.getDate() - mondayOffset);
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}
function weekKeyFromStr(s) {
  const [y, m, d] = String(s).split("-").map(Number);
  if (!y || !m || !d) return null;
  return weekStartKey(y, m - 1, d);
}
function currentWeekStartKey() {
  const n = new Date();
  return weekStartKey(n.getFullYear(), n.getMonth(), n.getDate());
}
// Weeks active = consecutive weeks (ending this week, or last week if this week is empty —
// the current week is never counted against you) that contain ≥1 entry.
function computeWeeksActive(weekSet) {
  if (!weekSet.size) return 0;
  const cur = new Date();
  cur.setDate(cur.getDate() - ((cur.getDay() + 6) % 7)); // Monday of this week
  const key = (dt) => `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
  if (!weekSet.has(key(cur))) cur.setDate(cur.getDate() - 7); // grace: this week not done yet
  let n = 0;
  while (weekSet.has(key(cur))) { n++; cur.setDate(cur.getDate() - 7); }
  return n;
}

// Pick a past entry to resurface: prefer the same month/day in a previous year ("On this day");
// otherwise the entry closest to ~1 month ago ("A while back"). Hide if nothing older than 14 days.
function pickOnThisDay(entries) {
  const valid = entries.filter((e) => e.date && /^\d{4}-\d{2}-\d{2}$/.test(e.date));
  if (!valid.length) return null;
  const now = new Date();
  const mmdd = `${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const ms = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d).getTime(); };

  const sameDay = valid
    .filter((e) => e.date.slice(5) === mmdd && Number(e.date.slice(0, 4)) < now.getFullYear())
    .sort((a, b) => b.date.localeCompare(a.date));
  if (sameDay.length) return { entry: sameDay[0], label: "On this day" };

  const older = valid.filter((e) => now.getTime() - ms(e.date) > 14 * 86400000);
  if (!older.length) return null;
  const target = now.getTime() - 30 * 86400000;
  older.sort((a, b) => Math.abs(ms(a.date) - target) - Math.abs(ms(b.date) - target));
  return { entry: older[0], label: "A while back" };
}

// ── Folder grouping: Year → Month → "Week N" (week-of-month = ceil(day/7)) ───────
function entryDateObj(e) {
  if (e.date && /^\d{4}-\d{2}-\d{2}$/.test(e.date)) {
    const [y, m, d] = e.date.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  return e.createdAt ? new Date(e.createdAt) : null;
}
function monthName(mo) { return new Date(2000, mo, 1).toLocaleDateString([], { month: "long" }); }
// entries arrive already sorted newest-first; the nested arrays stay in that order.
function buildFolders(entries) {
  const years = new Map(); // year → Map(monthIdx → Map(weekOfMonth → entries[]))
  for (const e of entries) {
    const d = entryDateObj(e);
    if (!d) continue;
    const y = d.getFullYear(), mo = d.getMonth(), wk = Math.ceil(d.getDate() / 7);
    if (!years.has(y)) years.set(y, new Map());
    const months = years.get(y);
    if (!months.has(mo)) months.set(mo, new Map());
    const weeks = months.get(mo);
    if (!weeks.has(wk)) weeks.set(wk, []);
    weeks.get(wk).push(e);
  }
  const sumWeeks = (weeks) => [...weeks.values()].reduce((a, arr) => a + arr.length, 0);
  return [...years.keys()].sort((a, b) => b - a).map((y) => {
    const months = years.get(y);
    return {
      key: `y${y}`, label: String(y),
      count: [...months.values()].reduce((a, w) => a + sumWeeks(w), 0),
      months: [...months.keys()].sort((a, b) => b - a).map((mo) => {
        const weeks = months.get(mo);
        return {
          key: `y${y}-m${mo}`, label: monthName(mo), count: sumWeeks(weeks),
          weeks: [...weeks.keys()].sort((a, b) => b - a).map((wk) => ({
            key: `y${y}-m${mo}-w${wk}`, label: `Week ${wk}`, entries: weeks.get(wk),
          })),
        };
      }),
    };
  });
}
function FolderRow({ open, onClick, label, count }) {
  return (
    <button onClick={onClick}
      className="w-full flex items-center gap-1.5 rounded-lg px-2 py-1.5 hover:bg-slate-50 transition-colors">
      <ChevronRight size={13} className={`text-slate-400 transition-transform ${open ? "rotate-90" : ""}`} />
      <Folder size={13} className="text-amber-400" />
      <span className="text-[12px] font-semibold text-slate-700">{label}</span>
      <span className="ml-auto rounded-full bg-slate-100 px-1.5 text-[10px] font-semibold text-slate-400 tabular-nums">{count}</span>
    </button>
  );
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

// ── Month heatmap — a non-judgemental record of reflection days ──────────────────
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
        {now.toLocaleDateString([], { month: "long" })} · your reflections
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
  const [expandPast, setExpandPast] = useState(false);
  const [openFolders, setOpenFolders] = useState(null); // Set of open folder keys (null → init to newest)
  const prevWeekly = useRef(null);
  const prevWeeks = useRef(null);

  useEffect(() => {
    if (!db || !uid) return;
    const q = query(collection(db, "users", uid, "journal"), orderBy("createdAt", "desc"));
    return onSnapshot(q, (snap) => {
      setEntries(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, () => {});
  }, [db, uid]);

  const activeType = TYPES.find((t) => t.id === type) ?? TYPES[0];
  // Prompt rotates automatically once every 24h (local-midnight day number in JournalPrompts).
  const prompt = pickDailyPrompt(uid, type, 0);

  // Derived stats
  const counts = {};
  let gratefulCount = 0, kindnessCount = 0;
  const dateSet = new Set();
  const weekSet = new Set();
  entries.forEach((e) => {
    if (e.date) {
      counts[e.date] = (counts[e.date] || 0) + 1;
      dateSet.add(e.date);
      const wk = weekKeyFromStr(e.date);
      if (wk) weekSet.add(wk);
    }
    if (e.type === "kindness") kindnessCount++; else gratefulCount++;
  });
  const weeksActive = computeWeeksActive(weekSet);
  const curWeek = currentWeekStartKey();
  const reflectionsThisWeek = entries.filter((e) => e.date && weekKeyFromStr(e.date) === curWeek).length;
  const onThisDay = pickOnThisDay(entries);
  const { displayed: totalDisp } = useSparkCounter(entries.length);

  // Folder tree (Year → Month → Week). Default-open the path to the newest entry.
  const folders = buildFolders(entries);
  const effectiveOpen = openFolders ?? (() => {
    const s = new Set();
    const y = folders[0];
    if (y) { s.add(y.key); const m = y.months[0]; if (m) { s.add(m.key); if (m.weeks[0]) s.add(m.weeks[0].key); } }
    return s;
  })();
  const toggleFolder = (key) => setOpenFolders((prev) => {
    const next = new Set(prev ?? effectiveOpen);
    next.has(key) ? next.delete(key) : next.add(key);
    return next;
  });

  const renderEntry = (e) => {
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
  };

  const fireCelebrate = () => {
    setCelebrate(true);
    setTimeout(() => setCelebrate(false), 1700);
  };

  // Gentle confetti — only on completing the weekly goal, never per-entry.
  useEffect(() => {
    if (prevWeekly.current === null) { prevWeekly.current = reflectionsThisWeek; return; }
    if (reflectionsThisWeek > prevWeekly.current && reflectionsThisWeek === WEEKLY_GOAL) fireCelebrate();
    prevWeekly.current = reflectionsThisWeek;
  }, [reflectionsThisWeek]);

  // …and on reaching a weeks-active milestone.
  useEffect(() => {
    if (prevWeeks.current === null) { prevWeeks.current = weeksActive; return; }
    if (weeksActive > prevWeeks.current && WEEKS_ACTIVE_MILESTONES.includes(weeksActive)) fireCelebrate();
    prevWeeks.current = weeksActive;
  }, [weeksActive]);

  const handleSave = async () => {
    const trimmed = text.trim();
    if (!trimmed || saving || !db || !uid) return;
    setSaving(true);
    try {
      await addDoc(collection(db, "users", uid, "journal"), {
        type, text: trimmed, date, prompt: prompt || null, createdAt: Date.now(),
      });
      setText("");
      playCheckIn();
    } catch (_) { /* best-effort */ }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    if (!db || !uid) return;
    try { await deleteDoc(doc(db, "users", uid, "journal", id)); } catch (_) {}
  };

  const goalPct = Math.min(100, (reflectionsThisWeek / WEEKLY_GOAL) * 100);

  return createPortal(
    <div data-portal className="fixed inset-0 z-[250] flex flex-col bg-white">
      {celebrate && <Confetti />}
      <div className="seen-overlay-header flex items-center gap-3 border-b border-slate-100 px-4 py-3 flex-shrink-0">
        <button onClick={onClose} className="rounded-full p-1.5 hover:bg-slate-100 transition-colors">
          <ArrowLeft size={18} className="text-slate-600" />
        </button>
        <h2 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
          <BookOpen size={15} className="text-teal-500" /> Journal
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Stats & gentle weekly cadence header */}
        {entries.length > 0 && (
          <div className="rounded-2xl bg-gradient-to-br from-amber-50 to-emerald-50 border border-amber-100 px-4 py-3">
            <div className="flex items-center">
              <div className="flex-1 text-center">
                <p className="text-2xl font-extrabold text-slate-800 tabular-nums">{totalDisp}</p>
                <p className="text-[10px] text-slate-500">reflections</p>
              </div>
              <div className="flex-1 text-center">
                <div className="inline-flex items-center justify-center gap-1">
                  <Sprout size={16} className="text-emerald-500" />
                  <span className="text-2xl font-extrabold text-emerald-600 tabular-nums">{weeksActive}</span>
                </div>
                <p className="text-[10px] text-slate-500">{weeksActive === 1 ? "week active" : "weeks active"}</p>
              </div>
              <div className="flex-1 text-center">
                <p className="text-sm font-bold text-slate-700">🙏 {gratefulCount} · 💚 {kindnessCount}</p>
                <p className="text-[10px] text-slate-500">grateful · kindness</p>
              </div>
            </div>
            {/* Gentle weekly goal — encouraging, never punitive */}
            <div className="mt-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-semibold text-slate-500">
                  {reflectionsThisWeek > 0
                    ? `Reflections this week: ${reflectionsThisWeek} of ${WEEKLY_GOAL}`
                    : "A fresh week — whenever you're ready 🌱"}
                </span>
                {reflectionsThisWeek >= WEEKLY_GOAL && <span className="text-[10px] font-bold text-emerald-600">✓ lovely rhythm</span>}
              </div>
              <div className="h-1.5 rounded-full bg-white/70 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-emerald-400 transition-all duration-500" style={{ width: `${goalPct}%` }} />
              </div>
            </div>
          </div>
        )}

        {/* Heatmap */}
        {entries.length > 0 && <MonthHeatmap counts={counts} />}

        {/* On this day — resurface a past reflection */}
        {onThisDay && (
          <button
            onClick={() => setExpandPast((v) => !v)}
            className="w-full text-left rounded-2xl border border-violet-100 bg-violet-50/60 px-4 py-3 transition-colors hover:bg-violet-50">
            <div className="flex items-center gap-1.5 mb-1">
              <History size={13} className="text-violet-400" />
              <p className="text-[10px] font-bold uppercase tracking-wide text-violet-500">{onThisDay.label}</p>
              <span className="text-[10px] text-slate-400 ml-auto">{fmtDate(onThisDay.entry.date)}</span>
            </div>
            <p className={`text-sm text-slate-700 whitespace-pre-wrap leading-relaxed ${expandPast ? "" : "line-clamp-2"}`}>
              {onThisDay.entry.text}
            </p>
          </button>
        )}

        {/* New entry */}
        <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-3 space-y-3">
          <p className="text-[11px] text-slate-500 leading-relaxed">
            A gentle space for gratitude and kindness — a few times a week is plenty. Pick a type and write what comes.
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

          {/* Today's prompt — refreshes automatically once a day */}
          <div className="rounded-xl bg-white border border-slate-200 px-3 py-2.5">
            <p className="text-[10px] font-bold uppercase tracking-wide text-teal-600">Today's prompt</p>
            <p className="text-sm text-slate-700 mt-1 leading-snug">{prompt}</p>
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
            placeholder={prompt}
            className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 focus:border-teal-400 focus:outline-none"
          />
          <button
            onClick={handleSave}
            disabled={saving || !text.trim()}
            className="w-full rounded-full bg-teal-600 py-2.5 text-sm font-bold text-white hover:bg-teal-700 transition-colors disabled:opacity-50">
            {saving ? "Saving…" : "Add reflection"}
          </button>
        </div>

        {/* Log — tidied into Year → Month → Week folders */}
        <div>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-2">Your entries</p>
          {entries.length === 0 ? (
            <p className="text-center text-xs text-slate-400 py-6 leading-relaxed">
              No reflections yet.<br />A line or two, a few times a week, is all it takes. 🌱
            </p>
          ) : (
            <div className="space-y-1">
              {folders.map((yr) => (
                <div key={yr.key}>
                  <FolderRow open={effectiveOpen.has(yr.key)} onClick={() => toggleFolder(yr.key)} label={yr.label} count={yr.count} />
                  {effectiveOpen.has(yr.key) && (
                    <div className="ml-3 border-l border-slate-100 pl-1.5 space-y-0.5">
                      {yr.months.map((mo) => (
                        <div key={mo.key}>
                          <FolderRow open={effectiveOpen.has(mo.key)} onClick={() => toggleFolder(mo.key)} label={mo.label} count={mo.count} />
                          {effectiveOpen.has(mo.key) && (
                            <div className="ml-3 border-l border-slate-100 pl-1.5 space-y-0.5">
                              {mo.weeks.map((wk) => (
                                <div key={wk.key}>
                                  <FolderRow open={effectiveOpen.has(wk.key)} onClick={() => toggleFolder(wk.key)} label={wk.label} count={wk.entries.length} />
                                  {effectiveOpen.has(wk.key) && (
                                    <div className="ml-3 mt-1 mb-2 space-y-2">
                                      {wk.entries.map(renderEntry)}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
