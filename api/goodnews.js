// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.
// /api/goodnews.js — Proxy + parse GoodNewsNetwork RSS feed

const RSS_URL = "https://www.goodnewsnetwork.org/feed/";

const FALLBACK = [
  {
    title: "Scientists Discover Non-Opioid Treatment That Eliminates Chronic Pain in Trials",
    description: "A groundbreaking treatment showed 90% pain reduction in early trials, giving hope to millions living with chronic conditions worldwide.",
    link: "https://www.goodnewsnetwork.org",
    pubDate: new Date().toUTCString(),
    image: null,
    category: { emoji: "🔬", label: "Breakthrough" },
  },
  {
    title: "Retired Postman Walks 1,000 Miles to Deliver Hand-Written Letters to Strangers",
    description: "He wrote kind notes to 1,000 random addresses and spent three months personally delivering replies he received — sparking friendships across the country.",
    link: "https://www.goodnewsnetwork.org",
    pubDate: new Date().toUTCString(),
    image: null,
    category: { emoji: "🤝", label: "Kind" },
  },
  {
    title: "Town Elects a Golden Retriever as Honorary Mayor for the Third Year Running",
    description: "Max the dog won the popular vote again in Rabbit Hash, Kentucky, after campaigning on a platform of belly rubs and afternoon naps.",
    link: "https://www.goodnewsnetwork.org",
    pubDate: new Date().toUTCString(),
    image: null,
    category: { emoji: "🤪", label: "Weird & Wonderful" },
  },
  {
    title: "Stand-Up Comedian Performs Sold-Out Show in Sign Language — Audience in Tears of Laughter",
    description: "Deaf comedian Kathy Buckley's show sold out in under an hour, proving laughter truly is universal.",
    link: "https://www.goodnewsnetwork.org",
    pubDate: new Date().toUTCString(),
    image: null,
    category: { emoji: "😂", label: "Funny" },
  },
  {
    title: "94-Year-Old Graduates With a Bachelor's Degree After 70-Year Dream",
    description: "'It's never too late,' said Doris Goldstein, who enrolled at 92 and walked the stage to a standing ovation.",
    link: "https://www.goodnewsnetwork.org",
    pubDate: new Date().toUTCString(),
    image: null,
    category: { emoji: "✨", label: "Inspiring" },
  },
];

function categorize(title, desc) {
  const text = (title + " " + desc).toLowerCase();
  // Funny first — lighthearted, humorous, absurd
  if (/funny|hilarious|laughing|laugh|comedy|comedian|joke|prank|viral|adorable|cute|puppy|kitten|cat video|goat|squirrel|duck|penguin|mayor|elected.*dog|dog.*elected/.test(text))
    return { emoji: "😂", label: "Funny" };
  // Weird & Wonderful — quirky, unusual, record-breaking, unexpected
  if (/world record|guinness|bizarre|unusual|oddly|unexpected|strange|mysterious|first ever|never before|incredible|unbelievable|rare|ancient|fossil|discovery/.test(text))
    return { emoji: "🤪", label: "Weird & Wonderful" };
  // Breakthrough — science, medical, tech
  if (/cancer|cure|vaccine|treatment|clinical trial|breakthrough|research|scientist|invention|technology|ai |robot|gene|dna|drug|therapy|disease|hospital|nasa|space|planet|orbit/.test(text))
    return { emoji: "🔬", label: "Breakthrough" };
  // Kind — acts of kindness, community, charity
  if (/donate|charity|volunteer|community|kindness|kind|help|raise|fund|neighbor|stranger|give|rescued|saved|veteran|homeless|reunited|reunite|foster|adopted|scholarship/.test(text))
    return { emoji: "🤝", label: "Kind" };
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
