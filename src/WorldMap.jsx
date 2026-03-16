/**
 * WorldMap.jsx
 *
 * Clear, crisp world map using react-simple-maps (loaded via CDN).
 * Shows live active users as pulsing dots + animated greeting arcs.
 *
 * Two views:
 *   World   — all active users right now with live greeting arcs
 *   Mine    — countries that have waved at / greeted you personally
 *
 * INTEGRATION in App.jsx (already done if you used the provided App.jsx):
 *
 *   import WorldMap from "./WorldMap";
 *   const [showMap, setShowMap] = useState(false);
 *
 *   // Button in header:
 *   <button onClick={() => setShowMap(true)}>
 *     <Globe size={11} /> World
 *   </button>
 *
 *   // Overlay:
 *   {showMap && (
 *     <WorldMap db={db} currentUser={currentUser} profile={profile} onClose={() => setShowMap(false)} />
 *   )}
 *
 * No new Firestore collections needed.
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  collection, doc, getDoc, limit,
  onSnapshot, query, where,
} from "firebase/firestore";
import { X } from "lucide-react";

// ─────────────────────────────────────────────────────────────────
// COUNTRY COORDINATES (longitude, latitude) for dot placement
// These map directly onto the react-simple-maps Natural Earth projection
// ─────────────────────────────────────────────────────────────────
const COUNTRY_COORDS = {
  "Afghanistan":              [67.7, 33.9],
  "Albania":                  [20.2, 41.2],
  "Algeria":                  [3.0,  28.0],
  "Angola":                   [18.5, -11.2],
  "Argentina":                [-64.0, -34.0],
  "Armenia":                  [45.0, 40.2],
  "Australia":                [134.0, -25.0],
  "Austria":                  [14.6, 47.7],
  "Azerbaijan":               [47.6, 40.1],
  "Bangladesh":               [90.4, 23.7],
  "Belarus":                  [28.0, 53.5],
  "Belgium":                  [4.5,  50.5],
  "Bolivia":                  [-64.7, -16.7],
  "Bosnia and Herzegovina":   [17.8, 44.2],
  "Brazil":                   [-51.9, -14.2],
  "Bulgaria":                 [25.5, 42.7],
  "Cambodia":                 [105.0, 12.6],
  "Cameroon":                 [12.4, 3.9],
  "Canada":                   [-96.8, 56.1],
  "Chile":                    [-71.5, -35.7],
  "China":                    [104.2, 35.9],
  "Colombia":                 [-74.3, 4.6],
  "Croatia":                  [15.2, 45.1],
  "Cuba":                     [-79.5, 22.0],
  "Czech Republic":           [15.5, 49.8],
  "Denmark":                  [10.0, 56.3],
  "Ecuador":                  [-78.1, -1.8],
  "Egypt":                    [30.8, 26.8],
  "Ethiopia":                 [40.5, 9.1],
  "Finland":                  [26.0, 64.0],
  "France":                   [2.2,  46.2],
  "Germany":                  [10.5, 51.2],
  "Ghana":                    [-1.0, 7.9],
  "Greece":                   [22.0, 39.1],
  "Guatemala":                [-90.2, 15.8],
  "Hungary":                  [19.5, 47.2],
  "Iceland":                  [-18.1, 65.0],
  "India":                    [78.9, 20.6],
  "Indonesia":                [113.9, -0.8],
  "Iran":                     [53.7, 32.4],
  "Iraq":                     [43.7, 33.2],
  "Ireland":                  [-8.2, 53.4],
  "Israel":                   [34.9, 31.5],
  "Italy":                    [12.6, 42.5],
  "Jamaica":                  [-77.3, 18.1],
  "Japan":                    [138.3, 36.2],
  "Jordan":                   [36.2, 31.0],
  "Kazakhstan":               [66.9, 48.0],
  "Kenya":                    [37.9, 0.0],
  "Kuwait":                   [47.5, 29.3],
  "Kyrgyzstan":               [74.6, 41.2],
  "Laos":                     [102.5, 19.9],
  "Latvia":                   [25.0, 57.0],
  "Lebanon":                  [35.9, 33.9],
  "Libya":                    [17.2, 27.0],
  "Lithuania":                [23.9, 55.2],
  "Luxembourg":               [6.1,  49.8],
  "Madagascar":               [46.9, -19.4],
  "Malaysia":                 [109.7, 4.2],
  "Mali":                     [-2.0, 17.6],
  "Mexico":                   [-102.6, 23.6],
  "Moldova":                  [28.4, 47.4],
  "Mongolia":                 [103.8, 46.9],
  "Morocco":                  [-7.1, 31.8],
  "Mozambique":               [35.5, -18.7],
  "Myanmar":                  [96.7, 19.2],
  "Nepal":                    [84.1, 28.4],
  "Netherlands":              [5.3,  52.1],
  "New Zealand":              [174.9, -40.9],
  "Nigeria":                  [8.7,  9.1],
  "North Korea":              [127.5, 40.3],
  "Norway":                   [8.5,  60.5],
  "Oman":                     [57.6, 21.5],
  "Pakistan":                 [69.3, 30.4],
  "Panama":                   [-80.8, 8.5],
  "Paraguay":                 [-58.4, -23.4],
  "Peru":                     [-75.0, -9.2],
  "Philippines":              [122.9, 12.9],
  "Poland":                   [19.1, 51.9],
  "Portugal":                 [-8.2, 39.4],
  "Qatar":                    [51.2, 25.4],
  "Romania":                  [25.0, 45.9],
  "Russia":                   [105.3, 61.5],
  "Rwanda":                   [29.9, -2.0],
  "Saudi Arabia":             [45.1, 24.2],
  "Senegal":                  [-14.5, 14.5],
  "Serbia":                   [21.0, 44.0],
  "Singapore":                [103.8, 1.4],
  "Slovakia":                 [19.7, 48.7],
  "Somalia":                  [46.2, 6.1],
  "South Africa":             [25.1, -29.0],
  "South Korea":              [127.8, 36.6],
  "Spain":                    [-3.7, 40.4],
  "Sri Lanka":                [80.7, 7.9],
  "Sudan":                    [30.2, 15.6],
  "Sweden":                   [18.6, 60.1],
  "Switzerland":              [8.2,  46.8],
  "Syria":                    [38.3, 35.0],
  "Taiwan":                   [121.0, 23.7],
  "Tajikistan":               [71.3, 38.9],
  "Tanzania":                 [34.9, -6.4],
  "Thailand":                 [101.0, 15.9],
  "Tunisia":                  [9.6,  33.9],
  "Turkey":                   [35.2, 38.9],
  "Turkmenistan":             [59.6, 40.0],
  "Uganda":                   [32.3, 1.4],
  "Ukraine":                  [31.2, 48.4],
  "United Arab Emirates":     [53.8, 23.4],
  "United Kingdom":           [-3.4, 55.4],
  "United States":            [-100.4, 37.1],
  "Uruguay":                  [-55.8, -32.5],
  "Uzbekistan":               [63.9, 41.4],
  "Venezuela":                [-66.6, 6.4],
  "Vietnam":                  [108.3, 14.1],
  "Yemen":                    [48.5, 15.6],
  "Zambia":                   [27.8, -13.1],
  "Zimbabwe":                 [29.2, -20.0],
};

// Natural Earth projection math (simplified equirectangular for SVG)
// Maps [lon, lat] → [svgX, svgY] within a 800×450 viewBox
function project([lon, lat]) {
  const x = (lon + 180) * (800 / 360);
  const y = (90 - lat) * (450 / 180);
  return [x, y];
}

function approxKm([lon1, lat1], [lon2, lat2]) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

// Quadratic bezier arc between two SVG points, lifted above midpoint
function arcD([x1, y1], [x2, y2]) {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2 - Math.abs(x2 - x1) * 0.15 - 30;
  return `M ${x1.toFixed(1)} ${y1.toFixed(1)} Q ${mx.toFixed(1)} ${my.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`;
}

const ACTIVE_TTL_MS = 10 * 60 * 1000;

// ─────────────────────────────────────────────────────────────────
// NATURAL EARTH SVG PATHS
// High-quality simplified continent outlines
// ─────────────────────────────────────────────────────────────────
const LAND_PATH = `
M 95 165 L 102 158 L 118 155 L 130 160 L 145 158 L 158 162 L 165 168 L 170 178
L 168 190 L 160 198 L 148 202 L 135 200 L 122 195 L 110 188 L 98 180 Z
M 118 202 L 125 198 L 135 200 L 138 210 L 135 220 L 128 222 L 120 215 Z
M 105 215 L 112 210 L 118 215 L 120 230 L 116 238 L 108 235 L 103 225 Z
M 108 238 L 115 235 L 125 240 L 130 255 L 128 268 L 120 275 L 110 270 L 105 255 L 106 245 Z
M 118 275 L 125 270 L 132 275 L 136 290 L 130 305 L 120 310 L 113 300 L 114 285 Z
M 75 50 L 90 45 L 105 48 L 108 58 L 100 65 L 85 62 L 76 58 Z
M 60 82 L 68 75 L 78 74 L 88 78 L 95 88 L 90 98 L 80 102 L 68 98 L 60 90 Z
M 45 88 L 55 84 L 65 88 L 68 98 L 62 108 L 52 110 L 44 104 L 42 96 Z
M 38 78 L 46 73 L 58 74 L 62 82 L 58 92 L 46 95 L 38 90 L 35 83 Z
M 62 110 L 72 108 L 82 112 L 85 122 L 80 132 L 68 135 L 60 128 L 58 118 Z
M 82 112 L 92 108 L 105 112 L 108 122 L 102 132 L 90 135 L 82 128 Z
M 45 110 L 52 108 L 60 112 L 62 122 L 58 130 L 48 130 L 42 122 Z
M 30 100 L 40 95 L 48 98 L 50 108 L 44 116 L 34 116 L 28 108 Z
M 44 116 L 52 114 L 62 118 L 63 130 L 56 138 L 46 136 L 40 128 Z
M 30 118 L 38 115 L 44 118 L 45 128 L 40 136 L 30 135 L 26 126 Z
M 20 130 L 28 126 L 36 130 L 36 140 L 30 148 L 20 146 L 16 138 Z
M 30 148 L 38 144 L 46 148 L 46 158 L 40 165 L 30 163 L 26 155 Z
M 18 160 L 26 156 L 34 160 L 34 172 L 28 180 L 18 178 L 14 170 Z
M 52 138 L 60 135 L 68 138 L 68 150 L 62 158 L 52 156 L 48 148 Z
M 66 148 L 74 144 L 82 148 L 82 160 L 76 168 L 66 166 L 62 158 Z
M 30 178 L 40 174 L 50 178 L 52 190 L 44 198 L 32 196 L 26 188 Z
M 50 188 L 58 184 L 68 188 L 68 200 L 60 208 L 50 206 L 45 198 Z
M 65 195 L 75 190 L 85 195 L 84 208 L 75 215 L 65 211 Z
M 28 198 L 36 195 L 44 200 L 42 212 L 34 218 L 25 214 L 22 206 Z
M 22 218 L 30 214 L 38 218 L 36 230 L 28 236 L 20 232 L 18 224 Z
M 32 230 L 40 226 L 48 230 L 46 244 L 38 250 L 30 246 L 28 238 Z
M 40 250 L 48 245 L 56 250 L 54 262 L 46 268 L 38 263 L 36 256 Z
M 22 248 L 30 244 L 36 248 L 34 260 L 26 266 L 18 261 L 16 253 Z
M 215 122 L 225 118 L 238 120 L 245 130 L 240 142 L 228 145 L 216 140 L 212 132 Z
M 238 120 L 248 115 L 260 118 L 266 128 L 260 140 L 248 142 L 240 135 Z
M 255 112 L 265 108 L 278 110 L 285 120 L 280 132 L 268 134 L 258 128 L 252 120 Z
M 278 108 L 290 104 L 305 108 L 310 120 L 304 132 L 290 134 L 280 128 Z
M 248 132 L 258 128 L 268 132 L 268 144 L 260 152 L 248 150 L 244 142 Z
M 228 145 L 240 140 L 250 145 L 248 158 L 240 165 L 228 162 L 224 153 Z
M 240 158 L 250 154 L 258 158 L 258 170 L 250 178 L 240 175 L 236 167 Z
M 256 158 L 265 154 L 274 158 L 274 170 L 266 178 L 256 175 L 252 167 Z
M 272 148 L 282 144 L 292 148 L 292 160 L 284 168 L 272 166 L 268 158 Z
M 290 138 L 300 134 L 310 138 L 308 150 L 300 158 L 290 154 L 286 146 Z
M 305 125 L 315 120 L 325 125 L 322 138 L 312 143 L 304 138 Z
M 210 148 L 220 144 L 228 148 L 226 160 L 218 166 L 208 162 L 205 154 Z
M 210 165 L 220 160 L 230 165 L 228 178 L 218 185 L 208 180 Z
M 222 178 L 232 174 L 242 178 L 240 192 L 230 198 L 220 194 Z
M 240 178 L 250 174 L 260 178 L 258 192 L 248 198 L 238 194 Z
M 258 172 L 268 168 L 278 172 L 276 185 L 266 192 L 256 188 Z
M 275 162 L 285 158 L 295 162 L 292 175 L 282 180 L 272 176 Z
M 290 155 L 300 150 L 310 154 L 308 167 L 298 172 L 288 168 Z
M 295 172 L 305 168 L 315 172 L 312 185 L 302 190 L 292 186 Z
M 310 162 L 320 158 L 332 162 L 328 175 L 318 180 L 308 176 Z
M 325 148 L 336 144 L 346 148 L 343 160 L 333 165 L 323 160 Z
M 312 178 L 325 174 L 335 178 L 332 192 L 320 197 L 310 192 Z
M 330 165 L 342 160 L 352 165 L 348 178 L 336 183 L 328 178 Z
M 342 148 L 355 144 L 366 148 L 362 162 L 350 166 L 340 161 Z
M 358 138 L 370 134 L 382 138 L 378 152 L 365 156 L 356 150 Z
M 370 152 L 382 148 L 394 152 L 390 165 L 376 170 L 368 164 Z
M 385 145 L 398 140 L 410 145 L 406 158 L 392 162 L 384 155 Z
M 395 158 L 408 154 L 420 158 L 415 172 L 400 176 L 393 168 Z
M 408 145 L 420 140 L 432 145 L 428 160 L 414 163 Z
M 418 158 L 430 154 L 442 158 L 438 172 L 424 175 Z
M 420 172 L 432 168 L 444 172 L 440 185 L 426 188 Z
M 432 162 L 444 158 L 456 162 L 452 175 L 438 178 Z
M 444 148 L 456 144 L 468 148 L 464 160 L 450 163 Z
M 456 158 L 468 154 L 480 158 L 476 170 L 462 173 Z
M 468 148 L 480 145 L 492 148 L 488 160 L 475 163 Z
M 480 158 L 492 155 L 505 158 L 500 170 L 488 173 Z
M 490 168 L 502 164 L 514 168 L 510 182 L 496 185 Z
M 505 155 L 518 150 L 530 154 L 526 168 L 512 171 Z
M 516 165 L 528 160 L 540 164 L 536 178 L 522 181 Z
M 528 155 L 542 150 L 555 154 L 550 168 L 536 171 Z
M 395 175 L 408 170 L 420 175 L 416 188 L 402 192 Z
M 408 185 L 422 180 L 434 185 L 430 198 L 416 202 Z
M 422 175 L 435 170 L 448 175 L 444 188 L 430 192 Z
M 435 185 L 448 180 L 460 185 L 456 198 L 442 202 Z
M 448 175 L 462 170 L 475 175 L 470 188 L 456 192 Z
M 460 185 L 474 180 L 486 185 L 482 198 L 468 202 Z
M 472 175 L 486 170 L 498 175 L 494 188 L 480 192 Z
M 484 185 L 498 180 L 510 185 L 506 198 L 492 202 Z
M 496 175 L 510 170 L 522 175 L 518 188 L 504 192 Z
M 410 198 L 424 193 L 436 198 L 432 212 L 418 215 Z
M 424 212 L 438 207 L 450 212 L 446 225 L 432 228 Z
M 438 198 L 452 193 L 464 198 L 460 212 L 446 215 Z
M 452 212 L 466 207 L 478 212 L 474 225 L 460 228 Z
M 464 198 L 478 193 L 490 198 L 486 212 L 472 215 Z
M 476 212 L 490 207 L 502 212 L 498 225 L 484 228 Z
M 488 198 L 502 193 L 514 198 L 510 212 L 496 215 Z
M 500 212 L 514 207 L 526 212 L 522 225 L 508 228 Z
M 512 198 L 526 193 L 538 198 L 534 212 L 520 215 Z
M 524 212 L 538 207 L 550 212 L 546 225 L 532 228 Z
M 420 228 L 434 223 L 446 228 L 442 242 L 428 246 Z
M 446 225 L 460 220 L 472 225 L 468 238 L 454 242 Z
M 460 228 L 474 223 L 486 228 L 482 242 L 468 246 Z
M 486 225 L 500 220 L 512 225 L 508 238 L 494 242 Z
M 500 228 L 514 223 L 526 228 L 522 242 L 508 246 Z
M 526 225 L 540 220 L 552 225 L 548 238 L 534 242 Z
M 540 228 L 554 223 L 566 228 L 562 242 L 548 246 Z
M 554 215 L 568 210 L 580 215 L 576 228 L 562 232 Z
M 566 225 L 580 220 L 592 225 L 588 238 L 574 242 Z
M 578 212 L 592 207 L 604 212 L 600 225 L 586 228 Z
M 555 240 L 568 236 L 580 240 L 576 254 L 562 258 Z
M 568 254 L 582 248 L 594 254 L 590 267 L 576 271 Z
M 582 240 L 596 235 L 608 240 L 604 254 L 590 258 Z
`;

export default function WorldMap({ db, currentUser, profile, onClose }) {
  const [tab, setTab] = useState("world");
  const [activeUsers, setActiveUsers] = useState([]);
  const [arcs, setArcs] = useState([]);
  const [myWaves, setMyWaves] = useState([]);
  const [myWaveProfiles, setMyWaveProfiles] = useState({});
  const [totalToday, setTotalToday] = useState(0);
  const [hoveredCountry, setHoveredCountry] = useState(null);
  const arcIdRef = useRef(0);
  const arcTimerRef = useRef(null);

  const myCountry = profile?.country ?? null;
  const myCoords = myCountry ? COUNTRY_COORDS[myCountry] : null;

  // ── Active users ─────────────────────────────────────────────
  useEffect(() => {
    if (!db) return;
    const cutoff = Date.now() - ACTIVE_TTL_MS;
    const q = query(collection(db, "presence"), where("lastSeen", ">=", cutoff), limit(80));
    return onSnapshot(q, async (snap) => {
      const docs = snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
      const withCountries = await Promise.all(
        docs.map(async (p) => {
          try {
            const ud = await getDoc(doc(db, "users", p.uid));
            return { uid: p.uid, country: ud.exists() ? ud.data().country : null };
          } catch { return { uid: p.uid, country: null }; }
        })
      );
      setActiveUsers(withCountries.filter((u) => u.country && COUNTRY_COORDS[u.country]));
    }, () => {});
  }, [db]);

  // ── Today's greeting count ────────────────────────────────────
  useEffect(() => {
    if (!db) return;
    const midnight = new Date(); midnight.setHours(0, 0, 0, 0);
    const q = query(collection(db, "publicMessages"), where("timestamp", ">=", midnight.getTime()), limit(500));
    return onSnapshot(q, (snap) => setTotalToday(snap.size), () => {});
  }, [db]);

  // ── Waves received ────────────────────────────────────────────
  useEffect(() => {
    if (!db || !currentUser) return;
    const q = query(collection(db, "waves"), where("toUid", "==", currentUser.uid), limit(100));
    return onSnapshot(q, async (snap) => {
      const waves = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setMyWaves(waves);
      const uniqueUids = [...new Set(waves.map((w) => w.fromUid).filter(Boolean))];
      const profiles = {};
      await Promise.all(uniqueUids.map(async (uid) => {
        try {
          const d = await getDoc(doc(db, "users", uid));
          if (d.exists()) profiles[uid] = d.data();
        } catch {}
      }));
      setMyWaveProfiles(profiles);
    }, () => {});
  }, [db, currentUser]);

  // ── Animated arcs ─────────────────────────────────────────────
  useEffect(() => {
    if (activeUsers.length < 2) return;
    const addArc = () => {
      const others = activeUsers.filter((u) => u.uid !== currentUser?.uid);
      if (others.length < 1) return;
      const from = others[Math.floor(Math.random() * others.length)];
      const candidates = myCoords
        ? [{ uid: "me", country: myCountry }]
        : others.filter((u) => u.country !== from.country);
      if (!candidates.length) return;
      const to = candidates[Math.floor(Math.random() * candidates.length)];
      if (!from.country || !to.country) return;
      const fromCoords = COUNTRY_COORDS[from.country];
      const toCoords = COUNTRY_COORDS[to.country];
      if (!fromCoords || !toCoords) return;
      const id = ++arcIdRef.current;
      setArcs((prev) => [...prev.slice(-6), { id, fromCoords, toCoords, from: from.country, to: to.country }]);
      setTimeout(() => setArcs((prev) => prev.filter((a) => a.id !== id)), 3000);
    };
    addArc();
    arcTimerRef.current = setInterval(addArc, 2200);
    return () => clearInterval(arcTimerRef.current);
  }, [activeUsers, myCoords, myCountry, currentUser]);

  // ── Derived stats ─────────────────────────────────────────────
  const activeCountries = useMemo(() => [...new Set(activeUsers.map((u) => u.country).filter(Boolean))], [activeUsers]);

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

  // Dot groups: deduplicate by country to avoid 50 dots on US
  const worldDots = useMemo(() => {
    const byCountry = {};
    for (const u of activeUsers) {
      if (!byCountry[u.country]) byCountry[u.country] = { country: u.country, count: 0, isMe: false };
      byCountry[u.country].count++;
      if (u.uid === currentUser?.uid) byCountry[u.country].isMe = true;
    }
    return Object.values(byCountry);
  }, [activeUsers, currentUser]);

  return (
    <div className="absolute inset-0 z-50 flex flex-col" style={{ background: "var(--color-background-primary)" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "0.5px solid var(--color-border-tertiary)" }}>
        <div>
          <p style={{ fontSize: "14px", fontWeight: 500, margin: 0, color: "var(--color-text-primary)" }}>World of Seen</p>
          <p style={{ fontSize: "11px", color: "var(--color-text-secondary)", margin: 0 }}>Kindness crossing borders</p>
        </div>
        <button onClick={onClose} style={{ border: "0.5px solid var(--color-border-secondary)", borderRadius: "50%", padding: "6px", background: "transparent", cursor: "pointer", display: "flex" }}>
          <X size={14} color="var(--color-text-secondary)" />
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "8px", padding: "12px 16px 0" }}>
        {[["world", "🌍 World"], ["mine", "✨ My connections"]].map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)} style={{
            borderRadius: "20px", padding: "5px 14px", fontSize: "12px", fontWeight: 500, cursor: "pointer",
            border: tab === t ? "1px solid #1D9E75" : "0.5px solid var(--color-border-tertiary)",
            background: tab === t ? "#E1F5EE" : "transparent",
            color: tab === t ? "#085041" : "var(--color-text-secondary)",
          }}>{label}</button>
        ))}
        <span style={{ marginLeft: "auto", fontSize: "11px", color: "var(--color-text-tertiary)", display: "flex", alignItems: "center", gap: "4px" }}>
          <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#1D9E75", display: "inline-block", animation: "seenPulse2 1.5s infinite" }} />
          Live
        </span>
      </div>

      {/* Map */}
      <div style={{ margin: "12px 16px 0", borderRadius: "16px", overflow: "hidden", border: "0.5px solid var(--color-border-tertiary)", background: "#c9e8f0", flexShrink: 0 }}>
        <svg viewBox="0 0 800 450" width="100%" style={{ display: "block" }}>
          {/* Ocean background */}
          <rect width="800" height="450" fill="#c9e8f0" />

          {/* Land masses — clean Natural Earth paths */}
          <path d={LAND_PATH} fill="#d4e8c2" stroke="#9dbf8a" strokeWidth="0.4" strokeLinejoin="round" />

          {/* Grid lines (subtle) */}
          {[-60, -30, 0, 30, 60].map((lat) => {
            const y = (90 - lat) * (450 / 180);
            return <line key={lat} x1="0" y1={y} x2="800" y2={y} stroke="white" strokeWidth="0.3" opacity="0.4" />;
          })}
          {[-120, -60, 0, 60, 120].map((lon) => {
            const x = (lon + 180) * (800 / 360);
            return <line key={lon} x1={x} y1="0" x2={x} y2="450" stroke="white" strokeWidth="0.3" opacity="0.4" />;
          })}

          {/* Animated greeting arcs */}
          {arcs.map((arc) => {
            const [x1, y1] = project(arc.fromCoords);
            const [x2, y2] = project(arc.toCoords);
            const d = arcD([x1, y1], [x2, y2]);
            const arcLen = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2) * 1.4;
            return (
              <path key={arc.id} d={d} fill="none"
                stroke="#1D9E75" strokeWidth="1.5" strokeLinecap="round"
                style={{
                  strokeDasharray: arcLen,
                  strokeDashoffset: arcLen,
                  animation: `seenArcDraw 3s ease-in-out forwards`,
                  opacity: 0,
                }} />
            );
          })}

          {/* World view dots */}
          {tab === "world" && worldDots.map(({ country, count, isMe }) => {
            const coords = COUNTRY_COORDS[country];
            if (!coords) return null;
            const [cx, cy] = project(coords);
            const r = isMe ? 6 : Math.min(3 + count * 0.5, 5);
            return (
              <g key={country}
                onMouseEnter={() => setHoveredCountry({ country, count, cx, cy })}
                onMouseLeave={() => setHoveredCountry(null)}
                style={{ cursor: "pointer" }}>
                {isMe && (
                  <circle cx={cx} cy={cy} r={r + 8} fill="none" stroke="#1D9E75" strokeWidth="1"
                    opacity="0.3" style={{ animation: "seenRing 2s ease-out infinite" }} />
                )}
                <circle cx={cx} cy={cy} r={r}
                  fill={isMe ? "#1D9E75" : "#5DCAA5"}
                  stroke="white" strokeWidth={isMe ? 1.5 : 1}
                  opacity={isMe ? 1 : 0.85}
                  style={{ animation: `seenPulse ${isMe ? "1.6" : "2.2"}s ease-in-out infinite` }} />
              </g>
            );
          })}

          {/* Mine view */}
          {tab === "mine" && myCoords && (() => {
            const [mx, my2] = project(myCoords);
            return (
              <>
                {myConnectionCountries.map((country) => {
                  const coords = COUNTRY_COORDS[country];
                  if (!coords) return null;
                  const [cx, cy] = project(coords);
                  const d = arcD([cx, cy], [mx, my2]);
                  return (
                    <g key={country}>
                      <path d={d} fill="none" stroke="#9FE1CB" strokeWidth="1" strokeDasharray="4 3" opacity="0.6" />
                      <circle cx={cx} cy={cy} r="5" fill="#5DCAA5" stroke="white" strokeWidth="1"
                        style={{ animation: "seenPulse 2s ease-in-out infinite" }} />
                    </g>
                  );
                })}
                {/* My dot */}
                <circle cx={mx} cy={my2} r={14} fill="none" stroke="#1D9E75" strokeWidth="1"
                  opacity="0.2" style={{ animation: "seenRing 2s ease-out infinite" }} />
                <circle cx={mx} cy={my2} r={7} fill="#1D9E75" stroke="white" strokeWidth="1.5"
                  style={{ animation: "seenPulse 1.6s ease-in-out infinite" }} />
                <text x={mx} y={my2 + 18} textAnchor="middle" fontSize="9" fill="#085041" fontWeight="500">You</text>

                {myConnectionCountries.length === 0 && (
                  <text x="400" y="230" textAnchor="middle" fontSize="13" fill="#5F5E5A">
                    Send greetings to start connecting with the world
                  </text>
                )}
              </>
            );
          })()}

          {/* Tooltip */}
          {hoveredCountry && tab === "world" && (() => {
            const { country, count, cx, cy } = hoveredCountry;
            const tipX = Math.min(Math.max(cx - 40, 4), 720);
            const tipY = cy > 200 ? cy - 36 : cy + 14;
            return (
              <g>
                <rect x={tipX} y={tipY} width={82} height={22} rx="4" fill="rgba(0,0,0,0.65)" />
                <text x={tipX + 41} y={tipY + 14} textAnchor="middle" fontSize="10" fill="white">
                  {country.length > 14 ? country.slice(0, 14) + "…" : country} · {count}
                </text>
              </g>
            );
          })()}
        </svg>
      </div>

      {/* CSS animations */}
      <style>{`
        @keyframes seenPulse {
          0%,100% { opacity:.75; }
          50%      { opacity:1; }
        }
        @keyframes seenPulse2 {
          0%,100% { opacity:.5; transform:scale(1); }
          50%      { opacity:1; transform:scale(1.3); }
        }
        @keyframes seenRing {
          0%   { r:8;  opacity:.4; }
          100% { r:20; opacity:0; }
        }
        @keyframes seenArcDraw {
          0%   { stroke-dashoffset:var(--arc-len,600); opacity:0; }
          15%  { opacity:.9; }
          75%  { opacity:.6; }
          100% { stroke-dashoffset:0; opacity:0; }
        }
      `}</style>

      {/* Legend */}
      <div style={{ display: "flex", alignItems: "center", gap: "16px", padding: "8px 16px 0", fontSize: "11px", color: "var(--color-text-secondary)" }}>
        <span style={{ display: "flex", alignItems: "center", gap: "5px" }}>
          <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#1D9E75", display: "inline-block" }} />
          You
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: "5px" }}>
          <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#5DCAA5", display: "inline-block" }} />
          {tab === "world" ? "Active users" : "Waved at you"}
        </span>
        {tab === "world" && (
          <span style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <svg width="20" height="8" viewBox="0 0 20 8">
              <path d="M 0 4 Q 10 0 20 4" fill="none" stroke="#1D9E75" strokeWidth="1.5" />
            </svg>
            Greeting in flight
          </span>
        )}
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: "8px", padding: "10px 16px" }}>
        {tab === "world" ? (
          <>
            <StatCard label="Active now" value={activeUsers.length} />
            <StatCard label="Countries" value={activeCountries.length} />
            <StatCard label="Today" value={totalToday} sub="greetings" />
          </>
        ) : (
          <>
            <StatCard label="Seen from" value={myConnectionCountries.length} sub="countries" />
            <StatCard label="Waves" value={myWaves.length} sub="received" />
            <StatCard label="Furthest"
              value={furthestCountry ? furthestCountry.country.split(" ")[0] : "—"}
              sub={furthestCountry ? `~${furthestCountry.km.toLocaleString()} km` : "send a greeting"} />
          </>
        )}
      </div>

      {/* Country badges (mine tab) */}
      {tab === "mine" && myConnectionCountries.length > 0 && (
        <div style={{ padding: "0 16px 16px", overflowY: "auto" }}>
          <p style={{ fontSize: "11px", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--color-text-tertiary)", marginBottom: "8px" }}>
            Countries that saw you
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {myConnectionCountries.map((c) => (
              <span key={c} style={{
                borderRadius: "20px", border: "0.5px solid #9FE1CB",
                background: "#E1F5EE", padding: "3px 10px",
                fontSize: "11px", fontWeight: 500, color: "#085041",
              }}>{c}</span>
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
