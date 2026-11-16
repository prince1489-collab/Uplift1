// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.
//
// cardBudget.js — at most one card a week after a kind act (3.22).
//
// Every kind act used to open the bar on a "Feel it" card, then a question ("Finish it: the
// smallest thing that ever made my day was…"), then the reminder chooser — and a card left
// unanswered was waiting again the next time the bar opened, stacked in front of the options. A
// screen recording of a normal day showed every one of them skipped. Asked for after every act,
// reflection is homework; asked for now and then, it is a moment.
//
// So: the "Feel it" card at most once a week, the question at most once a week and never on the
// same day as the card, each tied to the ONE act it was offered for. Any other act gets one warm
// confirmation and nothing to fill in. Per device, like the rest of the bar's day state.

// ── Never after you've just said it (3.24) ───────────────────────────────────────────────────
// Telling someone how their words landed — or writing them a note, or answering a stranger's kind
// words — IS saying how you feel, in your own words or in one tap. Being asked straight after how
// that felt, then why, then who's next was the screen people skipped every time. Those acts are
// followed by nothing but the sheet's own "Sent ✓", and they don't use up the week's card.
export const QUIET_ROUTES = new Set(["reply", "note"]);
export const isQuietAct = (dayState) => QUIET_ROUTES.has(dayState?.lastAct?.route);

const WEEK_MS = 7 * 86400000;
const KEY = { feel: "seen_card_feel", reflect: "seen_card_reflect" };

function read(kind) {
  try { return JSON.parse(localStorage.getItem(KEY[kind]) || "null"); } catch { return null; }
}
function write(kind, value) {
  try { localStorage.setItem(KEY[kind], JSON.stringify(value)); } catch { /* storage blocked */ }
}
const isFor = (rec, day, n) => Boolean(rec) && rec.day === day && rec.n === n;

// Is the card of this kind the one offered for act `n` of `day`?
export function cardFor(kind, day, n) {
  return isFor(read(kind), day, n);
}

// A new act just happened (`n` of `day`). Returns the card it gets — "feel", "reflect" — or null.
// Asking again for the same act returns the same answer.
export function claimCard(day, n, now = Date.now()) {
  const feel = read("feel");
  const reflect = read("reflect");
  if (isFor(feel, day, n)) return "feel";
  if (isFor(reflect, day, n)) return "reflect";
  if (!feel || now - Number(feel.at || 0) >= WEEK_MS) {
    write("feel", { at: now, day, n });
    return "feel";
  }
  if ((!reflect || now - Number(reflect.at || 0) >= WEEK_MS) && feel.day !== day) {
    write("reflect", { at: now, day, n });
    return "reflect";
  }
  return null;
}
