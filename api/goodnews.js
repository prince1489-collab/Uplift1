// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.
// /api/goodnews.js — Proxy + parse GoodNewsNetwork RSS feed

const RSS_URL = "https://www.goodnewsnetwork.org/feed/";

const FALLBACK = [
  {
    title: "Scientists Discover New Treatment That Eliminates Chronic Pain in Trials",
    description: "A groundbreaking non-opioid treatment showed 90% pain reduction in early trials, giving hope to millions living with chronic conditions.",
    link: "https://www.goodnewsnetwork.org",
    pubDate: new Date().toUTCString(),
    image: null,
    category: { emoji: "🧬", label: "Science" },
  },
  {
    title: "Teen Builds Free Library of 3,000 Books for Underserved Communities",
    description: "A 16-year-old spent two summers collecting and distributing books to neighborhoods with no public library access.",
    link: "https://www.goodnewsnetwork.org",
    pubDate: new Date().toUTCString(),
    image: null,
    category: { emoji: "🎓", label: "Education" },
  },
  {
    title: "Ocean Plastic Down 30% in Monitored Zones After Cleanup Initiative",
    description: "A coalition of volunteers removed over 1 million pounds of plastic from coastal waters in a record-breaking annual effort.",
    link: "https://www.goodnewsnetwork.org",
    pubDate: new Date().toUTCString(),
    image: null,
    category: { emoji: "🌿", label: "Environment" },
  },
];

function categorize(title, desc) {
  const text = (title + " " + desc).toLowerCase();
  if (/animal|dog|cat|wildlife|bird|whale|elephant|bear|rescue|sanctuary|koala|turtle/.test(text))
    return { emoji: "🐾", label: "Animals" };
  if (/climate|renewable|solar|wind|tree|forest|ocean|recycle|environment|green|planet|nature|emission/.test(text))
    return { emoji: "🌿", label: "Environment" };
  if (/cancer|cure|vaccine|medical|health|hospital|doctor|patient|research|breakthrough|disease|treatment/.test(text))
    return { emoji: "🧬", label: "Science" };
  if (/school|student|graduate|education|teacher|learning|scholarship|literacy|book/.test(text))
    return { emoji: "🎓", label: "Education" };
  if (/donate|charity|volunteer|community|kindness|help|raise|fund|neighbor|stranger|give/.test(text))
    return { emoji: "🤝", label: "Kindness" };
  if (/space|nasa|mars|planet|star|asteroid|telescope|galaxy|orbit|mission/.test(text))
    return { emoji: "🚀", label: "Space" };
  return { emoji: "✨", label: "Inspiring" };
}

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
  m = itemXml.match(/<enclosure[^>]+url="([^"]+)"/i);
  if (m) return m[1];
  // image inside description HTML
  m = itemXml.match(/<img[^>]+src="([^"]+)"/i);
  if (m) return m[1];
  return null;
}

function cleanHtml(str) {
  return str
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#8230;/g, "…")
    .replace(/&#8216;|&#8217;/g, "'")
    .replace(/&#8220;|&#8221;/g, '"')
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  try {
    const response = await fetch(RSS_URL, {
      headers: {
        "User-Agent": "Mozilla/5.0 SeenApp/1.0 (https://seenapp.app)",
        Accept: "application/rss+xml, application/xml, text/xml",
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) throw new Error(`RSS fetch failed: ${response.status}`);

    const xml = await response.text();
    const items = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
    let match;

    while ((match = itemRegex.exec(xml)) !== null && items.length < 8) {
      const itemXml = match[1];
      const title = cleanHtml(extractCDATA("title", itemXml));
      const link = cleanHtml(extractCDATA("link", itemXml));
      const rawDesc = extractCDATA("description", itemXml);
      const description = cleanHtml(rawDesc).slice(0, 180);
      const pubDate = cleanHtml(extractCDATA("pubDate", itemXml));
      const image = extractImage(itemXml);

      if (title && link) {
        items.push({ title, link, description, pubDate, image, category: categorize(title, description) });
      }
    }

    if (items.length === 0) throw new Error("No items parsed");

    res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
    return res.status(200).json({ items, fetched: new Date().toISOString() });
  } catch (err) {
    console.error("GoodNews API error:", err.message);
    // Return fallback stories so the feature always shows content
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ items: FALLBACK, fetched: new Date().toISOString(), fallback: true });
  }
}
