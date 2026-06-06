// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { collection, getDocs, limit, query, where } from "firebase/firestore";
import { countryToFlag } from "./MicroAnimations";
import { COUNTRY_COORDS } from "./WorldMap";

// ── Data hook ─────────────────────────────────────────────────────

const CACHE_TTL = 60 * 60 * 1000;

function useImpactData(db, currentUser, period) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!db || !currentUser) return;
    const cacheKey = `seen_impact_v1_${period}_${currentUser.uid}`;

    try {
      const cached = JSON.parse(localStorage.getItem(cacheKey) || "null");
      if (cached && Date.now() - cached.at < CACHE_TTL) {
        setData(cached.data);
        setLoading(false);
        return;
      }
    } catch (_) {}

    setLoading(true);
    const cutoff = Date.now() - (period === "30d" ? 30 : 7) * 86400000;

    (async () => {
      try {
        const mySnap = await getDocs(query(
          collection(db, "publicMessages"),
          where("uid", "==", currentUser.uid),
          where("timestamp", ">=", cutoff),
          limit(500)
        ));

        const dayMap = {};
        mySnap.forEach(d => {
          const key = new Date(d.data().timestamp).toISOString().split("T")[0];
          dayMap[key] = (dayMap[key] || 0) + 1;
        });

        const allSnap = await getDocs(query(
          collection(db, "publicMessages"),
          where("timestamp", ">=", cutoff),
          limit(500)
        ));
        const countriesReached = new Set();
        allSnap.forEach(d => {
          const c = d.data().country;
          if (c && d.data().uid !== currentUser.uid) countriesReached.add(c);
        });

        const myMsgIds = mySnap.docs.map(d => d.id);
        let totalReactions = 0;
        const reactionByCountry = {};
        await Promise.all(myMsgIds.map(async msgId => {
          try {
            const rSnap = await getDocs(collection(db, "publicMessages", msgId, "reactions"));
            rSnap.forEach(rDoc => {
              const { uids = [], countries = {} } = rDoc.data();
              uids.forEach(uid => {
                if (uid !== currentUser.uid) {
                  totalReactions++;
                  const c = countries[uid];
                  if (c) reactionByCountry[c] = (reactionByCountry[c] || 0) + 1;
                }
              });
            });
          } catch (_) {}
        }));

        const result = {
          sent: mySnap.size,
          countriesReached: [...countriesReached],
          totalReactions,
          reactionByCountry,
          dayMap,
        };
        setData(result);
        try { localStorage.setItem(cacheKey, JSON.stringify({ at: Date.now(), data: result })); } catch (_) {}
      } catch (_) {
        setData({ sent: 0, countriesReached: [], totalReactions: 0, reactionByCountry: {}, dayMap: {} });
      } finally {
        setLoading(false);
      }
    })();
  }, [db, currentUser, period]);

  return { data, loading };
}

// ── Mini flat world map ───────────────────────────────────────────

