// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.
// /api/goodnews.js — Fetch broadly from many sources, categorise with Claude.
//
// Env vars required:
//   GNEWS_API_KEY      — gnews.io free tier (100 req/day)
//   ANTHROPIC_API_KEY  — Claude Haiku for categorisation (~$0.01/day)
//
// Falls back to keyword-based categorisation when ANTHROPIC_API_KEY is absent.

import Anthropic from "@anthropic-ai/sdk";

// ── Categories ────────────────────────────────────────────────────────────────

const CATEGORIES = {
  inspiring:      { emoji: "✨", label: "Inspiring" },
  breakthrough:   { emoji: "🔬", label: "Breakthrough" },
  weirdWonderful: { emoji: "🤪", label: "Weird & Wonderful" },
  kind:           { emoji: "🤝", label: "Kind" },
  funny:          { emoji: "😂", label: "Funny" },
};
const CATEGORY_KEYS = Object.keys(CATEGORIES);

// ── Sources, in two tiers ────────────────────────────────────────────────────
//
// Both tiers are used. The split is not about excluding anyone — it is about knowing what a
// story arrived through, because the two tiers need different amounts of trust.
//
// CURATED feeds exist to publish uplifting or curious material. Choosing among them is choosing
// between good things. MAJOR feeds are general news: on any given day their top-news output is
// mostly war, disaster and crime, and asking a categoriser to find the most uplifting item in
// that pool is a different question with a worse failure mode — the winner on a grim day is a
// rescue at a catastrophe, which is technically uplifting and lands very badly unbidden in a
// wellbeing app used by 13-year-olds.
//
// Keeping the majors is the owner's decision, made with that spelled out. What follows is the
// machinery that makes it survivable: a deterministic blocklist every story must clear before a
// model sees it, a keyword fallback that will not touch the majors, and a day with no card at
// all in preference to a bad one.

const CURATED_FEEDS = [
  // Human interest / inspiring
  "https://www.goodnewsnetwork.org/feed/",
  "https://www.positive.news/feed/",
  "https://www.goodnewsnetwork.org/category/heroes/feed/",
  "https://www.goodnewsnetwork.org/category/kindness/feed/",
  "https://www.goodnewsnetwork.org/category/animals/feed/",
  "https://www.sunnyskyz.com/rss.php",
  // Science / technology
  "https://www.sciencedaily.com/rss/top/science.xml",
  "https://newatlas.com/feed/",
  "https://futurism.com/feed",
  // Quirky / funny
  "https://laughingsquid.com/feed/",
  "https://www.boredpanda.com/feed/",
  "https://www.odditycentral.com/feed",
  "https://twistedsifter.com/feed/",
  "https://www.atlasobscura.com/feeds/latest",
];

// General outlets. Their uplifting stories are real and worth having; everything around them is
// why the guards above this line exist.
const MAJOR_FEEDS = [
  "https://feeds.apnews.com/rss/apf-topnews",           // Associated Press
  "https://feeds.reuters.com/reuters/topNews",            // Reuters
  "http://feeds.bbci.co.uk/news/rss.xml",                // BBC News
  "https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml", // New York Times
  "https://www.aljazeera.com/xml/rss/all.xml",           // Al Jazeera
  "https://www.theguardian.com/international/rss",       // The Guardian
  "https://www.ft.com/rss/home",                         // Financial Times
  "https://feeds.a.dj.com/rss/RSSWorldNews.xml",         // Wall Street Journal
  "https://rss.dw.com/rdf/rss-en-all",                   // Deutsche Welle (DW)
];

const GLOBAL_FEEDS = [...CURATED_FEEDS, ...MAJOR_FEEDS];
const CURATED = new Set(CURATED_FEEDS);

