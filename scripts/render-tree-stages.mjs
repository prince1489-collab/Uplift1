// render-tree-stages.mjs — draws the REAL TreeScene at every stage, to an HTML page.
//
// check-tree.cjs asserts that each stage differs from the one before it, and it does that by
// reading the gate expressions — which tells you a feature is switched on somewhere, not that a
// person can see it. Three separate attempts at the late stages passed that test and looked wrong:
// a dark canopy drawn on top read as a second tree behind this one, buds drawn with a green base
// read as smudges, and root-coloured roots inside the soil mound vanished into the root fan
// already drawn there. All three were invisible in the code and obvious in a picture.
//
// So this exists to produce the picture. It imports the component and renders it, rather than
// redrawing the tree in a test fixture — a fixture would have been just as wrong as the component
// and agreed with it.
//
//   node scripts/render-tree-stages.mjs /tmp/stages.html [fromStage] [toStage]
import { readFileSync, writeFileSync } from "fs";
import { transform } from "esbuild";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server.node";

const src = readFileSync(new URL("../src/KindnessTree.jsx", import.meta.url), "utf8")
  // The scene draws with React and arithmetic and nothing else; its imports are for the panels
  // further down the file, which are not rendered here.
  .replace(/^import .*$/gm, "")
  .replace(/export (const|function) /g, "$1 ");
const { code } = await transform(src, { loader: "jsx", format: "cjs", target: "node20" });
const { TreeScene, TREE_STAGES } = new Function(
  "React", "exports", "module", "require",
  `${code}; return { TreeScene, TREE_STAGES };`,
)(React, {}, { exports: {} }, () => ({}));

const out = process.argv[2] || "/tmp/tree-stages.html";
const from = Number(process.argv[3] ?? 0);
const to = Number(process.argv[4] ?? TREE_STAGES.length - 1);

const cells = TREE_STAGES
  .map((s, i) => [s, i])
  .filter(([, i]) => i >= from && i <= to)
  .map(([s, i]) => `<figure><div>${renderToStaticMarkup(
    React.createElement(TreeScene, { stageIdx: i, size: 190, ambient: true, hour: 11 }),
  )}</div><figcaption>${i} · ${s.name}<br><small>${s.min.toLocaleString()}</small></figcaption></figure>`)
  .join("\n");

writeFileSync(out, `<!doctype html><meta charset="utf-8"><title>Kindness Tree — every stage</title><style>
body{margin:0;padding:12px;background:#f1f5f9;font-family:Inter,system-ui,sans-serif;
     display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px}
figure{margin:0;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:3px;text-align:center}
figcaption{font-size:10px;color:#334155;font-weight:700;padding-bottom:4px;line-height:1.4}
small{font-weight:500;color:#94a3b8}
svg{width:100%;height:auto}
</style>${cells}`);
console.log(`wrote ${out} — stages ${from}–${to}`);
