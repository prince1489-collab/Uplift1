// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.
//
// _seen.js — the pure, testable half of "Seen" (3.15): the AI conversation pinned in Messages.
// No network, no Firebase. api/understand.js does the reading and writing; scripts/
// test-understanding.mjs holds every rule below to account.
//
// ── THE PROMISE THIS CODE KEEPS ──────────────────────────────────────────────────────────────
// Seen reflects; it never defines. Everything it says about a person must stand on evidence the
// person can see — something they SAID, plus what they DID — and it must read as an observation
// ("You've mentioned… and you've…"), never a verdict ("You are…"). The model is asked to do this;
// this file makes sure, because a prompt is a request and these are rules:
//   • a reflection needs ≥2 real evidence ids, at least one of them the person's own words;
//   • wording that labels, instructs, diagnoses or guesses at health, faith, sexuality,
//     ethnicity or politics is dropped, however warm it sounds;
//   • anything that reads like someone in difficulty gets no analysis at all — just a kind line
//     and where to find support.

const DAY = 86400000;

// ── Safety ───────────────────────────────────────────────────────────────────────────────────
// Deliberately broad: a false alarm costs one gentle message; a miss could cost much more.
const CRISIS = /\b(kill(ing)? myself|suicid|end(ing)? (it all|my life)|want(ed)? to die|better off dead|no reason to live|self[- ]?harm|hurt(ing)? myself|cut(ting)? myself|overdose|can'?t go on)\b/i;
const CONCERN = /\b(hopeless|worthless|can'?t cope|cannot cope|falling apart|so alone|no one cares|nobody cares|panic attacks?|can'?t stop crying|breaking down|desperate)\b/i;

export function safetyLevel(text) {
  const t = String(text || "");
  if (CRISIS.test(t)) return "crisis";
  if (CONCERN.test(t)) return "concern";
  return "ok";
}

export function supportMessage(level) {
  return level === "crisis"
    ? "Thank you for telling me. I'm an AI, so I can't be the support you deserve right now — but people can. If you're in danger or thinking about ending your life, please contact your local emergency number or a crisis line now. Tap Support for people to talk to, any time."
    : "That sounds like a lot to be carrying. Thank you for telling me. If it would help to talk to someone, Support has people who listen, any time.";
}

// ── Wording guard ────────────────────────────────────────────────────────────────────────────
const LABELS = /\b(you are (a|an|the|so|very|clearly|definitely|really|someone|somebody|the kind)|you'?re (clearly|definitely|the kind|someone who|a natural|an? \w+ person)|you seem to be (a|an|someone|somebody|the)|this (shows|proves|means) you('re| are))\b/i;
const INSTRUCT = /\b(you (should|must|need to|have to|ought to)|make sure (you|to)|try to|i recommend|my advice)\b/i;
const CLINICAL = /\b(depress\w*|anxiety disorder|disorder|adhd|autis\w*|bipolar|ocd|ptsd|diagnos\w*|symptom\w*|therap(y|ist)|medication|burn-?out)\b/i;
const SPECIAL = /\b(relig\w*|faith|christian|muslim|islam\w*|hindu\w*|jewish|sikh|buddhis\w*|athei\w*|gay|lesbian|bisexual|queer|trans\w*gender|sexual\w*|ethnic\w*|racial|politic\w*|conservative|liberal|labour|tory|democrat\w*|republican|pregnan\w*|disab\w*|illness|sick)\b/i;

// For reflections and follow-up questions: everything above is off limits.
export function guardReflection(text, max = 260) {
  const t = String(text || "").replace(/\s+/g, " ").trim();
  if (!t || t.length > max) return null;
  if (LABELS.test(t) || INSTRUCT.test(t) || CLINICAL.test(t) || SPECIAL.test(t)) return null;
  return t;
}