// ── The blocklist ────────────────────────────────────────────────────────────
//
// Deterministic, and it runs FIRST — before Claude, before keywords, on every story from every
// tier. That ordering is the point: a model is a judgement, and a judgement is exactly one thing
// standing between a war headline and a child. This is the layer that does not depend on
// anything behaving well today.
//
// Deliberately blunt. It will drop perfectly good stories — an article about a charity tackling
// child poverty contains "child" and "poverty" and will not make it through. That is the right
// trade here: the cost of a false positive is one fewer nice story in a day, and the cost of a
// false negative is a bereavement headline in a feed someone opened to feel less alone.
const BLOCKED = new RegExp([
  // Death and violence
  "\\b(kill|killed|killing|murder|dead|death|deaths|died|dying|fatal|fatalit|homicide|massacre)",
  "\\b(shoot|shooting|shooter|stabb|gunman|gunmen|terror|bomb|blast|explosion|militant)",
  "\\b(war|warfare|troops|missile|airstrike|strike[sd]? on|invasion|occupation|ceasefire|hostage)",
  // Harm to people
  "\\b(abuse|assault|rape|traffick|kidnap|abduct|torture|slavery|exploit)",
  "\\b(suicide|self.harm|overdose)",
  // Disaster
  "\\b(earthquake|tsunami|hurricane|wildfire|famine|drought|flooding|catastroph|disaster|evacuat)",
  "\\b(crash|crashes|collision|derail|capsiz|sank|wreckage)",
  // Crime and courts
  "\\b(arrest|convict|sentenc|charged with|guilty|prison|jail|lawsuit|fraud|scandal|corrupt)",
  // Illness and distress
  "\\b(outbreak|epidemic|pandemic|virus|cancer|terminal|hospice|coma)",
  // Politics, which is not unsafe but is not what this app is for
  "\\b(election|president|prime minister|parliament|congress|senate|tariff|sanction|protest|riot)",
].join("|"), "i");

function isBlocked(story) {
  return BLOCKED.test(`${story.title || ""} ${story.description || ""}`);
}


// ── GNews broad queries (one call each, not per category) ─────────────────────

const GNEWS_LOCAL_QUERIES = [
  "good news OR achievement OR community OR charity OR kind",
  "science discovery OR medical breakthrough OR invention OR innovation",
  "funny OR amusing OR viral OR quirky OR unusual",
];

// ── Fallback stories (when all sources fail) ──────────────────────────────────

const FALLBACKS = {
  inspiring: [
    { title: "94-Year-Old Graduates With a Bachelor's Degree After a 70-Year Dream", description: "'It's never too late,' said Doris, who walked the stage to a standing ovation.", link: "#", pubDate: new Date().toUTCString(), image: null },
    { title: "Small Town Raises $500,000 to Save Its Beloved Local Library", description: "A community rallied in 30 days to keep their library open after funding cuts threatened closure.", link: "#", pubDate: new Date().toUTCString(), image: null },
  ],
  breakthrough: [
    { title: "AI System Detects Cancer 4 Years Before Symptoms Appear", description: "Early results from a 10,000-patient trial show 90% accuracy in detecting tumours before they're visible.", link: "#", pubDate: new Date().toUTCString(), image: null },
    { title: "New Battery Technology Charges an EV in 5 Minutes Flat", description: "A solid-state battery developed by a university spin-out promises to eliminate range anxiety entirely.", link: "#", pubDate: new Date().toUTCString(), image: null },
  ],
  weirdWonderful: [
    { title: "Town Elects a Golden Retriever as Honorary Mayor for the Third Year Running", description: "Max the dog won the popular vote again, campaigning on belly rubs and afternoon naps.", link: "#", pubDate: new Date().toUTCString(), image: null },
    { title: "Octopus Found to Dream in Vivid Colour Changes — Scientists Stunned", description: "Footage shows the octopus cycling through dramatic colour patterns during REM-like sleep.", link: "#", pubDate: new Date().toUTCString(), image: null },
  ],
  kind: [
    { title: "Teen Donates All His Birthday Money to Build a Water Well in Kenya", description: "The 13-year-old raised £4,000 from friends and family, enough to provide clean water for a village.", link: "#", pubDate: new Date().toUTCString(), image: null },
    { title: "Restaurant Feeds Hundreds of Homeless Every Sunday for Free — 10 Years Running", description: "Chef Maria Santos has never missed a Sunday since 2014, serving a three-course meal to anyone who comes.", link: "#", pubDate: new Date().toUTCString(), image: null },
  ],
  funny: [
    { title: "Duck Follows Bus Route Every Day — Locals Start Calling It the Commuter", description: "The duck has taken the same route 47 times. Transit officials say they have no plans to charge it.", link: "#", pubDate: new Date().toUTCString(), image: null },
    { title: "Grandma Thinks Google Home Is a New Family Member, Greets It Every Morning", description: "'I just don't want it to feel left out,' she told her bewildered grandchildren.", link: "#", pubDate: new Date().toUTCString(), image: null },
  ],
};

