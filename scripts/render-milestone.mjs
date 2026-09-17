// render-milestone.mjs — draws the Grow tab's hero card with the milestone celebration showing.
//
// ── WHY THIS EXISTS ──────────────────────────────────────────────────────────────────────────
// Its sibling render-tree-stages.mjs was written because three attempts at the late tree stages
// passed every check and looked wrong. This is the same lesson one level up: the celebration and
// the card it lands on are 250 lines apart in MySeenStory.jsx and neither mentions the other, so
// "the announcement is printed through the progress line" is invisible in the source and obvious
// in a picture.
//
// It caught exactly that. The overlay's text block sat at `absolute inset-x-0 bottom-6` of the
// whole hero button — not of the tree — which is where the card already puts "N drops · M more
// until X" and "See how it grows →". Measured here: the block spanned 517-556px and the progress
// line 517-530px.
//
// ── WHAT IT IMPORTS AND WHAT IT REPRODUCES ───────────────────────────────────────────────────
// TreeScene is the REAL component, read out of KindnessTree.jsx and server-rendered — the same
// strip-the-imports trick render-tree-stages.mjs uses, and for the same reason: a redrawn fixture
// would have been just as wrong as the component and agreed with it.
//
// The hero card AROUND it is reproduced rather than imported, because MySeenStory.jsx pulls in
// Firestore and the sound engine and cannot be rendered in a bare Node process. So this is a
// faithful copy of that markup, not the markup itself, and it has to be kept in step by hand — it
// proves a GEOMETRY, which is what the bug was, and it is not a regression test.
//
// The app's Tailwind is loaded from a CDN at runtime and is unreachable here, so the utilities
// used by the hero are written out longhand below, with the real @keyframes copied from index.css.
//
//   node scripts/render-milestone.mjs /tmp/milestone.html
import { readFileSync, writeFileSync } from "fs";
import { transform } from "esbuild";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server.node";

const ROOT = new URL("../", import.meta.url);
const src = readFileSync(new URL("src/KindnessTree.jsx", ROOT), "utf8")
  .replace(/^import .*$/gm, "")
  .replace(/export (const|function) /g, "$1 ");
const OUT = process.argv[2] || "/tmp/seen-milestone.html";
const { code } = await transform(src, { loader: "jsx", format: "cjs", target: "node20" });
const { TreeScene, TREE_STAGES } = new Function(
  "React", "exports", "module", "require",
  `${code}; return { TreeScene, TREE_STAGES };`,
)(React, {}, { exports: {} }, () => ({}));

const IDX = 11;                       // a mid-late stage, so there is a real canopy to obscure
const stage = TREE_STAGES[IDX];
const tree = renderToStaticMarkup(
  React.createElement(TreeScene, { stageIdx: IDX, size: 210, ambient: true, hour: 11 }),
);

const petals = ["🌸", "🌼", "🍃", "🌺", "🍂", "🌸", "🍃", "🌼"]
  .map((p, i) => `<span style="position:absolute;top:-14px;left:${6 + i * 12}%;font-size:${15 + (i % 3) * 4}px;
    --spin:${(i % 2 ? 1 : -1) * (240 + i * 40)}deg;
    animation:seenPetalFall ${2.6 + (i % 4) * 0.5}s cubic-bezier(0.35,0.6,0.5,1) ${i * 0.16}s both">${p}</span>`)
  .join("");

const progress = `
  <div class="prog">
    <div class="bar"><div class="fill" style="width:62%"></div></div>
    <p class="pnote">14,200 drops · 5,800 more until <strong>Blossoming</strong></p>
  </div>
  <span class="cta">See how it grows →</span>`;

// ── BEFORE: the overlay as shipped — absolute inset-0, text at bottom-6, over everything ──
const before = `
<button class="hero">
  <div class="treebox">${tree}</div>
  <div class="overlay" aria-hidden="true">
    <div class="glow"></div>
    ${petals}
    <div class="ovtext">
      <p class="eyebrow">New stage reached</p>
      <p class="bigname reveal">${stage.name}</p>
    </div>
  </div>
  <p class="bigname">${stage.name}</p>
  <p class="blurb">${stage.blurb}</p>
  ${progress}
</button>`;

// ── AFTER: glow + petals stay absolute; the words take the place of the name and blurb ──
const after = `
<button class="hero">
  <div class="treebox">${tree}</div>
  <div class="overlay" aria-hidden="true">
    <div class="glow"></div>
    ${petals}
  </div>
  <div class="namebox">
    <p class="eyebrow">New stage reached</p>
    <p class="bigname reveal">${stage.name}</p>
  </div>
  ${progress}
</button>`;

// ── The floating "Your tree grew" card, composited where App.jsx puts it ──
const floater = `
<div class="floatwrap">
  <div class="floatcard">
    <span class="fem">🌳</span>
    <span>
      <span class="flabel">Your tree grew</span>
      <span class="fname">${stage.name}</span>
      <span class="fblurb">${stage.blurb}</span>
    </span>
  </div>
</div>`;

