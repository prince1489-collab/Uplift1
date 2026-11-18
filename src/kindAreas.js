// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.
//
// kindAreas.js — where someone's kindness goes, in words (3.36).
//
// Every kind act lands in one of six areas. Some are known from what the act was — a message to a
// stranger is kindness to strangers; a reply or a note on Seen is kindness online unless the AI
// sorted it otherwise — and a real-life act is sorted by the AI from the words (api/_sort.js),
// which the app writes onto the kindness-log entry as `area`. Seen's weekly message then says it
// back: "Your kindness went to family (3), strangers (2) and work and study (1)."
// Pure, so it is tested in node (scripts/test-sort-kindness.mjs).

export const AREAS = [
  { id: "family", label: "family" },
  { id: "friends", label: "friends" },
  { id: "community", label: "your community" },
  { id: "strangers", label: "strangers" },
  { id: "work", label: "work and study" },
  { id: "online", label: "people online" },
];
const LABEL = Object.fromEntries(AREAS.map((a) => [a.id, a.label]));
const ms = (t) => (typeof t?.toMillis === "function" ? t.toMillis() : Number(t) || 0);

// The area one kindness-log entry counts towards, or null when it doesn't count (a heart, or a
// real-life act not sorted yet).
export function areaOf(entry) {
  if (!entry || !entry.route) return null;
  if (LABEL[entry.area]) return entry.area;
  if (entry.route === "sent") return "strangers";
  if (entry.route === "reply" || entry.route === "note") return "online";
  return null;
}

// "Your kindness went to family (3), strangers (2) and work and study (1)." — the acts between
// `from` and `to`, most first. Null when nothing in the window counts.
export function areasLine(entries = [], { from = 0, to = Infinity } = {}) {
  const counts = new Map();
  for (const e of entries || []) {
    const at = ms(e?.at);
    if (at < from || at > to) continue;
    const a = areaOf(e);
    if (a) counts.set(a, (counts.get(a) || 0) + 1);
  }
  if (!counts.size) return null;
  const order = AREAS.map((a) => a.id);
  const parts = [...counts.entries()]
    .sort((x, y) => y[1] - x[1] || order.indexOf(x[0]) - order.indexOf(y[0]))
    .map(([a, n]) => `${LABEL[a]} (${n})`);
  const list = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
  return `Your kindness went to ${list}.`;
}
