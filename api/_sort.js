// _sort.js — where a kind act went: family, friends, community, strangers, work or online (3.36).
//
// The founder: real-life prompts were "restricting users being able to input something kind they
// did", so people can now say it in their own words — and Seen sorts each act into an area that
// it can show back ("Your kindness went to family (3), strangers (2)…" in Seen's weekly message).
// The words go to the same model that already screens every message, through
// /api/moderate-message ({ sort: "kind_act", text }), so there is no new function. Nothing is
// stored here; the app writes the area onto its own kindness-log entry. Pure apart from the model
// call, which is passed in, so it is tested in node (scripts/test-sort-kindness.mjs).

export const AREA_IDS = ["family", "friends", "community", "strangers", "work", "online"];
export const SORT_MODEL = "claude-haiku-4-5-20251001";
export const MAX_ACT = 240;

export function sortPrompt(text) {
  return {
    system:
      "You sort a kind act someone did by WHO it was for. Areas:\n" +
      "family — relatives, a partner, children, parents, in-laws\n" +
      "friends — friends\n" +
      "community — neighbours, local people, shop staff, drivers, carers, a community group\n" +
      "strangers — people they don't know\n" +
      "work — colleagues, classmates, teachers, clients\n" +
      "online — people reached through the internet or messages, including on this app\n" +
      "Reply with ONLY one word: family, friends, community, strangers, work or online. " +
      "If it doesn't say who, choose the most likely.",
    user: `Kind act: "${String(text || "").replace(/\s+/g, " ").trim().slice(0, MAX_ACT)}"`,
  };
}

// The first known area named in the reply, or null.
export function parseArea(raw) {
  const words = String(raw || "").toLowerCase().match(/[a-z]+/g) || [];
  return words.find((w) => AREA_IDS.includes(w)) || null;
}

// `ai({ system, user })` returns the model's text. Any failure is simply "not sorted".
export async function sortKindAct(text, ai) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  if (!clean || typeof ai !== "function") return null;
  try { return parseArea(await ai(sortPrompt(clean))); } catch { return null; }
}
