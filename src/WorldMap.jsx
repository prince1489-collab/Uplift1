/**
 * WorldMap.jsx
 *
 * A live world map showing where Seen users are connecting from.
 * Two views:
 *   - World: all active users + animated greeting arcs
 *   - Mine:  countries that have specifically waved at / greeted you
 *
 * INTEGRATION in App.jsx:
 *
 *   import WorldMap from "./WorldMap";
 *
 *   // Add a state toggle in your App:
 *   const [showMap, setShowMap] = useState(false);
 *
 *   // Add a "Globe" button in the header next to Share:
 *   import { Globe } from "lucide-react";
 *   <button onClick={() => setShowMap(true)}
 *     className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-600 hover:border-slate-300">
 *     <Globe size={11} /> World
 *   </button>
 *
 *   // Add the overlay (same level as ProfileCard overlay):
 *   {showMap && (
 *     <WorldMap
 *       db={db}
 *       currentUser={currentUser}
 *       profile={profile}
 *       onClose={() => setShowMap(false)}
 *     />
 *   )}
 *
 * No new Firestore collections needed.
 * Reads from: users (country), waves (fromUid/toUid), publicMessages (timestamp)
 * Firestore rules already cover all three collections.
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { X } from "lucide-react";

// ─────────────────────────────────────────────────────────────────
// COUNTRY CENTROIDS
// Approximate [x%, y%] positions on a 0-100 coordinate space
// matching the simplified SVG map below.
// ─────────────────────────────────────────────────────────────────
const COUNTRY_POSITIONS = {
  "Afghanistan":              [67.5, 33],
  "Albania":                  [52, 27],
  "Algeria":                  [46, 38],
  "Angola":                   [48, 62],
  "Argentina":                [26, 75],
  "Armenia":                  [60, 28],
  "Australia":                [82, 68],
  "Austria":                  [50, 24],
  "Azerbaijan":               [61, 28],
  "Bangladesh":               [72, 38],
  "Belarus":                  [53, 21],
  "Belgium":                  [47, 22],
  "Bolivia":                  [26, 65],
  "Bosnia and Herzegovina":   [51, 26],
  "Brazil":                   [28, 65],
  "Bulgaria":                 [53, 27],
  "Cambodia":                 [76, 43],
  "Cameroon":                 [48, 50],
  "Canada":                   [18, 18],
  "Chile":                    [24, 75],
  "China":                    [76, 32],
  "Colombia":                 [23, 55],
  "Croatia":                  [51, 25],
  "Cuba":                     [21, 42],
  "Czech Republic":           [50, 23],
  "Denmark":                  [49, 19],
  "Ecuador":                  [22, 57],
  "Egypt":                    [54, 37],
  "Ethiopia":                 [57, 48],
  "Finland":                  [53, 15],
  "France":                   [46, 24],
  "Germany":                  [49, 22],
  "Ghana":                    [45, 50],
  "Greece":                   [52, 28],
  "Guatemala":                [19, 45],
  "Hungary":                  [51, 24],
  "Iceland":                  [40, 14],
  "India":                    [70, 38],
  "Indonesia":                [79, 55],
  "Iran":                     [63, 33],
  "Iraq":                     [60, 33],
  "Ireland":                  [44, 21],
  "Israel":                   [56, 33],
  "Italy":                    [50, 27],
  "Jamaica":                  [21, 45],
  "Japan":                    [84, 30],
  "Jordan":                   [57, 34],
  "Kazakhstan":               [65, 24],
  "Kenya":                    [57, 54],
  "Kuwait":                   [61, 35],
  "Kyrgyzstan":               [68, 27],
  "Laos":                     [76, 41],
  "Latvia":                   [53, 19],
  "Lebanon":                  [56, 33],
  "Libya":                    [50, 37],
  "Lithuania":                [53, 20],
  "Luxembourg":               [48, 23],
  "Madagascar":               [59, 65],
  "Malaysia":                 [78, 50],
  "Mali":                     [44, 43],
  "Mexico":                   [17, 40],
  "Moldova":                  [54, 25],
  "Mongolia":                 [75, 24],
  "Morocco":                  [43, 35],
  "Mozambique":               [56, 63],
  "Myanmar":                  [74, 38],
  "Nepal":                    [71, 35],
  "Netherlands":              [48, 21],
  "New Zealand":              [89, 76],
  "Nigeria":                  [47, 50],
  "North Korea":              [82, 28],
  "Norway":                   [49, 16],
  "Oman":                     [64, 40],
  "Pakistan":                 [67, 35],
  "Panama":                   [22, 50],
  "Paraguay":                 [27, 69],
  "Peru":                     [23, 62],
  "Philippines":              [81, 43],
  "Poland":                   [51, 22],
  "Portugal":                 [43, 27],
  "Qatar":                    [62, 37],
  "Romania":                  [53, 25],
  "Russia":                   [65, 18],
  "Rwanda":                   [55, 56],
  "Saudi Arabia":             [60, 38],
  "Senegal":                  [40, 45],
  "Serbia":                   [52, 26],
  "Singapore":                [78, 52],
  "Slovakia":                 [51, 23],
  "Somalia":                  [59, 50],
  "South Africa":             [51, 72],
  "South Korea":              [82, 30],
  "Spain":                    [44, 27],
  "Sri Lanka":                [71, 46],
  "Sudan":                    [55, 44],
  "Sweden":                   [51, 16],
  "Switzerland":              [48, 24],
  "Syria":                    [57, 31],
  "Taiwan":                   [82, 36],
  "Tajikistan":               [67, 29],
  "Tanzania":                 [56, 58],
  "Thailand":                 [76, 43],
  "Tunisia":                  [48, 33],
  "Turkey":                   [56, 29],
  "Turkmenistan":             [65, 29],
  "Uganda":                   [55, 54],
  "Ukraine":                  [55, 23],
  "United Arab Emirates":     [63, 38],
  "United Kingdom":           [46, 21],
  "United States":            [15, 30],
  "Uruguay":                  [28, 73],
  "Uzbekistan":               [66, 28],
  "Venezuela":                [24, 52],
  "Vietnam":                  [78, 41],
  "Yemen":                    [61, 43],
  "Zambia":                   [53, 62],
  "Zimbabwe":                 [54, 65],
};

// Distance between two country positions (for "furthest connection" stat)
function distanceBetween(pos1, pos2) {
  const dx = pos1[0] - pos2[0];
  const dy = pos1[1] - pos2[1];
  return Math.sqrt(dx * dx + dy * dy);
}

// Haversine-approximate km from percentage positions
// (rough but good enough for a stat display)
function approxKm(pos1, pos2) {
  return Math.round(distanceBetween(pos1, pos2) * 111);
}

// ─────────────────────────────────────────────────────────────────
// SVG MAP PATH
// Simplified world continents as a single path string.
// ─────────────────────────────────────────────────────────────────
const MAP_PATHS = [
  // North America
  "M 4 14 L 22 10 L 30 12 L 32 18 L 28 26 L 24 30 L 20 28 L 14 26 L 8 22 Z",
  // Central America / Caribbean
  "M 18 30 L 24 28 L 26 32 L 22 36 L 18 34 Z",
  // South America
  "M 20 46 L 32 42 L 36 48 L 34 64 L 28 78 L 22 76 L 18 64 L 18 54 Z",
  // Europe
  "M 42 10 L 58 8 L 62 14 L 60 22 L 54 24 L 44 22 L 40 16 Z",
  // Africa
  "M 40 30 L 62 28 L 68 36 L 66 56 L 58 72 L 48 74 L 38 64 L 36 46 Z",
  // Middle East
  "M 54 26 L 68 24 L 72 30 L 70 40 L 60 44 L 52 40 L 52 30 Z",
  // Central Asia
  "M 58 18 L 80 16 L 84 22 L 80 28 L 68 30 L 58 26 Z",
  // South Asia
  "M 62 28 L 78 26 L 82 32 L 80 44 L 70 48 L 62 42 Z",
  // Southeast Asia
  "M 74 36 L 88 34 L 92 42 L 88 54 L 78 56 L 72 48 Z",
  // East Asia
  "M 78 16 L 94 14 L 96 26 L 90 32 L 80 32 L 76 24 Z",
  // Australia
  "M 78 58 L 96 56 L 98 66 L 94 74 L 82 76 L 76 68 Z",
  // Greenland
  "M 28 4 L 40 4 L 42 10 L 36 12 L 28 10 Z",
];

const ACTIVE_TTL_MS = 10 * 60 * 1000; // 10 minutes

// ─────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────
export default function WorldMap({ db, currentUser, profile, onClose }) {
  const [tab, setTab] = useState("world");
  const [activeUsers, setActiveUsers] = useState([]);   // { uid, country }
  const [arcs, setArcs] = useState([]);                  // animated greeting arcs
  const [myWaves, setMyWaves] = useState([]);            // waves received by me
  const [myWaveProfiles, setMyWaveProfiles] = useState({}); // uid -> { country, fullName }
  const [totalToday, setTotalToday] = useState(0);
  const arcTimerRef = useRef(null);
  const arcIdRef = useRef(0);

  const myCountry = profile?.country ?? null;
  const myPos = myCountry ? COUNTRY_POSITIONS[myCountry] : null;

  // ── Active users (presence collection) ───────────────────────
  useEffect(() => {
    if (!db) return;
    const cutoff = Date.now() - ACTIVE_TTL_MS;
    const q = query(
      collection(db, "presence"),
      where("lastSeen", ">=", cutoff),
      limit(50)
    );
    const unsub = onSnapshot(q, async (snap) => {
      const presenceDocs = snap.docs.map((d) => ({ uid: d.id, ...d.data() }));

      // Fetch countries for each uid
      const withCountries = await Promise.all(
        presenceDocs.map(async (p) => {
          try {
            const userDoc = await getDoc(doc(db, "users", p.uid));
            return { uid: p.uid, country: userDoc.exists() ? userDoc.data().country : null };
          } catch {
            return { uid: p.uid, country: null };
          }
        })
      );
      setActiveUsers(withCountries.filter((u) => u.country && COUNTRY_POSITIONS[u.country]));
    }, () => {});
    return unsub;
  }, [db]);

  // ── Total greetings today ─────────────────────────────────────
  useEffect(() => {
    if (!db) return;
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);
    const q = query(
      collection(db, "publicMessages"),
      where("timestamp", ">=", midnight.getTime()),
      limit(500)
    );
    const unsub = onSnapshot(q, (snap) => setTotalToday(snap.size), () => {});
    return unsub;
  }, [db]);

  // ── Waves received (my connections tab) ──────────────────────
  useEffect(() => {
    if (!db || !currentUser) return;
    const q = query(
      collection(db, "waves"),
      where("toUid", "==", currentUser.uid),
      limit(100)
    );
    const unsub = onSnapshot(q, async (snap) => {
      const waves = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setMyWaves(waves);

      // Fetch sender profiles
      const uniqueUids = [...new Set(waves.map((w) => w.fromUid).filter(Boolean))];
      const profiles = {};
      await Promise.all(
        uniqueUids.map(async (uid) => {
          try {
            const d = await getDoc(doc(db, "users", uid));
            if (d.exists()) profiles[uid] = d.data();
          } catch {}
        })
      );
      setMyWaveProfiles(profiles);
    }, () => {});
    return unsub;
  }, [db, currentUser]);

  // ── Animated greeting arcs ────────────────────────────────────
  // Every few seconds, pick two random active countries and draw an arc
  useEffect(() => {
    if (activeUsers.length < 2) return;

    const addArc = () => {
      const filtered = activeUsers.filter((u) => u.uid !== currentUser?.uid);
      if (filtered.length < 1) return;

      const from = filtered[Math.floor(Math.random() * filtered.length)];
      const to = myPos
        ? { uid: "me", country: myCountry }
        : filtered[Math.floor(Math.random() * filtered.length)];

      if (!from.country || !to.country || from.country === to.country) return;

      const fromPos = COUNTRY_POSITIONS[from.country];
      const toPos = COUNTRY_POSITIONS[to.country];
      if (!fromPos || !toPos) return;

      const id = ++arcIdRef.current;
      setArcs((prev) => [...prev.slice(-4), { id, fromPos, toPos, from: from.country, to: to.country }]);

      // Remove arc after animation completes
      setTimeout(() => {
        setArcs((prev) => prev.filter((a) => a.id !== id));
      }, 2800);
    };

    addArc();
    arcTimerRef.current = setInterval(addArc, 2500);
    return () => clearInterval(arcTimerRef.current);
  }, [activeUsers, myPos, myCountry, currentUser]);

  // ── Derived stats ─────────────────────────────────────────────
  const activeCountries = useMemo(() => {
    return [...new Set(activeUsers.map((u) => u.country).filter(Boolean))];
  }, [activeUsers]);

  const myConnectionCountries = useMemo(() => {
    return [...new Set(
      myWaves
        .map((w) => myWaveProfiles[w.fromUid]?.country)
        .filter((c) => c && COUNTRY_POSITIONS[c])
    )];
  }, [myWaves, myWaveProfiles]);

  const furthestCountry = useMemo(() => {
    if (!myPos || myConnectionCountries.length === 0) return null;
    let max = 0;
    let best = null;
    for (const country of myConnectionCountries) {
      const pos = COUNTRY_POSITIONS[country];
      if (!pos) continue;
      const d = approxKm(myPos, pos);
      if (d > max) { max = d; best = { country, km: d }; }
    }
    return best;
  }, [myPos, myConnectionCountries]);

  // ── SVG coordinate helpers ────────────────────────────────────
  // Map 0-100 percentage positions to SVG viewBox 0-640 x 0-320
  const toSvg = ([px, py]) => [px * 6.4, py * 3.2];

  // Quadratic bezier control point (arc midpoint lifted above)
  function arcPath(from, to) {
    const [x1, y1] = toSvg(from);
    const [x2, y2] = toSvg(to);
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2 - Math.abs(x2 - x1) * 0.25 - 20;
    return `M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`;
  }

  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-white/98 backdrop-blur-sm">

      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <div>
          <h2 className="text-sm font-bold text-slate-800">World of Seen</h2>
          <p className="text-[11px] text-slate-500">Kindness crossing borders</p>
        </div>
        <button onClick={onClose} className="rounded-full border border-slate-200 p-1.5 hover:bg-slate-100 transition-colors">
          <X size={14} className="text-slate-500" />
        </button>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-2 px-4 pt-3">
        {["world", "mine"].map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
              tab === t
                ? "border-teal-400 bg-teal-50 text-teal-700"
                : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
            }`}>
            {t === "world" ? "🌍 World" : "✨ My connections"}
          </button>
        ))}
        <span className="ml-auto flex items-center gap-1 text-[11px] text-slate-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Live
        </span>
      </div>

      {/* Map */}
      <div className="mx-4 mt-3 overflow-hidden rounded-2xl border border-slate-100" style={{ background: "#dbeef7" }}>
        <svg width="100%" viewBox="0 0 640 320" style={{ display: "block" }}>

          {/* Continent fills */}
          {MAP_PATHS.map((d, i) => (
            <path key={i} d={d} transform="scale(6.4,3.2)"
              fill="#c8ddc4" stroke="#a8c4a0" strokeWidth="0.08" />
          ))}

          {/* Animated greeting arcs */}
          {arcs.map((arc) => {
            const d = arcPath(arc.fromPos, arc.toPos);
            return (
              <path key={arc.id} d={d} fill="none"
                stroke="#1D9E75" strokeWidth="1.5" strokeLinecap="round"
                opacity="0"
                style={{
                  animation: "seenArc 2.8s ease-in-out forwards",
                }} />
            );
          })}

          {/* World view: active user dots */}
          {tab === "world" && activeUsers.map((user) => {
            const pos = COUNTRY_POSITIONS[user.country];
            if (!pos) return null;
            const [cx, cy] = toSvg(pos);
            const isMe = user.uid === currentUser?.uid;
            return (
              <g key={user.uid}>
                {isMe && <circle cx={cx} cy={cy} r="10" fill="none" stroke="#1D9E75" strokeWidth="0.8" opacity="0.3"
                  style={{ animation: "seenPulseRing 2s ease-out infinite" }} />}
                <circle cx={cx} cy={cy} r={isMe ? 5 : 3.5}
                  fill={isMe ? "#1D9E75" : "#5DCAA5"}
                  opacity={isMe ? 1 : 0.8}
                  style={{ animation: `seenPulse ${isMe ? "1.8" : "2.4"}s ease-in-out infinite` }} />
              </g>
            );
          })}

          {/* Mine view: wave sender dots + my dot */}
          {tab === "mine" && (
            <>
              {myConnectionCountries.map((country) => {
                const pos = COUNTRY_POSITIONS[country];
                if (!pos) return null;
                const [cx, cy] = toSvg(pos);
                const d = arcPath(pos, myPos ?? [50, 50]);
                return (
                  <g key={country}>
                    <path d={d} fill="none" stroke="#0F6E56" strokeWidth="1" strokeDasharray="4 3" opacity="0.4" />
                    <circle cx={cx} cy={cy} r="4" fill="#5DCAA5" opacity="0.9"
                      style={{ animation: "seenPulse 2s ease-in-out infinite" }} />
                  </g>
                );
              })}

              {/* My dot */}
              {myPos && (() => {
                const [cx, cy] = toSvg(myPos);
                return (
                  <g>
                    <circle cx={cx} cy={cy} r="10" fill="none" stroke="#1D9E75" strokeWidth="0.8" opacity="0.3"
                      style={{ animation: "seenPulseRing 2s ease-out infinite" }} />
                    <circle cx={cx} cy={cy} r="5" fill="#1D9E75"
                      style={{ animation: "seenPulse 1.8s ease-in-out infinite" }} />
                    <text x={cx} y={cy + 14} textAnchor="middle" fontSize="7" fill="#085041" fontWeight="500">You</text>
                  </g>
                );
              })()}

              {myConnectionCountries.length === 0 && (
                <text x="320" y="165" textAnchor="middle" fontSize="11" fill="#5F5E5A">
                  Send greetings to start connecting
                </text>
              )}
            </>
          )}
        </svg>
      </div>

      {/* CSS keyframes injected inline */}
      <style>{`
        @keyframes seenPulse {
          0%,100% { opacity:.7; }
          50% { opacity:1; }
        }
        @keyframes seenPulseRing {
          0% { r:6; opacity:.4; }
          100% { r:14; opacity:0; }
        }
        @keyframes seenArc {
          0%   { stroke-dashoffset: 600; stroke-dasharray: 600; opacity: 0; }
          15%  { opacity: .8; }
          75%  { opacity: .6; }
          100% { stroke-dashoffset: 0; stroke-dasharray: 600; opacity: 0; }
        }
      `}</style>

      {/* Stats */}
      <div className="mx-4 mt-3 grid grid-cols-3 gap-2">
        {tab === "world" ? (
          <>
            <StatCard label="Active now" value={activeUsers.length} />
            <StatCard label="Countries" value={activeCountries.length} />
            <StatCard label="Today" value={totalToday} suffix="greetings" />
          </>
        ) : (
          <>
            <StatCard label="Seen from" value={myConnectionCountries.length} suffix="countries" />
            <StatCard label="Waves received" value={myWaves.length} />
            <StatCard
              label="Furthest"
              value={furthestCountry ? furthestCountry.country.split(" ")[0] : "—"}
              suffix={furthestCountry ? `~${furthestCountry.km.toLocaleString()} km` : ""}
            />
          </>
        )}
      </div>

      {/* Country list (mine tab) */}
      {tab === "mine" && myConnectionCountries.length > 0 && (
        <div className="mx-4 mt-3 flex-1 overflow-y-auto">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">People who saw you</p>
          <div className="flex flex-wrap gap-1.5">
            {myConnectionCountries.map((country) => (
              <span key={country}
                className="rounded-full border border-teal-200 bg-teal-50 px-2.5 py-1 text-[11px] font-semibold text-teal-700">
                {country}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Bottom padding */}
      <div className="h-4" />
    </div>
  );
}

function StatCard({ label, value, suffix }) {
  return (
    <div style={{ background: "var(--color-background-secondary)", borderRadius: "var(--border-radius-md)", padding: "10px 12px", textAlign: "center" }}>
      <p style={{ fontSize: "11px", color: "var(--color-text-secondary)", margin: "0 0 2px" }}>{label}</p>
      <p style={{ fontSize: "20px", fontWeight: 500, margin: 0, color: "var(--color-text-primary)", lineHeight: 1.1 }}>{value}</p>
      {suffix && <p style={{ fontSize: "9px", color: "var(--color-text-tertiary)", margin: "2px 0 0" }}>{suffix}</p>}
    </div>
  );
}
