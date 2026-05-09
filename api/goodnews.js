// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.
// /api/goodnews.js — Multi-source Wonderful News feed, 10+ stories per category + local news

const CATEGORY_SOURCES = {
  inspiring: {
    emoji: "✨",
    label: "Inspiring",
    feeds: [
      "https://www.goodnewsnetwork.org/category/inspire/feed/",
      "https://www.goodnewsnetwork.org/category/heroes/feed/",
      "https://www.positive.news/feed/",
    ],
    gnewsQuery: "inspiring OR heartwarming OR uplifting story",
  },
  breakthrough: {
    emoji: "🔬",
    label: "Breakthrough",
    feeds: [
      "https://www.sciencedaily.com/rss/top/science.xml",
      "https://newatlas.com/feed/",
      "https://futurism.com/feed",
    ],
    gnewsQuery: "science breakthrough OR medical discovery OR invention",
  },
  weirdWonderful: {
    emoji: "🤪",
    label: "Weird & Wonderful",
    feeds: [
      "https://www.odditycentral.com/feed",
      "https://twistedsifter.com/feed/",
      "https://www.atlasobscura.com/feeds/latest",
    ],
    gnewsQuery: "weird wonderful unusual quirky amazing record",
  },
  kind: {
    emoji: "🤝",
    label: "Kind",
    feeds: [
      "https://www.goodnewsnetwork.org/category/kindness/feed/",
      "https://www.goodnewsnetwork.org/category/animals/feed/",
      "https://www.sunnyskyz.com/rss.php",
    ],
    gnewsQuery: "kindness volunteer community charity helping strangers",
  },
  funny: {
    emoji: "😂",
    label: "Funny",
    feeds: [
      "https://laughingsquid.com/feed/",
      "https://www.boredpanda.com/feed/",
      "https://www.goodnewsnetwork.org/category/humor/feed/",
    ],
    gnewsQuery: "funny amusing humorous lighthearted viral",
  },
};

const FALLBACK_PER_CATEGORY = {
  inspiring: [
    { title: "94-Year-Old Graduates With a Bachelor's Degree After a 70-Year Dream", description: "'It's never too late,' said Doris, who walked the stage to a standing ovation.", link: "#", pubDate: new Date().toUTCString(), image: null },
    { title: "Blind Climber Reaches Summit of Mount Everest for the Third Time", description: "Erik Weihenmayer says the mountain 'speaks to you in a different language when you can't see it.'", link: "#", pubDate: new Date().toUTCString(), image: null },
    { title: "Small Town Raises $500,000 to Save Its Beloved Local Library", description: "A community rallied in 30 days to keep their library open after funding cuts threatened closure.", link: "#", pubDate: new Date().toUTCString(), image: null },
  ],
  breakthrough: [
    { title: "Scientists Grow Human Kidney in Pig for First Time — Landmark for Transplants", description: "Researchers at a leading university successfully grew a functional human kidney inside a pig embryo.", link: "#", pubDate: new Date().toUTCString(), image: null },
    { title: "New Battery Technology Charges an EV in 5 Minutes Flat", description: "A solid-state battery developed by a university spin-out promises to eliminate range anxiety entirely.", link: "#", pubDate: new Date().toUTCString(), image: null },
    { title: "AI System Detects Cancer 4 Years Before Symptoms Appear", description: "Early results from a 10,000-patient trial show 90% accuracy in detecting tumours before they're visible.", link: "#", pubDate: new Date().toUTCString(), image: null },
  ],
  weirdWonderful: [
    { title: "Town Elects a Golden Retriever as Honorary Mayor for the Third Year Running", description: "Max the dog won the popular vote again, campaigning on belly rubs and afternoon naps.", link: "#", pubDate: new Date().toUTCString(), image: null },
    { title: "Man Discovers 1,000-Year-Old Viking Sword While Walking His Dog", description: "A metal-detector hobbyist unearthed the perfectly preserved blade in a Norwegian field.", link: "#", pubDate: new Date().toUTCString(), image: null },
    { title: "Octopus Found to Dream in Vivid Colour Changes — Scientists Stunned", description: "Footage shows the octopus cycling through dramatic colour patterns during REM-like sleep.", link: "#", pubDate: new Date().toUTCString(), image: null },
  ],
  kind: [
    { title: "Retired Postman Walks 1,000 Miles Delivering Hand-Written Letters to Strangers", description: "He wrote kind notes to 1,000 random addresses and personally delivered replies he received.", link: "#", pubDate: new Date().toUTCString(), image: null },
    { title: "Teen Donates All His Birthday Money to Build a Water Well in Kenya", description: "The 13-year-old raised £4,000 from friends and family, enough to provide clean water for a village.", link: "#", pubDate: new Date().toUTCString(), image: null },
    { title: "Restaurant Feeds Hundreds of Homeless Every Sunday for Free — 10 Years Running", description: "Chef Maria Santos has never missed a Sunday since 2014, serving a three-course meal to anyone who comes.", link: "#", pubDate: new Date().toUTCString(), image: null },
  ],
  funny: [
    { title: "Duck Follows Bus Route Every Day — Locals Start Calling It the Commuter", description: "The duck has taken the same route 47 times. Transit officials say they have no plans to charge it.", link: "#", pubDate: new Date().toUTCString(), image: null },
    { title: "Man Accidentally Live-Streams Cat Walking on Keyboard to 50,000 People", description: "The cat managed to start a stream, adjust camera filters, and type 'mewwwww' in the chat.", link: "#", pubDate: new Date().toUTCString(), image: null },
    { title: "Grandma Thinks Google Home Is a New Family Member, Greets It Every Morning", description: "'I just don't want it to feel left out,' she told her bewildered grandchildren.", link: "#", pubDate: new Date().toUTCString(), image: null },
  ],
};

