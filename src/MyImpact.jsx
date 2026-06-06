// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.

import React, { useEffect, useMemo, useState } from "react";
import { collection, getDocs, limit, query, where } from "firebase/firestore";
import { countryToFlag } from "./MicroAnimations";
import { COUNTRY_COORDS } from "./WorldMap";

// ── Haversine distance ────────────────────────────────────────────

function kmBetween([lon1, lat1], [lon2, lat2]) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Data hook ─────────────────────────────────────────────────────

const CACHE_TTL = 60 * 60 * 1000;

function useReactionData(db, currentUser, period) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!db || !currentUser) return;
    const cacheKey = `seen_react_v1_${period}_${currentUser.uid}`;

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

        const result = { totalReactions, reactionByCountry, dayMap };
        setData(result);
        try { localStorage.setItem(cacheKey, JSON.stringify({ at: Date.now(), data: result })); } catch (_) {}
      } catch (_) {
        setData({ totalReactions: 0, reactionByCountry: {}, dayMap: {} });
      } finally {
        setLoading(false);
      }
    })();
  }, [db, currentUser, period]);

  return { data, loading };
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

// ── Milestone card ────────────────────────────────────────────────

const MILESTONES = [1, 5, 10, 20, 35, 50, 75, 100];

function MilestoneCard({ countriesCount }) {
  const reached = MILESTONES.filter(m => countriesCount >= m);
  const next = MILESTONES.find(m => countriesCount < m) || null;
  const prev = reached.length > 0 ? reached[reached.length - 1] : 0;
  const progress = next ? Math.round(((countriesCount - prev) / (next - prev)) * 100) : 100;

  return (
    <div style={{ margin: "0 18px 22px", borderRadius: "16px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", padding: "16px" }}>
      <p style={{ fontSize: "10px", fontWeight: 700, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 12px" }}>
        Milestone Progress
      </p>
      <div style={{ display: "flex", gap: "6px", marginBottom: "14px", flexWrap: "wrap" }}>
        {MILESTONES.map(m => (
          <div key={m} style={{
            padding: "3px 8px", borderRadius: "8px", fontSize: "10px", fontWeight: 700,
            background: countriesCount >= m ? "rgba(77,255,176,0.15)" : "rgba(255,255,255,0.05)",
            color: countriesCount >= m ? "#4DFFB0" : "rgba(255,255,255,0.2)",
            border: `1px solid ${countriesCount >= m ? "rgba(77,255,176,0.3)" : "rgba(255,255,255,0.06)"}`,
          }}>
            {m}
          </div>
        ))}
      </div>
      {next ? (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
            <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", fontWeight: 600 }}>{countriesCount} / {next} countries</span>
            <span style={{ fontSize: "11px", color: "#4DFFB0", fontWeight: 700 }}>{progress}%</span>
          </div>
          <div style={{ height: "5px", borderRadius: "3px", background: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${progress}%`, borderRadius: "3px", background: "linear-gradient(90deg, #4DFFB0, #00d9a3)", transition: "width 0.8s cubic-bezier(0.34,1.2,0.64,1)" }} />
          </div>
          <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.25)", margin: "8px 0 0", fontWeight: 500 }}>
            {next - countriesCount} more {next - countriesCount === 1 ? "country" : "countries"} to next milestone
          </p>
        </>
      ) : (
        <p style={{ fontSize: "12px", color: "#4DFFB0", fontWeight: 700, margin: 0, textAlign: "center" }}>
          🏆 All milestones reached!
        </p>
      )}
    </div>
  );
}

// ── Furthest Reach card ───────────────────────────────────────────

function FurthestReachCard({ reactionByCountry, homeCountry }) {
  const result = useMemo(() => {
    const homeCoords = COUNTRY_COORDS[homeCountry];
    if (!homeCoords || !reactionByCountry || Object.keys(reactionByCountry).length === 0) return null;
    let best = null, bestKm = 0;
    for (const country of Object.keys(reactionByCountry)) {
      const coords = COUNTRY_COORDS[country];
      if (!coords) continue;
      const km = kmBetween(homeCoords, coords);
      if (km > bestKm) { bestKm = km; best = country; }
    }
    if (!best) return null;
    return { country: best, km: Math.round(bestKm) };
  }, [reactionByCountry, homeCountry]);

  if (!result) return null;

  return (
    <div style={{ margin: "0 18px 22px", borderRadius: "16px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", padding: "16px" }}>
      <p style={{ fontSize: "10px", fontWeight: 700, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 12px" }}>
        Furthest Reaction
      </p>
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <span style={{ fontSize: "32px", lineHeight: 1 }}>{countryToFlag(result.country)}</span>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: "15px", fontWeight: 700, color: "#fff", margin: "0 0 2px" }}>{result.country}</p>
          <p style={{ fontSize: "12px", color: "#4DFFB0", fontWeight: 600, margin: 0 }}>{result.km.toLocaleString()} km from home</p>
        </div>
        <span style={{ fontSize: "24px" }}>✈️</span>
      </div>
    </div>
  );
}

// ── Rhythm card ───────────────────────────────────────────────────

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function RhythmCard({ streak, dayMap }) {
  const bestDay = useMemo(() => {
    const totals = [0, 0, 0, 0, 0, 0, 0];
    Object.entries(dayMap || {}).forEach(([dateStr, count]) => {
      const dow = new Date(dateStr + "T12:00:00").getDay();
      totals[dow] += count;
    });
    const max = Math.max(...totals);
    if (max === 0) return null;
    return DAY_NAMES[totals.indexOf(max)];
  }, [dayMap]);

  return (
    <div style={{ margin: "0 18px 22px", borderRadius: "16px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", padding: "16px" }}>
      <p style={{ fontSize: "10px", fontWeight: 700, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 14px" }}>
        Your Rhythm
      </p>
      <div style={{ display: "flex", gap: "12px" }}>
        <div style={{ flex: 1, background: "rgba(255,255,255,0.04)", borderRadius: "12px", padding: "12px", textAlign: "center" }}>
          <p style={{ fontSize: "28px", margin: "0 0 4px", lineHeight: 1 }}>{streak >= 7 ? "🔥" : streak >= 3 ? "✨" : "💫"}</p>
          <p style={{ fontSize: "22px", fontWeight: 800, color: streak > 0 ? "#fff" : "rgba(255,255,255,0.3)", margin: "0 0 2px", lineHeight: 1 }}>{streak}</p>
          <p style={{ fontSize: "9px", fontWeight: 700, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.05em", margin: 0 }}>Day streak</p>
        </div>
        {bestDay ? (
          <div style={{ flex: 1, background: "rgba(255,255,255,0.04)", borderRadius: "12px", padding: "12px", textAlign: "center" }}>
            <p style={{ fontSize: "28px", margin: "0 0 4px", lineHeight: 1 }}>📅</p>
            <p style={{ fontSize: "14px", fontWeight: 800, color: "#fff", margin: "0 0 2px", lineHeight: 1.2 }}>{bestDay}</p>
            <p style={{ fontSize: "9px", fontWeight: 700, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.05em", margin: 0 }}>Best day</p>
          </div>
        ) : (
          <div style={{ flex: 1, background: "rgba(255,255,255,0.04)", borderRadius: "12px", padding: "12px", textAlign: "center", display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.25)", margin: 0, fontWeight: 500, lineHeight: 1.4 }}>Send more to discover your best day</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────

export default function MyImpact({ db, currentUser, liveStats, streak = 0, profile }) {
  const [period, setPeriod] = useState("7d");
  const { data, loading } = useReactionData(db, currentUser, period);

  const sentCount = period === "7d" ? (liveStats?.sent7d ?? null) : (liveStats?.sent30d ?? null);
  const countriesCount = period === "7d" ? (liveStats?.countries7d ?? null) : (liveStats?.countries30d ?? null);

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
  const reactingCountriesCount = Object.keys(data?.reactionByCountry || {}).length;

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

      {/* ── Stat tiles — Sent + Countries are live (no loading); Reactions from Firestore ── */}
      <div style={{ margin: "0 18px 22px", borderRadius: "16px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)", padding: "18px 8px 16px", display: "flex" }}>
        <StatTile loading={false} value={sentCount} label="Sent" />
        <div style={{ width: "1px", background: "rgba(255,255,255,0.08)", margin: "4px 0" }} />
        <StatTile loading={false} value={countriesCount} label="Countries" sub="reached" />
        <div style={{ width: "1px", background: "rgba(255,255,255,0.08)", margin: "4px 0" }} />
        <StatTile
          loading={loading}
          value={data?.totalReactions}
          label="Reactions"
          sub={reactingCountriesCount > 0 ? `${reactingCountriesCount} ${reactingCountriesCount === 1 ? "country" : "countries"}` : undefined}
        />
      </div>

      {/* ── Milestone Progress ── */}
      <MilestoneCard countriesCount={countriesCount ?? 0} />

      {/* ── Furthest Reaction ── */}
      {!loading && <FurthestReachCard reactionByCountry={data?.reactionByCountry} homeCountry={profile?.country} />}

      {/* ── Your Rhythm ── */}
      <RhythmCard streak={streak} dayMap={data?.dayMap} />

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
