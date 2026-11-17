// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.
//
// AdminStats.jsx — "How Seen is doing" (3.26). Admin only: the rules let the admin account read
// every users/{uid} document (firestore.rules, isAdmin), and this screen is only rendered for it.
//
// It answers Seen's two aims with counts — did people OPEN Seen each day, and did they do a kind
// act — and nothing else: no names, emails or ids are shown (usageStats.js returns none). "Without
// me" takes the admin's own account out, because in a small group of family and friends the
// founder's own every-day habit moves every percentage.
//
// The day-by-day view is a table with a thin bar in each labelled column rather than a chart:
// two percentages for a small group read most honestly as numbers, and neither depends on colour.

import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { collection, getDocs } from "firebase/firestore";
import { BarChart3, X, RefreshCw } from "lucide-react";
import { summarise, MIN_COUNTED } from "./usageStats";
import { todayKey } from "./hytPrompts";

const HOUR = (h) => (h == null ? "Not chosen (9am)" : h === 0 ? "Midnight" : h === 12 ? "Noon" : h < 12 ? `${h}am` : `${h - 12}pm`);
const shortDay = (k) => {
  const d = new Date(`${k}T12:00:00Z`);
  return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
};

function Tile({ value, of, label, sub }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white px-3 py-3">
      <p className="text-[24px] font-extrabold leading-none text-slate-800">
        {value ?? "—"}{of != null && <span className="text-[14px] font-bold text-slate-400"> of {of}</span>}
      </p>
      <p className="mt-1.5 text-[12px] font-semibold leading-snug text-slate-700">{label}</p>
      {sub && <p className="mt-0.5 text-[11px] leading-snug text-slate-500">{sub}</p>}
    </div>
  );
}

function Section({ title, note, children }) {
  return (
    <section className="rounded-2xl border border-slate-100 bg-white px-4 py-3.5">
      <h3 className="text-[13px] font-bold text-slate-800">{title}</h3>
      {note && <p className="mt-0.5 text-[11.5px] leading-snug text-slate-500">{note}</p>}
      <div className="mt-2.5">{children}</div>
    </section>
  );
}

// A count, with a thin bar for its share of `total`. The bar is a reading aid; the number is the data.
function CountRow({ label, count, total }) {
  const w = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2 py-1">
      <span className="w-[42%] min-w-0 truncate text-[12.5px] text-slate-700">{label}</span>
      <span className="relative h-2 flex-1 overflow-hidden rounded-full bg-slate-100" aria-hidden>
        <span className="absolute inset-y-0 left-0 rounded-full bg-teal-500" style={{ width: `${w}%` }} />
      </span>
      <span className="w-12 text-right text-[12.5px] font-semibold tabular-nums text-slate-800">{count}</span>
    </div>
  );
}

function Bar({ value }) {
  return (
    <span className="relative mt-1 block h-1.5 w-full overflow-hidden rounded-full bg-slate-100" aria-hidden>
      {value != null && <span className="absolute inset-y-0 left-0 rounded-full bg-teal-500" style={{ width: `${value}%` }} />}
    </span>
  );
}

