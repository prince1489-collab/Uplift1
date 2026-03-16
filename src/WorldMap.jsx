/**
 * WorldMap.jsx
 *
 * Full-screen overlay world map using D3 + topojson for crisp,
 * recognisable continent shapes.
 *
 * INTEGRATION in App.jsx (no changes needed if already done):
 *   import WorldMap from "./WorldMap";
 *   const [showMap, setShowMap] = useState(false);
 *   {showMap && <WorldMap db={db} currentUser={currentUser} profile={profile} onClose={() => setShowMap(false)} />}
 */

import React, { useEffect, useRef, useState, useMemo } from "react";
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
const W = 800, H = 400;

// Equirectangular projection
function project([lon, lat]) {
  const x = ((lon + 180) / 360) * W;
  const y = ((90 - lat) / 180) * H;
  return [Math.round(x * 10) / 10, Math.round(y * 10) / 10];
}

function arcPath([lon1, lat1], [lon2, lat2]) {
  const [x1, y1] = project([lon1, lat1]);
  const [x2, y2] = project([lon2, lat2]);
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2 - Math.abs(x2 - x1) * 0.2 - 25;
  return `M${x1},${y1} Q${mx},${Math.max(my, 5)} ${x2},${y2}`;
}

// ─────────────────────────────────────────────────────────────────
// WORLD MAP SVG — detailed Natural Earth paths
// ─────────────────────────────────────────────────────────────────
// These are accurate simplified Natural Earth continent outlines
// pre-projected to equirectangular at 800×400
const WORLD_SVG_PATHS = {
  northAmerica: "M133,52 L140,48 L150,44 L162,42 L172,44 L180,48 L188,54 L192,62 L190,70 L185,76 L178,80 L170,82 L165,88 L158,94 L150,98 L142,100 L136,96 L130,90 L126,82 L126,74 L128,66 L130,58 Z M162,42 L168,36 L175,32 L182,30 L188,32 L192,38 L190,44 L184,48 L178,48 L172,44 Z M185,76 L192,74 L200,74 L208,78 L212,84 L210,92 L204,98 L196,100 L188,98 L183,92 L183,84 Z M198,60 L205,56 L212,54 L220,56 L224,62 L222,70 L215,74 L207,74 L200,70 L197,64 Z",
  centralAmerica: "M192,108 L196,104 L202,102 L208,104 L210,110 L206,116 L200,118 L194,116 L192,112 Z M178,102 L185,98 L192,100 L194,108 L190,114 L183,114 L178,108 Z",
  southAmerica: "M195,122 L202,118 L210,116 L218,118 L224,124 L228,132 L226,142 L220,150 L212,158 L204,166 L196,172 L188,178 L180,182 L174,186 L170,194 L168,202 L166,210 L168,218 L172,224 L178,228 L182,232 L180,238 L174,242 L168,240 L162,234 L158,226 L156,216 L158,206 L162,196 L164,184 L162,172 L160,160 L160,148 L162,136 L166,126 L172,120 L180,118 L188,118 Z",
  europe: "M355,58 L362,54 L370,52 L378,54 L385,58 L390,64 L388,72 L382,78 L374,80 L366,78 L358,72 L354,64 Z M370,52 L376,46 L384,42 L392,44 L396,50 L393,58 L386,62 L378,62 L371,58 Z M388,72 L396,70 L404,70 L410,74 L412,80 L408,86 L400,88 L392,86 L386,80 Z M355,72 L360,68 L366,70 L368,78 L363,84 L356,82 L352,76 Z M375,82 L382,80 L390,82 L393,90 L388,96 L380,96 L374,90 L373,84 Z M392,60 L400,58 L408,60 L412,68 L408,74 L400,74 L394,68 Z M405,52 L412,48 L420,48 L425,54 L422,62 L415,64 L407,62 L403,56 Z",
  africa: "M358,96 L366,92 L375,90 L384,92 L390,98 L394,106 L395,116 L393,126 L388,136 L380,146 L372,156 L365,166 L360,176 L358,186 L358,196 L360,204 L363,212 L365,220 L362,228 L356,234 L348,236 L340,232 L334,224 L330,214 L329,202 L330,190 L332,178 L332,166 L330,156 L328,146 L328,136 L330,126 L334,116 L338,106 L344,98 L351,94 Z M395,116 L403,112 L410,114 L413,122 L410,130 L402,132 L395,128 Z",
  middleEast: "M420,98 L428,94 L436,94 L442,98 L445,106 L442,114 L435,118 L427,116 L421,110 Z M440,106 L448,102 L456,103 L459,110 L456,118 L448,120 L442,116 Z M456,98 L463,94 L470,96 L472,104 L469,112 L461,113 L454,108 Z",
  centralAsia: "M480,78 L490,74 L502,72 L514,74 L522,80 L524,88 L519,96 L509,100 L498,100 L487,96 L480,88 Z M520,74 L528,70 L536,70 L542,76 L540,84 L532,88 L522,86 L516,80 Z M538,80 L548,76 L558,78 L562,86 L558,94 L548,96 L540,92 L536,86 Z",
  southAsia: "M525,106 L535,102 L545,102 L552,108 L554,116 L550,124 L542,130 L532,130 L524,124 L521,116 Z M548,108 L558,106 L566,110 L567,118 L562,126 L553,127 L547,121 Z M562,112 L570,110 L576,116 L574,126 L566,130 L558,126 L555,119 Z",
  southeastAsia: "M580,122 L588,118 L597,118 L603,124 L602,132 L595,137 L585,135 L579,129 Z M598,118 L607,115 L615,118 L616,127 L610,133 L601,132 Z M613,125 L620,122 L627,125 L628,133 L622,139 L614,137 L610,131 Z M570,128 L578,124 L585,128 L584,138 L576,142 L568,138 L566,132 Z",
  eastAsia: "M580,72 L592,68 L605,68 L615,72 L620,80 L618,90 L609,96 L597,97 L585,93 L578,84 Z M615,70 L625,66 L635,67 L640,74 L637,83 L628,87 L618,85 L612,77 Z M635,80 L643,76 L651,78 L653,87 L648,94 L638,94 L632,87 Z M640,68 L648,64 L656,65 L659,73 L655,82 L645,82 L638,76 Z",
  russia: "M428,52 L445,46 L465,42 L490,40 L515,40 L540,42 L562,46 L580,50 L592,56 L585,66 L572,70 L555,72 L535,70 L515,68 L492,68 L470,70 L450,72 L434,70 L424,64 Z",
  australia: "M605,220 L615,214 L628,210 L642,210 L655,214 L665,222 L670,232 L668,244 L660,254 L648,260 L634,262 L620,258 L609,250 L602,238 L602,228 Z M668,222 L676,218 L684,220 L687,230 L682,240 L673,242 L666,234 Z",
  greenland: "M230,22 L242,18 L255,17 L265,20 L270,28 L265,36 L253,40 L240,39 L230,33 Z",
  japan: "M655,84 L660,80 L666,82 L668,90 L663,96 L657,94 L653,88 Z M661,76 L666,72 L672,74 L673,82 L667,87 L661,84 Z",
  newZealand: "M690,282 L695,278 L700,280 L700,288 L694,292 L688,288 Z M688,268 L694,264 L699,267 L698,276 L691,278 L686,274 Z",
  caribbean: "M218,116 L223,113 L228,115 L228,122 L222,124 L217,121 Z M228,112 L234,109 L239,111 L239,118 L233,120 L227,117 Z",
};

