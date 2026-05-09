// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.
// GoodNews.jsx — Daily Wonderful News feed, 10 stories per category + local news

import React, { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw, Share2, ExternalLink } from "lucide-react";

const CATEGORY_KEYS = ["inspiring", "breakthrough", "weirdWonderful", "kind", "funny"];
const ALL_TAB = "all";

// Country name (as stored in profile) → ISO 3166-1 alpha-2
const COUNTRY_CODES = {
  "Afghanistan":"AF","Albania":"AL","Algeria":"DZ","Andorra":"AD","Angola":"AO",
  "Argentina":"AR","Armenia":"AM","Australia":"AU","Austria":"AT","Azerbaijan":"AZ",
  "Bahrain":"BH","Bangladesh":"BD","Belarus":"BY","Belgium":"BE","Bolivia":"BO",
  "Bosnia and Herzegovina":"BA","Brazil":"BR","Bulgaria":"BG","Cambodia":"KH",
  "Cameroon":"CM","Canada":"CA","Chile":"CL","China":"CN","Colombia":"CO",
  "Costa Rica":"CR","Croatia":"HR","Cuba":"CU","Cyprus":"CY","Czech Republic":"CZ",
  "Denmark":"DK","Dominican Republic":"DO","Ecuador":"EC","Egypt":"EG",
  "El Salvador":"SV","Estonia":"EE","Ethiopia":"ET","Finland":"FI","France":"FR",
  "Georgia":"GE","Germany":"DE","Ghana":"GH","Greece":"GR","Guatemala":"GT",
  "Honduras":"HN","Hungary":"HU","Iceland":"IS","India":"IN","Indonesia":"ID",
  "Iran":"IR","Iraq":"IQ","Ireland":"IE","Israel":"IL","Italy":"IT","Jamaica":"JM",
  "Japan":"JP","Jordan":"JO","Kazakhstan":"KZ","Kenya":"KE","Kuwait":"KW",
  "Latvia":"LV","Lebanon":"LB","Libya":"LY","Lithuania":"LT","Luxembourg":"LU",
  "Malaysia":"MY","Malta":"MT","Mexico":"MX","Moldova":"MD","Mongolia":"MN",
  "Morocco":"MA","Mozambique":"MZ","Myanmar":"MM","Nepal":"NP","Netherlands":"NL",
  "New Zealand":"NZ","Nicaragua":"NI","Nigeria":"NG","Norway":"NO","Oman":"OM",
  "Pakistan":"PK","Panama":"PA","Paraguay":"PY","Peru":"PE","Philippines":"PH",
  "Poland":"PL","Portugal":"PT","Qatar":"QA","Romania":"RO","Russia":"RU",
  "Rwanda":"RW","Saudi Arabia":"SA","Senegal":"SN","Serbia":"RS","Singapore":"SG",
  "Slovakia":"SK","Slovenia":"SI","Somalia":"SO","South Africa":"ZA",
  "South Korea":"KR","Spain":"ES","Sri Lanka":"LK","Sudan":"SD","Sweden":"SE",
  "Switzerland":"CH","Syria":"SY","Taiwan":"TW","Tanzania":"TZ","Thailand":"TH",
  "Tunisia":"TN","Turkey":"TR","Uganda":"UG","Ukraine":"UA",
  "United Arab Emirates":"AE","United Kingdom":"GB","United States":"US",
  "Uruguay":"UY","Uzbekistan":"UZ","Venezuela":"VE","Vietnam":"VN",
  "Yemen":"YE","Zambia":"ZM","Zimbabwe":"ZW",
};

function todayLabel() {
  return new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
}

function formatDate(dateStr) {
  try {
    const d = new Date(dateStr);
    if (isNaN(d)) return "";
    return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  } catch { return ""; }
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white overflow-hidden animate-pulse flex-shrink-0 w-64">
      <div className="h-28 bg-slate-100" />
      <div className="p-3 space-y-2">
        <div className="h-3 w-16 rounded-full bg-slate-100" />
        <div className="h-4 w-full rounded-full bg-slate-100" />
        <div className="h-4 w-3/4 rounded-full bg-slate-100" />
        <div className="h-3 w-full rounded-full bg-slate-100" />
      </div>
    </div>
  );
}

