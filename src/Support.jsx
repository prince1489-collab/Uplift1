// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.
//
// Support.jsx — someone to talk to, if you need it (3.31).
//
// This screen used to open on "How can we support you?" and a list of topics, each leading to a
// clinical questionnaire — PHQ-9 for depression, GAD-7 for anxiety, loneliness, stress and burnout
// scales — scored into a severity that chose coping tips and paid-app suggestions. The helplines
// came last, after the questionnaire. The founder: it's "dangerous for an app like this which is
// non clinical to give scores around wellbeing" — and the people this screen is for are sent here
// by Seen's AI or the feed's crisis banner because they may be struggling right now.
//
// So it is one page: the emergency number for their country, people to talk to now, more support
// where they live, and a way to find a line anywhere else. Nothing to answer, nothing scored.

import React from "react";
import { getResources, getEmergency, contactHref } from "./SupportData";
import { inPlace } from "./kindLog";

function Line({ r, tone = "warm" }) {
  const href = contactHref(r);
  const external = href && !href.startsWith("tel:") && !href.startsWith("sms:");
  const warm = tone === "warm";
  return (
    <a href={href || undefined} target={external ? "_blank" : undefined} rel="noopener noreferrer"
      className={`flex items-center gap-3 rounded-2xl border px-4 py-3 active:scale-[0.99] transition-transform ${warm ? "border-red-200 bg-red-50" : "border-slate-100 bg-white shadow-sm"}`}>
      <span className="text-xl" aria-hidden>{r.phone ? (/^text/i.test(r.phone) ? "💬" : "📞") : "🌐"}</span>
      <span className="min-w-0 flex-1">
        <span className={`block text-sm font-bold ${warm ? "text-red-700" : "text-slate-800"}`}>{r.name}</span>
        {r.phone && <span className={`block text-xs ${warm ? "text-red-600" : "text-slate-500"}`}>{r.phone}</span>}
      </span>
      {r.free && <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">FREE</span>}
    </a>
  );
}

export default function Support({ country }) {
  const resources = getResources(country);
  const emergency = getEmergency(country);
  return (
    <div className="flex flex-1 flex-col overflow-y-auto bg-slate-50/60 px-4 py-5">
      <div className="mx-auto w-full max-w-md space-y-4 pb-8">
        <div>
          <p className="text-[20px] font-extrabold text-slate-800">🛟 Someone to talk to</p>
          <p className="mt-1 text-[13.5px] leading-relaxed text-slate-600">
            If things feel heavy, you don't have to carry it alone. Seen isn't a crisis or clinical service — these people are, and they're there for exactly this.
          </p>
        </div>

        <div className="seen-support rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
          {emergency ? (
            <a href={`tel:${emergency}`} className="block">
              <p className="text-sm font-bold text-red-700">In an emergency, call {emergency}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-red-600">If you or someone else is in immediate danger, call now.</p>
            </a>
          ) : (
            <>
              <p className="text-sm font-bold text-red-700">In an emergency, call your local emergency number</p>
              <p className="mt-0.5 text-xs leading-relaxed text-red-600">If you or someone else is in immediate danger, call now.</p>
            </>
          )}
        </div>

        {resources.crisis?.length > 0 && (
          <section>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-red-600">Talk to someone now</p>
            <div className="flex flex-col gap-2">{resources.crisis.map((r) => <Line key={r.name} r={r} />)}</div>
          </section>
        )}

        {resources.mental?.length > 0 && (
          <section>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">More support{country ? ` in ${inPlace(country)}` : ""}</p>
            <div className="flex flex-col gap-2">{resources.mental.map((r) => <Line key={r.name} r={r} tone="calm" />)}</div>
          </section>
        )}

        <a href="https://findahelpline.com" target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-sm">
          <span className="text-xl" aria-hidden>🌍</span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold text-slate-800">Somewhere else?</span>
            <span className="block text-xs text-slate-500">Find a free, confidential helpline in any country</span>
          </span>
          <span className="text-lg text-slate-300" aria-hidden>→</span>
        </a>

        <p className="px-1 text-center text-[11.5px] leading-relaxed text-slate-500">
          Talking to someone you trust helps too — a friend, family, or your doctor.
        </p>
      </div>
    </div>
  );
}
