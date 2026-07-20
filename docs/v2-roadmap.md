# Seen v2 — Product Roadmap & Design Notes

Status: **planning only — nothing here is being built yet.**
Captured from product discussion on 14–15 July 2026.

---

## Vision

Evolve Seen from a "kindness feed" into a **kindness practice companion**: receive
kindness (Feed) → practise it in real life (Have you tried?) → celebrate it
(Editorial) → reflect on the journey (My SEEN Story).

New tab order: **Feed → Have you tried? → Editorial → My SEEN Story**

---

## 1. Rebrand — logo & LA-sunset palette

- **Palette:** coral → warm orange → dusky pink → soft violet
  (e.g. `#FF6B6B → #FF9E57 → #F472B6 → #8B7CF6`), warm sand `#FDF6EC` neutrals,
  deep plum `#3B2C4A` dark mode. Keep ONE accent (coral) for primary actions.
- **Logo candidates:**
  1. **Sun-on-horizon "eye"** — semicircle sun over a horizon line that also reads
     as an open eye (sunset + "seen" in one mark). *Preferred.*
  2. Two overlapping circles forming a vesica/eye — "two worlds touching".
  3. Keep the ✦ spark inside a warm gradient sun disc — lowest-risk evolution.
- **Implementation:** centralise colours as CSS variables first (teal/emerald hexes
  are currently scattered through Tailwind classes), then re-skin. Regenerate
  icon/splash (`assets/icon.png` → Codemagic `@capacitor/assets` step) + new store
  screenshots. **Do last** so screenshots are shot once against the final UI.

## 2. Remove Life Hacks (as a tab)

- Retire the Life Hacks tab in its current form (passive content library; also the
  largest JS chunk at ~1.5 MB).
- **Keep the content/data file** — best entries become the "Self life" slot in
  Have you tried? (refreshing every 24 h).

## 3. "Have you tried?" tab — the behaviour engine

Daily real-life kindness prompts across **15 life areas**: Work, Home/family,
Friendship, Romantic, Hobbies/sport, Stranger/public, Digital, Transactional,
Neighbourhood, Money, Care, Learning/mentoring, Self, Nature & animals, Legacy.

**Daily list — 3 prompts/day** (completable, varied, never homework):
1. **Anchor** — from one of the user's 3–5 chosen focus areas (picked at feature
   onboarding).
2. **Rotating** — a different life area each day so all 15 cycle.
3. **Self life** — daily-refreshing self-kindness slot seeded from Life Hacks.

Rules:
- **"Try another" swap** — skip any prompt without penalty; an unfinished list must
  never feel like failure (wellbeing app — no guilt mechanics).
- Tick-off = strike-through animation + soft chime + burst; all 3 done → small
  daily celebration ("You showed up for kindness today 🌅").
- Completion is **self-reported and private** — no proof, no sharing pressure, no
  public streak shaming.
- Optional one-tap reflection after ticking ("How did it feel?" 😊 😌 💪) — feeds
  My SEEN Story.

Content: bank of ~20–30 prompts per area (~400 total), tiny/concrete/doable-today,
warm voice. Examples:
- Work: "Have you tried… telling a colleague specifically what they did well this week?"
- Stranger/public: "Have you tried… letting someone go ahead of you in a queue and meaning it?"
- Nature & animals: "Have you tried… leaving water out for birds on a hot day?"
- Legacy: "Have you tried… writing down one piece of advice you'd want a younger you to hear?"

Data model: prompt bank ships in the bundle (like `greetings.js`);
`users/{uid}/haveYouTried/{yyyy-mm-dd}` stores the day's 3 prompt IDs + completion.
Deterministic selection seeded by date+uid → **no cron needed**.

## 4. Editorial tab — shared journals / good-news board

Users opt to publish a personal journal entry as a gratitude/kindness story;
others react.

**Moderation-first design (this is the first long-form public UGC surface):**
- "Share this story" action on an existing Journal entry (content already exists).
- **Pre-moderation, not post:** every submission passes the server-side AI
  moderation endpoint (extend the unbypassable `/api/submit-greeting` pattern)
  **before** becoming visible. Optionally human approval on top at launch —
  a curated feel matches "Editorial".