// ── Story card ────────────────────────────────────────────────────────────────
function StoryCard({ story, emoji, label }) {
  const [imgError, setImgError] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleShare = async (e) => {
    e.stopPropagation();
    try {
      if (navigator.share && story.link !== "#") {
        await navigator.share({ title: story.title, text: story.description, url: story.link });
      } else {
        await navigator.clipboard.writeText(story.link !== "#" ? story.link : story.title);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch (_) {}
  };

  const handleOpen = (e) => {
    e.stopPropagation();
    if (story.link && story.link !== "#") window.open(story.link, "_blank", "noopener,noreferrer");
  };

  const hasImage = story.image && !imgError;

  return (
    <div className="rounded-2xl border border-slate-100 bg-white overflow-hidden shadow-sm active:scale-[0.98] transition-transform flex-shrink-0 w-64 flex flex-col">
      {hasImage ? (
        <div className="relative h-28 overflow-hidden bg-slate-100 flex-shrink-0">
          <img src={story.image} alt="" className="w-full h-full object-cover" onError={() => setImgError(true)} />
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
        </div>
      ) : (
        <div className="h-14 flex items-center justify-center bg-gradient-to-br from-teal-50 to-emerald-50 flex-shrink-0">
          <span className="text-2xl">{emoji}</span>
        </div>
      )}

      <div className="p-3 flex flex-col flex-1">
        {/* Category + local badge + date */}
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1">
            <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 border border-teal-100 px-2 py-0.5 text-[10px] font-bold text-teal-700">
              {emoji} {label}
            </span>
            {story.isLocal && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-50 border border-amber-200 px-1.5 py-0.5 text-[9px] font-bold text-amber-700">
                📍 Local
              </span>
            )}
          </div>
          {story.pubDate && <span className="text-[10px] text-slate-400">{formatDate(story.pubDate)}</span>}
        </div>

        {/* Headline */}
        <p className="text-[13px] font-bold text-slate-800 leading-snug mb-1 line-clamp-2 flex-1">
          {story.title}
        </p>

        {/* Snippet */}
        {story.description && (
          <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-2 mb-2">
            {story.description}
          </p>
        )}

        {/* Actions */}
        <div className="flex items-center gap-1.5 mt-auto">
          <button onClick={handleOpen} className="flex-1 flex items-center justify-center gap-1 rounded-xl border border-slate-200 py-1.5 text-[10px] font-semibold text-slate-600 hover:bg-slate-50 active:scale-95 transition-all">
            <ExternalLink size={10} /> Read
          </button>
          <button onClick={handleShare} className="flex-1 flex items-center justify-center gap-1 rounded-xl border border-teal-200 bg-teal-50 py-1.5 text-[10px] font-semibold text-teal-700 hover:bg-teal-100 active:scale-95 transition-all">
            <Share2 size={10} /> {copied ? "Copied!" : "Share"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Category section (horizontal scroll row) ──────────────────────────────────
function CategorySection({ catKey, cat, onViewAll }) {
  return (
    <div className="mb-5">
      {/* Section header */}
      <div className="flex items-center justify-between mb-2 px-4">
        <div className="flex items-center gap-1.5">
          <span className="text-base leading-none">{cat.emoji}</span>
          <p className="text-sm font-bold text-slate-800">{cat.label}</p>
          <span className="text-[10px] text-slate-400 font-medium">{cat.stories.length} stories</span>
        </div>
        <button
          onClick={() => onViewAll(catKey)}
          className="text-[11px] font-semibold text-teal-600 hover:text-teal-700">
          See all →
        </button>
      </div>

      {/* Horizontal scroll */}
      <div className="flex gap-3 overflow-x-auto px-4 pb-1" style={{ scrollbarWidth: "none" }}>
        {cat.stories.map((story, i) => (
          <StoryCard key={i} story={story} emoji={cat.emoji} label={cat.label} />
        ))}
      </div>
    </div>
  );
}

// ── All-stories flat list ─────────────────────────────────────────────────────
function AllStoriesGrid({ categories }) {
  // Interleave: one story from each category at a time for variety
  const interleaved = [];
  const arrays = CATEGORY_KEYS.map((k) => [...(categories[k]?.stories || [])]);
  let hasMore = true;
  while (hasMore) {
    hasMore = false;
    for (const arr of arrays) {
      const item = arr.shift();
      if (item) { interleaved.push(item); hasMore = true; }
    }
  }
  return (
    <div className="px-4 space-y-3">
      {interleaved.map((story, i) => {
        // Find category for this story
        const catKey = CATEGORY_KEYS.find((k) => (categories[k]?.stories || []).some((s) => s.link === story.link && s.title === story.title)) || "inspiring";
        const cat = categories[catKey] || {};
        return (
          <div key={i} className="rounded-2xl border border-slate-100 bg-white overflow-hidden shadow-sm">
            <div className="flex gap-3 p-3">
              {story.image && (
                <img src={story.image} alt="" className="w-20 h-20 rounded-xl object-cover flex-shrink-0" onError={(e) => e.target.style.display = "none"} />
              )}
              <div className="flex-1 min-w-0">
                <span className="inline-flex items-center gap-0.5 rounded-full bg-teal-50 border border-teal-100 px-1.5 py-0.5 text-[9px] font-bold text-teal-700 mb-1">
                  {cat.emoji} {cat.label}
                </span>
                <p className="text-[13px] font-bold text-slate-800 leading-snug line-clamp-2 mb-1">{story.title}</p>
                <p className="text-[11px] text-slate-500 line-clamp-1">{story.description}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function GoodNews({ profile }) {
  const [categories, setCategories] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState(ALL_TAB);
  const [refreshKey, setRefreshKey] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [localCountry, setLocalCountry] = useState(null);
  const tabBarRef = useRef(null);

  const countryCode = COUNTRY_CODES[profile?.country] || null;

  const fetchNews = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = countryCode ? `/api/goodnews?country=${countryCode}` : "/api/goodnews";
      const res = await fetch(url);
      if (!res.ok) throw new Error("Could not load Wonderful News");
      const data = await res.json();
      setCategories(data.categories || {});
      setLocalCountry(data.countryCode || null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [countryCode]);

  useEffect(() => { fetchNews(); }, [fetchNews, refreshKey]);

  const handleRefresh = () => {
    setSpinning(true);
    setRefreshKey((k) => k + 1);
    setTimeout(() => setSpinning(false), 800);
  };

  // Tab definitions
  const tabs = [
    { key: ALL_TAB, label: "All" },
    ...(categories
      ? CATEGORY_KEYS.map((k) => ({ key: k, label: `${categories[k]?.emoji} ${categories[k]?.label}` }))
      : []),
  ];

  const activeCategory = categories?.[activeTab];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Sub-header */}
      <div className="px-4 pt-3 pb-0 bg-white border-b border-slate-100 flex-shrink-0">
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="text-base font-bold text-slate-800">Wonderful News</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <p className="text-[11px] text-slate-400">{todayLabel()}</p>
              {localCountry && (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-50 border border-amber-200 px-1.5 py-0.5 text-[9px] font-bold text-amber-700">
                  📍 {profile?.country} + Global
                </span>
              )}
            </div>
          </div>
          <button onClick={handleRefresh} className="flex items-center justify-center h-8 w-8 rounded-full text-slate-400 hover:bg-slate-100 active:scale-90 transition-all">
            <RefreshCw size={14} className={spinning ? "animate-spin" : ""} />
          </button>
        </div>

        {/* Category tab pills */}
        <div ref={tabBarRef} className="flex gap-1.5 overflow-x-auto pb-2.5" style={{ scrollbarWidth: "none" }}>
          {loading
            ? [ALL_TAB, ...CATEGORY_KEYS].map((k) => (
                <div key={k} className="flex-shrink-0 h-7 w-16 rounded-full bg-slate-100 animate-pulse" />
              ))
            : tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex-shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold transition-all border whitespace-nowrap ${
                    activeTab === tab.key
                      ? "bg-teal-500 border-teal-500 text-white"
                      : "bg-white border-slate-200 text-slate-500 hover:border-teal-300"
                  }`}>
                  {tab.label}
                </button>
              ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto bg-slate-50/60 py-4">
        {loading ? (
          <div>
            {CATEGORY_KEYS.map((k) => (
              <div key={k} className="mb-5">
                <div className="flex items-center gap-2 mb-2 px-4">
                  <div className="h-4 w-24 rounded-full bg-slate-200 animate-pulse" />
                </div>
                <div className="flex gap-3 overflow-x-auto px-4">
                  {[0, 1, 2].map((i) => <SkeletonCard key={i} />)}
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-6">
            <span className="text-4xl mb-3">😔</span>
            <p className="text-sm font-semibold text-slate-600 mb-1">Couldn't load Wonderful News</p>
            <p className="text-xs text-slate-400 mb-4">{error}</p>
            <button onClick={handleRefresh} className="rounded-full px-5 py-2 bg-teal-500 text-white text-xs font-bold">Try again</button>
          </div>
        ) : activeTab === ALL_TAB ? (
          <AllStoriesGrid categories={categories} />
        ) : activeCategory ? (
          <div className="px-4 space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl">{activeCategory.emoji}</span>
              <p className="text-sm font-bold text-slate-800">{activeCategory.label}</p>
              <span className="text-[11px] text-slate-400">{activeCategory.stories.length} stories today</span>
            </div>
            {activeCategory.stories.map((story, i) => (
              <div key={i} className="rounded-2xl border border-slate-100 bg-white overflow-hidden shadow-sm">
                {story.image && (
                  <div className="relative h-36 overflow-hidden bg-slate-100">
                    <img src={story.image} alt="" className="w-full h-full object-cover" onError={(e) => { e.target.parentElement.style.display = "none"; }} />
                  </div>
                )}
                <div className="p-3.5">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1">
                      <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 border border-teal-100 px-2 py-0.5 text-[10px] font-bold text-teal-700">
                        {activeCategory.emoji} {activeCategory.label}
                      </span>
                      {story.isLocal && (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-50 border border-amber-200 px-1.5 py-0.5 text-[9px] font-bold text-amber-700">
                          📍 Local
                        </span>
                      )}
                    </div>
                    {story.pubDate && <span className="text-[10px] text-slate-400">{formatDate(story.pubDate)}</span>}
                  </div>
                  <p className="text-sm font-bold text-slate-800 leading-snug mb-1.5 line-clamp-2">{story.title}</p>
                  {story.description && <p className="text-[12px] text-slate-500 leading-relaxed line-clamp-2 mb-3">{story.description}</p>}
                  <div className="flex gap-2">
                    <button
                      onClick={() => story.link !== "#" && window.open(story.link, "_blank", "noopener,noreferrer")}
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 py-2 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 active:scale-95 transition-all">
                      <ExternalLink size={11} /> Read more
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          if (navigator.share && story.link !== "#") await navigator.share({ title: story.title, url: story.link });
                          else await navigator.clipboard.writeText(story.link !== "#" ? story.link : story.title);
                        } catch (_) {}
                      }}
                      className="flex items-center justify-center gap-1.5 rounded-xl border border-teal-200 bg-teal-50 px-3 py-2 text-[11px] font-semibold text-teal-700 hover:bg-teal-100 active:scale-95 transition-all">
                      <Share2 size={11} /> Share
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {!loading && !error && (
          <p className="text-center text-[10px] text-slate-300 py-4">
            Refreshed every 6 hours · Inspiring · Breakthrough · Weird & Wonderful · Kind · Funny
          </p>
        )}
      </div>
    </div>
  );
}