function MiniWorldMap({ countriesReached = [], reactionCountries = [] }) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const mapRef = useRef({ nameToFeature: {}, d3: null, ready: false });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      if (!window.d3) {
        await new Promise((res, rej) => {
          const s = document.createElement("script");
          s.src = "https://cdnjs.cloudflare.com/ajax/libs/d3/7.8.5/d3.min.js";
          s.onload = res; s.onerror = rej;
          document.head.appendChild(s);
        });
      }
      if (!window.topojson) {
        await new Promise((res, rej) => {
          const s = document.createElement("script");
          s.src = "https://cdnjs.cloudflare.com/ajax/libs/topojson/3.0.2/topojson.min.js";
          s.onload = res; s.onerror = rej;
          document.head.appendChild(s);
        });
      }
      const world = await fetch("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json").then(r => r.json());
      const features = window.topojson.feature(world, world.objects.countries).features;
      const d3l = window.d3;
      const nameToFeature = {};

      for (const [name, coords] of Object.entries(COUNTRY_COORDS)) {
        let found = null;
        for (const f of features) {
          if (d3l.geoContains(f, coords)) { found = f; break; }
        }
        if (!found) {
          let best = null, minDist = Infinity;
          for (const f of features) {
            const c = d3l.geoCentroid(f);
            const dist = (c[0] - coords[0]) ** 2 + (c[1] - coords[1]) ** 2;
            if (dist < minDist) { minDist = dist; best = f; }
          }
          found = best;
        }
        if (found) nameToFeature[name] = found;
      }

      mapRef.current = { nameToFeature, d3: d3l, ready: true };
      setReady(true);
    })().catch(() => {});
  }, []);

  useEffect(() => {
    if (!ready || !canvasRef.current || !containerRef.current) return;

    const container = containerRef.current;
    const canvas = canvasRef.current;
    const dpr = window.devicePixelRatio || 1;
    const w = container.clientWidth;
    const h = Math.round(w * 0.46);

    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);

    const { d3, nameToFeature } = mapRef.current;
    const proj = d3.geoNaturalEarth1().scale(w / 6.28).translate([w / 2, h / 2]);
    const path = d3.geoPath().projection(proj).context(ctx);

    ctx.fillStyle = "#07111e";
    ctx.fillRect(0, 0, w, h);

    const reachedSet = new Set(countriesReached);
    const reactedSet = new Set(reactionCountries);

    // Base pass — all countries dim
    for (const [, feature] of Object.entries(nameToFeature)) {
      ctx.beginPath(); path(feature);
      ctx.fillStyle = "rgba(22, 42, 70, 0.6)";
      ctx.strokeStyle = "rgba(35, 65, 105, 0.5)";
      ctx.lineWidth = 0.3 / dpr;
      ctx.fill(); ctx.stroke();
    }

    // Highlight pass — reached (amber) then reacted (coral) on top
    for (const tier of ["reached", "reacted"]) {
      const activeSet = tier === "reached" ? reachedSet : reactedSet;
      for (const [name, feature] of Object.entries(nameToFeature)) {
        if (!activeSet.has(name)) continue;
        // Skip reached if it's also reacted — reacted pass will handle it
        if (tier === "reached" && reactedSet.has(name)) continue;

        ctx.beginPath(); path(feature);
        if (tier === "reacted") {
          ctx.shadowColor = "rgba(255, 90, 126, 0.9)";
          ctx.shadowBlur = 12;
          ctx.fillStyle = "rgba(255, 80, 120, 0.62)";
          ctx.strokeStyle = "rgba(255, 140, 165, 1)";
          ctx.lineWidth = 0.8 / dpr;
        } else {
          ctx.shadowColor = "rgba(255, 175, 60, 0.7)";
          ctx.shadowBlur = 9;
          ctx.fillStyle = "rgba(255, 160, 50, 0.42)";
          ctx.strokeStyle = "rgba(255, 200, 100, 0.85)";
          ctx.lineWidth = 0.5 / dpr;
        }
        ctx.fill(); ctx.stroke();
        ctx.shadowBlur = 0;
      }
    }
  }, [ready, countriesReached, reactionCountries]);

  return (
    <div ref={containerRef} style={{ width: "100%", borderRadius: "14px", overflow: "hidden", background: "#07111e", minHeight: "140px", display: "flex", alignItems: "center", justifyContent: "center" }}>
      {!ready && (
        <p style={{ color: "rgba(77,255,176,0.35)", fontSize: "11px", fontWeight: 600, margin: 0 }}>Loading map…</p>
      )}
      <canvas ref={canvasRef} style={{ display: ready ? "block" : "none" }} />
    </div>
  );
}

// ── Stat tile ─────────────────────────────────────────────────────