// ── XML helpers ───────────────────────────────────────────────────────────────

function extractCDATA(tag, xml) {
  const re = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, "i");
  const m = xml.match(re);
  if (m) return m[1].trim();
  const re2 = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const m2 = xml.match(re2);
  return m2 ? m2[1].trim() : "";
}

function extractImage(itemXml) {
  let m = itemXml.match(/<media:content[^>]+url="([^"]+)"/i);
  if (m) return m[1];
  m = itemXml.match(/<media:thumbnail[^>]+url="([^"]+)"/i);
  if (m) return m[1];
  m = itemXml.match(/<enclosure[^>]+url="([^"]+\.(?:jpg|jpeg|png|webp)[^"]*?)"/i);
  if (m) return m[1];
  m = itemXml.match(/<img[^>]+src="([^"]+)"/i);
  if (m) return m[1];
  return null;
}

function cleanHtml(str) {
  // Decode entities first, with &amp; decoded LAST so an input like "&amp;lt;"
  // becomes the literal "&lt;" rather than being double-unescaped into "<".
  let s = str
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#8230;/g, "…").replace(/&#8216;|&#8217;/g, "'")
    .replace(/&#8220;|&#8221;/g, '"').replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
  // Strip tags repeatedly until the string stops changing, so nested or
  // overlapping tags (e.g. "<scr<script>ipt>") can't reconstitute a live tag.
  let prev;
  do {
    prev = s;
    s = s.replace(/<[^>]*>/g, "");
  } while (s !== prev);
  return s.replace(/\s+/g, " ").trim();
}

function parseFeed(xml, limit = 15) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;
  while ((match = itemRegex.exec(xml)) !== null && items.length < limit) {
    const ix = match[1];
    const title = cleanHtml(extractCDATA("title", ix));
    const link = cleanHtml(extractCDATA("link", ix));
    const description = cleanHtml(extractCDATA("description", ix)).slice(0, 220);
    const pubDate = cleanHtml(extractCDATA("pubDate", ix));
    const image = extractImage(ix);
    if (title && link && !link.startsWith("#")) {
      items.push({ title, link, description, pubDate, image, source: null });
    }
  }
  return items;
}

async function fetchRss(url) {
  // Source and tier are stamped HERE, and the blocklist is applied HERE, so that every later
  // stage — Claude, keywords, the story-of-the-day pick — is working from an already-filtered
  // pool. A guard that each caller has to remember to apply is a guard that one caller will
  // eventually forget.
  const feedHost = (() => {
    try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return null; }
  })();
  const tier = CURATED.has(url) ? "curated" : "major";
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 SeenApp/1.0", Accept: "application/rss+xml, application/xml, text/xml" },
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`RSS ${res.status}`);
  return parseFeed(await res.text())
    .map((item) => ({ ...item, source: feedHost, tier }))
    .filter((item) => !isBlocked(item));
}

// ── GNews ─────────────────────────────────────────────────────────────────────

const GNEWS_API_KEY = process.env.GNEWS_API_KEY || "";
const GNEWS_SEARCH  = "https://gnews.io/api/v4/search";
const GNEWS_TOP     = "https://gnews.io/api/v4/top-headlines";

async function fetchGNews(query, { countryCode = null, max = 10 } = {}) {
  if (!GNEWS_API_KEY) return [];
  const p = new URLSearchParams({ q: query, lang: "en", max: String(max), apikey: GNEWS_API_KEY });
  if (countryCode) p.set("country", countryCode.toLowerCase());
  const res = await fetch(`${GNEWS_SEARCH}?${p}`, { signal: AbortSignal.timeout(7000) });
  if (!res.ok) throw new Error(`GNews search ${res.status}`);
  const data = await res.json();
  if (data.errors) throw new Error(JSON.stringify(data.errors));
  return (data.articles || []).map(articleToStory);
}

