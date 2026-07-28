// Journal.jsx — a private gratitude & kindness journal.
// Users log entries of two types: "Grateful" (thankful for something) or "Kindness"
// (an act of kindness given/received), each with a date, building a log over time.
// Framed as a GENTLE FEW-TIMES-A-WEEK reflective practice (research shows daily gratitude
// journaling habituates and that guilt-driven daily streaks cause drop-off), with rotating
// specific prompts and an "on this day" resurfacing card. Stored per-user at
// users/{uid}/journal/{entryId} (private to the owner).

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { collection, addDoc, updateDoc, onSnapshot, query, orderBy, deleteDoc, doc } from "firebase/firestore";
import { playCheckIn } from "./sounds";
import { ArrowLeft, Trash2, BookOpen, History, ChevronRight, Folder, Calendar, Share2, X, Check } from "lucide-react";
import { pickDailyPrompt } from "./JournalPrompts";
import { awardPoints } from "./points";
import { authedPost } from "./apiBase";

const TYPES = [
  { id: "grateful", label: "Grateful", emoji: "🙏", color: "#f59e0b" },
  { id: "kindness", label: "Kindness", emoji: "💚", color: "#FF9E57" },
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
  const tint = (c) => (c >= 3 ? "#D24341" : c === 2 ? "#FF8580" : c === 1 ? "#99f6e4" : "#f1f5f9");
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
              outline: d === today ? "2px solid #D24341" : "none",
              outlineOffset: "-2px",
            }}>
            {d}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Share a reflection to the feed as a Featured Story (v2 preview — device-local) ──
