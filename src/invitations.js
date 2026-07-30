// invitations.js — deciding which single thing the app asks of you, and when.
//
// The bell used to show real events (a like, a wave, a ripple) plus two hardcoded nudges,
// while everything else the app wanted to say was scattered through the feed as banners. This
// makes the bell the one place app-to-user messages live, and makes the pacing deliberate.
//
// THREE RULES, in order of how much they matter.
//
// 1. THE BADGE COUNTS HUMANS ONLY. A red dot must mean "a person did something". The moment it
//    also means "the app wants something", people stop trusting the badge and stop opening the
//    bell — and then the real notifications go unread too. Invitations appear in the list; they
//    never touch the count. This is enforced in App.jsx, not here, but it is the reason this
//    file returns invitations separately from events.
//
// 2. ONE AT A TIME. Four stacked asks is a chore list, and a chore list gets ignored as a
//    whole rather than item by item. `pickInvitation` returns at most one.
//
// 3. "NOT NOW" IS NOT "NEVER". Dismissals are timestamps, not booleans, so an invitation comes
//    back after its cooldown. The old code used permanent flags: one accidental tap on ✕ and
//    the wellbeing check-in was gone for the lifetime of the install.
//
// 4. DECLINING TEACHES IT TO STOP. Each time an invitation is dismissed its cooldown doubles,
//    and after MAX_DECLINES it is never shown again. This rule exists because the first version
//    of this file did NOT have it, and simulating a passive user over 60 days produced THIRTY
//    invitations — one every two days, forever. Fixed cooldowns plus several eligible
//    invitations means the global floor becomes the schedule rather than a safety net.
//
// Plus a global floor — MIN_GAP_MS between any two invitations — which is what stops
// satisfying one invitation from immediately surfacing the next.

const STORE_KEY = "seen_invitations_v1"; // { [id]: { at, declines } } plus { _last: ts }
const DAY = 24 * 60 * 60 * 1000;

export const MIN_GAP_MS = 3 * DAY;  // never two invitations closer together than this
export const MAX_DECLINES = 3;      // after this many, the app stops asking for good

const read = () => {
  try { return JSON.parse(localStorage.getItem(STORE_KEY) || "{}"); } catch { return {}; }
};
const write = (v) => {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(v)); } catch { /* ignore */ }
};

// Called when the user dismisses or acts on an invitation. Records the time and increments a
// decline counter rather than setting a "done" flag: the cooldown can bring it back if the
// thing is still undone, but each decline makes the next wait longer and the fourth stops it.
export function snoozeInvitation(id, now = Date.now()) {
  const store = read();
  const prev = store[id];
  const declines = (typeof prev === "object" ? prev.declines : 0) || 0;
  store[id] = { at: now, declines: declines + 1 };
  store._last = now;
  write(store);
}

// Cooldown grows with each decline: 1x, 2x, 4x. Someone who ignores an ask twice is telling
// you something, and asking again on the same schedule is not listening.
export function effectiveCooldown(inv, declines) {
  return inv.cooldown * Math.pow(2, Math.max(0, declines - 1));
}

// Lower `priority` wins. Ordered by what unblocks the most: an empty Focused Feed makes half
// the app look broken, so following someone comes first; a wellbeing re-check is the least
// urgent thing here.
//
// `earliest` is measured from the account's start, so day one is never a checklist.
// `cooldown` is how long after being shown-and-dismissed it may return.
export const INVITATIONS = [
  {
    id: "follow",
    priority: 1,
    earliest: 0,
    cooldown: 3 * DAY,
    // Only while the list is genuinely empty. Once someone follows anyone they have found the
    // feature, and repeating the ask would be noise.
    when: (ctx) => ctx.followCount === 0,
  },
  {
    id: "globe",
    priority: 2,
    earliest: 2 * DAY,
    cooldown: 7 * DAY,
    when: (ctx) => !ctx.hasOpenedGlobe,
  },
  {
    id: "glimpse",
    priority: 3,
    earliest: 3 * DAY,
    cooldown: 7 * DAY,
    when: (ctx) => !ctx.hasGlimpse,
  },
  {
    id: "wellbeing",
    priority: 4,
    earliest: 3 * DAY,
    cooldown: 14 * DAY,
    when: (ctx) => !ctx.hasWellbeing,
  },
  {
    id: "wellbeing_recheck",
    priority: 5,
    earliest: 30 * DAY,
    cooldown: 30 * DAY,
    // Only for people who HAVE done one, and not for a month. Distinct from `wellbeing` so the
    // copy can differ: a first check-in and a re-check are different invitations.
    when: (ctx) => ctx.hasWellbeing && ctx.lastWellbeingAt > 0
      && (ctx.now - ctx.lastWellbeingAt) > 30 * DAY,
  },
];

// Pick the one invitation to show, or null. Exported pure and side-effect free so the pacing
// rules can be tested against a simulated timeline rather than trusted.
export function pickInvitation(ctx) {
  const now = ctx.now ?? Date.now();
  const store = ctx.store ?? read();
  const accountAge = now - (ctx.accountStartedAt || now);

  // The global floor. Checked before anything else: if an invitation was shown recently,
  // nothing else is eligible no matter how many conditions are true.
  if (store._last && now - store._last < MIN_GAP_MS) return null;

  const eligible = INVITATIONS
    .filter((inv) => {
      if (accountAge < inv.earliest) return false;
      if (!inv.when({ ...ctx, now })) return false;
      const rec = store[inv.id];
      // Tolerates the older shape (a bare timestamp) so an existing install isn't reset.
      const lastShown = typeof rec === "object" ? rec.at : rec;
      const declines = (typeof rec === "object" ? rec.declines : 0) || 0;
      if (declines >= MAX_DECLINES) return false; // asked enough; stop asking
      if (lastShown && now - lastShown < effectiveCooldown(inv, declines)) return false;
      return true;
    })
    .sort((a, b) => a.priority - b.priority);

  return eligible[0] ?? null;
}

// Exposed for the pacing test, which needs to drive the store explicitly.
export const _internal = { read, write, STORE_KEY, DAY };
