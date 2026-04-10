import React, { useEffect, useRef, useState } from "react";
import {
  addDoc, collection, doc, getDoc, onSnapshot,
  orderBy, query, setDoc, updateDoc, where, limit,
} from "firebase/firestore";
import { ArrowLeft, Lock, MessageCircle, Send } from "lucide-react";

const MAX_LEVEL_SPARKS = 600; // "Main Character Energy"
const MSG_LIMIT = 100;

// ── Deterministic chat ID: sorted UIDs joined with _ ─────────────────
export function getChatId(uid1, uid2) {
  return [uid1, uid2].sort().join("_");
}

// ── Can this user SEND a chat request? (max level required) ──────────
export function canSendChatRequest(profile) {
  return Number(profile?.sparkBalance ?? 0) >= MAX_LEVEL_SPARKS;
}

// ── Pending incoming requests count (used for badge in header) ───────
export function usePendingChatCount(db, currentUser) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!db || !currentUser) return;
    const q = query(
      collection(db, "chatRequests"),
      where("toUid", "==", currentUser.uid),
      where("status", "==", "pending")
    );
    return onSnapshot(q, (snap) => setCount(snap.size), () => {});
  }, [db, currentUser]);
  return count;
}

// ── Button shown in each buddy row (only at max level) ───────────────
export function ChatRequestButton({ db, currentUser, buddyUid, buddyName, onChatOpen }) {
  const [status, setStatus] = useState(null); // null | "pending" | "chatting"
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!db || !currentUser || !buddyUid) return;
    const chatId = getChatId(currentUser.uid, buddyUid);
    const unsubChat = onSnapshot(
      doc(db, "privateChats", chatId),
      (snap) => { if (snap.exists()) setStatus("chatting"); },
      () => {}
    );
    const unsubReq = onSnapshot(
      query(
        collection(db, "chatRequests"),
        where("fromUid", "==", currentUser.uid),
        where("toUid", "==", buddyUid),
        where("status", "==", "pending")
      ),
      (snap) => { if (!snap.empty && status !== "chatting") setStatus("pending"); },
      () => {}
    );
    return () => { unsubChat(); unsubReq(); };
  }, [db, currentUser, buddyUid]);

  if (status === "chatting") {
    return (
      <button
        onClick={() => onChatOpen?.(getChatId(currentUser.uid, buddyUid), buddyUid, buddyName)}
        className="flex items-center gap-1 rounded-full bg-teal-100 border border-teal-300 px-2 py-0.5 text-[10px] font-semibold text-teal-700 hover:bg-teal-200 transition-colors">
        <MessageCircle size={9} /> Chat
      </button>
    );
  }

  if (status === "pending") {
    return <span className="text-[10px] text-slate-400 italic">Invite sent</span>;
  }

  const handleSend = async () => {
    if (loading || !db || !currentUser) return;
    setLoading(true);
    try {
      const chatId = getChatId(currentUser.uid, buddyUid);
      const chatSnap = await getDoc(doc(db, "privateChats", chatId));
      if (chatSnap.exists()) { setStatus("chatting"); return; }
      await addDoc(collection(db, "chatRequests"), {
        fromUid: currentUser.uid,
        toUid: buddyUid,
        fromName: currentUser.displayName ?? "Someone",
        status: "pending",
        createdAt: Date.now(),
      });
      setStatus("pending");
    } catch {}
    setLoading(false);
  };

  return (
    <button
      onClick={handleSend}
      disabled={loading}
      className="flex items-center gap-1 rounded-full border border-slate-200 px-2 py-0.5 text-[10px] text-slate-500 hover:border-teal-300 hover:text-teal-600 transition-colors">
      <MessageCircle size={9} /> {loading ? "…" : "Invite to chat"}
    </button>
  );
}

