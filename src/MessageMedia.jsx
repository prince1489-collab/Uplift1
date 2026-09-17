// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.
//
// MessageMedia.jsx — renders the GIF attached to a feed message, for the people allowed to see it.
//
// ── WHY THIS IS A COMPONENT AND NOT A FIELD ON THE MESSAGE ───────────────────────────────────
// Media lives at publicMessages/{id}/media/item rather than on the message document, because it
// is the one part of the feed that is not world-readable: firestore.rules gates reading it on
// whether YOU follow the author. Everything else in publicMessages is `allow read: if true`.
//
// Being a separate document is what makes that gate affordable. The message carries a boolean,
// `hasMedia`, and this component is mounted only when that boolean is set — so a feed of
// ordinary text messages issues no extra reads at all, and the follow check in the rules runs
// only for the handful of messages that actually have something attached.
//
// getDoc, not onSnapshot. Media is written once with its message and can never be edited (the
// rules have no `allow update`), so there is nothing for a live listener to hear. A listener per
// media message would be a permanent open subscription in exchange for updates that cannot
// happen.
//
// ── IT IS PART OF THE BUBBLE, NOT A CARD BESIDE IT ───────────────────────────────────────────
// This renders BARE — no margin, no border, no radius of its own — because it is mounted inside
// the message bubble, above the words, and the bubble's own frame and overflow-hidden are what
// give it its edges. It used to be a sibling after the bubble with `mt-1.5 rounded-2xl border`,
// and a gap plus a second border plus a second radius is the complete recipe for "two separate
// posts", which is exactly how it read.
//
// ── NOT BEING ALLOWED TO SEE IT IS NOT AN ERROR ──────────────────────────────────────────────
// A non-follower's read fails with permission-denied, and that is the feature working. It is
// handled by rendering nothing — no broken image, no padlock, no "you can't see this". A post
// carrying a GIF should not advertise to strangers that it is carrying one; they simply see the
// words, which is exactly what a text post looks like. Media-bearing posts are also kept out of
// the Worldwide rotation, so in practice this path is the belt to that filter's braces.

import React, { useEffect, useState } from "react";
import { doc, getDoc, getDocFromCache } from "firebase/firestore";

// Tallest a GIF is allowed to be, in CSS px. Measured off a recording: at the previous clamp a
// portrait GIF rendered 332px tall in a 655px feed viewport — 51% of everything visible — and the
// words it belonged to were below the fold. A cap in pixels rather than a ratio is the version
// that can be promised: whatever shape somebody picks, the sentence underneath is on screen with
// it. Roughly a quarter of the feed.
const MAX_H = 180;
// The width the bubble gives a GIF on a phone, used only to turn a shape into a height.
const COL_W = 360;
// Assumed shape before the real dimensions arrive. It barely matters: at a 180px cap a GIF has to
// be WIDER than 2:1 to render shorter than the cap, and almost none are — so the reserved box and
// the final box are the same height for nearly every GIF, and nothing moves when it lands.
const PLACEHOLDER_RATIO = 4 / 3;

export default function MessageMedia({ db, messageId }) {
  // Three states, not two. `null` meant both "still loading" and "you cannot see this", which is
  // why the feed jumped: the component rendered NOTHING until the document landed, then appeared
  // at full height and shoved the message down the screen. The aspect-ratio box was reserving
  // space beautifully and reserving it too late to matter.
  const [state, setState] = useState("loading"); // loading | ready | none
  const [media, setMedia] = useState(null);

  useEffect(() => {
    if (!db || !messageId) return;
    let alive = true;
    const ref = doc(db, "publicMessages", messageId, "media", "item");

    const use = (snap) => {
      const d = snap.exists() ? snap.data() : null;
      if (!d || d.type !== "gif" || !d.url) { setState("none"); return false; }
      setMedia(d); setState("ready"); return true;
    };

    // Cache first. Firestore persistence is on (see App.jsx), so a GIF this device has already
    // seen resolves with no network at all — which is the difference between a GIF that is there
    // when you arrive and one that appears six seconds later, as it did on the recording.
    //
    // getDoc does NOT do this for you: it goes to the server and only falls back to the cache
    // when offline. The cache miss is cheap and synchronous-ish, so the cost of trying is a
    // rejected promise on first view.
    getDocFromCache(ref)
      .then((snap) => { if (alive) use(snap); })
      .catch(() => {})
      .finally(() => {
        // Always follow up with the server: the cached copy may be stale, and on a miss this is
        // the only read that will ever return anything.
        if (!alive) return;
        getDoc(ref)
          .then((snap) => { if (alive) use(snap); })
          // permission-denied lands here and is deliberately silent — see the note above. `none`
          // rather than a broken image or a padlock.
          .catch(() => { if (alive) setState("none"); });
      });

    return () => { alive = false; };
  }, [db, messageId]);

  if (state === "none") return null;

  // ── The reserved box ───────────────────────────────────────────────────────────────────────
  // Rendered from the moment this mounts, which is the moment the message says it has something —
  // so the space exists before anyone knows what shape the GIF is, and nothing below it moves when
  // the picture lands.
  //
  // It does mean a stranger briefly sees a grey rectangle on a post they will not be shown the
  // contents of. That is a smaller leak than it looks: `hasMedia` is already on the world-readable
  // message document, media posts are filtered out of the Worldwide rotation entirely, and the
  // Focused Feed only contains people you follow — so the permission-denied path is the belt to
  // that filter's braces rather than something people meet.
  const w = Number(media?.width) || 0;
  const h = Number(media?.height) || 0;
  const natural = w > 0 && h > 0 ? h / w : PLACEHOLDER_RATIO;

  if (state === "loading") {
    return (
      <div className="border-b border-black/5 bg-slate-100"
        style={{ height: Math.min(MAX_H, Math.round(COL_W * PLACEHOLDER_RATIO)) }} aria-hidden />
    );
  }

  return (
    // The hairline is what stops the two halves reading as a picture with a caption welded under
    // it: black/5 is the same divider the proverb block inside the bubble already uses, so a GIF
    // post and a proverb post are divided the same way.
    // Height, not aspect-ratio. The box is as tall as the GIF wants up to the cap, and object-cover
    // crops anything taller — so a portrait GIF becomes a wide strip of itself rather than half
    // the screen, and the message under it is always in view.
    <div className="border-b border-black/5 bg-slate-100 overflow-hidden"
      style={{ height: Math.min(MAX_H, Math.round(COL_W * natural)) }}>
      <img
        src={media.url}
        // Klipy's own title, stored with the message so the alt text survives without
        // another call to them. A screen reader says "someone waving" rather than "image".
        alt={media.description || "GIF"}
        // NOT lazy. This sits at the top of a post in a feed somebody has just opened, so it is
        // almost always already on screen — deferring it bought nothing and cost the wait the
        // recording shows.
        className="h-full w-full object-cover"
      />
    </div>
  );
}