// For a reply to something the person just said: they may mention their faith or their health
// themselves, and an acknowledgement can use their words — but it still never instructs,
// diagnoses or labels.
export function guardReply(text, max = 420) {
  const t = String(text || "").replace(/\s+/g, " ").trim();
  if (!t || t.length > max) return null;
  if (LABELS.test(t) || INSTRUCT.test(t) || CLINICAL.test(t)) return null;
  return t;
}

// ── The evidence ─────────────────────────────────────────────────────────────────────────────
const ROUTE = { act: "real-life act", sent: "message to someone in the world", reply: "reply", note: "kind note" };
const dayName = (ts) => new Date(Number(ts)).toLocaleDateString("en-GB", { weekday: "long" });
const dateLabel = (ts) => new Date(Number(ts)).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
const clip = (s, n) => { const t = String(s || "").replace(/\s+/g, " ").trim(); return t.length > n ? `${t.slice(0, n - 1)}…` : t; };

// What the person SAID (A: answers to Seen; F: Feel-it sentences) and DID (S: patterns), last 30
// days, each with an id the model must cite and a plain label the person will be shown.
export function buildDigest({ answers = [], feelings = [], user = {}, now = Date.now() } = {}) {
  const from = now - 30 * DAY;
  const items = [];
  answers.filter((a) => Number(a.createdAt) >= from && a.text).slice(-12).forEach((a, i) => {
    items.push({ id: `A${i + 1}`, kind: "said", date: Number(a.createdAt),
      text: `Asked "${clip(a.question, 90)}" they answered: "${clip(a.text, 320)}"`,
      label: `You said on ${dayName(a.createdAt)}: “${clip(a.text, 70)}”` });
  });
  const felt = feelings.filter((f) => Number(f.createdAt) >= from && f.feelings?.length)
    .sort((a, b) => Number(a.createdAt) - Number(b.createdAt));
  felt.slice(-10).forEach((f, i) => {
    items.push({ id: `F${i + 1}`, kind: "said", date: Number(f.createdAt),
      text: `After a ${ROUTE[f.route] || "kind act"}${f.toName ? ` for ${f.toName}` : ""} (${dateLabel(f.createdAt)}): "${clip(f.sentence || f.feelings.join(", "), 160)}"`,
      label: `You felt ${f.feelings.join(" and ")} after a ${ROUTE[f.route] || "kind act"} on ${dateLabel(f.createdAt)}` });
  });

  const S = [];
  const days = new Set((user.activeDates || []).filter((d) => typeof d === "string" && Date.parse(`${d}T12:00:00Z`) >= from));
  if (days.size) S.push({ text: `made someone feel seen on ${days.size} of the last 30 days`, label: `You made someone feel seen on ${days.size} of the last 30 days` });
  const routes = {};
  felt.forEach((f) => { routes[f.route] = (routes[f.route] || 0) + 1; });
  const mix = Object.entries(routes).sort((a, b) => b[1] - a[1]);
  if (mix.length) S.push({ text: `kinds of kind acts: ${mix.map(([r, n]) => `${ROUTE[r] || r} ×${n}`).join(", ")}`, label: `Your kind acts were mostly ${ROUTE[mix[0][0]] || mix[0][0]}s (${mix[0][1]})` });
  const people = {};
  felt.forEach((f) => { if (f.toName) people[f.toName] = (people[f.toName] || 0) + 1; });
  const top = Object.entries(people).sort((a, b) => b[1] - a[1]).slice(0, 2);
  if (top.length) S.push({ text: `the people they were kind to most: ${top.map(([n, c]) => `${n} ×${c}`).join(", ")}`, label: `You were kind to ${top.map(([n]) => n).join(" and ")} more than once` });
  const words = {};
  felt.forEach((f) => f.feelings.forEach((w) => { words[w] = (words[w] || 0) + 1; }));
  const topWords = Object.entries(words).sort((a, b) => b[1] - a[1]).slice(0, 3);
  if (topWords.length) S.push({ text: `words they felt most: ${topWords.map(([w, n]) => `${w} ×${n}`).join(", ")}`, label: `You felt ${topWords[0][0]} ${topWords[0][1]} ${topWords[0][1] === 1 ? "time" : "times"} recently` });
  if (user.whosNext?.name) S.push({ text: `recently named ${user.whosNext.name} as someone they'd like to make feel seen next`, label: `You named ${user.whosNext.name} as who's next` });
  S.forEach((s, i) => items.push({ id: `S${i + 1}`, kind: "did", date: now, ...s }));
  return items;
}

