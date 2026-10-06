// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.
//
// conversations.js — turns private replies and notes into conversations, one per person.
//
// A privateReplies document is one message. Three of them can belong together: the first reply or
// kind note (id X), the answer (X__reply) and the last word (X__final). That is a THREAD. Every
// thread between you and one other person is that person's CONVERSATION, in time order, so four
// replies to four of Mateo's posts read as one history with him.
//
// buildConversations is pure, so it can be checked without a database
// (scripts/test-conversations.mjs).

import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query, where, limit } from "firebase/firestore";

// The other half of every conversation: what YOU sent — replies, answers, last words and kind
// notes. Nothing read these before, so your own words were invisible once sent (the Messages tab
// and the reply sheet's "You replied…" both need them). Readable by the sender under the existing
// privateReplies rule; needs the fromUid+ts index in firestore.indexes.json.
export function useMySentReplies(db, currentUser) {
  const uid = currentUser?.uid || null;
  const [state, setState] = useState({ uid: null, rows: [] });
  useEffect(() => {
    if (!db || !uid) return undefined;
    const q = query(collection(db, "privateReplies"), where("fromUid", "==", uid), orderBy("ts", "desc"), limit(200));
    return onSnapshot(q, (snap) => setState({ uid, rows: snap.docs.map((d) => ({ id: d.id, ...d.data() })) }),
      (err) => console.error("[privateReplies sent] listener failed:", err?.code, err?.message));
  }, [db, uid]);
  // Rows from a previous account never leak into the next one's view.
  return state.uid === uid ? state.rows : [];
}

export const rootIdOf = (m) => (m?.inReplyTo ? m.inReplyTo : m?.id);

export function buildConversations(received = [], sent = [], myUid, blocked = new Set()) {
  const all = new Map();
  for (const m of [...received, ...sent]) if (m?.id && !all.has(m.id)) all.set(m.id, m);
  const people = new Map();
  for (const m of all.values()) {
    const other = m.fromUid === myUid ? m.toUid : m.fromUid;
    if (!other || other === myUid || blocked.has(other)) continue;
    let p = people.get(other);
    if (!p) { p = { uid: other, name: null, country: null, threads: new Map(), lastTs: 0, unread: 0 }; people.set(other, p); }
    if (m.fromUid !== other) p.sentName = p.sentName || m.toName || null;
    if (m.fromUid === other) {
      p.name = p.name || m.fromName || null;
      p.country = p.country || m.fromCountry || null;
      if (m.read === false) p.unread += 1;
    }
    const root = rootIdOf(m);
    let t = p.threads.get(root);
    if (!t) { t = { id: root, messages: [], postText: "", postByMe: null, isNote: false }; p.threads.set(root, t); }
    t.messages.push({ ...m, mine: m.fromUid === myUid });
    p.lastTs = Math.max(p.lastTs, Number(m.ts) || 0);
  }
  const out = [];
  for (const p of people.values()) {
    const threads = [...p.threads.values()].map((t) => {
      t.messages.sort((a, b) => (Number(a.ts) || 0) - (Number(b.ts) || 0));
      const root = t.messages.find((x) => x.id === t.id) || t.messages[0];
      t.isNote = !root.messageId;
      t.postText = root.messageText || "";
      // A first reply always goes TO the author of the post it answers.
      t.postByMe = root.messageId ? !root.mine : null;
      t.lastTs = Number(t.messages[t.messages.length - 1]?.ts) || 0;
      t.complete = t.messages.some((x) => x.final) || t.messages.length >= 3;
      return t;
    // By LATEST activity, oldest first — like any chat, the newest is at the bottom, and an old
    // exchange that just got a reply moves down to join it (3.11; it used to stay where it began).
    }).sort((a, b) => a.lastTs - b.lastTs);
    const last = threads.flatMap((t) => t.messages).sort((a, b) => (Number(b.ts) || 0) - (Number(a.ts) || 0))[0];
    out.push({ uid: p.uid, name: p.name || p.sentName || null, country: p.country, unread: p.unread, lastTs: p.lastTs, last, threads });
  }
  return out.sort((a, b) => b.lastTs - a.lastTs);
}

// What, if anything, I may write next in a thread — mirrors firestore.rules privateReplies:
// the first message's recipient may answer once; then the first writer may write back once.
export function nextStep(thread, myUid) {
  const msgs = thread.messages;
  const root = msgs.find((x) => x.id === thread.id) || msgs[0];
  const answer = msgs.find((x) => x.id === `${thread.id}__reply`);
  const final = msgs.find((x) => x.id === `${thread.id}__final`);
  if (final) return null;
  if (!answer) return root.toUid === myUid ? { mode: "answer", doc: root } : null;
  return root.fromUid === myUid ? { mode: "final", doc: answer } : null;
}
