// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.
// GoodNews.jsx — Daily curated good-news feed

import React, { useCallback, useEffect, useState } from "react";
import { RefreshCw, Share2, ExternalLink } from "lucide-react";

const CATEGORIES = ["All", "🧬 Science", "🌿 Environment", "🐾 Animals", "🤝 Kindness", "🎓 Education", "🚀 Space", "✨ Inspiring"];

function formatDate(dateStr) {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  } catch {
    return "";
  }
}

function todayLabel() {
  return new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
}

// ── Skeleton card ─────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white overflow-hidden animate-pulse">
      <div className="h-36 bg-slate-100" />
      <div className="p-3.5 space-y-2">
        <div className="h-3 w-16 rounded-full bg-slate-100" />
        <div className="h-4 w-full rounded-full bg-slate-100" />
        <div className="h-4 w-3/4 rounded-full bg-slate-100" />
        <div className="h-3 w-full rounded-full bg-slate-100" />
        <div className="h-3 w-5/6 rounded-full bg-slate-100" />
      </div>
    </div>
  );
}

// ── Story card ────────────────────────────────────────────────────────────────
function StoryCard({ item }) {
  const [imgError, setImgError] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleShare = async (e) => {
    e.stopPropagation();
    if (sharing) return;
    setSharing(true);
    try {
      if (navigator.share) {
        await navigator.share({ title: item.title, text: item.description, url: item.link });
      } else {
        await navigator.clipboard.writeText(item.link);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch (_) {}
    setSharing(false);
  };

  const handleOpen = (e) => {
    e.stopPropagation();
    window.open(item.link, "_blank", "noopener,noreferrer");
  };

  const hasImage = item.image && !imgError;

  return (
    <div className="rounded-2xl border border-slate-100 bg-white overflow-hidden shadow-sm active:scale-[0.98] transition-transform">
      {/* Image */}
      {hasImage && (
        <div className="relative h-36 overflow-hidden bg-slate-100">
          <img
            src={item.image}
            alt=""
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
        </div>
      )}
      {!hasImage && (
        <div className="h-16 flex items-center justify-center bg-gradient-to-br from-teal-50 to-emerald-50">
          <span className="text-3xl">{item.category.emoji}</span>
        </div>
      )}

      <div className="p-3.5">
        {/* Category badge */}
        <div className="flex items-center justify-between mb-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 border border-teal-100 px-2 py-0.5 text-[10px] font-bold text-teal-700">
            {item.category.emoji} {item.category.label}
          </span>
          {item.pubDate && (
            <span className="text-[10px] text-slate-400">{formatDate(item.pubDate)}</span>
          )}
        </div>

        {/* Headline */}
        <p className="text-sm font-bold text-slate-800 leading-snug mb-1.5 line-clamp-2">
          {item.title}
        </p>

        {/* Snippet */}
        {item.description && (
          <p className="text-[12px] text-slate-500 leading-relaxed line-clamp-2 mb-3">
            {item.description}
          </p>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleOpen}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 py-2 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 active:scale-95 transition-all">
            <ExternalLink size={11} />
            Read more
          </button>
          <button
            onClick={handleShare}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-teal-200 bg-teal-50 px-3 py-2 text-[11px] font-semibold text-teal-700 hover:bg-teal-100 active:scale-95 transition-all">
            <Share2 size={11} />
            {copied ? "Copied!" : "Share"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function GoodNews() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeCategory, setActiveCategory] = useState("All");
  const [refreshKey, setRefreshKey] = useState(0);
  const [spinning, setSpinning] = useState(false);

  const fetchNews = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/goodnews");
      if (!res.ok) throw new Error("Could not load good news");
      const data = await res.json();
      setItems(data.items || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchNews(); }, [fetchNews, refreshKey]);

  const handleRefresh = () => {
    setSpinning(true);
    setRefreshKey(k => k + 1);
    setTimeout(() => setSpinning(false), 800);
  };

  const filtered = activeCategory === "All"
    ? items
    : items.filter(i => `${i.category.emoji} ${i.category.label}` === activeCategory);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Sub-header */}
      <div className="px-4 pt-4 pb-2 bg-white border-b border-slate-100">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-base font-bold text-slate-800">Good News</p>
            <p className="text-[11px] text-slate-400">{todayLabel()}</p>
          </div>
          <button
            onClick={handleRefresh}
            className="flex items-center justify-center h-8 w-8 rounded-full text-slate-400 hover:bg-slate-100 active:scale-90 transition-all">
            <RefreshCw size={14} className={spinning ? "animate-spin" : ""} />
          </button>
        </div>

        {/* Category filter chips */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none" style={{ scrollbarWidth: "none" }}>
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`flex-shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold transition-all border ${
                activeCategory === cat
                  ? "bg-teal-500 border-teal-500 text-white"
                  : "bg-white border-slate-200 text-slate-500 hover:border-teal-300"
              }`}>
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Stories */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-slate-50/60">
        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-12 text-center px-6">
            <span className="text-4xl mb-3">😔</span>
            <p className="text-sm font-semibold text-slate-600 mb-1">Couldn't load good news</p>
            <p className="text-xs text-slate-400 mb-4">{error}</p>
            <button
              onClick={handleRefresh}
              className="rounded-full px-5 py-2 bg-teal-500 text-white text-xs font-bold hover:bg-teal-600 transition-colors">
              Try again
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <span className="text-3xl mb-2">🔍</span>
            <p className="text-sm text-slate-500">No stories in this category today</p>
          </div>
        ) : (
          filtered.map((item, i) => <StoryCard key={i} item={item} />)
        )}

        {/* Footer note */}
        {!loading && !error && filtered.length > 0 && (
          <p className="text-center text-[10px] text-slate-300 pb-2 pt-1">
            Stories refreshed daily · Source: Good News Network
          </p>
        )}
      </div>
    </div>
  );
}
