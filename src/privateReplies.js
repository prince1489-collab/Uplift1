// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.
//
// privateReplies.js — the fields of a private reply, one shape whoever writes it (3.21).
//
// PrivateReplySheet (Feed2.jsx) writes every reply typed into a box; the one-tap answer to a
// stranger's delivered message (kindnessInbox.js) writes the same document without the box. The
// Messages tab, the bell and api/notify-reply.js read them all the same way, so both writers
// build the document here. firestore.rules /privateReplies says what may be in it.

const firstName = (n) => (n || "Someone").split(" ")[0];

export function privateReplyPayload({ me, uid, target, toName, text }) {
  return {
    fromUid: uid,
    fromName: firstName(me?.fullName) || "Someone",
    fromCountry: me?.country ?? null,
    toUid: target.uid,
    // Who it was to, so your own Messages list can name them even before they write back.
    toName: toName || null,
    messageId: target.id ?? null,
    messageText: (target.text ?? "").slice(0, 120), // context for the recipient
    text,
    ts: Date.now(),
    read: false,
  };
}

// One tap each, in the receiver's voice: the light way to say someone's words landed (3.21 for a
// stranger's delivered message, 3.22 for "Tell {name} how their words landed"). The app's own
// words, so they go out without the kindness check a typed reply needs.
export const QUICK_ANSWERS = [
  { id: "needed", text: "This was just what I needed today 💛" },
  { id: "smile", text: "This made me smile 😊" },
  { id: "thanks", text: "Thank you — truly 🙏" },
];
export const isQuickAnswer = (text) => QUICK_ANSWERS.some((a) => a.text === text);
