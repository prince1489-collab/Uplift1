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
// ── NOT BEING ALLOWED TO SEE IT IS NOT AN ERROR ──────────────────────────────────────────────
// A non-follower's read fails with permission-denied, and that is the feature working. It is
// handled by rendering nothing — no broken image, no padlock, no "you can't see this". A post
// carrying a GIF should not advertise to strangers that it is carrying one; they simply see the
// words, which is exactly what a text post looks like. Media-bearing posts are also kept out of
// the Worldwide rotation, so in practice this path is the belt to that filter's braces.

import React, { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";

export default function MessageMedia({ db, messageId }) {
  const [media, setMedia] = useState(null);

  useEffect(() => {
    if (!db || !messageId) return;
    let alive = true;
    getDoc(doc(db, "publicMessages", messageId, "media", "item"))
      .then((snap) => {
        if (!alive || !snap.exists()) return;
        const d = snap.data();
        if (d?.type !== "gif" || !d?.url) return;
        setMedia(d);
      })
      // permission-denied lands here and is deliberately silent — see the note above.
      .catch(() => {});
    return () => { alive = false; };
  }, [db, messageId]);

  if (!media) return null;

  // The stored dimensions reserve the right amount of space BEFORE the GIF loads. Without them
  // the bubble is one height, then jumps to another as each image arrives, and a feed being
  // scrolled shifts under the reader's thumb. Falls back to 4:3 for anything written without
  // them rather than collapsing to nothing.
  const w = Number(media.width) || 0;
  const h = Number(media.height) || 0;
  const ratio = w > 0 && h > 0 ? `${w} / ${h}` : "4 / 3";

  return (
    <div className="mt-1.5 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100"
      style={{ maxWidth: 260 }}>
      <img
        src={media.url}
        // Klipy's own title, stored with the message so the alt text survives without
        // another call to them. A screen reader says "someone waving" rather than "image".
        alt={media.description || "GIF"}
        loading="lazy"
        className="w-full object-cover"
        style={{ aspectRatio: ratio }}
      />
    </div>
  );
}
