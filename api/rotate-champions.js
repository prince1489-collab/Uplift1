// Weekly community-greeting rotation.
// Retires the current champions and promotes the Top-5 approved candidates by votes.
// Runs automatically (Vercel cron, Mondays 00:00 UTC) or manually from the admin panel
// (?force=1 with a verified admin Firebase ID token). Mirrors the init/auth pattern in
// send-reminder.js. Uses the Admin SDK, so it bypasses Firestore security rules.

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

const ADMIN_EMAIL = "prince1489@googlemail.com";
const CHAMPION_COUNT = 5;
const CHAMPION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
const CHAMPION_BONUS = 100;

function initAdmin() {
  if (!getApps().length) {
    initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)) });
  }
}

// ISO-week id like "2026-W26" (UTC) — used for idempotency.
function isoWeekId(d) {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = (date.getUTCDay() + 6) % 7;      // Mon=0 … Sun=6
  date.setUTCDate(date.getUTCDate() - dayNum + 3); // nearest Thursday
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(
    ((date - firstThursday) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7
  );
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

async function isAuthorised(req) {
  const auth = req.headers["authorization"] || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return false;
  // Cron path: Vercel injects Bearer <CRON_SECRET>.
  if (process.env.CRON_SECRET && token === process.env.CRON_SECRET) return true;
  // Manual admin path: a verified admin Firebase ID token.
  try {
    const decoded = await getAuth().verifyIdToken(token);
    return decoded?.email === ADMIN_EMAIL;
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  try {
    initAdmin();
  } catch (err) {
    return res.status(500).json({ error: "admin init failed" });
  }

  if (!(await isAuthorised(req))) {
    return res.status(401).json({ error: "unauthorised" });
  }

  try {
    const db = getFirestore();
    const now = Date.now();
    const weekId = isoWeekId(new Date(now));
    const force = req.query?.force === "1" || req.query?.force === 1;

    // Idempotency — don't run twice in the same ISO week unless forced.
    const metaRef = db.collection("meta").doc("communityRotation");
    const metaSnap = await metaRef.get();
    if (!force && metaSnap.exists && metaSnap.data()?.weekId === weekId) {
      return res.status(200).json({ skipped: true, reason: "already ran this week", weekId });
    }

    const col = db.collection("greetingSubmissions");

    // 1) Retire current champions (one greeting = one shot; never recompete).
    const champSnap = await col.where("status", "==", "champion").get();
    const retireBatch = db.batch();
    champSnap.docs.forEach((d) => {
      retireBatch.update(d.ref, { status: "retired", retiredAt: now, championUntil: null });
    });
    await retireBatch.commit();

    // 2) Promote the Top-N approved candidates by votes (tie-break: earliest approved).
    const apprSnap = await col.where("status", "==", "approved").get();
    const ranked = apprSnap.docs
      .map((d) => ({ id: d.id, ref: d.ref, ...d.data() }))
      .filter((s) => (s.reportCount ?? 0) < 3)
      .sort((a, b) => (b.upvotes ?? 0) - (a.upvotes ?? 0) || (a.approvedAt ?? 0) - (b.approvedAt ?? 0))
      .slice(0, CHAMPION_COUNT);

    const promoteBatch = db.batch();
    ranked.forEach((s) => {
      promoteBatch.update(s.ref, {
        status: "champion",
        championUntil: now + CHAMPION_DURATION_MS,
        championWeekId: weekId,
        promotedAt: now,
      });
    });
    await promoteBatch.commit();

    // 3) Award each champion's author the promotion bonus (best-effort, per-doc).
    for (const s of ranked) {
      if (!s.authorUid) continue;
      try {
        const userRef = db.collection("users").doc(s.authorUid);
        await db.runTransaction(async (tx) => {
          const u = await tx.get(userRef);
          const bal = Number(u.exists ? u.data().sparkBalance ?? 0 : 0);
          tx.set(userRef, { sparkBalance: bal + CHAMPION_BONUS }, { merge: true });
        });
      } catch (_) { /* reward best-effort */ }
    }

    await metaRef.set({
      weekId,
      ranAt: now,
      promotedIds: ranked.map((s) => s.id),
      retiredCount: champSnap.size,
    });

    return res.status(200).json({
      ok: true,
      weekId,
      retired: champSnap.size,
      promoted: ranked.length,
    });
  } catch (err) {
    console.error("[rotate-champions]", err?.message);
    return res.status(500).json({ error: err?.message ?? "rotation failed" });
  }
}
