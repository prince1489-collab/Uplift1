/**
 * WorldMap.jsx — Revolving 3D Globe
 *
 * INTEGRATION in App.jsx (no changes needed):
 *   import WorldMap from "./WorldMap";
 *   {showMap && <WorldMap db={db} currentUser={currentUser} profile={profile} onClose={() => setShowMap(false)} />}
 */

import React, { useEffect, useRef, useState, useMemo } from "react";
import {
  collection, doc, getDoc, limit,
  onSnapshot, query, where,
} from "firebase/firestore";
import { X } from "lucide-react";

// ── Country centroids [longitude, latitude] ──────────────────────
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
const AUTO_ROTATE_SPEED = 0.12;

export default function WorldMap({ db, currentUser, profile, onClose }) {
  const canvasRef = useRef(null);
  const [tab, setTab] = useState("world");
  const [mapReady, setMapReady] = useState(false);
  const [activeUsers, setActiveUsers] = useState([]);
  const [myWaves, setMyWaves] = useState([]);
  const [myWaveProfiles, setMyWaveProfiles] = useState({});
  const [totalToday, setTotalToday] = useState(0);
  const [tooltip, setTooltip] = useState(null);
  const [isAutoRotating, setIsAutoRotating] = useState(true);

  const d3Ref = useRef(null);
  const projRef = useRef(null);
  const countriesRef = useRef([]);
  const rotationRef = useRef([0, -20, 0]);
  const scaleRef = useRef(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef(null);
  const rotationStartRef = useRef(null);
  const autoRotateRef = useRef(true);
  const animFrameRef = useRef(null);
  const arcsRef = useRef([]);
  const arcIdRef = useRef(0);
  const arcTimerRef = useRef(null);
  const tabRef = useRef("world");
  const lastPinchRef = useRef(null);
  const worldDotsRef = useRef([]);
  const myConnectionCountriesRef = useRef([]);

  const myCountry = profile?.country ?? null;
  const myCoords = myCountry ? COUNTRY_COORDS[myCountry] : null;

  useEffect(() => { tabRef.current = tab; }, [tab]);

  const worldDots = useMemo(() => {
    const map = {};
    for (const u of activeUsers) {
      if (!map[u.country]) map[u.country] = { country: u.country, count: 0, isMe: false };
      map[u.country].count++;
      if (u.uid === currentUser?.uid) map[u.country].isMe = true;
    }
    return Object.values(map);
  }, [activeUsers, currentUser]);

  useEffect(() => { worldDotsRef.current = worldDots; }, [worldDots]);

  const myConnectionCountries = useMemo(() =>
    [...new Set(myWaves.map(w => myWaveProfiles[w.fromUid]?.country).filter(c => c && COUNTRY_COORDS[c]))],
    [myWaves, myWaveProfiles]
  );

  useEffect(() => { myConnectionCountriesRef.current = myConnectionCountries; }, [myConnectionCountries]);

  const furthestCountry = useMemo(() => {
    if (!myCoords || !myConnectionCountries.length) return null;
    let best = null, max = 0;
    for (const c of myConnectionCountries) {
      const coords = COUNTRY_COORDS[c];
      if (!coords) continue;
      const d = approxKm(myCoords, coords);
      if (d > max) { max = d; best = { country: c, km: d }; }
    }
    return best;
  }, [myCoords, myConnectionCountries]);

  // ── Load D3 + TopoJSON ───────────────────────────────────────
  useEffect(() => {
    const load = async () => {
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
      countriesRef.current = window.topojson.feature(world, world.objects.countries).features;
      d3Ref.current = window.d3;
      setMapReady(true);
    };
    load().catch(console.error);
  }, []);

  // ── Canvas draw loop ─────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const d3 = d3Ref.current;

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      const size = Math.min(rect.width - 32, rect.height - 20);
      const dpr = window.devicePixelRatio || 1;
      canvas.width = size * dpr;
      canvas.height = size * dpr;
      canvas.style.width = size + "px";
      canvas.style.height = size + "px";
      ctx.scale(dpr, dpr);
      if (!scaleRef.current) scaleRef.current = size / 2 * 0.9;
    };
    resize();
    window.addEventListener("resize", resize);

    // Check if a lon/lat is on the visible hemisphere
    const isVisible = (lon, lat) => {
      const [rLon, rLat] = rotationRef.current;
      const dLon = ((lon + rLon + 540) % 360) - 180;
      const dLat = lat - rLat;
      return Math.abs(dLon) < 90 && Math.abs(dLat) < 90 &&
        Math.sqrt(dLon * dLon + dLat * dLat) < 90;
    };

    const draw = () => {
      const size = parseFloat(canvas.style.width) || 300;
      const cx = size / 2, cy = size / 2;
      const scale = scaleRef.current || cx * 0.9;

      const proj = d3.geoOrthographic()
        .scale(scale)
        .translate([cx, cy])
        .rotate(rotationRef.current)
        .clipAngle(90);
      projRef.current = proj;
      const path = d3.geoPath().projection(proj).context(ctx);

      ctx.clearRect(0, 0, size, size);

      // Ocean with radial gradient
      const oceanGrad = ctx.createRadialGradient(cx - scale * 0.2, cy - scale * 0.25, scale * 0.1, cx, cy, scale);
      oceanGrad.addColorStop(0, "#1e5070");
      oceanGrad.addColorStop(0.6, "#0f2d45");
      oceanGrad.addColorStop(1, "#081820");
      ctx.beginPath();
      path({ type: "Sphere" });
      ctx.fillStyle = oceanGrad;
      ctx.fill();

      // Graticule
      ctx.beginPath();
      path(d3.geoGraticule()());
      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      ctx.lineWidth = 0.5;
      ctx.stroke();

      // Countries
      for (const feature of countriesRef.current) {
        ctx.beginPath();
        path(feature);
        ctx.fillStyle = "#2d5a3d";
        ctx.fill();
        ctx.strokeStyle = "rgba(0,0,0,0.25)";
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }

      // Atmosphere rim
      ctx.beginPath();
      ctx.arc(cx, cy, scale, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(77,255,176,0.3)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      const atmGrad = ctx.createRadialGradient(cx, cy, scale * 0.88, cx, cy, scale * 1.0);
      atmGrad.addColorStop(0, "rgba(77,255,176,0)");
      atmGrad.addColorStop(1, "rgba(77,255,176,0.08)");
      ctx.fillStyle = atmGrad;
      ctx.fill();

      // Specular highlight
      const specGrad = ctx.createRadialGradient(cx - scale * 0.28, cy - scale * 0.3, 0, cx, cy, scale);
      specGrad.addColorStop(0, "rgba(255,255,255,0.1)");
      specGrad.addColorStop(0.35, "rgba(255,255,255,0.02)");
      specGrad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.beginPath();
      ctx.arc(cx, cy, scale, 0, Math.PI * 2);
      ctx.fillStyle = specGrad;
      ctx.fill();

      // ── Arcs ──
      if (tabRef.current === "world") {
        for (const { fromC, toC } of arcsRef.current) {
          const interp = d3.geoInterpolate(fromC, toC);
          const pts = [];
          for (let i = 0; i <= 60; i++) {
            const p = proj(interp(i / 60));
            if (p) pts.push(p);
          }
          if (pts.length < 2) continue;
          ctx.beginPath();
          ctx.moveTo(pts[0][0], pts[0][1]);
          for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
          ctx.strokeStyle = "rgba(77,255,176,0.7)";
          ctx.lineWidth = 1.5;
          ctx.shadowColor = "#4DFFB0";
          ctx.shadowBlur = 6;
          ctx.stroke();
          ctx.shadowBlur = 0;
        }
      }

      // ── Dots ──
      const dots = tabRef.current === "world"
        ? worldDotsRef.current
        : myConnectionCountriesRef.current.map(c => ({ country: c, count: 1, isMe: false }));

      for (const { country, count, isMe } of dots) {
        const coords = COUNTRY_COORDS[country];
        if (!coords || !isVisible(coords[0], coords[1])) continue;
        const pt = proj(coords);
        if (!pt) continue;

        const r = isMe ? 6 : Math.min(3 + count, 6);
        const color = isMe ? "#4DFFB0" : "#1D9E75";

        // Glow
        const glow = ctx.createRadialGradient(pt[0], pt[1], 0, pt[0], pt[1], r * 3.5);
        glow.addColorStop(0, isMe ? "rgba(77,255,176,0.5)" : "rgba(29,158,117,0.35)");
        glow.addColorStop(1, "rgba(0,0,0,0)");
        ctx.beginPath();
        ctx.arc(pt[0], pt[1], r * 3.5, 0, Math.PI * 2);
        ctx.fillStyle = glow;
        ctx.fill();

        // Dot
        ctx.beginPath();
        ctx.arc(pt[0], pt[1], r, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.shadowBlur = 0;

        // Ring for "me"
        if (isMe) {
          ctx.beginPath();
          ctx.arc(pt[0], pt[1], r + 4, 0, Math.PI * 2);
          ctx.strokeStyle = "rgba(77,255,176,0.45)";
          ctx.lineWidth = 1.5;
          ctx.stroke();

          // YOU label
          ctx.font = "bold 9px system-ui, sans-serif";
          ctx.fillStyle = "rgba(255,255,255,0.9)";
          ctx.textAlign = "center";
          ctx.fillText("YOU", pt[0], pt[1] - r - 7);
        }
      }
    };

    const tick = () => {
      if (autoRotateRef.current && !isDraggingRef.current) {
        rotationRef.current = [rotationRef.current[0] + AUTO_ROTATE_SPEED, rotationRef.current[1], 0];
      }
      draw();
      animFrameRef.current = requestAnimationFrame(tick);
    };
    animFrameRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener("resize", resize);
    };
  }, [mapReady]);

  // ── Input handlers ───────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !canvasRef.current) return;
    const canvas = canvasRef.current;

    const onMouseDown = (e) => {
      e.preventDefault();
      isDraggingRef.current = true;
      autoRotateRef.current = false;
      setIsAutoRotating(false);
      dragStartRef.current = [e.clientX, e.clientY];
      rotationStartRef.current = [...rotationRef.current];
    };

    const onMouseMove = (e) => {
      if (isDraggingRef.current) {
        const scale = scaleRef.current || 150;
        const dx = e.clientX - dragStartRef.current[0];
        const dy = e.clientY - dragStartRef.current[1];
        rotationRef.current = [
          rotationStartRef.current[0] + dx * (80 / scale),
          Math.max(-85, Math.min(85, rotationStartRef.current[1] - dy * (80 / scale))),
          0,
        ];
      } else {
        if (!projRef.current) return;
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const size = parseFloat(canvas.style.width) || 300;
        const cx = size / 2, cy = size / 2;
        const scale = scaleRef.current || cx;
        if ((x - cx) ** 2 + (y - cy) ** 2 > scale ** 2) { setTooltip(null); return; }
        let closest = null, minDist = 16;
        for (const { country, count, isMe } of worldDotsRef.current) {
          const coords = COUNTRY_COORDS[country];
          if (!coords) continue;
          const pt = projRef.current(coords);
          if (!pt) continue;
          const dist = Math.sqrt((pt[0] - x) ** 2 + (pt[1] - y) ** 2);
          if (dist < minDist) { minDist = dist; closest = { country, count, isMe, x, y }; }
        }
        setTooltip(closest);
      }
    };

    const onMouseUp = () => { isDraggingRef.current = false; };
    const onMouseLeave = () => { isDraggingRef.current = false; setTooltip(null); };

    const onTouchStart = (e) => {
      if (e.touches.length === 2) {
        isDraggingRef.current = false;
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        lastPinchRef.current = { dist: Math.sqrt(dx * dx + dy * dy), scale: scaleRef.current };
      } else if (e.touches.length === 1) {
        isDraggingRef.current = true;
        autoRotateRef.current = false;
        setIsAutoRotating(false);
        dragStartRef.current = [e.touches[0].clientX, e.touches[0].clientY];
        rotationStartRef.current = [...rotationRef.current];
      }
    };

    const onTouchMove = (e) => {
      e.preventDefault();
      if (e.touches.length === 2 && lastPinchRef.current) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const size = parseFloat(canvas.style.width) || 300;
        scaleRef.current = Math.max(size * 0.25, Math.min(size * 1.6, lastPinchRef.current.scale * dist / lastPinchRef.current.dist));
      } else if (e.touches.length === 1 && isDraggingRef.current) {
        const scale = scaleRef.current || 150;
        const dx = e.touches[0].clientX - dragStartRef.current[0];
        const dy = e.touches[0].clientY - dragStartRef.current[1];
        rotationRef.current = [
          rotationStartRef.current[0] + dx * (80 / scale),
          Math.max(-85, Math.min(85, rotationStartRef.current[1] - dy * (80 / scale))),
          0,
        ];
      }
    };

    const onTouchEnd = () => { isDraggingRef.current = false; lastPinchRef.current = null; };

    const onWheel = (e) => {
      e.preventDefault();
      const size = parseFloat(canvas.style.width) || 300;
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      scaleRef.current = Math.max(size * 0.25, Math.min(size * 1.6, (scaleRef.current || size * 0.45) * factor));
    };

    canvas.addEventListener("mousedown", onMouseDown);
    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("mouseleave", onMouseLeave);
    canvas.addEventListener("touchstart", onTouchStart, { passive: true });
    canvas.addEventListener("touchmove", onTouchMove, { passive: false });
    canvas.addEventListener("touchend", onTouchEnd);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("mouseup", onMouseUp);

    return () => {
      canvas.removeEventListener("mousedown", onMouseDown);
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("mouseleave", onMouseLeave);
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchmove", onTouchMove);
      canvas.removeEventListener("touchend", onTouchEnd);
      canvas.removeEventListener("wheel", onWheel);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [mapReady]);

  // ── Firestore ────────────────────────────────────────────────
  useEffect(() => {
    if (!db) return;
    const cutoff = Date.now() - ACTIVE_TTL_MS;
    const q = query(collection(db, "presence"), where("lastSeen", ">=", cutoff), limit(80));
    return onSnapshot(q, async (snap) => {
      const docs = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
      const withCountries = await Promise.all(docs.map(async (p) => {
        try {
          const ud = await getDoc(doc(db, "users", p.uid));
          return { uid: p.uid, country: ud.exists() ? ud.data().country : null };
        } catch { return { uid: p.uid, country: null }; }
      }));
      setActiveUsers(withCountries.filter(u => u.country && COUNTRY_COORDS[u.country]));
    }, () => {});
  }, [db]);

  useEffect(() => {
    if (!db) return;
    const midnight = new Date(); midnight.setHours(0, 0, 0, 0);
    const q = query(collection(db, "publicMessages"), where("timestamp", ">=", midnight.getTime()), limit(500));
    return onSnapshot(q, snap => setTotalToday(snap.size), () => {});
  }, [db]);

  useEffect(() => {
    if (!db || !currentUser) return;
    const q = query(collection(db, "waves"), where("toUid", "==", currentUser.uid), limit(100));
    return onSnapshot(q, async (snap) => {
      const waves = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setMyWaves(waves);
      const uids = [...new Set(waves.map(w => w.fromUid).filter(Boolean))];
      const profiles = {};
      await Promise.all(uids.map(async (uid) => {
        try { const d = await getDoc(doc(db, "users", uid)); if (d.exists()) profiles[uid] = d.data(); } catch {}
      }));
      setMyWaveProfiles(profiles);
    }, () => {});
  }, [db, currentUser]);

  // ── Arc animation ────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || activeUsers.length < 2) return;
    const addArc = () => {
      const others = activeUsers.filter(u => u.uid !== currentUser?.uid);
      if (!others.length) return;
      const from = others[Math.floor(Math.random() * others.length)];
      const toCandidates = myCoords
        ? [{ country: myCountry }]
        : others.filter(u => u.country !== from.country);
      if (!toCandidates.length) return;
      const to = toCandidates[Math.floor(Math.random() * toCandidates.length)];
      const fromC = COUNTRY_COORDS[from.country];
      const toC = COUNTRY_COORDS[to.country];
      if (!fromC || !toC) return;
      const id = ++arcIdRef.current;
      arcsRef.current = [...arcsRef.current.slice(-6), { id, fromC, toC }];
      setTimeout(() => { arcsRef.current = arcsRef.current.filter(a => a.id !== id); }, 3000);
    };
    addArc();
    arcTimerRef.current = setInterval(addArc, 2500);
    return () => clearInterval(arcTimerRef.current);
  }, [mapReady, activeUsers, myCoords, myCountry, currentUser]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", width: "100%", background: "#060e10", overflow: "hidden", position: "relative" }}>

      {/* ── GLOBE AREA ── */}
      <div style={{ position: "relative", flex: 1, overflow: "hidden", minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "radial-gradient(ellipse at 40% 40%, #0d2535 0%, #060e10 70%)" }}>

        {/* Loading */}
        {!mapReady && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
            <div style={{ width: "32px", height: "32px", border: "3px solid #1D9E75", borderTopColor: "transparent", borderRadius: "50%", animation: "seenSpin 0.8s linear infinite" }} />
            <p style={{ color: "#5DCAA5", fontSize: "13px", margin: 0 }}>Loading globe…</p>
          </div>
        )}

        <canvas ref={canvasRef} style={{ display: mapReady ? "block" : "none", cursor: "grab", borderRadius: "50%", boxShadow: "0 0 80px rgba(77,255,176,0.07), 0 8px 60px rgba(0,0,0,0.9)" }} />

        {/* Tooltip */}
        {tooltip && (
          <div style={{
            position: "absolute", left: tooltip.x + 14, top: tooltip.y - 14,
            background: "rgba(6,14,16,0.92)", border: "1px solid rgba(77,255,176,0.35)",
            borderRadius: "8px", padding: "5px 11px", fontSize: "12px", color: "white",
            pointerEvents: "none", backdropFilter: "blur(6px)", whiteSpace: "nowrap",
            boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
          }}>
            {tooltip.country} · <span style={{ color: "#4DFFB0" }}>{tooltip.count} active</span>
          </div>
        )}

        {/* ── FLOATING HEADER ── */}
        <div onMouseDown={e => e.stopPropagation()} onTouchStart={e => e.stopPropagation()}
          style={{ position: "absolute", top: 0, left: 0, right: 0, display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "14px 16px", background: "linear-gradient(to bottom, rgba(6,14,16,0.92) 0%, transparent 100%)" }}>
          <div>
            <p style={{ fontSize: "15px", fontWeight: 700, margin: 0, color: "white", letterSpacing: "-0.01em" }}>World of Seen</p>
            <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.45)", margin: "2px 0 0" }}>Kindness crossing borders</p>
          </div>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            {/* Auto-rotate toggle */}
            <button onClick={(e) => { e.stopPropagation(); autoRotateRef.current = !autoRotateRef.current; setIsAutoRotating(r => !r); }}
              title={isAutoRotating ? "Pause rotation" : "Resume rotation"}
              style={{ border: "1px solid rgba(255,255,255,0.2)", borderRadius: "8px", padding: "5px 8px", background: isAutoRotating ? "rgba(77,255,176,0.15)" : "rgba(0,0,0,0.4)", cursor: "pointer", fontSize: "13px", color: isAutoRotating ? "#4DFFB0" : "rgba(255,255,255,0.6)", backdropFilter: "blur(4px)" }}>
              {isAutoRotating ? "⟳ Live" : "⟳ Paused"}
            </button>
            <button onClick={onClose} style={{ border: "1px solid rgba(255,255,255,0.2)", borderRadius: "50%", padding: "6px", background: "rgba(0,0,0,0.4)", cursor: "pointer", display: "flex", alignItems: "center", backdropFilter: "blur(4px)" }}>
              <X size={14} color="rgba(255,255,255,0.8)" />
            </button>
          </div>
        </div>

        {/* ── FLOATING TABS ── */}
        <div onMouseDown={e => e.stopPropagation()} onTouchStart={e => e.stopPropagation()}
          style={{ position: "absolute", bottom: 0, left: 0, right: 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px 12px", background: "linear-gradient(to top, rgba(6,14,16,0.95) 0%, transparent 100%)" }}>
          <div style={{ display: "flex", gap: "8px" }}>
            {[["world", "🌍 World"], ["mine", "✨ My connections"]].map(([t, label]) => (
              <button key={t} onClick={() => setTab(t)} style={{ borderRadius: "20px", padding: "5px 14px", fontSize: "12px", fontWeight: 600, cursor: "pointer", border: tab === t ? "1px solid #4DFFB0" : "1px solid rgba(255,255,255,0.2)", background: tab === t ? "rgba(77,255,176,0.15)" : "rgba(0,0,0,0.3)", color: tab === t ? "#4DFFB0" : "rgba(255,255,255,0.7)", backdropFilter: "blur(4px)" }}>{label}</button>
            ))}
          </div>
          <span style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "11px", color: "rgba(255,255,255,0.5)" }}>
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#4DFFB0", display: "inline-block", animation: "seenLive 1.5s infinite" }} />Live
          </span>
        </div>
      </div>

      <style>{`
        @keyframes seenLive { 0%,100%{opacity:.4} 50%{opacity:1} }
        @keyframes seenSpin { to{transform:rotate(360deg)} }
        canvas { touch-action: none; user-select: none; }
      `}</style>

      {/* ── IMPACT BAR ── */}
      <div style={{ flexShrink: 0, background: "#0d1f1a", borderTop: "1px solid rgba(77,255,176,0.12)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          {tab === "world" ? (
            <>
              <ImpactStat label="Active now" value={activeUsers.length} />
              <ImpactStat label="Countries" value={[...new Set(activeUsers.map(u => u.country).filter(Boolean))].length} divider />
              <ImpactStat label="Greetings today" value={totalToday} divider />
            </>
          ) : (
            <>
              <ImpactStat label="Seen from" value={`${myConnectionCountries.length} countries`} />
              <ImpactStat label="Waves received" value={myWaves.length} divider />
              <ImpactStat label="Furthest reach" value={furthestCountry ? `~${furthestCountry.km.toLocaleString()} km` : "—"} divider />
            </>
          )}
        </div>

        {tab === "mine" && myConnectionCountries.length > 0 && (
          <div style={{ padding: "10px 16px 14px", overflowX: "auto" }}>
            <p style={{ fontSize: "10px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(77,255,176,0.6)", margin: "0 0 8px" }}>Countries that saw you</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
              {myConnectionCountries.map(c => (
                <span key={c} style={{ borderRadius: "20px", border: "1px solid rgba(77,255,176,0.25)", background: "rgba(77,255,176,0.08)", padding: "3px 10px", fontSize: "11px", fontWeight: 500, color: "#5DCAA5" }}>{c}</span>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: "16px", padding: "8px 16px 12px", fontSize: "11px", color: "rgba(255,255,255,0.4)", flexWrap: "wrap" }}>
          <span style={{ display: "flex", alignItems: "center", gap: "5px" }}><span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#4DFFB0", display: "inline-block" }} />You</span>
          <span style={{ display: "flex", alignItems: "center", gap: "5px" }}><span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#1D9E75", display: "inline-block" }} />{tab === "world" ? "Active user" : "Waved at you"}</span>
          {tab === "world" && <span style={{ display: "flex", alignItems: "center", gap: "5px" }}><svg width="20" height="8" viewBox="0 0 20 8"><path d="M1,6 Q10,1 19,6" fill="none" stroke="#4DFFB0" strokeWidth="1.5" strokeLinecap="round" /></svg>Greeting arc</span>}
        </div>
      </div>
    </div>
  );
}

function ImpactStat({ label, value, divider }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "12px 8px", borderLeft: divider ? "1px solid rgba(255,255,255,0.06)" : "none", textAlign: "center" }}>
      <p style={{ fontSize: "18px", fontWeight: 700, margin: 0, color: "white", lineHeight: 1.1 }}>{value}</p>
      <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.4)", margin: "3px 0 0", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</p>
    </div>
  );
}