async function fetchGNewsTop(countryCode, max = 10) {
  if (!GNEWS_API_KEY || !countryCode) return [];
  const p = new URLSearchParams({ lang: "en", max: String(max), apikey: GNEWS_API_KEY, country: countryCode.toLowerCase() });
  const res = await fetch(`${GNEWS_TOP}?${p}`, { signal: AbortSignal.timeout(7000) });
  if (!res.ok) throw new Error(`GNews top ${res.status}`);
  const data = await res.json();
  if (data.errors) throw new Error(JSON.stringify(data.errors));
  return (data.articles || []).map(articleToStory);
}

function articleToStory(a) {
  return {
    title: (a.title || "").replace(/\s[-–]\s[^-–]+$/, "").trim(),
    description: (a.description || "").slice(0, 220),
    link: a.url || "#",
    image: a.image || null,
    pubDate: a.publishedAt || null,
    source: a.source?.name || null,
  };
}

// ── Claude categorisation ─────────────────────────────────────────────────────

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || "";

async function categoriseWithClaude(stories) {
  if (!ANTHROPIC_KEY) return null;

  const client = new Anthropic({ apiKey: ANTHROPIC_KEY });

  // Send title + first 120 chars of description; enough for accurate categorisation
  const list = stories
    .map((s, i) => `${i}|${s.title}${s.description ? " — " + s.description.slice(0, 120) : ""}`)
    .join("\n");

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1024,
    messages: [{
      role: "user",
      content: `You are categorising news stories for an uplifting news app. Assign each story to exactly one category.

Categories:
- inspiring   : Personal achievements, overcoming adversity, feel-good human stories, hope
- breakthrough: Science, medicine, technology — new discoveries or inventions
- weirdWonderful: Quirky, offbeat, surprising, record-breaking, unusual-but-true stories
- kind        : Acts of kindness, volunteers, charity, community, animal rescue
- funny       : Lighthearted, humorous, amusing stories that make you smile
- skip        : Too negative, political, violent, irrelevant, or not uplifting

Return ONLY a compact JSON array, one object per story, in the same order:
[{"i":0,"c":"inspiring"},{"i":1,"c":"kind"},...]

Stories (index|title — description):
${list}`,
    }],
  });

  const text = response.content[0]?.text || "";
  const raw = text.match(/\[[\s\S]*\]/)?.[0];
  if (!raw) throw new Error("Claude returned no JSON array");
  return JSON.parse(raw); // [{ i, c }]
}

// Keyword fallback when Claude is unavailable
const KEYWORD_MAP = {
  inspiring:      /inspir|achiev|overcome|triumph|dream|graduate|surviv|hero|milestone|uplifting|heartwarming|hope/i,
  breakthrough:   /science|medical|research|discover|invent|technolog|breakthrough|cure|study|treatment|AI|robot/i,
  weirdWonderful: /weird|quirky|unusual|strange|bizarre|record|oddity|unexpect|mysterious|wonder/i,
  kind:           /kind|volunteer|charit|donat|community|help|rescue|shelter|compassion|generous/i,
  funny:          /funny|humor|amusing|laugh|hilarious|viral|prank|comic|whimsical/i,
};

function keywordCategorise(story) {
  const text = `${story.title} ${story.description}`;
  for (const [cat, re] of Object.entries(KEYWORD_MAP)) {
    if (re.test(text)) return cat;
  }
  return null; // skip
}

// ── The story of the day ─────────────────────────────────────────────────────
//
// One story, the same one for everybody, refreshed once a day. Shared on purpose: a thing two
// people can both have read is worth more in an app about connection than a personalised list
// nobody else saw.
//
// Curated first, always. A major-outlet story is used only when no curated feed produced
// anything that day — so on a normal day the majors are a fallback rather than the source, which
// is the practical half of keeping them at all.
function pickStoryOfTheDay(result) {
  const ordered = [];
  for (const key of CATEGORY_KEYS) {
    for (const st of result[key]?.stories ?? []) ordered.push({ ...st, category: key });
  }
  const live = ordered.filter((st) => st.link && st.title && !isBlocked(st));
  return live.find((st) => st.tier === "curated") || live.find((st) => st.tier === "major") || null;
}

