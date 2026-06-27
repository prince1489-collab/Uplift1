// Journal.jsx — a private gratitude & kindness journal.
// Users log entries of two types: "Grateful" (thankful for something) or "Kindness"
// (an act of kindness given/received), each with a date, building a log over time.
// Stored per-user at users/{uid}/journal/{entryId} (private to the owner).

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc } from "firebase/firestore";
import { ArrowLeft, Trash2, BookOpen } from "lucide-react";

const TYPES = [
  { id: "grateful", label: "Grateful", emoji: "🙏", color: "#f59e0b", placeholder: "What are you grateful for today?" },
  { id: "kindness", label: "Kindness", emoji: "💚", color: "#10b981", placeholder: "Describe an act of kindness you gave or received." },
];

function todayStr() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function fmtDate(s) {
  try {
    const [y, m, d] = String(s).split("-").map(Number);
    if (!y || !m || !d) return s;
    return new Date(y, m - 1, d).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
  } catch { return s; }
}

export default function JournalPanel({ db, currentUser, onClose }) {
  const uid = currentUser?.uid;
  const [type, setType] = useState("grateful");
  const [date, setDate] = useState(todayStr());
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [entries, setEntries] = useState([]);

  useEffect(() => {
    if (!db || !uid) return;
    const q = query(collection(db, "users", uid, "journal"), orderBy("createdAt", "desc"));
    return onSnapshot(q, (snap) => {
      setEntries(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, () => {});
  }, [db, uid]);

  const activeType = TYPES.find((t) => t.id === type) ?? TYPES[0];

  const handleSave = async () => {
    const trimmed = text.trim();
    if (!trimmed || saving || !db || !uid) return;
    setSaving(true);
    try {
      await addDoc(collection(db, "users", uid, "journal"), {
        type, text: trimmed, date, createdAt: Date.now(),
      });
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
      <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 flex-shrink-0">
        <button onClick={onClose} className="rounded-full p-1.5 hover:bg-slate-100 transition-colors">
          <ArrowLeft size={18} className="text-slate-600" />
        </button>
        <h2 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
          <BookOpen size={15} className="text-teal-500" /> Journal
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
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
                  <div key={e.id} className="rounded-2xl border border-slate-100 bg-white shadow-sm px-3.5 py-3">
                    <div className="flex items-center justify-between mb-1">
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
                    <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{e.text}</p>
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
