// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.

import React, { useState } from "react";
import { X } from "lucide-react";
import { openAppStore } from "./updateCheck";

export default function UpdatePrompt({ version, onDismiss }) {
  const [busy, setBusy] = useState(false);

  const handleUpdate = async () => {
    setBusy(true);
    await openAppStore();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      style={{ animation: "seenFadeUp 320ms ease both" }}
    >
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-lg">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Update Available</h2>
            <p className="mt-1 text-sm text-slate-600">Version {version} is here</p>
          </div>
          <button
            onClick={onDismiss}
            className="text-slate-300 hover:text-slate-500"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <p className="text-sm text-slate-700">
          A new version of Seen is available with improvements and fixes. Update now
          to stay up to date.
        </p>

        <div className="mt-5 flex gap-2">
          <button
            onClick={onDismiss}
            className="flex-1 rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Later
          </button>
          <button
            onClick={handleUpdate}
            disabled={busy}
            className="flex-1 rounded-full bg-teal-600 px-4 py-3 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-70"
          >
            {busy ? "Opening…" : "Update"}
          </button>
        </div>
      </div>
    </div>
  );
}