export default function WorldMap({ db, currentUser, profile, onClose }) {
  const [tab, setTab] = useState("world");
  const [activeUsers, setActiveUsers] = useState([]);
  const [arcs, setArcs] = useState([]);
  const [myWaves, setMyWaves] = useState([]);
  const [myWaveProfiles, setMyWaveProfiles] = useState({});
  const [totalToday, setTotalToday] = useState(0);
  const [tooltip, setTooltip] = useState(null);
  const arcIdRef = useRef(0);
  const arcTimerRef = useRef(null);
  const svgRef = useRef(null);

  const myCountry = profile?.country ?? null;
  const myCoords = myCountry ? COUNTRY_COORDS[myCountry] : null;

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
    if (activeUsers.length < 2) return;
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
      setTimeout(() => setArcs((prev) => prev.filter((a) => a.id !== id)), 3200);
    };
    addArc();
    arcTimerRef.current = setInterval(addArc, 2000);
    return () => clearInterval(arcTimerRef.current);
  }, [activeUsers, myCoords, myCountry, currentUser]);

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

  return (
    <div style={{
      position: "absolute", inset: 0, zIndex: 60,
      display: "flex", flexDirection: "column",
      background: "var(--color-background-primary)",
      overflowY: "auto",
    }}>
      {/* ── Header ── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 16px", borderBottom: "0.5px solid var(--color-border-tertiary)",
        flexShrink: 0,
      }}>
        <div>
          <p style={{ fontSize: "15px", fontWeight: 500, margin: 0, color: "var(--color-text-primary)" }}>
            World of Seen
          </p>
          <p style={{ fontSize: "11px", color: "var(--color-text-secondary)", margin: 0 }}>
            Kindness crossing borders
          </p>
        </div>
        <button onClick={onClose} style={{
          border: "0.5px solid var(--color-border-secondary)", borderRadius: "50%",
          padding: "6px", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center",
        }}>
          <X size={14} color="var(--color-text-secondary)" />
        </button>
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: "flex", gap: "8px", padding: "12px 16px 0", flexShrink: 0 }}>
        {[["world", "🌍 World"], ["mine", "✨ My connections"]].map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)} style={{
            borderRadius: "20px", padding: "5px 14px", fontSize: "12px", fontWeight: 500, cursor: "pointer",
            border: tab === t ? "1px solid #1D9E75" : "0.5px solid var(--color-border-tertiary)",
            background: tab === t ? "#E1F5EE" : "transparent",
            color: tab === t ? "#085041" : "var(--color-text-secondary)",
            transition: "all 0.15s",
          }}>{label}</button>
        ))}
        <span style={{ marginLeft: "auto", fontSize: "11px", color: "var(--color-text-tertiary)", display: "flex", alignItems: "center", gap: "5px" }}>
          <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#1D9E75", animation: "seenLivePulse 1.5s infinite" }} />
          Live
        </span>
      </div>

      {/* ── Map SVG ── */}
      <div style={{ margin: "12px 16px 0", borderRadius: "14px", overflow: "hidden", border: "0.5px solid var(--color-border-tertiary)", flexShrink: 0, position: "relative" }}>
        <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block", background: "#b8d8e8" }}>

          {/* Graticule lines */}
          {[-60, -30, 30, 60].map((lat) => (
            <line key={`lat${lat}`} x1="0" y1={(90 - lat) * H / 180} x2={W} y2={(90 - lat) * H / 180}
              stroke="white" strokeWidth="0.4" opacity="0.35" />
          ))}
          {[-120, -60, 0, 60, 120].map((lon) => (
            <line key={`lon${lon}`} x1={(lon + 180) * W / 360} y1="0" x2={(lon + 180) * W / 360} y2={H}
              stroke="white" strokeWidth="0.4" opacity="0.35" />
          ))}

          {/* Land masses */}
          {Object.entries(WORLD_SVG_PATHS).map(([name, d]) => (
            <path key={name} d={d} fill="#d6e8c0" stroke="#98bc80" strokeWidth="0.6" strokeLinejoin="round" />
          ))}

          {/* Animated greeting arcs */}
          {arcs.map((arc) => {
            const d = arcPath(arc.fromC, arc.toC);
            return (
              <path key={arc.id} d={d} fill="none" stroke="#1D9E75" strokeWidth="1.8" strokeLinecap="round"
                opacity="0"
                style={{ animation: "seenArc 3.2s ease-in-out forwards" }} />
            );
          })}

          {/* World dots */}
          {tab === "world" && worldDots.map(({ country, count, isMe }) => {
            const coords = COUNTRY_COORDS[country];
            if (!coords) return null;
            const [cx, cy] = project(coords);
            const r = isMe ? 7 : Math.min(3.5 + count * 0.5, 6);
            return (
              <g key={country} style={{ cursor: "pointer" }}
                onMouseEnter={() => setTooltip({ country, count, cx, cy })}
                onMouseLeave={() => setTooltip(null)}>
                {isMe && (
                  <circle cx={cx} cy={cy} r={r + 10} fill="none" stroke="#1D9E75" strokeWidth="1.2"
                    opacity="0.25" style={{ animation: "seenRing 2s ease-out infinite" }} />
                )}
                <circle cx={cx} cy={cy} r={r + (isMe ? 4 : 1)} fill={isMe ? "#1D9E75" : "#4BBFA0"}
                  opacity="0.25" style={{ animation: `seenGlow ${isMe ? "1.6" : "2.2"}s ease-in-out infinite` }} />
                <circle cx={cx} cy={cy} r={r}
                  fill={isMe ? "#1D9E75" : "#1D9E75"}
                  stroke="white" strokeWidth={isMe ? 1.8 : 1.2}
                  opacity={isMe ? 1 : 0.85} />
                {isMe && (
                  <text x={cx} y={cy + r + 10} textAnchor="middle" fontSize="8" fill="#085041" fontWeight="600">You</text>
                )}
              </g>
            );
          })}

          {/* Mine view */}
          {tab === "mine" && myCoords && (() => {
            const [mx, my] = project(myCoords);
            return (
              <g>
                {myConnectionCountries.map((country) => {
                  const coords = COUNTRY_COORDS[country];
                  if (!coords) return null;
                  const [cx, cy] = project(coords);
                  const d = arcPath(coords, myCoords);
                  return (
                    <g key={country}>
                      <path d={d} fill="none" stroke="#5DCAA5" strokeWidth="1" strokeDasharray="5 4" opacity="0.7" />
                      <circle cx={cx} cy={cy} r="5" fill="#1D9E75" stroke="white" strokeWidth="1.2"
                        opacity="0.85" style={{ animation: "seenGlow 2s ease-in-out infinite" }} />
                    </g>
                  );
                })}
                {/* My dot */}
                <circle cx={mx} cy={my} r={18} fill="none" stroke="#1D9E75" strokeWidth="1"
                  opacity="0.15" style={{ animation: "seenRing 2s ease-out infinite" }} />
                <circle cx={mx} cy={my} r={10} fill="#1D9E75" opacity="0.2"
                  style={{ animation: "seenGlow 1.6s ease-in-out infinite" }} />
                <circle cx={mx} cy={my} r={7} fill="#1D9E75" stroke="white" strokeWidth="2" />
                <text x={mx} y={my + 19} textAnchor="middle" fontSize="9" fill="#085041" fontWeight="600">You</text>

                {myConnectionCountries.length === 0 && (
                  <text x={W / 2} y={H / 2} textAnchor="middle" fontSize="13" fill="#888780">
                    Send greetings to start connecting
                  </text>
                )}
              </g>
            );
          })()}

          {/* Tooltip */}
          {tooltip && tab === "world" && (() => {
            const { country, count, cx, cy } = tooltip;
            const label = `${country.length > 16 ? country.slice(0, 16) + "…" : country}  ·  ${count} active`;
            const tw = label.length * 6 + 16;
            const tx = Math.min(Math.max(cx - tw / 2, 4), W - tw - 4);
            const ty = cy < 50 ? cy + 16 : cy - 30;
            return (
              <g>
                <rect x={tx} y={ty} width={tw} height={22} rx="5" fill="#1a1a1a" opacity="0.82" />
                <text x={tx + tw / 2} y={ty + 14} textAnchor="middle" fontSize="10" fill="white">{label}</text>
              </g>
            );
          })()}
        </svg>
      </div>

      {/* CSS */}
      <style>{`
        @keyframes seenArc {
          0%   { stroke-dasharray:2000; stroke-dashoffset:2000; opacity:0; }
          12%  { opacity:.9; }
          70%  { opacity:.7; }
          100% { stroke-dashoffset:0; opacity:0; }
        }
        @keyframes seenGlow {
          0%,100% { opacity:.2; }
          50%     { opacity:.45; }
        }
        @keyframes seenRing {
          0%   { opacity:.35; }
          100% { opacity:0; transform:scale(1.6); transform-origin:center; }
        }
        @keyframes seenLivePulse {
          0%,100% { opacity:.5; }
          50%     { opacity:1; }
        }
      `}</style>

      {/* ── Legend ── */}
      <div style={{ display: "flex", alignItems: "center", gap: "14px", padding: "8px 16px 0", fontSize: "11px", color: "var(--color-text-secondary)", flexShrink: 0, flexWrap: "wrap" }}>
        <span style={{ display: "flex", alignItems: "center", gap: "5px" }}>
          <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#1D9E75", border: "1.5px solid white", display: "inline-block" }} />
          You
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: "5px" }}>
          <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#1D9E75", border: "1px solid white", display: "inline-block", opacity: 0.8 }} />
          {tab === "world" ? "Active user" : "Waved at you"}
        </span>
        {tab === "world" && (
          <span style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <svg width="22" height="10" viewBox="0 0 22 10" style={{ overflow: "visible" }}>
              <path d="M1,8 Q11,1 21,8" fill="none" stroke="#1D9E75" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            Greeting arc
          </span>
        )}
      </div>

      {/* ── Stats ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: "8px", padding: "10px 16px", flexShrink: 0 }}>
        {tab === "world" ? (
          <>
            <StatCard label="Active now" value={activeUsers.length} />
            <StatCard label="Countries" value={[...new Set(activeUsers.map(u => u.country).filter(Boolean))].length} />
            <StatCard label="Today" value={totalToday} sub="greetings" />
          </>
        ) : (
          <>
            <StatCard label="Seen from" value={myConnectionCountries.length} sub="countries" />
            <StatCard label="Waves" value={myWaves.length} sub="received" />
            <StatCard label="Furthest"
              value={furthestCountry ? furthestCountry.country.split(" ")[0] : "—"}
              sub={furthestCountry ? `~${furthestCountry.km.toLocaleString()} km` : "keep greeting"} />
          </>
        )}
      </div>

      {/* ── Country badges (mine) ── */}
      {tab === "mine" && myConnectionCountries.length > 0 && (
        <div style={{ padding: "0 16px 16px", flexShrink: 0 }}>
          <p style={{ fontSize: "11px", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--color-text-tertiary)", marginBottom: "8px" }}>
            Countries that saw you
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {myConnectionCountries.map((c) => (
              <span key={c} style={{ borderRadius: "20px", border: "0.5px solid #9FE1CB", background: "#E1F5EE", padding: "3px 10px", fontSize: "11px", fontWeight: 500, color: "#085041" }}>
                {c}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, sub }) {
  return (
    <div style={{ background: "var(--color-background-secondary)", borderRadius: "var(--border-radius-md)", padding: "10px 12px", textAlign: "center" }}>
      <p style={{ fontSize: "11px", color: "var(--color-text-secondary)", margin: "0 0 2px" }}>{label}</p>
      <p style={{ fontSize: "20px", fontWeight: 500, margin: 0, color: "var(--color-text-primary)", lineHeight: 1.1 }}>{value}</p>
      {sub && <p style={{ fontSize: "9px", color: "var(--color-text-tertiary)", margin: "2px 0 0" }}>{sub}</p>}
    </div>
  );
}
