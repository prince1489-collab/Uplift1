/**
 * WorldMap.jsx
 *
 * Uses D3.js + Natural Earth GeoJSON (fetched from CDN) to render
 * a proper, accurate world map with real country borders.
 *
 * INTEGRATION in App.jsx (no changes needed):
 *   import WorldMap from "./WorldMap";
 *   {showMap && <WorldMap db={db} currentUser={currentUser} profile={profile} onClose={() => setShowMap(false)} />}
 */

import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import {
  collection, doc, getDoc, limit,
  onSnapshot, query, where,
} from "firebase/firestore";
import { X } from "lucide-react";

// ─────────────────────────────────────────────────────────────────
// COUNTRY CENTROIDS [longitude, latitude]
// ─────────────────────────────────────────────────────────────────
const COUNTRY_COORDS = {
  "Afghanistan": [67.7, 33.9], "Albania": [20.2, 41.2], "Algeria": [3.0, 28.0],
  "Angola": [18.5, -11.2], "Argentina": [-64.0, -34.0], "Armenia": [45.0, 40.2],
  "Australia": [134.0, -25.0], "Austria": [14.6, 47.7], "Azerbaijan": [47.6, 40.1],
  "Bangladesh": [90.4, 23.7], "Belarus": [28.0, 53.5], "Belgium": [4.5, 50.5],
  "Bolivia": [-64.7, -16.7], "Bosnia and Herzegovina": [17.8, 44.2],
  "Brazil": [-51.9, -14.2], "Bulgaria": [25.5, 42.7], "Cambodia": [105.0, 12.6],
  "Cameroon": [12.4, 3.9], "Canada": [-96.8, 56.1], "Chile": [-71.5, -35.7],
  "China": [104.2, 35.9], "Colombia": [-74.3, 4.6], "Croatia": [15.2, 45.1],
  "Cuba": [-79.5, 22.0], "Czech Republic": [15.5, 49.8], "Denmark": [10.0, 56.3],
  "Ecuador": [-78.1, -1.8], "Egypt": [30.8, 26.8], "Ethiopia": [40.5, 9.1],
  "Finland": [26.0, 64.0], "France": [2.2, 46.2], "Germany": [10.5, 51.2],
  "Ghana": [-1.0, 7.9], "Greece": [22.0, 39.1], "Guatemala": [-90.2, 15.8],
  "Hungary": [19.5, 47.2], "Iceland": [-18.1, 65.0], "India": [78.9, 20.6],
  "Indonesia": [113.9, -0.8], "Iran": [53.7, 32.4], "Iraq": [43.7, 33.2],
  "Ireland": [-8.2, 53.4], "Israel": [34.9, 31.5], "Italy": [12.6, 42.5],
  "Jamaica": [-77.3, 18.1], "Japan": [138.3, 36.2], "Jordan": [36.2, 31.0],
  "Kazakhstan": [66.9, 48.0], "Kenya": [37.9, 0.0], "Kuwait": [47.5, 29.3],
  "Kyrgyzstan": [74.6, 41.2], "Laos": [102.5, 19.9], "Latvia": [25.0, 57.0],
  "Lebanon": [35.9, 33.9], "Libya": [17.2, 27.0], "Lithuania": [23.9, 55.2],
  "Luxembourg": [6.1, 49.8], "Madagascar": [46.9, -19.4], "Malaysia": [109.7, 4.2],
  "Mali": [-2.0, 17.6], "Mexico": [-102.6, 23.6], "Moldova": [28.4, 47.4],
  "Mongolia": [103.8, 46.9], "Morocco": [-7.1, 31.8], "Mozambique": [35.5, -18.7],
  "Myanmar": [96.7, 19.2], "Nepal": [84.1, 28.4], "Netherlands": [5.3, 52.1],
  "New Zealand": [174.9, -40.9], "Nigeria": [8.7, 9.1], "North Korea": [127.5, 40.3],
  "Norway": [8.5, 60.5], "Oman": [57.6, 21.5], "Pakistan": [69.3, 30.4],
  "Panama": [-80.8, 8.5], "Paraguay": [-58.4, -23.4], "Peru": [-75.0, -9.2],
  "Philippines": [122.9, 12.9], "Poland": [19.1, 51.9], "Portugal": [-8.2, 39.4],
  "Qatar": [51.2, 25.4], "Romania": [25.0, 45.9], "Russia": [105.3, 61.5],
  "Rwanda": [29.9, -2.0], "Saudi Arabia": [45.1, 24.2], "Senegal": [-14.5, 14.5],
  "Serbia": [21.0, 44.0], "Singapore": [103.8, 1.4], "Slovakia": [19.7, 48.7],
  "Somalia": [46.2, 6.1], "South Africa": [25.1, -29.0], "South Korea": [127.8, 36.6],
  "Spain": [-3.7, 40.4], "Sri Lanka": [80.7, 7.9], "Sudan": [30.2, 15.6],
  "Sweden": [18.6, 60.1], "Switzerland": [8.2, 46.8], "Syria": [38.3, 35.0],
  "Taiwan": [121.0, 23.7], "Tajikistan": [71.3, 38.9], "Tanzania": [34.9, -6.4],
  "Thailand": [101.0, 15.9], "Tunisia": [9.6, 33.9], "Turkey": [35.2, 38.9],
  "Turkmenistan": [59.6, 40.0], "Uganda": [32.3, 1.4], "Ukraine": [31.2, 48.4],
  "United Arab Emirates": [53.8, 23.4], "United Kingdom": [-3.4, 55.4],
  "United States": [-100.4, 37.1], "Uruguay": [-55.8, -32.5], "Uzbekistan": [63.9, 41.4],
  "Venezuela": [-66.6, 6.4], "Vietnam": [108.3, 14.1], "Yemen": [48.5, 15.6],
  "Zambia": [27.8, -13.1], "Zimbabwe": [29.2, -20.0],
};