function StatTile({ value, label, sub, loading }) {
  return (
    <div style={{ flex: 1, textAlign: "center", padding: "2px 4px" }}>
      {loading ? (
        <div style={{ height: "30px", borderRadius: "6px", background: "rgba(255,255,255,0.07)", margin: "0 auto 6px", width: "52%" }} />
      ) : (
        <p style={{ fontSize: "26px", fontWeight: 800, color: "#fff", margin: "0 0 4px", lineHeight: 1, letterSpacing: "-0.03em" }}>
          {value ?? 0}
        </p>
      )}
      <p style={{ fontSize: "10px", fontWeight: 700, color: "rgba(255,255,255,0.45)", margin: 0, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</p>
      {sub && <p style={{ fontSize: "9px", color: "#4DFFB0", margin: "2px 0 0", fontWeight: 600 }}>{sub}</p>}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────

export default function MyImpact({ db, currentUser }) {
  const [period, setPeriod] = useState("7d");
  const { data, loading } = useImpactData(db, currentUser, period);

  const days = useMemo(() => {
    const n = period === "30d" ? 30 : 7;
    const result = [];
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const key = d.toISOString().split("T")[0];
      const label = period === "7d"
        ? ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"][d.getDay()]
        : (i === n - 1 || i === 0 || i % 7 === 0) ? d.getDate().toString() : "";
      result.push({ key, label, count: data?.dayMap?.[key] || 0 });
    }
    return result;
  }, [period, data]);

  const maxCount = Math.max(1, ...days.map(d => d.count));
  const reactionList = useMemo(() =>
    Object.entries(data?.reactionByCountry || {}).sort(([, a], [, b]) => b - a).slice(0, 10),
    [data]
  );
  const reactionCountryNames = useMemo(() => Object.keys(data?.reactionByCountry || {}), [data]);

  return (
    <div style={{ flex: 1, background: "#060e18", overflowY: "auto", display: "flex", flexDirection: "column", paddingBottom: "32px" }}>

      {/* ── Header ── */}
      <div style={{ padding: "22px 18px 14px", display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <p style={{ fontSize: "20px", fontWeight: 800, color: "#fff", margin: 0, letterSpacing: "-0.025em", lineHeight: 1.15 }}>
            Your Kindness
          </p>
          <p style={{ fontSize: "20px", fontWeight: 800, color: "#4DFFB0", margin: 0, letterSpacing: "-0.025em", lineHeight: 1.15 }}>
            Footprint
          </p>
        </div>
        <div style={{ display: "flex", background: "rgba(255,255,255,0.06)", borderRadius: "10px", padding: "3px", marginTop: "2px" }}>
          {["7d", "30d"].map(p => (
            <button key={p} onClick={() => setPeriod(p)} style={{
              padding: "5px 13px", borderRadius: "7px", fontSize: "11px", fontWeight: 700,
              border: "none", cursor: "pointer", transition: "all 0.15s",
              background: period === p ? "rgba(77,255,176,0.18)" : "transparent",
              color: period === p ? "#4DFFB0" : "rgba(255,255,255,0.35)",
            }}>
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* ── Mini World Map ── */}
      <div style={{ padding: "0 18px 10px" }}>
        <MiniWorldMap
          countriesReached={data?.countriesReached || []}
          reactionCountries={reactionCountryNames}
        />
      </div>

      {/* Legend */}
      <div style={{ padding: "0 20px 20px", display: "flex", gap: "18px" }}>
        <span style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "10px", fontWeight: 600, color: "rgba(255,175,60,0.85)" }}>
          <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "rgba(255,160,50,0.7)", flexShrink: 0 }} />
          Countries active
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "10px", fontWeight: 600, color: "rgba(255,100,140,0.85)" }}>
          <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "rgba(255,80,120,0.7)", flexShrink: 0 }} />
          Reacted to you
        </span>
      </div>

      {/* ── Stat tiles ── */}
      <div style={{ margin: "0 18px 22px", borderRadius: "16px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)", padding: "18px 8px 16px", display: "flex" }}>
        <StatTile loading={loading} value={data?.sent} label="Sent" />
        <div style={{ width: "1px", background: "rgba(255,255,255,0.08)", margin: "4px 0" }} />
        <StatTile loading={loading} value={data?.countriesReached?.length} label="Countries" sub="reached" />
        <div style={{ width: "1px", background: "rgba(255,255,255,0.08)", margin: "4px 0" }} />
        <StatTile
          loading={loading}
          value={data?.totalReactions}
          label="Reactions"
          sub={data?.reactionByCountry && Object.keys(data.reactionByCountry).length > 0
            ? `${Object.keys(data.reactionByCountry).length} ${Object.keys(data.reactionByCountry).length === 1 ? "country" : "countries"}`
            : undefined}
        />
      </div>

      {/* ── Daily activity ── */}
      <div style={{ margin: "0 18px 26px" }}>
        <p style={{ fontSize: "10px", fontWeight: 700, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 14px" }}>
          Daily Activity
        </p>
        <div style={{ display: "flex", alignItems: "flex-end", gap: period === "30d" ? "2px" : "5px", height: "68px" }}>
          {days.map(({ key, label, count }) => {
            const isBest = count > 0 && count === maxCount;
            return (
              <div key={key} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "5px" }}>
                <div
                  title={`${key}: ${count} sent`}
                  style={{
                    width: "100%", borderRadius: "3px 3px 2px 2px",
                    height: `${Math.max(3, (count / maxCount) * 46)}px`,
                    background: count === 0
                      ? "rgba(255,255,255,0.06)"
                      : isBest
                      ? "rgba(77,255,176,0.85)"
                      : "rgba(77,255,176,0.35)",
                    boxShadow: isBest ? "0 0 8px rgba(77,255,176,0.4)" : "none",
                    transition: "height 0.5s cubic-bezier(0.34,1.2,0.64,1)",
                  }}
                />
                {label ? (
                  <span style={{ fontSize: "8px", fontWeight: 600, color: count > 0 ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.2)", lineHeight: 1 }}>
                    {label}
                  </span>
                ) : <span style={{ height: "9px" }} />}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Reactions from ── */}
      <div style={{ margin: "0 18px" }}>
        <p style={{ fontSize: "10px", fontWeight: 700, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 14px" }}>
          Reactions from
        </p>

        {loading ? (
          [1, 2, 3].map(i => (
            <div key={i} style={{ height: "52px", borderRadius: "12px", background: "rgba(255,255,255,0.04)", marginBottom: "8px" }} />
          ))
        ) : reactionList.length === 0 ? (
          <div style={{ textAlign: "center", padding: "28px 0" }}>
            <p style={{ fontSize: "36px", margin: "0 0 10px" }}>🌍</p>
            <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.3)", margin: 0, fontWeight: 500 }}>
              No reactions yet
            </p>
            <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.2)", margin: "5px 0 0" }}>
              Keep spreading kindness — they're coming
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {reactionList.map(([country, count]) => (
              <div key={country} style={{ display: "flex", alignItems: "center", gap: "13px", padding: "11px 14px", borderRadius: "13px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <span style={{ fontSize: "24px", lineHeight: 1, flexShrink: 0 }}>{countryToFlag(country)}</span>
                <p style={{ flex: 1, fontSize: "13px", fontWeight: 600, color: "rgba(255,255,255,0.8)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {country}
                </p>
                <div style={{ display: "flex", alignItems: "center", gap: "3px", flexShrink: 0 }}>
                  {Array.from({ length: Math.min(count, 5) }).map((_, i) => (
                    <span key={i} style={{ fontSize: "13px" }}>❤️</span>
                  ))}
                  {count > 5 && (
                    <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.35)", fontWeight: 700, marginLeft: "2px" }}>
                      +{count - 5}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
