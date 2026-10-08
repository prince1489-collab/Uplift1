// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.
//
// DeleteAccount.jsx — "Delete account", inside the app (3.20; App Store Guideline 5.1.1(v)).
//
// One sheet, honest about what happens: what's deleted (straight away, for good), what's kept
// and why, and one confirmation — type DELETE — which Apple allows and which stops a slip of the
// thumb from erasing someone's history. Sign in with Apple users on iOS confirm once more with
// Apple, which also disconnects Seen from their Apple ID. See accountDeletion.js.
//
// AccountDeletedScreen is the confirmation afterwards. App renders it in place of everything
// else, because signing out swaps the whole screen and would take this sheet with it.

import React, { useState } from "react";
import { createPortal } from "react-dom";
import { X, Loader2 } from "lucide-react";
import { useVisibleViewport, sheetBox, sheetCap } from "./viewport";
import { confirmAndRevokeApple, deleteMyAccount, forgetThisDevice, needsAppleConfirm, Cancelled } from "./accountDeletion";

const GOES = [
  "Your profile, photo and “Right now” line",
  "Every message you've posted, and its reactions",
  "Private replies and kind notes — sent and received",
  "Your conversation with Seen and everything it noticed",
  "Your journal, feelings and wellbeing check-ins",
  "Your tree, drops, streak and certificates",
];

export default function DeleteAccount({ auth, db, onClose, onDeleted }) {
  const view = useVisibleViewport();
  const [typed, setTyped] = useState("");
  const [state, setState] = useState("idle"); // idle | working | error | cancelled
  const ready = typed.trim().toUpperCase() === "DELETE";
  const apple = needsAppleConfirm(auth.currentUser);

  const run = async () => {
    if (!ready || state === "working") return;
    setState("working");
    try {
      await confirmAndRevokeApple(auth);
      await deleteMyAccount({ auth });
    } catch (err) {
      setState(err instanceof Cancelled ? "cancelled" : "error");
      return;
    }
    // Deleted. App switches to the confirmation now, before signing out can swap the screen.
    onDeleted?.();
    forgetThisDevice({ auth, db });
  };

  return createPortal(
    <div data-portal className="fixed inset-0 z-[300] flex flex-col justify-end" style={sheetBox(view)}>
      <div className="absolute inset-0 bg-black/40" onClick={state === "working" ? undefined : onClose} aria-hidden />
      <div className="relative flex flex-col rounded-t-3xl bg-white shadow-2xl sheet-slide-up" style={sheetCap(view)} role="dialog" aria-modal="true" aria-labelledby="del-title">
        <div className="flex items-center justify-between px-5 pb-1 pt-4">
          <p id="del-title" className="text-[17px] font-extrabold text-slate-900">Delete your account</p>
          {state !== "working" && (
            <button onClick={onClose} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full text-slate-500 hover:bg-slate-100"><X size={18} /></button>
          )}
        </div>
        <div className="overflow-y-auto px-5 pt-1" style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}>
          <p className="text-[13.5px] leading-relaxed text-slate-700">
            This permanently deletes your Seen account and everything in it, straight away. It can't be undone.
          </p>
          <ul className="mt-2.5 space-y-1 rounded-2xl bg-slate-50 px-3.5 py-3 text-[13px] leading-snug text-slate-700">
            {GOES.map((g) => <li key={g}>• {g}</li>)}
          </ul>
          <p className="mt-2.5 text-[12px] leading-relaxed text-slate-500">
            Kept: reports you've made about other people's behaviour (safety records), and payment records if you've ever supported Seen (needed for tax).
            {" "}Any active supporter subscription is cancelled.
          </p>
          {apple && (
            <p className="mt-2 text-[12px] leading-relaxed text-slate-500">
              You'll be asked to confirm with Apple — that also disconnects Seen from your Apple ID.
            </p>
          )}
          <label className="mt-4 block text-[12.5px] font-semibold text-slate-700" htmlFor="del-confirm">Type DELETE to confirm</label>
          <input id="del-confirm" value={typed} onChange={(e) => setTyped(e.target.value)} autoCapitalize="characters" autoComplete="off" autoCorrect="off" spellCheck={false}
            disabled={state === "working"} placeholder="DELETE"
            className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-[15px] tracking-wider text-slate-900 placeholder:text-slate-300 focus:border-red-400 focus:outline-none" />
          {state === "error" && (
            <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-[12.5px] font-semibold text-red-700" role="alert">
              Something went wrong and your account wasn't fully deleted. Please check your connection and try again.
            </p>
          )}
          {state === "cancelled" && (
            <p className="mt-2 rounded-xl bg-slate-100 px-3 py-2 text-[12.5px] text-slate-700" role="status">Cancelled — your account is still here.</p>
          )}
          <button onClick={run} disabled={!ready || state === "working"}
            className={`mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-red-600 py-3.5 text-[14.5px] font-bold text-white transition-opacity ${ready ? "" : "opacity-40"}`}>
            {state === "working" ? <><Loader2 size={16} className="animate-spin" /> Deleting your account…</> : "Delete my account permanently"}
          </button>
          {state !== "working" && (
            <button onClick={onClose} className="mt-2 w-full py-2.5 text-[13.5px] font-semibold text-slate-500">Keep my account</button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

export function AccountDeletedScreen({ onDone }) {
  // The auth screens' classes: their background and type move together in night mode.
  return (
    <div className="seen-auth-bg flex min-h-[100dvh] items-center justify-center bg-gradient-to-b from-[#FFF6EF] via-[#f7f7f6] to-[#f6f5f2] px-8">
      <div className="w-full max-w-sm text-center" role="status">
        <p className="text-[40px]" aria-hidden>💛</p>
        <h1 className="seen-auth-title mt-3 text-[22px] font-extrabold">Your account has been deleted.</h1>
        <p className="seen-auth-sub mt-2 text-[14.5px] leading-relaxed">
          Your profile, messages and everything else you made in Seen have been removed.
        </p>
        <p className="seen-auth-sub mt-2 text-[14.5px] leading-relaxed">Thank you for every kind word you sent. You're always welcome back.</p>
        <button onClick={onDone} className="mt-7 w-full rounded-2xl bg-teal-600 py-3.5 text-[15px] font-bold text-white hover:bg-teal-700">Done</button>
      </div>
    </div>
  );
}
