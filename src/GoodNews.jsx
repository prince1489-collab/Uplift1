// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.
// GoodNews.jsx — Daily Wonderful News feed, 10 stories per category + local news

import React, { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw, Share2, ExternalLink } from "lucide-react";

const CATEGORY_KEYS = ["inspiring", "breakthrough", "weirdWonderful", "kind", "funny"];
const ALL_TAB = "all";
const REACTION_EMOJIS = ["😍", "🤩", "💡", "❤️", "😂"];

const HERO_GRADIENTS = {
  inspiring:      "from-amber-400 to-orange-500",
  breakthrough:   "from-blue-500 to-cyan-400",
  weirdWonderful: "from-purple-500 to-pink-400",
  kind:           "from-teal-400 to-emerald-500",
  funny:          "from-yellow-400 to-orange-400",
};

// Country name → ISO 3166-1 alpha-2
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

// ── Reaction localStorage helpers ─────────────────────────────────────────────
function reactionKey(story) {
  return encodeURIComponent((story.link && story.link !== "#" ? story.link : story.title).slice(0, 100));
}
function getStoredReaction(key) {
  try { return localStorage.getItem(`seen_nr_${key}`) || null; } catch { return null; }
}
function storeReaction(key, emoji) {
  try {
    if (emoji) localStorage.setItem(`seen_nr_${key}`, emoji);
    else localStorage.removeItem(`seen_nr_${key}`);
  } catch {}
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white overflow-hidden animate-pulse flex-shrink-0 w-60">
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

// ── Emoji Reactions ───────────────────────────────────────────────────────────
function EmojiReactions({ story }) {
  const key = reactionKey(story);
  const [myReaction, setMyReaction] = useState(() => getStoredReaction(key));

  const toggle = (e) => {
    const next = myReaction === e ? null : e;
    setMyReaction(next);
    storeReaction(key, next);
  };

  return (
    <div className="flex items-center gap-2.5 mb-3">
      {REACTION_EMOJIS.map((e) => (
        <button
          key={e}
          onClick={(ev) => { ev.stopPropagation(); toggle(e); }}
          className={`text-xl leading-none transition-all duration-150 select-none ${
            myReaction === e
              ? "scale-125 drop-shadow-sm"
              : "opacity-30 hover:opacity-60 active:scale-110"
          }`}>
          {e}
        </button>
      ))}
    </div>
  );
}

// ── Hero Card — full-width featured story ─────────────────────────────────────
function HeroCard({ story, catKey, emoji, label, onShareStory }) {
  const [imgError, setImgError] = useState(false);
  const [shareState, setShareState] = useState("idle"); // idle | copied | sparked

  const hasImage = story.image && !imgError;
  const gradient = HERO_GRADIENTS[catKey] || "from-teal-400 to-emerald-500";

  const handleShare = async (e) => {
    e.stopPropagation();
    try {
      if (navigator.share && story.link !== "#") {
        await navigator.share({ title: story.title, text: story.description, url: story.link });
      } else {
        await navigator.clipboard.writeText(story.link !== "#" ? story.link : story.title);
        setShareState("copied");
        setTimeout(() => setShareState("idle"), 2000);
        return;
      }
      onShareStory?.();
      setShareState("sparked");
      setTimeout(() => setShareState("idle"), 2500);
    } catch (_) {}
  };

  const handleRead = (e) => {
    e.stopPropagation();
    if (story.link && story.link !== "#") window.open(story.link, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="mx-4 mb-5 rounded-3xl overflow-hidden shadow-xl active:scale-[0.99] transition-transform">
      {/* Hero image */}
      <div className={`relative h-52 bg-gradient-to-br ${gradient}`}>
        {hasImage ? (
          <img
            src={story.image} alt=""
            className="absolute inset-0 w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-8xl opacity-20">{emoji}</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

        {/* Badges */}
        <div className="absolute top-3.5 left-3.5 flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-full bg-white/20 backdrop-blur-md border border-white/25 px-2.5 py-1 text-[11px] font-bold text-white">
            {emoji} {label}
          </span>
          {story.isLocal && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-500/90 px-2 py-1 text-[10px] font-bold text-white">
              📍 Local
            </span>
          )}
        </div>

        {/* Title over image */}
        <div className="absolute bottom-0 left-0 right-0 px-4 pb-4">
          <p className="text-[15px] font-extrabold text-white leading-snug line-clamp-2">{story.title}</p>
          {story.pubDate && (
            <p className="text-[10px] text-white/55 mt-0.5">{formatDate(story.pubDate)}</p>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="bg-white px-4 pt-3.5 pb-4">
        {story.description && (
          <p className="text-[12px] text-slate-500 leading-relaxed line-clamp-2 mb-3">
            {story.description}
          </p>
        )}
        <EmojiReactions story={story} />
        <div className="flex gap-2.5">
          <button
            onClick={handleRead}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-2xl border border-slate-200 py-2.5 text-[12px] font-semibold text-slate-600 hover:bg-slate-50 active:scale-95 transition-all">
            <ExternalLink size={12} /> Read more
          </button>
          <button
            onClick={handleShare}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-2xl py-2.5 text-[12px] font-bold text-white transition-all active:scale-95"
            style={{
              background: shareState === "sparked"
                ? "linear-gradient(135deg,#f59e0b,#d97706)"
                : "linear-gradient(135deg,#14b8a6,#10b981)",
              boxShadow: "0 2px 12px rgba(20,184,166,0.3)",
            }}>
            {shareState === "sparked" ? "✨ +5 Sparks!" : shareState === "copied" ? "✓ Copied" : (
              <><Share2 size={12} /> Share <span className="opacity-60 text-[10px] font-normal">+5✨</span></>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Compact Story Card (horizontal scroll) ────────────────────────────────────
function StoryCard({ story, emoji, label, onShareStory }) {
  const [imgError, setImgError] = useState(false);
  const [shareState, setShareState] = useState("idle");

  const hasImage = story.image && !imgError;

  const handleShare = async (e) => {
    e.stopPropagation();
    try {
      if (navigator.share && story.link !== "#") {
        await navigator.share({ title: story.title, text: story.description, url: story.link });
      } else {
        await navigator.clipboard.writeText(story.link !== "#" ? story.link : story.title);
        setShareState("copied");
        setTimeout(() => setShareState("idle"), 2000);
        return;
      }
      onShareStory?.();
      setShareState("sparked");
      setTimeout(() => setShareState("idle"), 2500);
    } catch (_) {}
  };

  const handleOpen = (e) => {
    e.stopPropagation();
    if (story.link && story.link !== "#") window.open(story.link, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="rounded-2xl border border-slate-100 bg-white overflow-hidden shadow-sm active:scale-[0.98] transition-transform flex-shrink-0 w-60 flex flex-col">
      {hasImage ? (
        <div className="relative h-28 overflow-hidden bg-slate-100 flex-shrink-0">
          <img src={story.image} alt="" className="w-full h-full object-cover" onError={() => setImgError(true)} />
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
        </div>
      ) : (
        <div className="h-12 flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 flex-shrink-0">
          <span className="text-xl">{emoji}</span>
        </div>
      )}

      <div className="p-3 flex flex-col flex-1">
        <div className="flex items-center gap-1 mb-1.5">
          <span className="inline-flex items-center gap-0.5 rounded-full bg-teal-50 border border-teal-100 px-1.5 py-0.5 text-[9px] font-bold text-teal-700">
            {emoji} {label}
          </span>
          {story.isLocal && (
            <span className="inline-flex items-center rounded-full bg-amber-50 border border-amber-200 px-1.5 py-0.5 text-[9px] font-bold text-amber-700">
              📍
            </span>
          )}
        </div>

        <p className="text-[12px] font-bold text-slate-800 leading-snug mb-2 line-clamp-2 flex-1">{story.title}</p>

        <EmojiReactions story={story} />

        <div className="flex items-center gap-1.5 mt-auto">
          <button onClick={handleOpen} className="flex-1 flex items-center justify-center gap-1 rounded-xl border border-slate-200 py-1.5 text-[10px] font-semibold text-slate-600 hover:bg-slate-50 active:scale-95 transition-all">
            <ExternalLink size={10} /> Read
          </button>
          <button
            onClick={handleShare}
            className="flex-1 flex items-center justify-center gap-1 rounded-xl py-1.5 text-[10px] font-semibold text-white active:scale-95 transition-all"
            style={{ background: shareState === "sparked" ? "linear-gradient(135deg,#f59e0b,#d97706)" : "linear-gradient(135deg,#14b8a6,#10b981)" }}>
            {shareState === "sparked" ? "✨+5!" : shareState === "copied" ? "✓" : <><Share2 size={9} /> <span className="opacity-70">+5✨</span></>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Full-width story card (per-category list) ─────────────────────────────────
function FullCard({ story, emoji, label, onShareStory }) {
  const [imgError, setImgError] = useState(false);
  const [shareState, setShareState] = useState("idle");

  const handleShare = async (e) => {
    e.stopPropagation();
    try {
      if (navigator.share && story.link !== "#") {
        await navigator.share({ title: story.title, text: story.description, url: story.link });
      } else {
        await navigator.clipboard.writeText(story.link !== "#" ? story.link : story.title);
        setShareState("copied");
        setTimeout(() => setShareState("idle"), 2000);
        return;
      }
      onShareStory?.();
      setShareState("sparked");
      setTimeout(() => setShareState("idle"), 2500);
    } catch (_) {}
  };

  return (
    <div className="rounded-2xl border border-slate-100 bg-white overflow-hidden shadow-sm">
      {story.image && !imgError && (
        <div className="relative h-36 overflow-hidden bg-slate-100">
          <img src={story.image} alt="" className="w-full h-full object-cover"
            onError={() => setImgError(true)} />
        </div>
      )}
      <div className="p-3.5">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1">
            {story.isLocal && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-50 border border-amber-200 px-1.5 py-0.5 text-[9px] font-bold text-amber-700">
                📍 Local
              </span>
            )}
          </div>
          {story.pubDate && <span className="text-[10px] text-slate-400">{formatDate(story.pubDate)}</span>}
        </div>
        <p className="text-sm font-bold text-slate-800 leading-snug mb-1.5 line-clamp-2">{story.title}</p>
        {story.description && (
          <p className="text-[12px] text-slate-500 leading-relaxed line-clamp-2 mb-3">{story.description}</p>
        )}
        <EmojiReactions story={story} />
        <div className="flex gap-2">
          <button
            onClick={() => story.link !== "#" && window.open(story.link, "_blank", "noopener,noreferrer")}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 py-2 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 active:scale-95 transition-all">
            <ExternalLink size={11} /> Read more
          </button>
          <button
            onClick={handleShare}
            className="flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-[11px] font-semibold text-white active:scale-95 transition-all"
            style={{ background: shareState === "sparked" ? "linear-gradient(135deg,#f59e0b,#d97706)" : "linear-gradient(135deg,#14b8a6,#10b981)" }}>
            {shareState === "sparked" ? "✨ +5!" : shareState === "copied" ? "✓ Copied" : <><Share2 size={11} /> <span className="opacity-70">+5✨</span></>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Category row (horizontal scroll) ─────────────────────────────────────────
function CategoryRow({ catKey, cat, onShareStory }) {
  if (!cat?.stories?.length) return null;
  return (
    <div className="mb-5">
      <div className="flex items-center gap-1.5 mb-2 px-4">
        <span className="text-base leading-none">{cat.emoji}</span>
        <p className="text-sm font-bold text-slate-800">{cat.label}</p>
        <span className="text-[10px] text-slate-400">{cat.stories.length} stories</span>
      </div>
      <div className="flex gap-3 overflow-x-auto px-4 pb-1" style={{ scrollbarWidth: "none" }}>
        {cat.stories.map((story, i) => (
          <StoryCard key={i} story={story} emoji={cat.emoji} label={cat.label} onShareStory={onShareStory} />
        ))}
      </div>
    </div>
  );
}

// ── All view: hero + category rows ────────────────────────────────────────────
function AllView({ categories, onShareStory }) {
  const heroKey = CATEGORY_KEYS.find((k) => categories?.[k]?.stories?.length > 0) || null;
  const heroCat = heroKey ? categories[heroKey] : null;
  const heroStory = heroCat?.stories?.[0] || null;

  return (
    <div>
      {heroStory && heroCat && (
        <HeroCard
          story={heroStory}
          catKey={heroKey}
          emoji={heroCat.emoji}
          label={heroCat.label}
          onShareStory={onShareStory}
        />
      )}
      {CATEGORY_KEYS.map((k) => {
        const cat = categories?.[k];
        if (!cat) return null;
        const stories = k === heroKey ? cat.stories.slice(1) : cat.stories;
        if (!stories.length) return null;
        return (
          <CategoryRow key={k} catKey={k} cat={{ ...cat, stories }} onShareStory={onShareStory} />
        );
      })}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function GoodNews({ profile, onShareStory }) {
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
            <div className="mx-4 mb-5 h-52 rounded-3xl bg-slate-200 animate-pulse" />
            {CATEGORY_KEYS.slice(1).map((k) => (
              <div key={k} className="mb-5">
                <div className="flex items-center gap-2 mb-2 px-4">
                  <div className="h-4 w-28 rounded-full bg-slate-200 animate-pulse" />
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
          <AllView categories={categories} onShareStory={onShareStory} />
        ) : activeCategory ? (
          <div>
            {activeCategory.stories.length > 0 && (
              <HeroCard
                story={activeCategory.stories[0]}
                catKey={activeTab}
                emoji={activeCategory.emoji}
                label={activeCategory.label}
                onShareStory={onShareStory}
              />
            )}
            {activeCategory.stories.length > 1 && (
              <div className="px-4 space-y-3">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
                  More {activeCategory.label}
                </p>
                {activeCategory.stories.slice(1).map((story, i) => (
                  <FullCard key={i} story={story} emoji={activeCategory.emoji} label={activeCategory.label} onShareStory={onShareStory} />
                ))}
              </div>
            )}
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