export const digestText = (items) => items.map((i) => `${i.id}: ${i.text}`).join("\n");

// ── Validation of what the model returns ─────────────────────────────────────────────────────
export function parseJson(raw) {
  const m = String(raw || "").match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}

// Keep only reflections that stand on the evidence, worded as observations. Evidence is returned
// as the plain labels the person will see under "Why I think this".
export function validateReflections(list, items, max = 2) {
  const byId = new Map(items.map((i) => [i.id, i]));
  const out = [];
  for (const r of Array.isArray(list) ? list : []) {
    const ids = [...new Set((Array.isArray(r?.evidence) ? r.evidence : []).map(String))].filter((id) => byId.has(id));
    if (ids.length < 2) continue;
    if (!ids.some((id) => byId.get(id).kind === "said")) continue;
    const text = guardReflection(r.text);
    if (!text) continue;
    const theme = guardReflection(r.theme, 40);
    out.push({ text, theme: theme ? theme.toLowerCase() : null, evidence: ids.map((id) => ({ kind: byId.get(id).kind, label: byId.get(id).label })) });
    if (out.length >= max) break;
  }
  return out;
}

// ── The living understanding ─────────────────────────────────────────────────────────────────
// Themes strengthen when seen again, weaken when the person says "Not quite", vanish on "Forget
// this", and fade out after 30 days unseen — so the picture changes as their life does.
export function mergeThemes(old = [], fresh = [], feedback = [], now = Date.now()) {
  const map = new Map(old.map((t) => [t.name, { ...t }]));
  for (const name of fresh.filter(Boolean)) {
    const t = map.get(name) || { name, firstSeen: now, strength: 0, evidenceCount: 0 };
    t.lastSeen = now; t.strength = Math.min(5, (t.strength || 0) + 1); t.evidenceCount = (t.evidenceCount || 0) + 1;
    map.set(name, t);
  }
  for (const f of feedback) {
    if (!f?.theme || !map.has(f.theme)) continue;
    if (f.feedback === "forget") map.delete(f.theme);
    else if (f.feedback === "no") { const t = map.get(f.theme); t.strength = (t.strength || 1) - 2; if (t.strength <= 0) map.delete(f.theme); }
    else if (f.feedback === "yes") { const t = map.get(f.theme); t.strength = Math.min(5, (t.strength || 0) + 1); }
  }
  return [...map.values()]
    .filter((t) => now - Number(t.lastSeen || 0) <= 30 * DAY)
    .sort((a, b) => b.strength - a.strength || b.lastSeen - a.lastSeen)
    .slice(0, 6);
}

// ── When things are due ──────────────────────────────────────────────────────────────────────
export const REPLIES_PER_DAY = 5;
export function reflectionDue({ answers = [], lastReflect = 0, now = Date.now() } = {}) {
  const since = answers.filter((a) => Number(a.createdAt) > Number(lastReflect || 0)).length;
  if (answers.length < 2) return false;                  // too soon to notice anything honestly
  if (now - Number(lastReflect || 0) < 5 * DAY) return false;
  return since >= 2 || (since >= 1 && now - Number(lastReflect || 0) >= 7 * DAY);
}

export function replyAllowed(state = {}, todayKey) {
  const r = state.replies || {};
  return r.day !== todayKey || (r.n || 0) < REPLIES_PER_DAY;
}