// ── Private Chat Inbox (requests + active chats list) ────────────────
export function PrivateChatInbox({ db, currentUser, profile, onOpenChat, onClose }) {
  const [requests, setRequests] = useState([]);
  const [chats, setChats] = useState([]);
  const [senderMeta, setSenderMeta] = useState({}); // uid → profile data
  const [partnerMeta, setPartnerMeta] = useState({});
  const isPremium = profile?.isPremium === true;

  // Listen to incoming pending requests
  useEffect(() => {
    if (!db || !currentUser) return;
    const q = query(
      collection(db, "chatRequests"),
      where("toUid", "==", currentUser.uid),
      where("status", "==", "pending")
    );
    return onSnapshot(q, (snap) => {
      setRequests(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, () => {});
  }, [db, currentUser]);

  // Listen to active chats
  useEffect(() => {
    if (!db || !currentUser) return;
    const q = query(
      collection(db, "privateChats"),
      where("participants", "array-contains", currentUser.uid)
    );
    return onSnapshot(q, (snap) => {
      setChats(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, () => {});
  }, [db, currentUser]);

  // Fetch sender profiles for requests
  useEffect(() => {
    const uids = [...new Set(requests.map((r) => r.fromUid).filter(Boolean))];
    if (!db || uids.length === 0) return;
    Promise.all(uids.map((uid) => getDoc(doc(db, "users", uid)))).then((docs) => {
      const map = {};
      docs.forEach((d) => { if (d.exists()) map[d.id] = d.data(); });
      setSenderMeta((prev) => ({ ...prev, ...map }));
    });
  }, [db, JSON.stringify(requests.map((r) => r.fromUid))]);

  // Fetch partner profiles for active chats
  useEffect(() => {
    const uids = [...new Set(
      chats.flatMap((c) => c.participants ?? []).filter((u) => u !== currentUser?.uid)
    )];
    if (!db || uids.length === 0) return;
    Promise.all(uids.map((uid) => getDoc(doc(db, "users", uid)))).then((docs) => {
      const map = {};
      docs.forEach((d) => { if (d.exists()) map[d.id] = d.data(); });
      setPartnerMeta((prev) => ({ ...prev, ...map }));
    });
  }, [db, JSON.stringify(chats.map((c) => c.id))]);

  const handleAccept = async (req) => {
    if (!isPremium || !db) return;
    const chatId = getChatId(req.fromUid, req.toUid);
    await setDoc(doc(db, "privateChats", chatId), {
      participants: [req.fromUid, req.toUid].sort(),
      createdAt: Date.now(),
    });
    await updateDoc(doc(db, "chatRequests", req.id), { status: "accepted" });
    const name = senderMeta[req.fromUid]?.fullName ?? req.fromName ?? "Someone";
    onOpenChat?.(chatId, req.fromUid, name);
  };

  const handleDecline = async (req) => {
    if (!db) return;
    await updateDoc(doc(db, "chatRequests", req.id), { status: "declined" });
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white" data-dark-shell>
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 flex-shrink-0">
        <button onClick={onClose}
          className="rounded-full p-1.5 hover:bg-slate-100 transition-colors">
          <ArrowLeft size={18} className="text-slate-600" />
        </button>
        <h2 className="text-sm font-bold text-slate-800">Private Chats</h2>
        <div className="ml-auto flex items-center gap-1 rounded-full bg-violet-50 border border-violet-200 px-2 py-0.5">
          <Lock size={9} className="text-violet-500" />
          <span className="text-[10px] font-semibold text-violet-600">Members only</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">

        {/* Pending invite requests */}
        {requests.length > 0 && (
          <section>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-2">
              Invite requests
            </p>
            <div className="space-y-2">
              {requests.map((req) => {
                const sender = senderMeta[req.fromUid];
                const name = sender?.fullName ?? req.fromName ?? "Someone";
                return (
                  <div key={req.id}
                    className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2.5 gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {sender?.profilePhotoUrl
                        ? <img src={sender.profilePhotoUrl} alt=""
                            className="h-8 w-8 rounded-full object-cover flex-shrink-0" />
                        : <div className="h-8 w-8 rounded-full bg-teal-100 flex items-center justify-center text-xs font-bold text-teal-700 flex-shrink-0">
                            {name[0]}
                          </div>}
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-700 truncate">{name}</p>
                        <p className="text-[10px] text-slate-400">wants to chat privately</p>
                      </div>
                    </div>
                    {isPremium ? (
                      <div className="flex gap-1.5 flex-shrink-0">
                        <button onClick={() => handleAccept(req)}
                          className="rounded-full bg-teal-600 px-3 py-1 text-[11px] font-semibold text-white hover:bg-teal-700 transition-colors">
                          Accept
                        </button>
                        <button onClick={() => handleDecline(req)}
                          className="rounded-full border border-slate-200 px-3 py-1 text-[11px] text-slate-500 hover:bg-slate-100 transition-colors">
                          Decline
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-1 flex-shrink-0">
                        <Lock size={9} className="text-amber-600" />
                        <span className="text-[10px] font-semibold text-amber-700 whitespace-nowrap">
                          Upgrade to reply
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Active chats */}
        {chats.length > 0 && (
          <section>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-2">
              Chats
            </p>
            <div className="space-y-2">
              {chats.map((chat) => {
                const otherUid = (chat.participants ?? []).find((u) => u !== currentUser?.uid);
                const other = partnerMeta[otherUid];
                const name = other?.fullName ?? "Someone";
                return (
                  <button key={chat.id}
                    onClick={() => onOpenChat?.(chat.id, otherUid, name)}
                    className="w-full flex items-center gap-3 rounded-2xl border border-slate-100 bg-white px-3 py-2.5 hover:bg-slate-50 transition-colors text-left">
                    {other?.profilePhotoUrl
                      ? <img src={other.profilePhotoUrl} alt=""
                          className="h-9 w-9 rounded-full object-cover flex-shrink-0" />
                      : <div className="h-9 w-9 rounded-full bg-teal-100 flex items-center justify-center text-sm font-bold text-teal-700 flex-shrink-0">
                          {name[0]}
                        </div>}
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-700">{name}</p>
                      <p className="text-[11px] text-slate-400">Tap to open</p>
                    </div>
                    <MessageCircle size={14} className="text-slate-300 ml-auto flex-shrink-0" />
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Empty state */}
        {requests.length === 0 && chats.length === 0 && (
          <div className="flex flex-col items-center justify-center pt-20 gap-3 text-center">
            <MessageCircle size={44} className="text-slate-200" />
            <p className="text-sm font-semibold text-slate-400">No chats yet</p>
            <p className="text-xs text-slate-300 max-w-[200px]">
              Reach <strong>Main Character Energy</strong> and invite a buddy from the Buddies panel
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Private Chat Window ───────────────────────────────────────────────
export function PrivateChatWindow({ db, currentUser, chatId, otherName, onBack }) {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!db || !chatId) return;
    const q = query(
      collection(db, "privateChats", chatId, "messages"),
      orderBy("timestamp", "asc"),
      limit(MSG_LIMIT)
    );
    return onSnapshot(q, (snap) => {
      setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, () => {});
  }, [db, chatId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || !db || !chatId || !currentUser || sending) return;
    setSending(true);
    setDraft("");
    try {
      await addDoc(collection(db, "privateChats", chatId, "messages"), {
        senderUid: currentUser.uid,
        text,
        timestamp: Date.now(),
      });
    } catch { setDraft(text); }
    setSending(false);
    inputRef.current?.focus();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white" data-dark-shell>
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 flex-shrink-0">
        <button onClick={onBack}
          className="rounded-full p-1.5 hover:bg-slate-100 transition-colors">
          <ArrowLeft size={18} className="text-slate-600" />
        </button>
        <div className="h-7 w-7 rounded-full bg-teal-100 flex items-center justify-center text-xs font-bold text-teal-700 flex-shrink-0">
          {(otherName ?? "?")[0]}
        </div>
        <h2 className="text-sm font-bold text-slate-800 truncate">{otherName ?? "Chat"}</h2>
        <div className="ml-auto flex items-center gap-1 rounded-full bg-violet-50 border border-violet-200 px-2 py-0.5 flex-shrink-0">
          <Lock size={9} className="text-violet-500" />
          <span className="text-[10px] font-semibold text-violet-600">Private</span>
        </div>
      </div>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center pt-20 gap-2 text-center">
            <Lock size={30} className="text-slate-200" />
            <p className="text-xs text-slate-400">
              This is a private conversation.<br />Only you two can see it.
            </p>
          </div>
        )}
        {messages.map((msg) => {
          const mine = msg.senderUid === currentUser?.uid;
          return (
            <div key={msg.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[72%] rounded-2xl px-3.5 py-2.5 text-sm leading-snug break-words ${
                mine
                  ? "bg-teal-600 text-white rounded-br-sm"
                  : "bg-slate-100 text-slate-800 rounded-bl-sm"
              }`}>
                {msg.text}
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {/* Input bar */}
      <div className="flex-shrink-0 flex items-center gap-2 border-t border-slate-100 px-3 py-2.5">
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          placeholder="Message…"
          className="flex-1 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700 placeholder:text-slate-400 outline-none focus:border-teal-300 transition-colors"
        />
        <button
          onClick={handleSend}
          disabled={!draft.trim() || sending}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-600 text-white disabled:opacity-40 hover:bg-teal-700 transition-colors flex-shrink-0">
          <Send size={15} />
        </button>
      </div>
    </div>
  );
}