function approxKm([lon1, lat1], [lon2, lat2]) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

const ACTIVE_TTL_MS = 10 * 60 * 1000;
const W = 960, H = 500;

export default function WorldMap({ db, currentUser, profile, onClose }) {
  const canvasRef = useRef(null);
  const svgRef = useRef(null);
  const [tab, setTab] = useState("world");
  const [mapReady, setMapReady] = useState(false);
  const [activeUsers, setActiveUsers] = useState([]);
  const [arcs, setArcs] = useState([]);
  const [myWaves, setMyWaves] = useState([]);
  const [myWaveProfiles, setMyWaveProfiles] = useState({});
  const [totalToday, setTotalToday] = useState(0);
  const [tooltip, setTooltip] = useState(null);
  const [geoPath, setGeoPath] = useState(null);   // d3 path generator
  const [countries, setCountries] = useState([]); // GeoJSON features
  const arcIdRef = useRef(0);
  const arcTimerRef = useRef(null);
  const d3Ref = useRef(null);
  const projRef = useRef(null);

  const myCountry = profile?.country ?? null;
  const myCoords = myCountry ? COUNTRY_COORDS[myCountry] : null;

  // ── Load D3 + GeoJSON ─────────────────────────────────────────
  useEffect(() => {
    const loadD3AndMap = async () => {
      // Load D3 from CDN
      if (!window.d3) {
        await new Promise((res, rej) => {
          const s = document.createElement("script");
          s.src = "https://cdnjs.cloudflare.com/ajax/libs/d3/7.8.5/d3.min.js";
          s.onload = res; s.onerror = rej;
          document.head.appendChild(s);
        });
      }

      const d3 = window.d3;
      d3Ref.current = d3;

      // Fetch world GeoJSON (Natural Earth 110m — small, fast, clear)
      const response = await fetch(
        "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json"
      );
      const world = await response.json();

      // Convert topojson → GeoJSON using d3
      // world-atlas uses topojson, so we need topojson-client
      if (!window.topojson) {
        await new Promise((res, rej) => {
          const s = document.createElement("script");
          s.src = "https://cdnjs.cloudflare.com/ajax/libs/topojson/3.0.2/topojson.min.js";
          s.onload = res; s.onerror = rej;
          document.head.appendChild(s);
        });
      }

      const features = window.topojson.feature(world, world.objects.countries).features;

      // Set up Natural Earth projection
      const projection = d3.geoNaturalEarth1()
        .scale(160)
        .translate([W / 2, H / 2]);

      projRef.current = projection;

      const pathGen = d3.geoPath().projection(projection);
      setGeoPath(() => pathGen);
      setCountries(features);
      setMapReady(true);
    };

    loadD3AndMap().catch(console.error);
  }, []);

  // Helper: lon/lat → SVG x,y
  const project = useCallback((coords) => {
    if (!projRef.current) return [0, 0];
    return projRef.current(coords);
  }, [mapReady]);

  // ── Firestore listeners ───────────────────────────────────────
  useEffect(() => {
    if (!db) return;
    const cutoff = Date.now() - ACTIVE_TTL_MS;
    const q = query(collection(db, "presence"), where("lastSeen", ">=", cutoff), limit(80));
    return onSnapshot(q, async (snap) => {
      const docs = snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
      const withCountries = await Promise.all(docs.map(async (p) => {
        try {
          const ud = await getDoc(doc(db, "users", p.uid));
          return { uid: p.uid, country: ud.exists() ? ud.data().country : null };
        } catch { return { uid: p.uid, country: null }; }
      }));
      setActiveUsers(withCountries.filter((u) => u.country && COUNTRY_COORDS[u.country]));
    }, () => {});
  }, [db]);

  useEffect(() => {
    if (!db) return;
    const midnight = new Date(); midnight.setHours(0, 0, 0, 0);
    const q = query(collection(db, "publicMessages"), where("timestamp", ">=", midnight.getTime()), limit(500));
    return onSnapshot(q, (snap) => setTotalToday(snap.size), () => {});
  }, [db]);

  useEffect(() => {
    if (!db || !currentUser) return;
    const q = query(collection(db, "waves"), where("toUid", "==", currentUser.uid), limit(100));
    return onSnapshot(q, async (snap) => {
      const waves = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setMyWaves(waves);
      const uids = [...new Set(waves.map((w) => w.fromUid).filter(Boolean))];
      const profiles = {};
      await Promise.all(uids.map(async (uid) => {
        try { const d = await getDoc(doc(db, "users", uid)); if (d.exists()) profiles[uid] = d.data(); } catch {}
      }));
      setMyWaveProfiles(profiles);
    }, () => {});
  }, [db, currentUser]);

  // ── Arc animation ─────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || activeUsers.length < 2) return;
    const addArc = () => {
      const others = activeUsers.filter((u) => u.uid !== currentUser?.uid);
      if (!others.length) return;
      const from = others[Math.floor(Math.random() * others.length)];
      const toCandidates = myCoords
        ? [{ uid: "me", country: myCountry }]
        : others.filter((u) => u.country !== from.country);
      if (!toCandidates.length) return;
      const to = toCandidates[Math.floor(Math.random() * toCandidates.length)];
      const fromC = COUNTRY_COORDS[from.country];
      const toC = COUNTRY_COORDS[to.country];
      if (!fromC || !toC) return;
      const id = ++arcIdRef.current;
      setArcs((prev) => [...prev.slice(-8), { id, fromC, toC }]);
      setTimeout(() => setArcs((prev) => prev.filter((a) => a.id !== id)), 3000);
    };
    addArc();
    arcTimerRef.current = setInterval(addArc, 2200);
    return () => clearInterval(arcTimerRef.current);
  }, [mapReady, activeUsers, myCoords, myCountry, currentUser]);

  // ── Derived data ──────────────────────────────────────────────
  const worldDots = useMemo(() => {
    const map = {};
    for (const u of activeUsers) {
      if (!map[u.country]) map[u.country] = { country: u.country, count: 0, isMe: false };
      map[u.country].count++;
      if (u.uid === currentUser?.uid) map[u.country].isMe = true;
    }
    return Object.values(map);
  }, [activeUsers, currentUser]);

  const myConnectionCountries = useMemo(() =>
    [...new Set(myWaves.map((w) => myWaveProfiles[w.fromUid]?.country).filter((c) => c && COUNTRY_COORDS[c]))],
    [myWaves, myWaveProfiles]
  );

  const furthestCountry = useMemo(() => {
    if (!myCoords || !myConnectionCountries.length) return null;
    let best = null; let max = 0;
    for (const c of myConnectionCountries) {
      const coords = COUNTRY_COORDS[c];
      if (!coords) continue;
      const d = approxKm(myCoords, coords);
      if (d > max) { max = d; best = { country: c, km: d }; }
    }
    return best;
  }, [myCoords, myConnectionCountries]);

  // Arc SVG path using D3 great-circle interpolation
  const makeArcPath = useCallback((fromC, toC) => {
    if (!d3Ref.current || !projRef.current) return "";
    const d3 = d3Ref.current;
    // Use d3 geo interpolation for a proper great-circle arc
    const interp = d3.geoInterpolate(fromC, toC);
    const points = Array.from({ length: 50 }, (_, i) => projRef.current(interp(i / 49)));
    const validPoints = points.filter((p) => p !== null);
    if (validPoints.length < 2) return "";
    return "M" + validPoints.map((p) => p.map((v) => v.toFixed(1)).join(",")).join("L");
  }, [mapReady]);

  // Handle dot hover
  const handleSvgMouseMove = useCallback((e) => {
    if (!projRef.current || tab !== "world") return;
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    // Scale mouse position to SVG coordinates
    const scaleX = W / rect.width;
    const scaleY = H / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;

    let closest = null;
    let minDist = 20; // threshold in SVG units
    for (const { country, count, isMe } of worldDots) {
      const coords = COUNTRY_COORDS[country];
      if (!coords) continue;
      const pt = projRef.current(coords);
      if (!pt) continue;
      const dist = Math.sqrt((pt[0] - mx) ** 2 + (pt[1] - my) ** 2);
      if (dist < minDist) { minDist = dist; closest = { country, count, isMe, x: pt[0], y: pt[1] }; }
    }
    setTooltip(closest);
  }, [worldDots, tab, mapReady]);

  return (
    <div style={{
      display: "flex", flexDirection: "column",
      height: "100%", width: "100%",
      background: "#0d1f1a",
      overflow: "hidden",
      position: "relative",
    }}>
      {/* ── FULL-WIDTH MAP (fills most of the screen) ── */}
      <div style={{ position: "relative", flex: 1, overflow: "hidden", minHeight: 0 }}>

        {/* Loading state */}
        {!mapReady && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: "10px" }}>
            <div style={{ width: "32px", height: "32px", border: "3px solid #1D9E75", borderTopColor: "transparent", borderRadius: "50%", animation: "seenSpin 0.8s linear infinite" }} />
            <p style={{ color: "#5DCAA5", fontSize: "13px", margin: 0 }}>Loading map…</p>
          </div>
        )}

        {mapReady && (
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            width="100%" height="100%"
            preserveAspectRatio="xMidYMid slice"
            style={{ display: "block", cursor: "crosshair" }}
            onMouseMove={handleSvgMouseMove}
            onMouseLeave={() => setTooltip(null)}
          >
            <rect x="0" y="0" width={W} height={H} fill="#1a3a4a" />

            {d3Ref.current && projRef.current && (() => {
              const graticule = d3Ref.current.geoGraticule()();
              const pathGen = d3Ref.current.geoPath().projection(projRef.current);
              return <path d={pathGen(graticule)} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />;
            })()}

            {d3Ref.current && projRef.current && (() => {
              const sphere = { type: "Sphere" };
              const pathGen = d3Ref.current.geoPath().projection(projRef.current);
              return <path d={pathGen(sphere)} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />;
            })()}

            {/* Country fills — darker palette to contrast dots */}
            {geoPath && countries.map((feature) => (
              <path key={feature.id} d={geoPath(feature)} fill="#2d5a3d" stroke="#1a3a2a" strokeWidth="0.4" />
            ))}

            {/* Greeting arcs */}
            {tab === "world" && arcs.map((arc) => {
              const d = makeArcPath(arc.fromC, arc.toC);
              if (!d) return null;
              return (
                <path key={arc.id} d={d} fill="none"
                  stroke="#4DFFB0" strokeWidth="1.5" strokeLinecap="round"
                  opacity="0"
                  style={{ animation: "seenArc 3s ease-in-out forwards" }} />
              );
            })}

            {/* Mine arcs */}
            {tab === "mine" && myCoords && myConnectionCountries.map((country) => {
              const coords = COUNTRY_COORDS[country];
              if (!coords) return null;
              const d = makeArcPath(coords, myCoords);
              if (!d) return null;
              return <path key={country} d={d} fill="none" stroke="#5DCAA5" strokeWidth="1" strokeDasharray="5 4" opacity="0.6" />;
            })}

            {/* World dots */}
            {tab === "world" && worldDots.map(({ country, count, isMe }) => {
              const coords = COUNTRY_COORDS[country];
              if (!coords) return null;
              const pt = projRef.current(coords);
              if (!pt) return null;
              const [cx, cy] = pt;
              const r = isMe ? 9 : Math.min(4 + count * 0.8, 7);
              return (
                <g key={country}>
                  {isMe && <circle cx={cx} cy={cy} r={r + 12} fill="none" stroke="#4DFFB0" strokeWidth="1" opacity="0.2" style={{ animation: "seenRing 2s ease-out infinite" }} />}
                  <circle cx={cx} cy={cy} r={r + 4} fill={isMe ? "#4DFFB0" : "#5DCAA5"} opacity="0.15" style={{ animation: "seenGlow 2.2s ease-in-out infinite" }} />
                  <circle cx={cx} cy={cy} r={r} fill={isMe ? "#4DFFB0" : "#1D9E75"} stroke={isMe ? "#0d1f1a" : "rgba(255,255,255,0.3)"} strokeWidth={isMe ? 2 : 1} />
                  {isMe && <text x={cx} y={cy + r + 13} textAnchor="middle" fontSize="9" fill="#4DFFB0" fontWeight="700" letterSpacing="0.5">YOU</text>}
                </g>
              );
            })}

            {/* Mine dots */}
            {tab === "mine" && myCoords && (() => {
              const pt = projRef.current(myCoords);
              if (!pt) return null;
              const [mx, my] = pt;
              return (
                <g>
                  {myConnectionCountries.map((country) => {
                    const coords = COUNTRY_COORDS[country];
                    if (!coords) return null;
                    const cpt = projRef.current(coords);
                    if (!cpt) return null;
                    const [cx, cy] = cpt;
                    return (
                      <g key={country}>
                        <circle cx={cx} cy={cy} r={5} fill="#1D9E75" stroke="rgba(255,255,255,0.4)" strokeWidth="1.2" style={{ animation: "seenGlow 2s ease-in-out infinite" }} />
                      </g>
                    );
                  })}
                  {myConnectionCountries.length === 0 && (
                    <text x={W / 2} y={H / 2 + 20} textAnchor="middle" fontSize="14" fill="rgba(255,255,255,0.4)">
                      Send greetings to connect with the world
                    </text>
                  )}
                  <circle cx={mx} cy={my} r={20} fill="none" stroke="#4DFFB0" strokeWidth="1" opacity="0.2" style={{ animation: "seenRing 2s ease-out infinite" }} />
                  <circle cx={mx} cy={my} r={10} fill="#4DFFB0" opacity="0.2" style={{ animation: "seenGlow 1.6s ease-in-out infinite" }} />
                  <circle cx={mx} cy={my} r={8} fill="#4DFFB0" stroke="#0d1f1a" strokeWidth="2" />
                  <text x={mx} y={my + 21} textAnchor="middle" fontSize="9" fill="#4DFFB0" fontWeight="700" letterSpacing="0.5">YOU</text>
                </g>
              );
            })()}

            {/* Tooltip */}
            {tooltip && (() => {
              const label = `${tooltip.country}  ·  ${tooltip.count} active`;
              const tw = Math.min(label.length * 6.5 + 20, 220);
              const tx = Math.min(Math.max(tooltip.x - tw / 2, 4), W - tw - 4);
              const ty = tooltip.y < 60 ? tooltip.y + 18 : tooltip.y - 32;
              return (
                <g>
                  <rect x={tx} y={ty} width={tw} height={24} rx="5" fill="rgba(0,0,0,0.75)" />
                  <text x={tx + tw / 2} y={ty + 15} textAnchor="middle" fontSize="11" fill="white">{label}</text>
                </g>
              );
            })()}
          </svg>
        )}

        {/* ── FLOATING HEADER (top overlay on map) ── */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0,
          display: "flex", alignItems: "flex-start", justifyContent: "space-between",
          padding: "14px 16px",
          background: "linear-gradient(to bottom, rgba(13,31,26,0.85) 0%, transparent 100%)",
        }}>
          <div>
            <p style={{ fontSize: "15px", fontWeight: 700, margin: 0, color: "white", letterSpacing: "-0.01em" }}>World of Seen</p>
            <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.55)", margin: "2px 0 0" }}>Kindness crossing borders</p>
          </div>
          <button onClick={onClose} style={{
            border: "1px solid rgba(255,255,255,0.2)", borderRadius: "50%", padding: "6px",
            background: "rgba(0,0,0,0.3)", cursor: "pointer", display: "flex", alignItems: "center", backdropFilter: "blur(4px)",
          }}>
            <X size={14} color="rgba(255,255,255,0.8)" />
          </button>
        </div>

        {/* ── FLOATING TABS (bottom overlay on map) ── */}
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "10px 16px 12px",
          background: "linear-gradient(to top, rgba(13,31,26,0.9) 0%, transparent 100%)",
        }}>
          <div style={{ display: "flex", gap: "8px" }}>
            {[["world", "🌍 World"], ["mine", "✨ My connections"]].map(([t, label]) => (
              <button key={t} onClick={() => setTab(t)} style={{
                borderRadius: "20px", padding: "5px 14px", fontSize: "12px", fontWeight: 600, cursor: "pointer",
                border: tab === t ? "1px solid #4DFFB0" : "1px solid rgba(255,255,255,0.2)",
                background: tab === t ? "rgba(77,255,176,0.15)" : "rgba(0,0,0,0.3)",
                color: tab === t ? "#4DFFB0" : "rgba(255,255,255,0.7)",
                backdropFilter: "blur(4px)",
              }}>{label}</button>
            ))}
          </div>
          {/* Live pulse */}
          <span style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "11px", color: "rgba(255,255,255,0.5)" }}>
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#4DFFB0", display: "inline-block", animation: "seenLive 1.5s infinite" }} />
            Live
          </span>
        </div>
      </div>

      {/* CSS */}
      <style>{`
        @keyframes seenArc {
          0%   { stroke-dasharray:3000; stroke-dashoffset:3000; opacity:0; }
          10%  { opacity:.9; }
          70%  { opacity:.6; }
          100% { stroke-dashoffset:0; opacity:0; }
        }
        @keyframes seenGlow { 0%,100%{opacity:.1} 50%{opacity:.3} }
        @keyframes seenRing { 0%{opacity:.3} 100%{opacity:0;transform:scale(1.8);transform-origin:center} }
        @keyframes seenLive { 0%,100%{opacity:.4} 50%{opacity:1} }
        @keyframes seenSpin { to{transform:rotate(360deg)} }
      `}</style>

      {/* ── IMPACT BAR (pinned bottom strip) ── */}
      <div style={{
        flexShrink: 0,
        background: "#0d1f1a",
        borderTop: "1px solid rgba(77,255,176,0.12)",
        padding: "0",
      }}>
        {/* Stats row */}
        <div style={{
          display: "grid",
          gridTemplateColumns: tab === "world" ? "repeat(3,1fr)" : "repeat(3,1fr)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}>
          {tab === "world" ? (
            <>
              <ImpactStat label="Active now" value={activeUsers.length} icon="🟢" />
              <ImpactStat label="Countries" value={[...new Set(activeUsers.map(u => u.country).filter(Boolean))].length} icon="🌍" divider />
              <ImpactStat label="Greetings today" value={totalToday} icon="💬" divider />
            </>
          ) : (
            <>
              <ImpactStat label="Seen from" value={`${myConnectionCountries.length} countries`} icon="🌐" />
              <ImpactStat label="Waves received" value={myWaves.length} icon="👋" divider />
              <ImpactStat label="Furthest reach" value={furthestCountry ? `~${furthestCountry.km.toLocaleString()} km` : "—"} icon="📡" divider />
            </>
          )}
        </div>

        {/* Country badges for "mine" tab */}
        {tab === "mine" && myConnectionCountries.length > 0 && (
          <div style={{ padding: "10px 16px 14px", overflowX: "auto" }}>
            <p style={{ fontSize: "10px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(77,255,176,0.6)", margin: "0 0 8px" }}>
              Countries that saw you
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
              {myConnectionCountries.map((c) => (
                <span key={c} style={{
                  borderRadius: "20px", border: "1px solid rgba(77,255,176,0.25)",
                  background: "rgba(77,255,176,0.08)", padding: "3px 10px",
                  fontSize: "11px", fontWeight: 500, color: "#5DCAA5",
                }}>
                  {c}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Legend strip */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px", padding: "8px 16px 12px", fontSize: "11px", color: "rgba(255,255,255,0.4)", flexWrap: "wrap" }}>
          <span style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#4DFFB0", display: "inline-block" }} />
            You
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#1D9E75", display: "inline-block" }} />
            {tab === "world" ? "Active user" : "Waved at you"}
          </span>
          {tab === "world" && (
            <span style={{ display: "flex", alignItems: "center", gap: "5px" }}>
              <svg width="20" height="8" viewBox="0 0 20 8"><path d="M1,6 Q10,1 19,6" fill="none" stroke="#4DFFB0" strokeWidth="1.5" strokeLinecap="round" /></svg>
              Greeting arc
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function ImpactStat({ label, value, icon, divider }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: "12px 8px",
      borderLeft: divider ? "1px solid rgba(255,255,255,0.06)" : "none",
      textAlign: "center",
    }}>
      <p style={{ fontSize: "18px", fontWeight: 700, margin: 0, color: "white", lineHeight: 1.1 }}>{value}</p>
      <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.4)", margin: "3px 0 0", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</p>
    </div>
  );
}