const phone = (label, card, withFloater) => `
<div class="col">
  <div class="lbl">${label}</div>
  <div class="shell">
    <div class="apphdr">Hey Mahiman</div>
    <div class="tabbar">🤝 Connect &nbsp; 🌱 Practice &nbsp; 📓 Reflect &nbsp; <b>🌳 Grow</b></div>
    <div class="growscroll">${card}
      <p class="oneliner">Every kind act you make waters this tree, Mahiman.</p>
    </div>
    ${withFloater ? floater : ""}
  </div>
</div>`;

writeFileSync(OUT, `<!doctype html><meta charset="utf-8">
<title>Grow — milestone</title><style>
*{box-sizing:border-box;margin:0;padding:0;font-family:Inter,system-ui,sans-serif}
body{background:#1b1b1b;color:#fff;padding:14px}
#r{display:flex;gap:16px}
.lbl{font:700 12px system-ui;margin-bottom:6px}
.shell{position:relative;width:414px;height:820px;display:flex;flex-direction:column;overflow:hidden;background:#fff;border-radius:16px}
.apphdr{flex-shrink:0;height:110px;display:flex;align-items:flex-end;padding:14px;font:800 22px system-ui;color:#0f172a}
.tabbar{flex-shrink:0;height:52px;display:flex;align-items:center;padding:0 14px;border-bottom:1px solid #f1f5f9;color:#94a3b8;font:600 13px system-ui}
.tabbar b{color:#A82E2C}
.growscroll{flex:1;overflow-y:auto;background:rgba(248,250,252,.6);padding:16px}
.oneliner{margin-top:16px;text-align:center;font:400 13px system-ui;color:#64748b}
/* hero */
.hero{position:relative;display:block;width:100%;border:1px solid #FFE0DE;border-radius:24px;
  background:linear-gradient(to bottom,#FEF2F8,#FFF1F0);padding:20px 16px 24px;text-align:center;overflow:hidden}
.treebox{margin:0 auto;width:210px;height:210px}
.treebox svg{width:100%;height:auto}
.bigname{margin-top:4px;font:800 20px system-ui;color:#1e293b}
.blurb{margin-top:2px;font:400 12px system-ui;color:#64748b}
.namebox{min-height:52px}
.prog{margin:16px auto 0;max-width:20rem}
.bar{height:8px;border-radius:999px;background:rgba(255,255,255,.7);overflow:hidden}
.fill{height:100%;border-radius:999px;background:linear-gradient(to right,#F68CBF,#FF8580)}
.pnote{margin-top:6px;font:400 11px system-ui;color:#64748b}
.cta{display:inline-block;margin-top:12px;font:600 11px system-ui;color:#D24341}
/* overlay */
.overlay{pointer-events:none;position:absolute;inset:0;overflow:hidden;border-radius:24px}
.glow{position:absolute;inset:0;border-radius:24px;animation:seenMilestoneGlow 2.4s ease-in-out 2}
.ovtext{position:absolute;left:0;right:0;bottom:24px;text-align:center}
.eyebrow{font:700 10px system-ui;text-transform:uppercase;letter-spacing:.2em;color:#d97706;
  animation:seenFadeUp 600ms ease 500ms both}
.reveal{animation:seenStageReveal 1100ms cubic-bezier(0.2,0.9,0.3,1) 700ms both}
/* floating card */
.floatwrap{position:absolute;left:0;right:0;top:104px;z-index:240;display:flex;justify-content:center;padding:0 16px;pointer-events:none}
.floatcard{display:flex;align-items:center;gap:12px;max-width:24rem;border:1px solid #FFD4B0;background:#fff;
  border-radius:16px;padding:10px 16px;text-align:left;box-shadow:0 10px 15px -3px rgba(0,0,0,.1)}
.fem{font-size:20px}
.flabel{display:block;font:700 10px system-ui;text-transform:uppercase;letter-spacing:.05em;color:#E07C33}
.fname{display:block;font:700 13px system-ui;color:#1e293b}
.fblurb{display:block;font:400 11px system-ui;color:#64748b}
@keyframes seenFadeUp{0%{transform:translateY(8px);opacity:0}100%{transform:translateY(0);opacity:1}}
@keyframes seenPetalFall{0%{transform:translateY(-10px) rotate(0deg);opacity:0}10%{opacity:1}
  100%{transform:translateY(230px) rotate(var(--spin,320deg));opacity:0}}
@keyframes seenStageReveal{0%{opacity:0;transform:translateY(8px) scale(0.94);letter-spacing:.3em}
  60%{opacity:1;letter-spacing:.08em}100%{opacity:1;transform:translateY(0) scale(1);letter-spacing:.02em}}
@keyframes seenMilestoneGlow{0%,100%{box-shadow:0 0 0 0 rgba(251,191,36,0)}
  50%{box-shadow:0 0 34px 6px rgba(251,191,36,.45)}}
</style><div id="r">
${phone("BEFORE — overlay text over the card's own text", before, false)}
${phone("BEFORE — the \"Your tree grew\" card is still up on Grow", after.replace(/class="namebox"/, 'class="namebox" style="visibility:hidden"'), true)}
${phone("AFTER — words in flow, one name, nothing on top", after, false)}
</div>`);
console.log(`wrote ${OUT} — stage ${IDX} ${stage.name}`);
