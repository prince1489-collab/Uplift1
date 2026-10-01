// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.
//
// motion.js — one small thing flies from what you just did to the 🌳 Grow tab.
//
// ── WHY THIS AND NOT MORE CONFETTI ───────────────────────────────────────────────────────────
// Seen already has plenty of motion — sparks, confetti, full-screen bursts — and none of it
// answers the question an action leaves behind: where did that go? This does. Every kind act
// sends one glyph (💧 a message, 💌 a reply, 🍃 a real-life act, ☀️ a feeling) in an arc to the
// Grow tab, which gives a small wiggle and a "+n". The tree grows from where you are, without
// having to go and look at it.
//
// The rules every motion here follows:
//   • it shows a CONSEQUENCE (it travels somewhere), not just a celebration
//   • ≤ 800ms, pointer-events none — it never blocks the next tap
//   • one per action, the same vocabulary everywhere
//   • prefers-reduced-motion → no flight; the "+n" simply appears and fades at the tab
//
// Driven by the "seen-points" event points.js already announces for every award, so no call
// site has to remember to animate — anything that waters the tree is seen to water it. Plain
// DOM + Web Animations rather than React state: nothing re-renders for a 700ms decoration.

const GLYPH = {
  send: "💧", post: "💧", postFirst: "💧",
  reply: "💌",
  practice: "🍃", practiceAll: "🍃",
  feeling: "☀️",
  reflect: "✨", story: "🌱",
};
// Awards that should NOT fly: a heart stays on the bubble it was given to, and the daily open
// bonus is not something the person did.
const SILENT = new Set(["like", "dailyOpen"]);

export function prefersReducedMotion() {
  try { return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true; } catch { return false; }
}

// Where the last tap landed — the origin of the flight when the caller does not say. Captured
// on pointerdown so it is the finger's position, not wherever a sheet has since moved to.
let lastPoint = null;
let installed = false;

function growTarget() {
  const el = document.querySelector('[data-fly-target="grow"]');
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (!r.width || !r.height) return null;
  return { el, x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

function plus(target, value) {
  const tag = document.createElement("span");
  tag.textContent = `+${value}`;
  tag.setAttribute("aria-hidden", "true");
  Object.assign(tag.style, {
    // Under the tab when the tab is at the top of the screen (it is, in the app), above it otherwise.
    position: "fixed", left: `${target.x}px`, top: `${target.y < 60 ? target.y + 26 : target.y - 18}px`, transform: "translate(-50%, -50%)",
    font: "800 11px Inter, system-ui, sans-serif", color: "#D24341", pointerEvents: "none", zIndex: 400,
    textShadow: "0 1px 0 #fff",
  });
  document.body.appendChild(tag);
  const anim = tag.animate(
    prefersReducedMotion()
      ? [{ opacity: 0 }, { opacity: 1, offset: 0.2 }, { opacity: 1, offset: 0.7 }, { opacity: 0 }]
      : [{ opacity: 0, transform: "translate(-50%, -10%) scale(0.8)" }, { opacity: 1, transform: "translate(-50%, -50%) scale(1.1)", offset: 0.3 },
         { opacity: 1, transform: "translate(-50%, -50%) scale(1)", offset: 0.7 }, { opacity: 0, transform: "translate(-50%, -80%)" }],
    { duration: 1100, easing: "ease-out" }
  );
  anim.onfinish = () => tag.remove();
}

function wiggle(el) {
  if (prefersReducedMotion()) return;
  el.animate(
    [{ transform: "scale(1)" }, { transform: "scale(1.18) rotate(-6deg)" }, { transform: "scale(0.96) rotate(4deg)" }, { transform: "scale(1)" }],
    { duration: 420, easing: "ease-out" }
  );
}

// Fly `glyph` from `from` ({x, y}) to the Grow tab, then credit `value` there. Safe to call from
// anywhere; does nothing if there is no Grow tab on screen (a full-screen sheet, onboarding).
export function flyToGrow(glyph, value, from = lastPoint) {
  const target = growTarget();
  if (!target) return;
  if (prefersReducedMotion() || !from) {
    plus(target, value);
    return;
  }
  const g = document.createElement("span");
  g.textContent = glyph;
  g.setAttribute("aria-hidden", "true");
  Object.assign(g.style, {
    position: "fixed", left: "0px", top: "0px", fontSize: "20px", lineHeight: "1",
    pointerEvents: "none", zIndex: 400, willChange: "transform, opacity",
  });
  document.body.appendChild(g);
  const dx = target.x - from.x;
  const dy = target.y - from.y;
  // An arc rather than a straight line: the midpoint lifts above both ends, which is what makes
  // it read as something thrown to the tree rather than something sliding off the screen.
  // The Grow tab sits near the top of the screen, so the lift is capped to keep the apex on it.
  const lift = Math.max(0, Math.min(160, Math.abs(dx) * 0.4 + 60, from.y + dy / 2 - 30));
  const at = (t, extra = "") => {
    const x = from.x + dx * t - 10;
    const y = from.y + dy * t - 4 * lift * t * (1 - t) - 10;
    return `translate(${x}px, ${y}px) ${extra}`;
  };
  const anim = g.animate([
    { transform: at(0, "scale(0.6)"), opacity: 0 },
    { transform: at(0.15, "scale(1.15)"), opacity: 1, offset: 0.12 },
    { transform: at(0.5, "scale(1)"), offset: 0.5 },
    { transform: at(0.85, "scale(0.9)"), opacity: 1, offset: 0.85 },
    { transform: at(1, "scale(0.5)"), opacity: 0 },
  ], { duration: 720, easing: "cubic-bezier(.3,.6,.4,1)" });
  anim.onfinish = () => {
    g.remove();
    wiggle(target.el);
    plus(target, value);
  };
}

// Installed once from App. Listens for every award and flies the matching glyph.
export function installFlyToGrow() {
  if (installed || typeof window === "undefined") return () => {};
  installed = true;
  const onDown = (e) => { lastPoint = { x: e.clientX, y: e.clientY }; };
  const onPts = (e) => {
    const { action, value } = e.detail || {};
    if (!value || SILENT.has(action)) return;
    flyToGrow(GLYPH[action] || "💧", value);
  };
  window.addEventListener("pointerdown", onDown, true);
  window.addEventListener("seen-points", onPts);
  return () => {
    installed = false;
    window.removeEventListener("pointerdown", onDown, true);
    window.removeEventListener("seen-points", onPts);
  };
}