export default function AdminStats({ db, adminUid, darkMode = false, onClose }) {
  const [users, setUsers] = useState(null); // null = loading
  const [error, setError] = useState("");
  const [withoutMe, setWithoutMe] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!db) return undefined;
    let alive = true;
    getDocs(collection(db, "users"))
      .then((snap) => { if (alive) { setUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); setError(""); } })
      .catch((e) => { if (alive) { setUsers([]); setError(e?.code === "permission-denied" ? "Only the admin account can see this." : "Couldn't load the numbers — try again."); } });
    return () => { alive = false; };
  }, [db, tick]);

  const today = todayKey();
  const s = useMemo(() => (users ? summarise(users, { today, adminUid, withoutMe }) : null), [users, today, adminUid, withoutMe]);

  return createPortal(
    <div data-portal {...(darkMode ? { "data-dark-shell": "" } : {})} className="fixed inset-0 z-[260] flex flex-col bg-white">
      <div className="seen-overlay-header flex flex-shrink-0 items-center gap-3 border-b border-slate-100 px-4 py-3">
        <BarChart3 size={18} className="text-teal-600" />
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-bold text-slate-800">How Seen is doing</h2>
          <p className="text-[11px] text-slate-500">
            {s ? `${s.people} people${withoutMe ? ", not counting you" : ""} · counts only, no names` : "Loading…"}
          </p>
        </div>
        <button onClick={() => { setUsers(null); setTick((n) => n + 1); }} className="p-1 text-slate-400 hover:text-slate-600" aria-label="Refresh"><RefreshCw size={17} /></button>
        <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600" aria-label="Close"><X size={20} /></button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 px-4 py-4" style={{ paddingBottom: "max(24px, env(safe-area-inset-bottom))" }}>
        <label className="flex items-center justify-between rounded-2xl border border-slate-100 bg-white px-4 py-2.5">
          <span className="text-[13px] font-semibold text-slate-700">Without me</span>
          <input type="checkbox" checked={withoutMe} onChange={(e) => setWithoutMe(e.target.checked)} className="h-4 w-4 accent-teal-600" />
        </label>

        {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-[12.5px] font-semibold text-red-600" role="alert">{error}</p>}
        {!s ? (
          <p className="py-10 text-center text-[13px] text-slate-400">Reading every account…</p>
        ) : (
          <>
            {/* ── The two aims, today ── */}
            <div className="grid grid-cols-2 gap-2">
              <Tile value={s.today.opened} of={s.people} label="Opened Seen today"
                sub={s.today.fromPush != null ? `${s.today.fromPush} from a notification` : "Counting opens from 3.26"} />
              <Tile value={s.today.acted} of={s.people} label="Did a kind act today"
                sub={s.today.planned ? `${s.today.planned} planned a real-life one` : null} />
              <Tile value={s.week.openedPct != null ? `${s.week.openedPct}%` : null} label="Opened, each day (last 7)"
                sub={s.week.openedPct != null
                  ? `Of people whose app counts opens${s.week.pushShare != null ? ` · ${s.week.pushShare}% from a notification` : ""}`
                  : s.week.counted > 0
                    ? `Only ${s.week.counted} ${s.week.counted === 1 ? "person's app counts" : "people's apps count"} opens so far — shown from ${MIN_COUNTED}`
                    : "Starts once phones report opens"} />
              <Tile value={s.week.actedPct != null ? `${s.week.actedPct}%` : null} label="Did a kind act, each day (last 7)" />
            </div>

            {/* ── Day by day ── */}
            <Section title="Day by day"
              note={s.firstOpenDay
                ? `Opens are counted from ${shortDay(s.firstOpenDay)}, among people whose app was reporting them that day.`
                : "Kind acts go back 30 days. Opens start counting once people's apps update to 3.26."}>
              <table className="w-full table-fixed text-left">
                <thead>
                  <tr className="text-[10.5px] font-bold uppercase tracking-wide text-slate-500">
                    <th className="w-[30%] pb-1.5 font-bold">Day</th>
                    <th className="pb-1.5 pr-3 font-bold">Kind act</th>
                    <th className="pb-1.5 font-bold">Opened</th>
                  </tr>
                </thead>
                <tbody>
                  {s.series.map((d) => (
                    <tr key={d.day} className="border-t border-slate-100 align-top">
                      <td className="py-1.5 text-[12px] text-slate-600">{shortDay(d.day)}</td>
                      <td className="py-1.5 pr-3">
                        <span className="text-[12px] font-semibold tabular-nums text-slate-800">{d.acted}</span>
                        <span className="text-[11px] text-slate-500"> · {d.actedPct ?? 0}%</span>
                        <Bar value={d.actedPct} />
                      </td>
                      <td className="py-1.5">
                        {d.opened == null ? <span className="text-[12px] text-slate-400">—</span> : (
                          <>
                            <span className="text-[12px] font-semibold tabular-nums text-slate-800">{d.opened}</span>
                            <span className="text-[11px] text-slate-500"> of {d.reporting} · {d.openedPct}%{d.fromPush ? ` · ${d.fromPush} via push` : ""}</span>
                            <Bar value={d.openedPct} />
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>

            {/* ── Where everyone is ── */}
            <Section title="When each person was last here" note="The latest day they opened Seen or did a kind act (their last kind act is kept forever).">
              {s.recency.map((b) => <CountRow key={b.id} label={b.label} count={b.count} total={s.people} />)}
              {s.never > 0 && <CountRow label="Never did anything" count={s.never} total={s.people} />}
              {s.undated > 0 && <CountRow label="Used it, date not recorded" count={s.undated} total={s.people} />}
            </Section>

            <Section title="Days each person has ever done a kind act" note="Their whole time on Seen: tried it once, or kept going?">
              {s.lifetime.map((b) => <CountRow key={b.id} label={b.label} count={b.count} total={s.people} />)}
            </Section>

            <Section title="When they joined" note="When each person finished signing up.">
              {s.joined.map((b) => <CountRow key={b.id} label={b.label} count={b.count} total={s.people} />)}
              {s.joinedUnknown > 0 && <CountRow label="Not recorded (joined before it was)" count={s.joinedUnknown} total={s.people} />}
            </Section>

            <Section title="How many days of the last 30 had a kind act" note="Per person: the habit, not just today.">
              {s.depth.map((b) => <CountRow key={b.id} label={b.label} count={b.count} total={s.people} />)}
            </Section>

            {/* ── Can Seen reach them ── */}
            <Section title="Reach" note="A reminder needs a device that allowed notifications and a timezone.">
              <CountRow label="Can get a reminder" count={s.reach.canRemind} total={s.people} />
              <p className="mb-1 mt-0.5 text-[11.5px] leading-snug text-slate-600">
                Did a kind act in the last 30 days: <strong className="font-semibold text-slate-800">{s.reach.actedReachable} of {s.reach.canRemind}</strong> who can get a reminder,{" "}
                <strong className="font-semibold text-slate-800">{s.reach.actedUnreachable} of {s.people - s.reach.canRemind}</strong> who can't.
              </p>
              <CountRow label="iPhone or iPad" count={s.reach.platforms.ios} total={s.people} />
              <CountRow label="Android" count={s.reach.platforms.android} total={s.people} />
              <CountRow label="Web browser" count={s.reach.platforms.web} total={s.people} />
              {s.reach.platforms.unknown > 0 && <CountRow label="Older device record" count={s.reach.platforms.unknown} total={s.people} />}
              <CountRow label="Evening reminders on" count={s.reach.evening} total={s.people} />
              <p className="mt-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">Reminder time chosen</p>
              {s.reach.hours.map((h) => <CountRow key={String(h.hour)} label={HOUR(h.hour)} count={h.count} total={s.people} />)}
            </Section>

            <Section title="Counting coverage"
              note="Opens are only known for people whose app is 3.26 or newer and has been opened since.">
              <CountRow label="Reporting opens" count={s.coverage.reporting} total={s.people} />
              {s.coverage.builds.slice(0, 5).map((b) => <CountRow key={b.build} label={`Build ${b.build}`} count={b.count} total={s.people} />)}
            </Section>

            <Section title="All-time totals">
              <div className="grid grid-cols-3 gap-2 text-center">
                {[["Messages", s.totals.messages], ["Replies & notes", s.totals.replies], ["Real-life acts", s.totals.realLife]].map(([k, v]) => (
                  <div key={k}><p className="text-[18px] font-extrabold tabular-nums text-slate-800">{v}</p><p className="text-[11px] text-slate-500">{k}</p></div>
                ))}
              </div>
              {s.unfinished > 0 && (
                <p className="mt-2.5 text-[11.5px] text-slate-500">{s.unfinished} more {s.unfinished === 1 ? "account" : "accounts"} signed in but never finished setting up.</p>
              )}
            </Section>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