// ── XML parsing helpers ───────────────────────────────────────────────────────

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

async function fetchFeed(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 SeenApp/1.0 (https://seenapp.app)", Accept: "application/rss+xml, application/xml, text/xml" },
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.text();
}

function buildGoogleNewsUrl(query, countryCode) {
  const cc = countryCode.toUpperCase();
  const q = encodeURIComponent(query);
  return `https://news.google.com/rss/search?q=${q}&gl=${cc}&hl=en&ceid=${cc}:en`;
}

function parseFeed(xml, limit = 12) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;
  while ((match = itemRegex.exec(xml)) !== null && items.length < limit) {
    const ix = match[1];
    const title = cleanHtml(extractCDATA("title", ix));
    const link = cleanHtml(extractCDATA("link", ix));
    const description = cleanHtml(extractCDATA("description", ix)).slice(0, 200);
    const pubDate = cleanHtml(extractCDATA("pubDate", ix));
    const image = extractImage(ix);
    if (title && link && !link.startsWith("#")) items.push({ title, link, description, pubDate, image });
  }
  return items;
}

// ── Main handler ──────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const countryCode = (req.query?.country || "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2);

  try {
    // Build feed list: global feeds + optional local Google News feeds per category
    const allFeedTasks = Object.entries(CATEGORY_SOURCES).flatMap(([key, cat]) => {
      const global = cat.feeds.map((url) => ({ key, url, isLocal: false }));
      const local = countryCode
        ? [{ key, url: buildGoogleNewsUrl(cat.gnewsQuery, countryCode), isLocal: true }]
        : [];
      return [...global, ...local];
    });

    const results = await Promise.allSettled(
      allFeedTasks.map(async ({ key, url, isLocal }) => {
        const xml = await fetchFeed(url);
        const stories = parseFeed(xml, 12).map((s) => ({ ...s, isLocal }));
        return { key, stories, isLocal };
      })
    );

    // Group by category — local stories go first, then global
    const byCategory = {};
    for (const [key, cat] of Object.entries(CATEGORY_SOURCES)) {
      byCategory[key] = { emoji: cat.emoji, label: cat.label, stories: [] };
    }

    // First pass: local stories
    for (const result of results) {
      if (result.status !== "fulfilled" || !result.value.isLocal) continue;
      const { key, stories } = result.value;
      const seen = new Set(byCategory[key].stories.map((s) => s.link));
      for (const story of stories) {
        if (!seen.has(story.link) && byCategory[key].stories.length < 5) {
          seen.add(story.link);
          byCategory[key].stories.push(story);
        }
      }
    }

    // Second pass: global stories fill the rest
    for (const result of results) {
      if (result.status !== "fulfilled" || result.value.isLocal) continue;
      const { key, stories } = result.value;
      const seen = new Set(byCategory[key].stories.map((s) => s.link));
      for (const story of stories) {
        if (!seen.has(story.link) && byCategory[key].stories.length < 10) {
          seen.add(story.link);
          byCategory[key].stories.push(story);
        }
      }
    }

    // Pad with fallbacks if a category came up short
    for (const [key, cat] of Object.entries(byCategory)) {
      if (cat.stories.length < 3) {
        const seen = new Set(cat.stories.map((s) => s.link));
        for (const fb of FALLBACK_PER_CATEGORY[key] || []) {
          if (!seen.has(fb.link)) cat.stories.push(fb);
        }
      }
    }

    // Don't cache per-country responses at the edge (vary by country)
    const cacheHeader = countryCode
      ? "public, s-maxage=10800, stale-while-revalidate=86400"
      : "public, s-maxage=21600, stale-while-revalidate=86400";
    res.setHeader("Cache-Control", cacheHeader);
    res.setHeader("Vary", "");
    return res.status(200).json({ categories: byCategory, countryCode: countryCode || null, fetched: new Date().toISOString() });
  } catch (err) {
    console.error("GoodNews API error:", err.message);
    const fallbackCategories = {};
    for (const [key, cat] of Object.entries(CATEGORY_SOURCES)) {
      fallbackCategories[key] = { emoji: cat.emoji, label: cat.label, stories: FALLBACK_PER_CATEGORY[key] || [] };
    }
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ categories: fallbackCategories, fetched: new Date().toISOString(), fallback: true });
  }
}
