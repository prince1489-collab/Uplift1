// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.
//
// treeMilestone.js — "has this person already been told they reached this stage?"
//
// ── WHY THIS IS ITS OWN FILE ─────────────────────────────────────────────────────────────────
// Reaching a new stage of the Kindness Tree is the biggest reward the app has, and until now
// almost nobody saw it happen.
//
// The celebration — petals, the stage name drawing itself in — lived inside MySeenStory, so it
// fired only when somebody OPENED the Grow tab. Nothing in the app routes anyone to Grow. App.jsx
// separately noticed the same crossing and played a chime, and that was the whole of what a
// person elsewhere in the app got — on a phone with sound muted, which is the default posture for
// most people most of the time, it was nothing at all. Earn a stage on Tuesday, find out on
// Friday, if ever.
//
// So two places now want to celebrate the same event, and they must not both do it. The latch
// moves here, where it can be CLAIMED: the first caller to ask about a given stage gets true and
// every later one gets false, whichever component that turns out to be.
//
// ── THE FIRST-RUN RULE ───────────────────────────────────────────────────────────────────────
// With no latch stored, we record where the person is and celebrate nothing. Without that, every
// existing account throws a party for a stage they reached weeks ago the first time they open the
// new build — which is worse than silence, because it is a celebration they know they did not
// earn just now, and it teaches them the ones that follow are noise too.

const STAGE_SEEN_KEY = "seen_v2_tree_stage_seen";

function read() {
  try {
    const raw = localStorage.getItem(STAGE_SEEN_KEY);
    return raw == null ? null : Number(raw);
  } catch { return null; }
}

function write(idx) {
  try { localStorage.setItem(STAGE_SEEN_KEY, String(idx)); } catch { /* ignore */ }
}

// Ask whether THIS arrival is worth announcing, and claim it if so.
//
// Claiming and asking are one call on purpose. Two callers race this on the render where the
// balance crosses a threshold, and a read-then-write with anything in between is how the same
// stage gets celebrated twice on the same screen.
//
// Returns false for a stage already seen, for a stage below where they are (a balance can fall
// if a reflection is deleted, and dropping back does not un-earn the announcement), and for the
// very first run on a device.
export function claimStageUp(stageIdx) {
  if (!Number.isFinite(stageIdx) || stageIdx < 0) return false;
  const seen = read();
  if (seen != null && stageIdx <= seen) return false;
  write(stageIdx);
  return seen != null;
}