// "Yesterday you said you'd like to make Sam feel seen." Straight from their own plan — no AI.
export function nudgeFor(user = {}, todayKey) {
  const w = user.whosNext;
  if (!w?.name || !w.day) return null;
  const d = Math.round((Date.parse(`${todayKey}T00:00:00Z`) - Date.parse(`${w.day}T00:00:00Z`)) / DAY);
  if (d < 1 || d > 2) return null;
  return { text: `${d === 1 ? "Yesterday" : "The other day"} you said you'd like to make ${w.name} feel seen. Want to send them a note?`, name: w.name };
}

// ── What the model is told ───────────────────────────────────────────────────────────────────
const VOICE = `You are Seen, a warm, perceptive presence inside a kindness app whose purpose is helping people feel seen and make others feel seen. Speak in plain, natural English, second person, like a thoughtful friend — never clinical, never gushing, never preachy. Never give medical, legal, financial or therapeutic advice. Never diagnose. Never tell the person who they are or what they should do. Never guess at health, religion, sexuality, ethnicity or politics. Keep it short.`;

export function replyPrompt({ chat = [], themes = [], evidence = [], name = null }) {
  const convo = chat.slice(-10).map((m) => `${m.role === "me" ? "Person" : "Seen"}: ${clip(m.text, 400)}`).join("\n");
  return {
    system: `${VOICE}\n\nReply to the person's latest message in 1–3 sentences (under 420 characters).\n- If they answered a question: acknowledge something SPECIFIC they said, warmly. You may ask ONE gentle follow-up question, or none.\n- If they asked you something about themselves ("why do you think that?", "what have you noticed?"): answer only from the evidence and themes below, and say what it's based on. If there isn't enough, say so honestly.\n- If they ask about the app: Seen helps you make someone feel seen once a day; questions here are private to them; they can forget everything from the ⋯ menu.\n- If they ask for something you can't do (advice, diagnosis, facts about the world): kindly say that's not something you can help with, and turn back to them.\nWhen it fits naturally, point towards real people rather than yourself.`,
    user: `${name ? `Their first name: ${name}\n` : ""}What Seen has noticed so far (themes): ${themes.map((t) => t.name).join(", ") || "nothing yet"}\nEvidence:\n${digestText(evidence) || "none yet"}\n\nConversation (oldest first):\n${convo}\n\nWrite Seen's reply. Reply with ONLY the message text.`,
  };
}

export function reflectPrompt({ items, themes = [], feedback = [] }) {
  return {
    system: `${VOICE}\n\nYou notice patterns in what a person has SAID (ids starting A or F) and what they have DONE (ids starting S), and reflect them back so they feel recognised. Rules:\n- Observe, don't define: "You've mentioned… and you've also…", "It sounds like…". NEVER "You are…", "You seem to be someone who…".\n- Every reflection must cite at least two evidence ids, and at least one must be an A or F id.\n- Under 240 characters each. At most 2 reflections. If nothing is well supported, return none — saying less is better than guessing.\n- Themes are 1–3 word plain labels of what matters to them right now (e.g. "running", "family", "a new job").\n- followUp: one warm, specific question that remembers something they said (under 110 characters), or null.\n- safety: "crisis" if anything suggests risk of harm, "concern" if they seem in real difficulty, otherwise "ok".`,
    user: `Evidence:\n${digestText(items)}\n\nThemes noticed before: ${themes.map((t) => `${t.name} (strength ${t.strength})`).join(", ") || "none"}\nTheir feedback on earlier reflections: ${feedback.map((f) => `"${f.theme}": ${f.feedback}`).join(", ") || "none"}\n\nReturn ONLY JSON: {"safety":"ok|concern|crisis","reflections":[{"theme":"…","text":"…","evidence":["A1","S2"]}],"themes":["…"],"followUp":"…"|null}`,
  };
}
