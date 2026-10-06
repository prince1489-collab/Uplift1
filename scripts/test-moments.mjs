// test-moments.mjs — the private-kindness card stays one calm card, however busy the day.
import { summarizeMoments, rowLine, placeName, headline, dayLine, ago, MAX_ROWS } from "../src/kindMoments.js";
const results = [];
const check = (n, ok, d = "") => results.push([ok, ok ? n : `${n} — ${d}`]);
const NOW = new Date(2026, 9, 6, 15, 0).getTime();
const H = 3600000;
let id = 0;
const m = (a, b, hoursAgo, extra = {}) => ({ id: `m${++id}`, aUid: `u${id}`, bUid: `v${id}`, aCountry: a, bCountry: b, ts: NOW - hoursAgo * H, ...extra });

// ── A quiet day: three different pairs, three rows ──
const quiet = summarizeMoments([m("United Kingdom", "Mexico", 2), m("Mexico", "India", 4), m("United Kingdom", "United Kingdom", 5)], { now: NOW });
check("one card for the day", quiet.length === 1 && quiet[0].isToday);
check("three rows, nothing left over", quiet[0].rows.length === 3 && quiet[0].more === null);
check("headline counts them", headline(quiet[0]) === "3 private kindnesses today", headline(quiet[0]));
check("same country is a home row", quiet[0].rows.some((r) => r.same && /United Kingdom/.test(r.key)));
check("no 'United Kingdom and United Kingdom'", !quiet[0].rows.map((r) => rowLine(r).text).join(" ").includes("United Kingdom and"));

// ── A busy day: 100 kindnesses, 10 countries — still at most three rows ──
const C = ["United Kingdom", "Mexico", "India", "Japan", "Brazil", "United States", "Nigeria", "Germany", "Kenya", "Australia"];
const busyList = [];
for (let i = 0; i < 12; i++) busyList.push(m("United Kingdom", "Mexico", 1 + i * 0.1));
for (let i = 0; i < 21; i++) busyList.push(m("India", "India", 1 + i * 0.1));
while (busyList.length < 100) { const k = busyList.length; busyList.push(m(C[k % 10], C[(k * 3 + 1) % 10], 1 + (k % 9))); }
const busy = summarizeMoments(busyList, { now: NOW })[0];
check("busy day: header carries the total", busy.total === 100 && busy.countries === 10, `${busy.total}/${busy.countries}`);
check("busy day: never more than three rows", busy.rows.length === MAX_ROWS, busy.rows.length);
check("busy day: the rest add up", busy.rows.reduce((n, r) => n + r.count, 0) + (busy.more?.count || 0) === 100);
check("busy day: busiest pair is merged", busy.rows.some((r) => r.count === 21) && busy.rows.some((r) => r.count >= 12));
check("merged rows read as a pair", /kept it going|Close to home in/.test(rowLine(busy.rows[0]).text), rowLine(busy.rows[0]).text);

// ── Your own moments come first (but get no badge) ──
const mine = summarizeMoments([...busyList, m("Japan", "Kenya", 3, { aUid: "ME" })], { now: NOW, myUid: "ME" })[0];
check("your own moment is a shown row", mine.rows[0].mine === true && mine.rows[0].aCountry === "Japan");

// ── Earlier days fold to one line each ──
const days = summarizeMoments([m("India", "India", 2), m("United Kingdom", "Mexico", 26), m("Mexico", "India", 27)], { now: NOW });
check("one entry per day, newest first", days.length === 2 && days[0].label === "Today" && days[1].label === "Yesterday", days.map((d) => d.label).join());
check("yesterday's line", dayLine(days[1]) === "2 kindnesses across 3 countries", dayLine(days[1]));
check("a one-country day names it", dayLine(days[0]) === "1 kindness in India", dayLine(days[0]));

// ── Wording ──
check("the UK, not United Kingdom", placeName("United Kingdom") === "the UK");
check("India stays India", placeName("India") === "India");
check("a line starting with a place is capitalised", !/^the /.test(rowLine({ key: "x", aCountry: "United Kingdom", bCountry: "India", count: 3 }).text));
const lines = new Set(["a", "b", "c", "d", "e", "f", "g", "h"].map((k) => rowLine({ key: k, aCountry: "Mexico", bCountry: "India", count: 1 }).text));
check("single rows vary their wording", lines.size >= 3, lines.size);
let distinct = 0;
for (let k = 0; k < 60; k++) {
  const d = summarizeMoments([m("Mexico", "India", 1 + k * 24), m("Japan", "Kenya", 1.1 + k * 24), m("Brazil", "Germany", 1.2 + k * 24)], { now: NOW })[0];
  const t = d.rows.map((r) => rowLine(r).text.replace(/Mexico|India|Japan|Kenya|Brazil|Germany/g, "X"));
  if (new Set(t).size === 3) distinct++;
}
check("rows on the same day never share a sentence", distinct === 60, `${distinct}/60`);
const ways = summarizeMoments([m("United Kingdom", "Mexico", 1), m("Mexico", "United Kingdom", 2), m("Japan", "Kenya", 3), m("India", "India", 4)], { now: NOW })[0].rows;
check("a pair with kindness both ways is marked bothWays", ways.find((r) => /Mexico/.test(r.key))?.bothWays === true);
check("a one-way pair is not", ways.find((r) => /Japan/.test(r.key))?.bothWays === false);
check("same-country rows go back and forth", ways.find((r) => r.same)?.bothWays === true);
check("a one-way row runs sender → recipient (left → right)", ways.find((r) => /Japan/.test(r.key))?.aCountry === "Japan");
check("unknown countries still read well", rowLine({ key: "u", aCountry: null, bCountry: "India", count: 1 }).text.length > 10);
check("no distances anywhere", ![...lines].join(" ").match(/\bkm\b|miles/));
check("ago reads naturally", ago(NOW - 5 * 60000, NOW) === "5 min ago" && ago(NOW - 2 * H, NOW) === "2h ago");

let failed = 0;
for (const [ok, n] of results) { console.log(`${ok ? "  ok  " : "  FAIL"}  ${n}`); if (!ok) failed++; }
console.log(`\n  ${results.length - failed}/${results.length} kind-moment tests passed.`);
process.exit(failed ? 1 : 0);
