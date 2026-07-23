# Seen v2 — Product Roadmap & Design Notes

Status: **planning only — nothing here is being built yet.**
Captured from product discussions on 14–15 July 2026; substantially revised
22 July 2026 after an external "simplify the app" review.

---

## Vision

**One guiding brief (22 Jul): simplify the app around a single question — what
experience should a user get out of Seen?** Answer: *feel genuinely seen by the
people who matter to them, practise kindness in real life, and watch themselves
grow.*

Four tabs, four verbs:

**Feed** (connect) → **Have you tried?** (practise) → **Journal** (reflect) →
**My SEEN Story** (see your journey)

**The daily loop:** a user opens the app → lands on the focused Feed (interacts
with close contacts, watches stranger kindness roll by in the bulletin, hearts
messages, sends kindness) → checks today's Have-you-tried prompts → writes to
today's single Journal prompt → occasionally visits My SEEN Story to see how
far they've come.

Everything social lives in the Feed. The separate Editorial tab, the status
strip, and the Community tab are all absorbed or retired. Two signature visuals:
the **Globe** (kindness across the world) and the **Kindness Tree** (your own
growth).

---

## 1. Onboarding — near-zero friction

Current onboarding requires two free-text "glimpse" questions (*most days I…*,
*in another life…*) before entry — friction before the user has seen any value.

- **Cut signup to: sign in → date of birth → country → in.** (~30 seconds.)
- **DOB stays** — the 13+ age gate is legally non-negotiable. **Country stays** —
  it powers the map and feed context.
- **Glimpse questions move to a later prompt** (~day 3, or after N sends):
  "Help people see the person behind the kindness" — asked when the user
  understands why it matters. Profile stays functional without them.
- **Wellbeing check-in** at signup: already skippable — consider moving it to the
  same later-prompt pattern.
- **Remove the guided tour** (and its `TOUR_VERSION` re-run machinery). Replace
  with contextual coach-marks at the moment of first use (the "tap to send" pill
  pattern already shipped). Tours get skipped; context teaches.

## 2. Feed 2.0 — the app's centre of gravity

External feedback: the feed must be *the* feature, but a stream of stranger
messages isn't engaging. Redesign it around **"your people up close, the world
as a bulletin."**

### Structure
- **Bulletin ribbon (top):** world kindness compressed into a rotating one-line
  ticker/carousel — "💛 Someone in Brazil sent kindness a moment ago" · "🌱 2,400
  kind acts today". Ambient global warmth without flooding the feed. Absorbs the
  role of stranger messages in the feed (and of community-greeting surfacing).
- **The feed itself:** posts and messages from **your people** (friends, family,
  contacts — builds on the existing buddies model), scrollable, real-time.
- **Featured story slot:** a pinned "Featured kindness story" card (see Stories
  below) so uplifting long-form is always one tap away.

### Posting (replaces the separate status/feelings feature)
- **Free-text posts, AI-moderated server-side** (unbypassable `/api/…` pattern,
  fail-closed, level-gated) — the moderation design agreed 15 Jul carries over;
  it simply lands in the feed instead of a separate greetings pool.
- **Post as yourself or anonymously.** Anonymity is **display-only** — the system
  always stores the uid (report/block must keep working). Guardrails: stricter
  moderation threshold for anonymous posts + a level gate before anonymous
  posting unlocks (new/throwaway accounts can't post anonymously on day one).
- Others respond **privately** (below) or with reactions.

### Private replies — NOT open DMs (safety line)
- **Decision: no open direct-messaging system.** In a 13+ wellbeing app, open DM
  threads are the single biggest safety/moderation escalation (grooming surface,
  per-message duty of care, App Store / NHS scrutiny).
- Instead: **bounded private exchanges anchored to a post** — reply privately to
  a feed post; the author can respond within that one exchange (a short,
  post-scoped thread, e.g. capped turns, auto-expiring). Both directions pass AI
  moderation; report + block apply inside the exchange.
- **Public interaction broadcast:** "✨ A & B shared a kind moment" can appear in
  the feed — **only with both users' consent** (one-tap "share that this moment
  happened?"), never revealing content, and never for anonymous posts.

### Stories in the feed (replaces the Editorial tab)
- "Share this story" on a Journal entry → **compact story card** in the feed
  ("📖 Maya shared a kindness story") → tap opens a full-screen reader.
- Pre-moderation as designed 15 Jul (AI + optional human curation), anonymous by
  default, reactions + preset responses only (no free comments at launch).
- **Featured stories** rotate into the pinned slot. No separate tab needed.

### Connection made visible
- **Who hearted you:** tap the reaction count on your message to see the list of
  people (name + country) — the data already exists in the reactions model.
  Instagram-style reinforcement of "a real human did this".

### What this retires
- Separate status/feelings strip (folds into posting).
- Editorial tab (folds into story cards + featured slot).
- Community tab/pipeline (already decided 15 Jul; the bulletin ribbon absorbs
  world-surfacing; best approved greetings migrate to the preset library;
  `rotate-champions` cron removed).

### Honest cost (recorded, eyes open)
The feed becomes a full UGC social surface. The Phase-4 moderation
infrastructure becomes the load-bearing wall: server-side AI screening,
fail-closed, rate limits, level gates, report/block everywhere, and App Store
review-notes + support-page updates shipped in lockstep. Nothing in this section
ships before that infrastructure does.

## 3. "Have you tried?" tab — the behaviour engine

Daily real-life kindness prompts across **15 life areas**: Work, Home/family,
Friendship, Romantic, Hobbies/sport, Stranger/public, Digital, Transactional,
Neighbourhood, Money, Care, Learning/mentoring, Self, Nature & animals, Legacy.

**Daily list — 3 prompts/day** (completable, varied, never homework):
1. **Anchor** — from one of the user's 3–5 chosen focus areas (picked at feature
   onboarding).