// The ~200 words the owner asked for. The endpoint previously carried an RSS blurb cut to 220
// CHARACTERS, which is a different thing entirely and reads like a teaser.
//
// Returns null rather than a half-summary if anything goes wrong, and the caller then publishes
// nothing. A day with no card is unremarkable; a day with a mangled one is the only version of
// this feature anybody would remember.
//
// ── THE CEILING WAS NOT GENEROUS, AND THAT COST TWO DAYS OF CARDS ────────────────────────────
// This ran at max_tokens: 600 with a comment claiming that was "roughly double what is needed"
// for 200 words. Two hundred words IS about 270 tokens, so the arithmetic was right and the
// premise was wrong: the model was asked for "ABOUT 200 words" and then given six formatting
// rules, and what comes back is routinely 350-450 words — 470 to 600 tokens, right on the line.
//
// While the over-run was simply truncated it was invisible, because the card clipped the text
// anyway. The moment a guard turned "truncated" into "publish nothing", the daily story stopped
// appearing and stayed stopped, because this endpoint fails closed by design.
//
// So the fix is not the guard, which is correct. It is three things the guard exposed: a ceiling
// that could actually be reached, a brief with no upper bound in it, and no second chance.
const SUMMARY_MAX_TOKENS = 1200; // ~4x a 200-word answer: a backstop, not a budget

function summaryPrompt(story, extra = "") {
  return `Write 150 to 220 words on this news story for a kindness and wellbeing app used by people aged 13 and over.

Title: ${story.title}
Summary: ${story.description || "(none)"}
Source: ${story.source || "unknown"}

Rules:
- Warm and plain. No hype, no "amazing", no exclamation marks.
- Only what the title and summary support. Invent no names, numbers, quotes or outcomes.
- If the story turns out to involve death, violence, crime, disaster, illness or politics,
  reply with exactly: UNSUITABLE
- No preamble. Start with the story.
- Plain prose only. No markdown of any kind: no headings, no #, no bullet points, no bold,
  no italics. Paragraphs separated by a blank line, nothing else.
- No title or headline of your own. The app shows the story's own headline above your text.
- Stop when the story is told. Do not pad to reach a length.${extra}`;
}

