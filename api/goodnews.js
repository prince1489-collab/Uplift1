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

// ── Global RSS sources (positive/uplifting news, all categories merged) ───────

const GLOBAL_FEEDS = [
  // Human interest / inspiring
  "https://www.goodnewsnetwork.org/feed/",
  "https://www.positive.news/feed/",
  "https://www.goodnewsnetwork.org/category/heroes/feed/",
  "https://www.goodnewsnetwork.org/category/kindness/feed/",
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
  // Animals / community
  "https://www.goodnewsnetwork.org/category/animals/feed/",
  "https://www.sunnyskyz.com/rss.php",
];

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
  return str
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#8230;/g, "…").replace(/&#8216;|&#8217;/g, "'")
    .replace(/&#8220;|&#8221;/g, '"').replace(/&nbsp;/g, " ").replace(/\s+/g, " ")
    .trim();
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
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 SeenApp/1.0", Accept: "application/rss+xml, application/xml, text/xml" },
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`RSS ${res.status}`);
  return parseFeed(await res.text());
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
        // Cap at 80 stories to keep token usage lean; local stories go first
        const localFirst = [
          ...allStories.filter((s) => s.isLocal),
          ...allStories.filter((s) => !s.isLocal),
        ].slice(0, 80);

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

    return res.status(200).json({
      categories: result,
      countryCode: countryCode || null,
      fetched: new Date().toISOString(),
      categorisedBy: claudeAssignments ? "claude" : "keywords",
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