2. **Rotating** — a different life area each day so all 15 cycle.
3. **Self life** — daily-refreshing self-kindness slot seeded from Life Hacks
   content (the Life Hacks tab itself is retired; best entries live on here).

Rules:
- **"Try another" swap** — skip any prompt without penalty; an unfinished list
  must never feel like failure (wellbeing app — no guilt mechanics).
- Tick-off = strike-through animation + soft chime + burst; all 3 done → small
  daily celebration ("You showed up for kindness today 🌅").
- Completion is **self-reported and private** — no proof, no sharing pressure,
  no public streak shaming.
- Optional one-tap reflection after ticking ("How did it feel?" 😊 😌 💪) —
  feeds My SEEN Story.
- Completing prompts **waters your Kindness Tree** (section 6) — the daily
  action and the growth visual reinforce each other.

Content: bank of ~20–30 prompts per area (~400 total), tiny/concrete/
doable-today, warm voice. Examples:
- Work: "Have you tried… telling a colleague specifically what they did well this week?"
- Stranger/public: "Have you tried… letting someone go ahead of you in a queue and meaning it?"
- Nature & animals: "Have you tried… leaving water out for birds on a hot day?"
- Legacy: "Have you tried… writing down one piece of advice you'd want a younger you to hear?"

Data model: prompt bank ships in the bundle (like `greetings.js`);
`users/{uid}/haveYouTried/{yyyy-mm-dd}` stores the day's 3 prompt IDs +
completion. Deterministic selection seeded by date+uid → **no cron needed**.

## 4. Journal — one prompt a day (promoted to tab 3)

**Decision (23 Jul):** Journal moves out of the ⋯ menu into the main tab bar,
and is radically simplified — fewer choices, one focused daily ritual.

- **One journal, not two.** The Grateful / Kindness category choice is removed
  entirely. Existing entries keep their data (the old category becomes a silent
  historical tag); going forward there is just "today's entry".
