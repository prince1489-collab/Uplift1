// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.
//
// BootScreen.jsx — what Seen shows while it is starting.
//
// It replaces a bare spinner on a near-white background, which is what every startup path used
// to render. Measured off a recording of a real sign-in, that was on screen for about six
// seconds: no logo, no wordmark, no words. It arrives immediately after someone has typed their
// password — the moment they have just committed — and what it communicates is that the app has
// died.
//
// Firestore persistence (see App.jsx) is what makes the wait short for a returning user. This is
// for the rest: a first sign-in on a new device, a cold network, a slow morning. Those will
// always exist, so the wait needs to look like part of the app rather than an absence of one.
//
// Deliberately the same marks as the welcome screen the user has just come from — same tree,
// same wordmark, same line. Continuity is the whole job: it should read as Seen still opening,
// not as a different, blanker thing that happened afterwards.

import React, { useEffect, useState } from "react";

// How long before the wait gets acknowledged in words. Short enough that a stalled start is
// never silent, long enough that a normal one never shows it — with persistence a returning
// user should be through in well under a second, so anyone who reads this line is genuinely
// waiting and is owed an explanation rather than a spinner.
const SLOW_AFTER_MS = 2500;

export default function BootScreen({ error = "", onRetry }) {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="grid h-screen place-items-center bg-slate-50 px-8">
      <div className="flex flex-col items-center text-center">
        <img src="/icon-192.png" alt="" aria-hidden className="h-16 w-16 rounded-2xl shadow-sm" />
        <p className="mt-4 text-2xl font-extrabold tracking-tight text-slate-800">Seen</p>
        <p className="mt-1 text-[13px] font-semibold text-rose-400">Kindness is Addictive</p>

        {error ? (
          <div className="mt-7 flex flex-col items-center gap-3">
            <p className="max-w-[16rem] text-sm leading-relaxed text-slate-600">
              Having trouble loading your profile.
            </p>
            <button
              onClick={onRetry || (() => window.location.reload())}
              className="rounded-full bg-teal-600 px-5 py-2 text-sm font-semibold text-white hover:bg-teal-700 transition-colors">
              Try again
            </button>
          </div>
        ) : (
          <>
            {/* A quiet bar rather than a spinner. A spinner on an empty screen reads as "stuck";
                something that moves along a track reads as "working". */}
            <div className="mt-8 h-1 w-32 overflow-hidden rounded-full bg-slate-200" role="status" aria-live="polite">
              <div className="h-full w-1/3 rounded-full bg-teal-500" style={{ animation: "seenBootSlide 1.15s ease-in-out infinite" }} />
              <span className="sr-only">Opening Seen</span>
            </div>
            {/* Only after the wait stops being normal. Naming the connection rather than saying
                "loading" tells someone the honest thing: it is the network, not their phone, and
                it is worth waiting a moment longer. */}
            <p className={`mt-4 text-[12px] text-slate-400 transition-opacity duration-500 ${slow ? "opacity-100" : "opacity-0"}`}>
              Still connecting…
            </p>
          </>
        )}
      </div>
    </div>
  );
}