- **Anonymous by default**, opt-in first name.
- **Launch WITHOUT free-text comments.** Reactions + preset responses ("This made
  my day", "Needed this today 💛") = 90 % of warmth, 10 % of risk. Free comments
  reconsidered later once volumes are known.
- Report + Block (already shipped) apply here.
- New `stories` collection; reuse reaction components.

## 5. Free-text greetings (AI-moderated) — replaces community greetings

**Decision (15 Jul 2026):** retire the community-greetings pipeline entirely
(submissions → voting → leaderboard → weekly champions cron) and instead let users
**write their own greeting, max 80 characters**, screened by AI before anyone sees
it. This adopts the QA tester's Suggestion S1 deliberately, with guardrails.

Why: hand-written kindness carries far more emotional weight than a picked preset
(the QA tester independently called this the app's biggest feature gap), and the
community pipeline was heavy machinery whose end goal — more varied greetings —
free text achieves directly. Removing it deletes a whole meta-game (voting,
champions, `rotate-champions` cron, `greetingSubmissions` collection).

Guardrails (non-negotiable):
- **Presets stay** as the default quick-send path; "✍️ Write your own" appears
  alongside them in the picker. Zero-effort sending must survive.
- **Server-side moderation, unbypassable:** extend the existing
  `/api/submit-greeting` pattern (Anthropic AI screen for profanity, hate,
  harassment, sexual content, contact info — multilingual, with word-list
  fallback). The send happens via the API with the Admin SDK; **Firestore rules
  change to forbid direct client writes to `publicMessages`** — which also closes
  the existing latent gap where preset-only was client-enforced.
- **Fail closed:** if the moderation endpoint can't run, custom sending is
  disabled (with a gentle message); presets keep working.
- **Level-gated (anti-abuse):** unlock "write your own" at a low Kindness-Jar
  level, so brand-new/throwaway accounts start preset-only.
- **Rejected messages** get a kind, non-shaming explanation and keep the preset
  option in view.
- Report + Block (already shipped) continue to apply to all feed messages.
- **App Store lockstep:** ship in the same release as updated review notes and
  support-page copy ("user-written messages are screened by automated AI
  moderation before delivery" — replacing "users cannot free-type messages into
  the public feed"). Age rating already declares UGC; no change needed there.

Cleanup: remove `CommunityGreetings.jsx` voting/leaderboard/champions UI, the
`rotate-champions` cron in `vercel.json`, and the Community tab; migrate the best
approved community greetings into the preset library so that content isn't lost.

## 6. "My SEEN Story" (Board → personal narrative)

Amalgamates Feed activity, Journal, Have you tried?, and wellbeing check-ins into
a narrative + metrics view. Daily / Weekly / Monthly / Yearly segments.

- **v1 — template narratives (no AI, ship fast):** warm sentences assembled from
  real data: "This week you sent **7 kind messages** reaching **4 countries**;
  you tried **5 real-life kindnesses**, mostly in your **Work life**…"
- **v2 — AI summaries** (server endpoint, same pattern as moderation; monthly/
  yearly only; cached). **Wording rule:** wellbeing reflections stay reflective
  ("your check-ins suggest…"), never diagnostic/scored — protects the
  wellbeing-not-medical positioning (NHS/MHRA).
- **Metrics row:** messages sent, people reached, countries, reactions received,
  HYT completed by life area (mini radar/bars), journal entries, check-in trend
  arrow. Mostly reuses existing MyImpact/Board data — reorganisation + narrative
  layer, not a rebuild.
- **Shareable image card** for monthly/yearly summaries = organic marketing.

## 7. Navigation changes

- Tab order: **Feed → Have you tried? → Editorial → My SEEN Story**.
- **Community tab removed entirely** — the community-greetings pipeline is retired
  in favour of AI-moderated free-text greetings (section 5). Nothing moves to the
  ⋯ menu.
- ⋯ menu is getting crowded → add sections ("You", "Community", "Support") in the
  same release.
- **Bump `TOUR_VERSION`** so the guided tour re-runs once and reintroduces the new
  layout to existing users.

## 8. Sparks → Kindness Jar

- Replace the sparks meter with a **Kindness Jar**: coins earned for in-app
  actions; the jar's **fill level = progress within a level**, the **jar size/shape
  = level** (jam jar → mason jar → sweet jar → apothecary jar → amphora…).
  Level names to match ("First Jar", "Filling Up", "Overflowing"…).
- Standalone screen in the ⋯ menu; **remove the meter from the main screen**.
- **Coin-drop moment:** pending coins visibly drop in with a *plink* (Web Audio)
  when the jar is opened. Jar-full → **upgrade ceremony**: contents pour into the
  next, bigger jar (the pour IS the level-up).
- Below the jar: recent earnings log + "what earns coins" sheet.
- **Convert existing sparks 1:1** — never devalue testers' balances.
- Decide: keep coins spendable (gifting stays thematically perfect) vs purely
  cumulative (simpler). Leaning: keep gifting.
- Technically a re-theme of the existing spark/level system + one animated SVG/CSS
  screen.

## 9. Level rewards (ranked)

1. **Real-world kindness as the reward** — full jar plants a tree / funds a food
   bank via a charity partner. On-brand, meaningful, and sellable to B2B.
2. **Cosmetics** — jar skins, profile auras/frames, exclusive sticker packs,
   "Founding Kind" badge for early testers. Free to run.
3. **Capability unlocks** — levels unlock "write your own" greetings (section 5)
   and early Editorial access (privileges as abuse-gates).
4. **Yearly printable "Kindness Certificate"/story-book** of their SEEN Story.
5. **Avoid:** cash-value rewards, prize draws (gambling/age-rating issues),
   anything making kindness feel transactional.

## 10. B2B — "Seen for Teams" (v3 horizon)

Product:
- Private company-scoped spaces (feed/HYT/jar within an organisation); peer
  recognition maps onto the existing message model.
- **Work-life HYT packs** and seasonal campaigns ("Kindness Week").
- **Team Kindness Jar** — collective jar; when full, the company's pledged charity
  donation releases (margin for Seen).
- **Aggregated, team-level-only wellbeing pulse** for HR — never individual data
  (GDPR/works-council + ethics).
- ESG/CSR reporting pack ("4,200 acts of kindness this quarter").

Concierge layer:
- Branded setup, custom prompt packs, launch comms, run their Kindness Week.
- Quarterly leadership kindness & wellbeing report (human-written).
- Manager toolkits (monthly team-meeting exercises from HYT).
- Recognition ceremonies + certificates/awards fulfilment.
- **NHS angle:** occupational-health package (DTAC-aligned staff-wellbeing
  framing) — the door NHS trusts buy staff tools through.

Pricing shape: per-seat/month SaaS (~£1–3/seat) + setup fee + concierge retainer.
Multi-tenancy in Firestore is the big technical lift — v3, but v2 (HYT + Jar) is
exactly the asset that makes it sellable.

---

## Build order

| Phase | Scope | Rationale |
|---|---|---|
| **1** | Have you tried? tab + prompt bank; retire Life Hacks tab (keep data for Self-life slot) | Biggest user value, zero moderation risk, feeds everything else |
| **2** | Kindness Jar (sparks→coins 1:1) + remove main-screen meter; retire Community tab/pipeline (migrate best greetings to presets, remove champions cron); new tab order; menu sections; `TOUR_VERSION` bump | All structural churn in one release |
| **3** | My SEEN Story v1 (template narratives + metrics + shareable card) | Needs HYT data flowing to be good |
| **4** | Moderation build-out: free-text greetings (80-char, server-screened, level-gated, fail-closed) + Editorial (pre-moderated, reactions + preset responses, **no free comments**) + App Store notes/support-page updates in lockstep | Highest moderation stakes, shared AI-moderation infrastructure — do when the rest is stable |
| **5** | Rebrand: sunset palette + logo + icon/splash + new store screenshots | Last, so store assets are shot once |
| Later | AI narratives, free-text comments, charity-partner rewards, Seen for Teams | |

Each phase ships independently to testers via the existing web-deploy loop
(Vercel; Android TWA follows automatically, iOS needs a Codemagic rebuild).

**Decisions locked in:** 3 HYT prompts/day with a no-guilt swap; Editorial launches
without free-text comments; community greetings retired in favour of AI-moderated
80-char free-text greetings (presets kept as the quick-send path).

---

## QA report follow-up (PrimeTestLab, 15 Jul 2026)

**"Write your own" kindness message (their Suggestion S1)** — initially deferred,
now **ADOPTED into v2** as section 5 (decision 15 Jul 2026). The original deferral
conditions became the design's guardrails: server-side AI moderation on the
unbypassable `/api/submit-greeting` pattern, fail-closed behaviour, presets
retained, level-gating, and App Store review-notes + support-page updates shipped
in lockstep. It must NOT ship before those conditions are met — until phase 4
goes live, the current "preset-only feed" posture declared to Apple remains true
and unchanged.