- **One prompt, rotating every 24 h** — a deterministic date-seeded pick from a
  bank of ~30–60 warm prompts blending gratitude and kindness ("What small
  kindness found you today?", "Who made today lighter?", "What did you do today
  that your future self will thank you for?"). Same no-cron pattern as the
  Have-you-tried prompts. Free writing stays available beneath the prompt for
  users who want to go off-script.
- **Private by default.** "Share this story" to the feed (story cards, section
  2) is the opt-in bridge — today's prompt doubles as the story seed.
- Entries continue to feed **My SEEN Story** narratives and **water the
  Kindness Tree**.
- **Differentiation:** Journal = *write today*; My SEEN Story = *read your
  journey*. Two reflection tabs, two distinct jobs — no duplication.

## 5. "My SEEN Story" (Board → personal narrative)

Amalgamates Feed activity, Journal, Have you tried?, and wellbeing check-ins
into a narrative + metrics view. Daily / Weekly / Monthly / Yearly segments.

- **v1 — template narratives (no AI, ship fast):** warm sentences assembled from
  real data: "This week you sent **7 kind messages** reaching **4 countries**;
  you tried **5 real-life kindnesses**, mostly in your **Work life**…"
- **v2 — AI summaries** (server endpoint, same pattern as moderation; monthly/
  yearly only; cached). **Wording rule:** wellbeing reflections stay reflective
  ("your check-ins suggest…"), never diagnostic/scored — protects the
  wellbeing-not-medical positioning (NHS/MHRA).
- **Metrics row:** messages sent, people reached, countries, reactions received,
  HYT completed by life area (mini radar/bars), journal entries, check-in trend
  arrow. Mostly reuses existing MyImpact/Board data.
- **Shareable image card** for monthly/yearly summaries = organic marketing.
- The **Kindness Tree** (section 6) lives here and/or one tap from the header —
  the personal-growth visual anchoring the reflection space.

## 6. The Kindness Tree (decision: replaces the Kindness Jar)

**Decision (22 Jul): growth visual = seed → tree, not piggy-bank/jar.**

Why the tree wins:
- A jar of coins is an *accumulation/currency* metaphor — it quietly makes
  kindness transactional, which our own rewards principles warn against. A
  growing tree is a *personal growth* metaphor — it mirrors the user, fits the
  wellbeing/NHS framing, and pairs with the Globe as the app's two signature
  visuals (**the world** and **you**).
- Fits the LA-sunset/nature rebrand; "your kindness waters the seed" gives every
  daily action a poetic why.
- Perfect synergy with the top reward idea: a fully-grown tree **plants a real
  tree** via a charity partner.

Design:
- **Stages = levels:** seed → sprout → seedling → sapling → young tree → tree in
  leaf → blossom → full bloom. Stage names replace level names.
- Kind actions (sends, HYT completions, hearts given, journal entries) **water
  the tree**; a gentle animation + soft sound on watering (Web Audio engine).
- Level-up = a **growth moment** (time-lapse sprout/blossom animation).
- Standalone screen (⋯ menu and/or My SEEN Story); the sparks meter leaves the
  main screen (as previously agreed).
- **Economy:** earned coins/drops remain the underlying resource (1:1 conversion
  of existing sparks — never devalue testers' balances); gifting stays; the tree
  is the *display*, not the ledger.
- Optional delight: seasons/weather passes over the tree; a tiny bird arrives at
  higher stages.

## 7. Wellbeing hub — merge check-in + Support

External feedback: Wellbeing check-in and Support appear as two separate
questionnaire-ish features in the ⋯ menu.

- Merge into **one "Wellbeing" hub** with two sections inside:
  - **Check-in** — the existing reflection questionnaire + trends over time.
  - **Support** — the wellbeing tools and helplines.
- **Safety rule:** crisis helplines must be *no deeper than today* — surfaced
  immediately on opening the hub, and the distress-triggered inline banner in
  the feed stays exactly as-is.
- One menu entry instead of two; simpler mental model ("everything about how
  I'm doing lives here").

## 8. Navigation (end state)

- **Four tabs: Feed → Have you tried? → Journal → My SEEN Story.**
- Promoted: **Journal** moves from the ⋯ menu to tab 3 (section 4).
- Retired: Life Hacks tab (content lives in HYT "Self life"), Community tab
  (pipeline retired), Editorial tab (absorbed into feed), status strip
  (absorbed into posting), guided tour (replaced by coach-marks).
- ⋯ menu gets sections ("You", "Community", "Support") and holds: World Map,
  Person behind the Kindness, **Wellbeing hub** (merged), Kindness Tree,
  Blocked accounts, Change password, admin tools.

## 9. Rebrand — logo & LA-sunset palette

- **Palette:** coral → warm orange → dusky pink → soft violet
  (e.g. `#FF6B6B → #FF9E57 → #F472B6 → #8B7CF6`), warm sand `#FDF6EC` neutrals,
  deep plum `#3B2C4A` dark mode. Keep ONE accent (coral) for primary actions.
- **Logo candidates:**
  1. **Sun-on-horizon "eye"** — semicircle sun over a horizon line that also
     reads as an open eye (sunset + "seen" in one mark). *Preferred.*
  2. Two overlapping circles forming a vesica/eye — "two worlds touching".
  3. Keep the ✦ spark inside a warm gradient sun disc — lowest-risk evolution.
- The nature palette now also serves the **Kindness Tree** (section 6).
- **Implementation:** centralise colours as CSS variables first, then re-skin.
  Regenerate icon/splash (`assets/icon.png` → Codemagic `@capacitor/assets`
  step) + new store screenshots. **Do last** so screenshots are shot once.

## 10. Level rewards (ranked)

1. **Real-world kindness as the reward** — a full-grown Kindness Tree plants a
   real tree / funds a food bank via a charity partner. On-brand, meaningful,
   and sellable to B2B.
2. **Cosmetics** — tree variants/seasons, profile auras/frames, sticker packs,
   "Founding Kind" badge for early testers. Free to run.
3. **Capability unlocks** — levels unlock free-text posting, anonymous posting,
   and early story-sharing (privileges as abuse-gates).
4. **Yearly printable "Kindness Certificate"/story-book** of their SEEN Story.
5. **Avoid:** cash-value rewards, prize draws (gambling/age-rating issues),
   anything making kindness feel transactional.

## 11. B2B — "Seen for Teams" (v3 horizon)

Product:
- Private company-scoped spaces (feed/HYT/tree within an organisation); peer
  recognition maps onto the existing message model.
- **Work-life HYT packs** and seasonal campaigns ("Kindness Week").
- **Team Kindness Tree** — collective tree the whole company grows; when it
  fully blooms, the company's pledged charity donation releases (margin for
  Seen).
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

Pricing shape: per-seat/month SaaS (~£1–3/seat) + setup fee + concierge
retainer. Multi-tenancy in Firestore is the big technical lift — v3, but v2
(Feed 2.0 + HYT + Tree) is exactly the asset that makes it sellable.

---

## Phase 0 — near-term polish  ✅ SHIPPED 23 Jul 2026

1. **Dark-theme contrast (readability)** ✅ — extended the `[data-dark-shell]` map
   in `src/index.css` to darken light accent backgrounds (teal/emerald/amber/
   violet/rose/blue `-50/-100`) and lighten dark accent text (`text-*-700`),
   brightened `text-slate-400`, and fixed the reported community-greetings header
   + champion cards (`CommunityGreetings.jsx`, incl. an `!important` override of
   the inline champion-card gradient). MyImpact/Board already dark-aware.
2. **In-app "Change password"** ✅ — new `ChangePasswordPanel` (⋯ menu → Change
   password) using Firebase `reauthenticateWithCredential` + `updatePassword`;
   Google/Apple accounts get a "manage it with your provider" note.

**Deferred → dedicated "dark-mode consistency" pass (not Phase 0):** the portal
components (`Feelings`, `Wellbeing`, `Journal`, `UserGlimpse`, `SubmitGreetingModal`,
stickers, tour) `createPortal` outside the dark shell and render permanently light.
Their text is dark-on-white = readable (passes the "font is clear" bar) but
theme-inconsistent. Making them dark-aware is per-component work — a separate task.

---

## Build order (revised 22 Jul)

| Phase | Scope | Rationale |
|---|---|---|
| **0** | Near-term polish: dark-theme contrast audit + change password | Small, current-user value, no dependencies |
| **1** | Onboarding simplification (cut glimpse Qs to later prompt, remove tour) + Have you tried? tab + prompt bank; retire Life Hacks tab | Friction off the front door; biggest new user value; zero moderation risk |
| **2** | Kindness Tree (sparks→1:1) + remove main-screen meter; retire Community tab/pipeline (migrate best greetings to presets, remove champions cron); four-tab order incl. Journal promotion + one-prompt simplification; menu sections + Wellbeing hub merge | All structural churn in one release |
| **3** | My SEEN Story v1 (template narratives + metrics + shareable card + tree) | Needs HYT data flowing to be good |
| **4** | **Moderation build-out / Feed 2.0:** server-side AI moderation infra (fail-closed, unbypassable) → free-text + anonymous posting, bulletin ribbon, story cards + featured slot, who-hearted list, bounded private replies + consented interaction broadcasts. App Store notes/support-page updates in lockstep. | Highest stakes; everything social rides on this wall — built once, properly |
| **5** | Rebrand: sunset palette + logo + icon/splash + new store screenshots | Last, so store assets are shot once |
| Later | AI narratives, free comments, charity tree-planting, Seen for Teams | |

Each phase ships independently to testers via the existing web-deploy loop
(Vercel; Android TWA follows automatically, iOS needs a Codemagic rebuild).

**Decisions locked in:**
- 3 HYT prompts/day with a no-guilt swap.
- Community greetings retired; presets kept as the quick-send path.
- **Kindness Tree over Kindness Jar** (growth metaphor beats currency metaphor).
- **No open DMs** — bounded, post-anchored private replies only; interaction
  broadcasts require both users' consent.
- Anonymous posting is display-only anonymity, level-gated, stricter-moderated.
- Editorial is feed story cards + a featured slot, not a tab. No free-text
  comments at launch.
- Onboarding keeps DOB (13+ gate) and country; everything else moves later.
- **Four tabs: Feed → Have you tried? → Journal → My SEEN Story** — Journal
  promoted out of the ⋯ menu, single category, one prompt rotating every 24 h.

---

## QA report follow-up (PrimeTestLab, 15 Jul 2026)

**"Write your own" kindness message (their Suggestion S1)** — initially
deferred, then adopted; now folded into **Feed 2.0 posting** (section 2). The
original deferral conditions became the design's guardrails: server-side AI
moderation on the unbypassable pattern, fail-closed behaviour, presets
retained, level-gating, and App Store review-notes + support-page updates in
lockstep. It must NOT ship before those conditions are met — until Phase 4 goes
live, the current "preset-only feed" posture declared to Apple remains true and
unchanged.