async function summariseStory(story) {
  if (!ANTHROPIC_KEY) return null;
  try {
    const client = new Anthropic({ apiKey: ANTHROPIC_KEY });

    const ask = (extra) => client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: SUMMARY_MAX_TOKENS,
      messages: [{ role: "user", content: summaryPrompt(story, extra) }],
    });

    let response = await ask("");

    // A summary that ran into the ceiling is a half-summary, and this function's whole contract
    // is not to return one. With the ceiling at 1200 this should now be unreachable — but an
    // unreachable branch that silently costs a whole day of cards is exactly what was here
    // before, so it gets a second chance rather than a shrug. One more call costs a fraction of
    // a penny; the alternative costs everybody the card.
    if (response.stop_reason === "max_tokens") {
      console.error("[goodnews] summary hit the token ceiling — retrying once, shorter");
      response = await ask("\n- IMPORTANT: keep it under 200 words.");
      if (response.stop_reason === "max_tokens") {
        console.error("[goodnews] retry hit the ceiling too — publishing nothing today");
        return null;
      }
    }

    const text = (response.content[0]?.text || "").trim();
    // The model gets a way out, and it is honoured. A categoriser forced to always produce
    // something will always produce something, including on the day it should have declined.
    if (!text) { console.error("[goodnews] summary came back empty"); return null; }
    if (/^UNSUITABLE/i.test(text)) {
      console.error("[goodnews] model declined the story as unsuitable");
      return null;
    }
    return text;
  } catch (err) {
    console.error("[goodnews] summary failed:", err.message);
    return null;
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const countryCode = (req.query?.country || "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2);
  const countryName = (req.query?.name || "").replace(/[^a-zA-Z\s]/g, "").trim().slice(0, 60);

  try {
    // ── 1. Fetch all stories in parallel ──────────────────────────────────────

    const fetchTasks = [
      // Global RSS feeds
      ...GLOBAL_FEEDS.map((url) => fetchRss(url).then((stories) => stories.map((s) => ({ ...s, isLocal: false }))).catch(() => [])),
    ];

    if (countryCode && GNEWS_API_KEY) {
      // Local GNews: three broad queries to maximise story count
      for (const q of GNEWS_LOCAL_QUERIES) {
        // A: articles FROM the country's own sources
        fetchTasks.push(
          fetchGNews(q, { countryCode }).then((s) => s.map((x) => ({ ...x, isLocal: true }))).catch(() => [])
        );
        // B: articles ABOUT the country from any source
        if (countryName) {
          fetchTasks.push(
            fetchGNews(`${q} "${countryName}"`, {}).then((s) => s.map((x) => ({ ...x, isLocal: true }))).catch(() => [])
          );
        }
      }
      // C: country top-headlines (broadest possible local sweep)
      fetchTasks.push(
        fetchGNewsTop(countryCode).then((s) => s.map((x) => ({ ...x, isLocal: true }))).catch(() => [])
      );
    }

    const batches = await Promise.all(fetchTasks);

    // Deduplicate by link
    const seen = new Set();
    const allStories = [];
    for (const batch of batches) {
      for (const story of batch) {
        if (story.link && story.link !== "#" && !seen.has(story.link)) {
          seen.add(story.link);
          allStories.push(story);
        }
      }
    }

    // ── 2. Categorise with Claude (or keyword fallback) ───────────────────────

    const result = {};
    for (const [key, meta] of Object.entries(CATEGORIES)) {
      result[key] = { ...meta, stories: [] };
    }

    let claudeAssignments = null;
    if (ANTHROPIC_KEY && allStories.length > 0) {
      try {
        // Cap at 120 stories; local stories go first so they aren't crowded out
        const localFirst = [
          ...allStories.filter((s) => s.isLocal),
          ...allStories.filter((s) => !s.isLocal),
        ].slice(0, 120);

        claudeAssignments = await categoriseWithClaude(localFirst);

        // Track per-category local/global counts for balanced filling
        const localCounts  = Object.fromEntries(CATEGORY_KEYS.map((k) => [k, 0]));
        const globalCounts = Object.fromEntries(CATEGORY_KEYS.map((k) => [k, 0]));

        for (const { i, c } of claudeAssignments) {
          const cat = c;
          if (!result[cat] || i >= localFirst.length) continue;
          const story = localFirst[i];
          const counts = story.isLocal ? localCounts : globalCounts;
          if (counts[cat] < 10) {
            result[cat].stories.push(story);
            counts[cat]++;
          }
        }
      } catch (err) {
        console.error("Claude categorisation failed, falling back to keywords:", err.message);
        claudeAssignments = null;
      }
    }

    // Keyword fallback (no API key, or Claude errored)
    if (!claudeAssignments) {
      const localCounts  = Object.fromEntries(CATEGORY_KEYS.map((k) => [k, 0]));
      const globalCounts = Object.fromEntries(CATEGORY_KEYS.map((k) => [k, 0]));

      for (const story of allStories) {
        // CURATED ONLY when Claude is unavailable, and this is the important line in the
        // fallback. keywordCategorise matches on POSITIVE words — "rescue" scores kind, "hero"
        // and "surviv" score inspiring — so run over general news it actively selects FOR
        // disaster coverage that happens to contain an uplifting word. The blocklist above
        // already drops those, but a fallback whose whole method is keyword-matching should not
        // be the last thing standing between a bereavement headline and a 13-year-old.
        //
        // A thinner day is the cost, and it is the right one: the curated feeds publish nothing
        // but this sort of story, so the fallback still has plenty to choose from.
        if (story.tier !== "curated") continue;
        const cat = keywordCategorise(story);
        if (!cat) continue;
        const counts = story.isLocal ? localCounts : globalCounts;
        if (counts[cat] < 10) {
          result[cat].stories.push(story);
          counts[cat]++;
        }
      }
    }

    // ── 3. Pad thin categories with fallbacks ─────────────────────────────────

    for (const [key, cat] of Object.entries(result)) {
      if (cat.stories.length < 2) {
        const seenLinks = new Set(cat.stories.map((s) => s.link));
        for (const fb of FALLBACKS[key] || []) {
          if (!seenLinks.has(fb.link)) cat.stories.push(fb);
        }
      }
    }

    const cacheHeader = countryCode
      ? "public, s-maxage=10800, stale-while-revalidate=86400"
      : "public, s-maxage=21600, stale-while-revalidate=86400";
    res.setHeader("Cache-Control", cacheHeader);
    res.setHeader("Vary", "");

    // ── The daily write ───────────────────────────────────────────────────────
    //
    // Called with the cron secret, this also stores ONE story at meta/goodNewsToday, and that is
    // what every client reads. Clients never call this endpoint.
    //
    // Not an optimisation — a hard requirement. GNews's free tier is 100 requests a DAY, so a
    // client-side fetch-on-open exhausts it before lunch at a few dozen users, and then the
    // feature fails for everybody in a way that looks like a bug rather than a quota.
    //
    // meta/{docId} is world-readable and admin-writable (firestore.rules), so the owner can
    // delete a story from the Firebase console and the card disappears for everyone. That is the
    // backstop for a story that clears the blocklist and still lands wrong — which, with general
    // news in the pool, will happen eventually.
    const isCron = process.env.CRON_SECRET
      && req.headers?.authorization === `Bearer ${process.env.CRON_SECRET}`;
    let stored = null;
    if (isCron) {
      const pick = pickStoryOfTheDay(result);
      const summary = pick ? await summariseStory(pick) : null;
      if (pick && summary) {
        try {
          const { cert, getApps, initializeApp } = await import("firebase-admin/app");
          const { getFirestore } = await import("firebase-admin/firestore");
          if (!getApps().length) {
            initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)) });
          }
          stored = {
            title: pick.title,
            summary,
            link: pick.link,
            source: pick.source || null,
            tier: pick.tier || null,
            category: pick.category || null,
            emoji: CATEGORIES[pick.category]?.emoji || "✨",
            label: CATEGORIES[pick.category]?.label || "Good news",
            image: pick.image || null,
            publishedAt: Date.now(),
          };
          await getFirestore().collection("meta").doc("goodNewsToday").set(stored);
          // Say so. A successful run used to log NOTHING, which meant "no goodnews lines in the
          // log" was ambiguous between "it worked" and "it never ran" — and during a two-day
          // outage that ambiguity was the difference between a diagnosis and a guess. The word
          // count is here because the failure this feature actually had was about length.
          console.log(`[goodnews] published "${pick.title}" (${summary.split(/\s+/).length} words)`);
        } catch (err) {
          console.error("[goodnews] store failed:", err.message);
          stored = null;
        }
      } else {
        // FAIL CLOSED. Nothing suitable today means yesterday's card stays until it is replaced,
        // and the client hides anything older than 48 hours. Publishing the least-bad remaining
        // story on a thin day is exactly how this feature would earn its bad reputation.
        //
        // console.error, not console.log, and the distinction is the whole lesson of the outage
        // this comment was written after: failing closed is right, but a feature that fails
        // closed SILENTLY looks identical to one that is working, and this one went two days
        // before anybody noticed. An error line at least puts it in the view people check.
        console.error(`[goodnews] nothing to publish today (story=${pick ? "found" : "none"}, summary=${summary ? "ok" : "none"}) — leaving the existing card alone`);
      }
    }

    return res.status(200).json({
      categories: result,
      countryCode: countryCode || null,
      fetched: new Date().toISOString(),
      categorisedBy: claudeAssignments ? "claude" : "keywords",
      storyOfTheDay: stored,
    });

  } catch (err) {
    console.error("GoodNews handler error:", err.message);
    const fallback = {};
    for (const [key, meta] of Object.entries(CATEGORIES)) {
      fallback[key] = { ...meta, stories: FALLBACKS[key] || [] };
    }
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ categories: fallback, fetched: new Date().toISOString(), fallback: true });
  }
}
