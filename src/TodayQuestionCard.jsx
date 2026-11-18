// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.
//
// TodayQuestionCard.jsx — Today's question, on the home screen (3.33). See todayQuestion.js.
//
// Answer first, then see the world's answers: a heart reaches the person privately, "Tell them"
// sends them a private word, ⋯ reports or blocks. Ten answers, then "New question tomorrow".

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { collection, deleteDoc, doc, limit, onSnapshot, query, setDoc, where } from "firebase/firestore";
import { MoreHorizontal } from "lucide-react";
import { shownQuestion, answerIdFor, othersAnswers, answersSoFar, answerDoc, MAX_ANSWER } from "./todayQuestion";
import { authedPost } from "./apiBase";
import { useDictation } from "./dictation";
import MicButton from "./MicButton";
import { FLAG_MAP } from "./MicroAnimations";
import { ReportBlockBar } from "./UpliftRetentionFeatures";
import { logKindAct } from "./kindLog";

const HEARTS_KEY = "seen_answer_hearts_v1"; // which answers you hearted, on this device
const readHearts = () => { try { return JSON.parse(localStorage.getItem(HEARTS_KEY) || "{}"); } catch { return {}; } };
const writeHearts = (h) => { try { localStorage.setItem(HEARTS_KEY, JSON.stringify(h)); } catch { /* private mode */ } };
const ANON_MIN_BALANCE = 150; // the same as posting your own words without a name (Feed2.jsx)

// Today's answers, live — one query on the day, sorted on the device (no extra index).
function useTodayAnswers(db, day, enabled) {
  const [state, setState] = useState({ day: null, rows: null });
  useEffect(() => {
    if (!db || !day || !enabled) return undefined;
    const q = query(collection(db, "dailyAnswers"), where("day", "==", day), limit(150));
    return onSnapshot(q, (snap) => setState({ day, rows: snap.docs.map((d) => ({ id: d.id, ...d.data() })) }), () => setState({ day, rows: [] }));
  }, [db, day, enabled]);
  return state.day === day ? state.rows : null;
}

// Who felt your answer — only you can read these (firestore.rules).
function useMyAnswerHearts(db, answerId) {
  const [state, setState] = useState({ id: null, names: [] });
  useEffect(() => {
    if (!db || !answerId) return undefined;
    return onSnapshot(collection(db, "dailyAnswers", answerId, "hearts"),
      (snap) => setState({ id: answerId, names: snap.docs.map((d) => d.data()?.name || "Someone") }), () => {});
  }, [db, answerId]);
  return state.id === answerId ? state.names : [];
}

const flag = (c) => FLAG_MAP[c] || "🌍";
// A heart on someone's answer, at your own uid (firestore.rules), with your first name for them.
const sendAnswerHeart = (db, answerId, uid, name) =>
  setDoc(doc(db, "dailyAnswers", answerId, "hearts", uid), { uid, name: name || null, at: Date.now() }).catch(() => {});
const joinNames = (n) => (n.length === 1 ? n[0] : n.length === 2 ? `${n[0]} and ${n[1]}` : `${n[0]}, ${n[1]} and ${n.length - 2} more`);