const ENRICH_PROMPTS = [
  { key: "matter", label: "What made this matter to you?" },
  { key: "who", label: "Who was it for — and why them?" },
  { key: "feel", label: "How did it leave you feeling?" },
];
function ShareStorySheet({ entry, authorName, country, authorUid, db, currentUser, onShared, onClose }) {
  const [enrich, setEnrich] = useState({});
  const [anon, setAnon] = useState(false);
  const [posting, setPosting] = useState(false);
  const [shareError, setShareError] = useState("");

  const share = async () => {
    if (posting) return;
    setPosting(true);
    const extras = ENRICH_PROMPTS
      .map((p) => (enrich[p.key]?.trim() ? { q: p.label, a: enrich[p.key].trim() } : null))
      .filter(Boolean);
    // Screened before anyone sees it, exactly like a feed post — a reflection is free text
    // going to other members. Fails CLOSED: no clean verdict, nothing is shared.
    try {
      const mod = await authedPost(currentUser, "/api/moderate-message", { text: entry.text, context: "post" });
      if (!mod.checked || !mod.ok) {
        setShareError(mod.reason || "That didn't pass our kindness check. Try rewording it.");
        setPosting(false);
        return;
      }
    } catch (err) {
      setShareError(err?.status === 503
        ? "The kindness check isn't set up on this deployment (503)."
        : "We couldn't run the kindness check just now — try again in a moment.");
      setPosting(false);
      return;
    }

    try {
      await addDoc(collection(db, "sharedReflections"), {
        authorUid: authorUid ?? currentUser?.uid ?? null,
        text: entry.text,
        enrich: extras,
        anonymous: anon,
        authorName: anon ? "Someone, somewhere" : (authorName || "A member"),
        country: anon ? null : (country || null),
        date: entry.date || null,
        ts: Date.now(),
      });
    } catch {
      setShareError("Couldn't share that — check your connection and try again.");
      setPosting(false);
      return;
    }
    try { awardPoints("story"); } catch { /* ignore */ }
    try { playCheckIn(); } catch { /* ignore */ }
    onShared?.();
  };

  return createPortal(
    <div data-portal className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-white max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 flex items-center gap-3 border-b border-slate-100 bg-white px-4 py-3">
          <h3 className="flex-1 text-sm font-bold text-slate-800 flex items-center gap-1.5">
            <Share2 size={15} className="text-teal-500" /> Share as a Featured Story
          </h3>
          <button onClick={onClose} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100"><X size={18} /></button>
        </div>
        <div className="px-4 py-4 space-y-4">
          <div className="rounded-2xl border border-slate-100 bg-slate-50 px-3.5 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">Your reflection</p>
            <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{entry.text}</p>
          </div>
          <div className="space-y-3">
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Add a little more so others can feel it too (all optional).
            </p>
            {ENRICH_PROMPTS.map((p) => (
              <div key={p.key}>
                <label className="text-[11px] font-semibold text-slate-600">{p.label}</label>
                <textarea rows={2} value={enrich[p.key] || ""}
                  onChange={(e) => setEnrich((prev) => ({ ...prev, [p.key]: e.target.value }))}
                  className="mt-1 w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-teal-400 focus:outline-none" />
              </div>
            ))}
          </div>
          <button onClick={() => setAnon((v) => !v)}
            className="w-full flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3.5 py-3 text-left">
            <span className={`grid h-6 w-6 flex-shrink-0 place-items-center rounded-md border-2 transition-colors ${anon ? "border-teal-500 bg-teal-500 text-white" : "border-slate-300 text-transparent"}`}>
              <Check size={14} strokeWidth={3} />
            </span>
            <span className="flex-1">
              <span className="block text-sm font-semibold text-slate-800">Share anonymously</span>
              <span className="block text-[11px] text-slate-500">Your name and country won't be shown.</span>
            </span>
          </button>
          {/* Says who can actually see it. The follow graph is device-local, so the server
              cannot restrict this to followers — claiming otherwise would be a promise the
              data model can't keep. */}
          <div className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2.5">
            <p className="text-[12px] font-bold text-sky-800">This will be visible to other members</p>
            <p className="text-[11px] text-sky-700 mt-0.5 leading-relaxed">
              It appears in the feed of people who follow you, and other members can read it too. It's screened
              first, and you can delete it at any time. Share anonymously to hide your name and country.
            </p>
          </div>
          {shareError && (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-center text-xs font-semibold text-red-600" role="alert">{shareError}</p>
          )}
          <button onClick={share} disabled={posting}
            className="w-full rounded-full bg-teal-600 py-3 text-sm font-bold text-white hover:bg-teal-700 transition-colors disabled:opacity-50">
            {posting ? "Sharing…" : "Share to Featured Stories ✨"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function JournalPanel({ db, currentUser, profile, darkMode = false, inline = false, onClose }) {
  const uid = currentUser?.uid;
  const type = "reflection"; // v2: single-category journal
  const [date, setDate] = useState(todayStr());
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [entries, setEntries] = useState([]);
  const [celebrate, setCelebrate] = useState(false);
  const [expandPast, setExpandPast] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false); // v2: calendar collapsed by default to reclaim space
  const [shareEntry, setShareEntry] = useState(null); // entry being shared as a Featured Story
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
            <button onClick={() => setShareEntry(e)} title="Share as story" className="text-slate-300 hover:text-teal-500 transition-colors">
              <Share2 size={12} />
            </button>
            <button onClick={() => handleDelete(e.id)} title="Delete" className="text-slate-300 hover:text-red-400 transition-colors">
              <Trash2 size={12} />
            </button>
          </div>
        </div>
        <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed relative">{e.text}</p>
        <button onClick={() => setShareEntry(e)}
          className="mt-2 inline-flex items-center gap-1 rounded-full bg-teal-50 px-2.5 py-1 text-[10px] font-semibold text-teal-600 hover:bg-teal-100 transition-colors">
          <Share2 size={10} /> Share as a Featured Story
        </button>
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

  // One reflection per day. Once the selected day already has an entry, the box edits that
  // entry instead of offering a second blank one against the same prompt.
  const entryForDate = entries.find((e) => e.date === date) || null;
  const editingId = entryForDate?.id ?? null;
  // Load the day's entry into the box when the selected date (or its entry) changes.
  // Keyed on the id so an unrelated snapshot never wipes what's being typed.
  useEffect(() => {
    setText(entryForDate?.text ?? "");
  }, [date, entryForDate?.id]);
  // While editing, show the prompt that entry was actually written against.
  const activePrompt = entryForDate?.prompt || prompt;

  const handleSave = async () => {
    const trimmed = text.trim();
    if (!trimmed || saving || !db || !uid) return;
    setSaving(true);
    try {
      if (editingId) {
        await updateDoc(doc(db, "users", uid, "journal", editingId), { text: trimmed, updatedAt: Date.now() });
      } else {
        await addDoc(collection(db, "users", uid, "journal"), {
          type, text: trimmed, date, prompt: prompt || null, createdAt: Date.now(),
        });
        try { awardPoints("reflect"); } catch { /* ignore */ } // v2: waters the Kindness Tree — new entries only
      }
      setSaveError("");
      playCheckIn();
    } catch (_) {
      // A reflection is something the user wrote. Losing it silently is the worst
      // outcome here — keep the text in the box and tell them it didn't save.
      setSaveError("Couldn't save that reflection — check your connection and try again.");
    }
    setSaving(false);
  };

  const handleDelete = async (id) => {
    if (!db || !uid) return;
    try { setSaveError(""); await deleteDoc(doc(db, "users", uid, "journal", id)); }
    catch (_) { setSaveError("Couldn't delete that entry — check your connection and try again."); }
  };

  const goalPct = Math.min(100, (reflectionsThisWeek / WEEKLY_GOAL) * 100);

  // v2: renders inline as a tab (inline=true) or as a full-screen portal (from the menu).
  const content = (
    <>
      {celebrate && <Confetti />}
      {!inline && (
        <div className="seen-overlay-header flex items-center gap-3 border-b border-slate-100 px-4 py-3 flex-shrink-0">
          <button onClick={onClose} className="rounded-full p-1.5 hover:bg-slate-100 transition-colors">
            <ArrowLeft size={18} className="text-slate-600" />
          </button>
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
            <BookOpen size={15} className="text-teal-500" /> Journal
          </h2>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* v2: numeric stats now live in "My Journey". Reflect stays a calm writing space.
            A slim, non-numeric weekly-cadence line keeps the gentle rhythm without a stats block. */}
        {entries.length > 0 && (
          <div className="flex items-center justify-between rounded-2xl bg-amber-50 border border-amber-100 px-4 py-2.5">
            <span className="text-[11px] font-semibold text-slate-500">
              {reflectionsThisWeek > 0
                ? `Reflections this week: ${reflectionsThisWeek} of ${WEEKLY_GOAL}`
                : "A fresh week — whenever you're ready 🌱"}
            </span>
            {reflectionsThisWeek >= WEEKLY_GOAL && <span className="text-[10px] font-bold text-emerald-600">✓ lovely rhythm</span>}
          </div>
        )}

        {/* Calendar — collapsed by default (it's spacious); tap to reveal */}
        {entries.length > 0 && (
          <div>
            <button onClick={() => setShowCalendar((v) => !v)}
              className="w-full flex items-center gap-2 rounded-2xl border border-slate-100 bg-white px-3.5 py-2.5 text-left hover:bg-slate-50 transition-colors">
              <Calendar size={14} className="text-teal-500" />
              <span className="text-[12px] font-semibold text-slate-700">This month's reflections</span>
              <ChevronRight size={14} className={`ml-auto text-slate-400 transition-transform ${showCalendar ? "rotate-90" : ""}`} />
            </button>
            {showCalendar && <div className="mt-2"><MonthHeatmap counts={counts} /></div>}
          </div>
        )}

        {/* On this day — resurface a past reflection */}
        {onThisDay && (
          <button
            onClick={() => setExpandPast((v) => !v)}
            className="w-full text-left rounded-2xl border border-violet-100 bg-violet-50 px-4 py-3 transition-colors hover:bg-violet-50">
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

        {/* Today's reflection — writes a new one, or edits the day's existing entry */}
        <div className={`rounded-2xl border p-3 space-y-3 ${editingId ? "border-teal-200 bg-teal-50/40" : "border-slate-100 bg-slate-50/60"}`}>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            {editingId
              ? (date === todayStr()
                  ? "You've written today's reflection. You can keep editing it — one a day is plenty."
                  : "You already reflected on this day. Edit it below, or pick another date.")
              : "A gentle space to reflect — a few times a week is plenty. Just follow the prompt and write what comes."}
          </p>

          {/* One journal, one daily prompt. While editing, this shows the prompt that entry
              was written against rather than today's rotating one. */}
          <div className="rounded-xl bg-white border border-slate-200 px-3 py-2.5">
            <p className="text-[10px] font-bold uppercase tracking-wide text-teal-600">
              {editingId ? "You answered" : "Today's prompt"}
            </p>
            <p className="text-sm text-slate-700 mt-1 leading-snug">{activePrompt}</p>
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
            placeholder={activePrompt}
            className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 focus:border-teal-400 focus:outline-none"
          />
          {saveError && (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-center text-xs font-semibold text-red-600" role="alert">{saveError}</p>
          )}
          <button
            onClick={handleSave}
            disabled={saving || !text.trim() || (editingId && text.trim() === (entryForDate?.text ?? "").trim())}
            className="w-full rounded-full bg-teal-600 py-2.5 text-sm font-bold text-white hover:bg-teal-700 transition-colors disabled:opacity-50">
            {saving ? "Saving…" : editingId ? "Save changes" : "Add reflection"}
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

      {shareEntry && (
        <ShareStorySheet
          entry={shareEntry}
          authorName={profile?.fullName}
          country={profile?.country}
          authorUid={uid}
          db={db}
          currentUser={currentUser}
          onShared={() => setShareEntry(null)}
          onClose={() => setShareEntry(null)}
        />
      )}
    </>
  );

  if (inline) {
    return (
      <main {...(darkMode ? { "data-dark-shell": "" } : {})} className="flex-1 overflow-hidden flex flex-col"
        style={{ background: darkMode ? "#0e1219" : undefined }}>
        {content}
      </main>
    );
  }
  return createPortal(
    <div data-portal {...(darkMode ? { "data-dark-shell": "" } : {})}
      className="fixed inset-0 z-[250] flex flex-col"
      style={{ background: darkMode ? "#0e1219" : "#fff" }}>
      {content}
    </div>,
    document.body
  );
}