export default function TodayQuestionCard({ db, currentUser, profile, day, blocked, sparkBalance = 0, onKindAct, onTell }) {
  const uid = currentUser?.uid;
  const answers = useTodayAnswers(db, day, Boolean(uid));
  const myId = uid ? answerIdFor(day, uid) : null;
  const mine = (answers || []).find((a) => a.id === myId) || null;
  // Once you've answered, the question your answer was for, and only answers to it (3.36.2).
  const question = shownQuestion(day, mine);
  const heartsOnMine = useMyAnswerHearts(db, mine ? myId : null);
  const [text, setText] = useState("");
  // The box grows with the answer (3.36) — about seven lines, then it scrolls — so a longer answer
  // is never squeezed into two lines you can't read back.
  const boxRef = useRef(null);
  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 168)}px`;
  }, [text]);
  const dictation = useDictation({ text, setText, max: MAX_ANSWER });
  const [anon, setAnon] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [hearted, setHearted] = useState(readHearts);
  const [menuFor, setMenuFor] = useState(null);
  const canAnon = Number(sparkBalance) >= ANON_MIN_BALANCE;

  const share = async () => {
    dictation.stop();
    const data = answerDoc({ dayKey: day, uid, text, firstName: profile?.fullName, country: profile?.country, anonymous: anon && canAnon });
    if (!data || busy || !db) return;
    setBusy(true); setError("");
    try {
      // Screened like any words you post — nothing is written unless the check says yes.
      const mod = await authedPost(currentUser, "/api/moderate-message", { text: data.text, context: anon && canAnon ? "post_anonymous" : "post" });
      if (!mod?.checked || !mod.ok) { setError(mod?.reason || "That didn't pass our kindness check — try saying it another way."); setBusy(false); return; }
      await setDoc(doc(db, "dailyAnswers", myId), data);
      setText("");
    } catch {
      setError("Couldn't share that just now — check your connection and try again.");
    }
    setBusy(false);
  };

  const toggleHeart = (a) => {
    if (!db || !uid || a.uid === uid) return;
    const on = !hearted[a.id];
    const next = { ...hearted, [a.id]: on };
    setHearted(next); writeHearts(next);
    if (on) {
      sendAnswerHeart(db, a.id, uid, String(profile?.fullName || "").trim().split(/\s+/)[0] || null);
      try { onKindAct?.(); } catch { /* the heart is still sent */ }
      logKindAct(db, uid, { id: `heart_answer_${a.id}`, route: "heart", toName: a.name || null, toUid: a.uid });
    } else {
      deleteDoc(doc(db, "dailyAnswers", a.id, "hearts", uid)).catch(() => {});
    }
  };

  const so = answersSoFar(answers || [], { qid: question.id });
  const others = othersAnswers(answers || [], { myUid: uid, blocked, qid: question.id });

  return (
    <section className="seen-today-q mb-3 rounded-2xl border border-orange-200 bg-gradient-to-br from-orange-50 to-white px-3.5 pb-3 pt-3 shadow-sm"
      style={{ animation: "seenFadeUp 320ms ease both" }} aria-label="Today's question">
      <p className="text-[10.5px] font-bold uppercase tracking-wide text-orange-600">Today's question</p>
      <p className="mt-1 text-[16px] font-extrabold leading-snug text-slate-800">{question.q}</p>

      {!mine ? (
        <>
          <div className="mt-2.5 flex items-end gap-2 rounded-2xl border border-slate-200 bg-white py-1.5 pl-3 pr-1.5">
            <textarea ref={boxRef} value={text} rows={2} maxLength={MAX_ANSWER} onChange={(e) => setText(e.target.value.slice(0, MAX_ANSWER))}
              placeholder="A sentence is plenty…" aria-label="Your answer"
              className="min-h-[44px] flex-1 resize-none overflow-y-auto bg-transparent py-1 text-[14px] leading-snug text-slate-800 placeholder:text-slate-400 focus:outline-none" />
            <MicButton dictation={dictation} variant="icon" />
          </div>
          {dictation.listening && <p className="mt-1 text-[11px] font-semibold text-red-600" role="status">Listening… tap ■ when you're done</p>}
          {error && <p className="mt-1.5 text-[12px] font-semibold text-red-600" role="alert">{error}</p>}
          <div className="mt-2 flex items-center gap-2">
            {canAnon && (
              <label className="flex items-center gap-1.5 text-[11.5px] text-slate-500">
                <input type="checkbox" checked={anon} onChange={(e) => setAnon(e.target.checked)} /> Just my country
              </label>
            )}
            <button onClick={share} disabled={!text.trim() || busy}
              className="ml-auto rounded-full bg-teal-600 px-4 py-2 text-[13px] font-bold text-white disabled:opacity-50">
              {busy ? "Sharing…" : "Share"}
            </button>
          </div>
          <p className="mt-2 text-[11.5px] text-slate-500">
            {so.count ? `${so.count} ${so.count === 1 ? "answer" : "answers"} from ${so.countries || 1} ${so.countries === 1 ? "country" : "countries"} so far — yours, then theirs.` : "Answer first, then see how people around the world answered."}
          </p>
        </>
      ) : (
        <>
          <div className="mt-2.5 rounded-2xl border border-orange-100 bg-white px-3 py-2">
            <p className="text-[10.5px] font-bold uppercase tracking-wide text-slate-400">You said</p>
            <p className="mt-0.5 text-[13.5px] leading-snug text-slate-700">“{mine.text}”</p>
            {heartsOnMine.length > 0 && <p className="mt-1 text-[12px] font-semibold text-rose-600">❤️ {joinNames(heartsOnMine)} felt this</p>}
          </div>
          {others.length ? (
            <ul className="mt-2.5 space-y-2">
              {others.map((a) => (
                <li key={a.id} className="rounded-2xl border border-slate-100 bg-white px-3 py-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[14px]" aria-hidden>{flag(a.country)}</span>
                    <span className="flex-1 truncate text-[11.5px] font-bold text-slate-600">{a.name || `Someone in ${a.country || "the world"}`}</span>
                    <button onClick={() => setMenuFor(menuFor === a.id ? null : a.id)} aria-label="More" className="p-0.5 text-slate-300"><MoreHorizontal size={15} /></button>
                  </div>
                  <p className="mt-0.5 text-[13.5px] leading-snug text-slate-800">“{a.text}”</p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <button onClick={() => toggleHeart(a)} aria-pressed={Boolean(hearted[a.id])}
                      className={`rounded-full border px-2.5 py-1 text-[12px] font-semibold active:scale-95 ${hearted[a.id] ? "border-rose-200 bg-rose-50 text-rose-600" : "border-slate-200 bg-white text-slate-500"}`}>
                      {hearted[a.id] ? "❤️ Felt it" : "🤍 Felt it"}
                    </button>
                    {a.name && (
                      <button onClick={() => onTell?.(a)} className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[12px] font-semibold text-teal-700 active:scale-95">
                        Tell {a.name} it meant something
                      </button>
                    )}
                  </div>
                  {menuFor === a.id && (
                    <div className="mt-1.5">
                      <ReportBlockBar db={db} currentUser={currentUser} targetUid={a.uid} targetName={a.name || "this person"} contentId={a.id} contentKind="answer" />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2.5 text-[12.5px] text-slate-500">You're the first today. Others' answers will appear here as they come in.</p>
          )}
          <p className="mt-2.5 text-center text-[11.5px] font-semibold text-slate-400">New question tomorrow 🌙</p>
        </>
      )}
    </section>
  );
}
