// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.

import React, { useEffect, useRef, useState } from "react";
import {
  addDoc, collection, deleteDoc, deleteField, doc, getDoc, increment, onSnapshot,
  orderBy, query, setDoc, updateDoc, where, limit, writeBatch,
} from "firebase/firestore";
import { ArrowLeft, Lock, MessageCircle, MoreHorizontal, Send } from "lucide-react";

const MAX_LEVEL_SPARKS = 10_000_000; // "Chronically GOATED"
const MSG_LIMIT = 100;
const LONG_PRESS_MS = 500;

// ── Deterministic chat ID: sorted UIDs joined with _ ─────────────────
export function getChatId(uid1, uid2) {
  return [uid1, uid2].sort().join("_");
}

// ── Can this user SEND a chat request? ───────────────────────────
export function canSendChatRequest(profile) {
  return true; // open to all users
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

// ── Total unread private messages across all of my chats ─────────────
export function usePrivateUnreadCount(db, currentUser) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!db || !currentUser) return;
    const q = query(
      collection(db, "privateChats"),
      where("participants", "array-contains", currentUser.uid)
    );
    return onSnapshot(q, (snap) => {
      let total = 0;
      snap.forEach((d) => {
        const data = d.data();
        if (data?.deletedFor?.[currentUser.uid]) return; // skip hidden chats
        total += data?.unread?.[currentUser.uid] ?? 0;
      });
      setCount(total);
    }, (err) => { console.error("[usePrivateUnreadCount]", err); });
  }, [db, currentUser?.uid]);
  return count;
}

// ── Hook: check if either user has blocked the other ─────────────────
function useBlockStatus(db, currentUser, otherUid) {
  const [blocked, setBlocked] = useState(null); // null = loading
  const [iBlockedThem, setIBlockedThem] = useState(false);

  useEffect(() => {
    if (!db || !currentUser || !otherUid) return;
    let cancelled = false;
    Promise.all([
      getDoc(doc(db, "users", currentUser.uid, "blockedUsers", otherUid)),
      getDoc(doc(db, "users", otherUid, "blockedUsers", currentUser.uid)),
    ]).then(([myBlock, theirBlock]) => {
      if (cancelled) return;
      const iBlocked = myBlock.exists();
      setIBlockedThem(iBlocked);
      setBlocked(iBlocked || theirBlock.exists());
    }).catch(() => { if (!cancelled) setBlocked(false); });
    return () => { cancelled = true; };
  }, [db, currentUser, otherUid]);

  return { blocked, iBlockedThem };
}

// ── Button shown in each buddy row ───────────────────────────────────
export function ChatRequestButton({ db, currentUser, buddyUid, buddyName, onChatOpen }) {
  const [status, setStatus] = useState(null); // null | "pending" | "chatting" | "blocked"
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

  if (status === "blocked") {
    return <span className="text-[10px] text-slate-300 italic">Unavailable</span>;
  }

  const handleSend = async () => {
    if (loading || !db || !currentUser) return;
    setLoading(true);
    try {
      const chatId = getChatId(currentUser.uid, buddyUid);
      const chatSnap = await getDoc(doc(db, "privateChats", chatId));
      if (chatSnap.exists()) { setStatus("chatting"); return; }
      // Check if buddy has blocked this user
      const blockSnap = await getDoc(doc(db, "users", buddyUid, "blockedUsers", currentUser.uid));
      if (blockSnap.exists()) { setStatus("blocked"); return; }
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
  const [sentRequests, setSentRequests] = useState([]);
  const [chats, setChats] = useState([]);
  const [senderMeta, setSenderMeta] = useState({});
  const [recipientMeta, setRecipientMeta] = useState({});
  const [partnerMeta, setPartnerMeta] = useState({});

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

  // Listen to sent (outgoing) requests
  useEffect(() => {
    if (!db || !currentUser) return;
    const q = query(
      collection(db, "chatRequests"),
      where("fromUid", "==", currentUser.uid)
    );
    return onSnapshot(q, (snap) => {
      const pending = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((r) => r.status === "pending");
      setSentRequests(pending);
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

  // Fetch sender profiles for incoming requests
  useEffect(() => {
    const uids = [...new Set(requests.map((r) => r.fromUid).filter(Boolean))];
    if (!db || uids.length === 0) return;
    Promise.all(uids.map((uid) => getDoc(doc(db, "users", uid)))).then((docs) => {
      const map = {};
      docs.forEach((d) => { if (d.exists()) map[d.id] = d.data(); });
      setSenderMeta((prev) => ({ ...prev, ...map }));
    });
  }, [db, JSON.stringify(requests.map((r) => r.fromUid))]);

  // Fetch recipient profiles for sent requests
  useEffect(() => {
    const uids = [...new Set(sentRequests.map((r) => r.toUid).filter(Boolean))];
    if (!db || uids.length === 0) return;
    Promise.all(uids.map((uid) => getDoc(doc(db, "users", uid)))).then((docs) => {
      const map = {};
      docs.forEach((d) => { if (d.exists()) map[d.id] = d.data(); });
      setRecipientMeta((prev) => ({ ...prev, ...map }));
    });
  }, [db, JSON.stringify(sentRequests.map((r) => r.toUid))]);

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
    if (!db) return;
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
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      {/* Header */}
      <div className="seen-overlay-header flex items-center gap-3 border-b border-slate-100 px-4 py-3 flex-shrink-0">
        <button onClick={onClose}
          className="rounded-full p-1.5 hover:bg-slate-100 transition-colors">
          <ArrowLeft size={18} className="text-slate-600" />
        </button>
        <h2 className="text-sm font-bold text-slate-800">Private Chats</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">

        {/* Pending invite requests — excludes anyone already in an active chat */}
        {requests.filter((r) => !chats.some((c) => (c.participants ?? []).includes(r.fromUid))).length > 0 && (
          <section>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-2">
              Invite requests
            </p>
            <div className="space-y-2">
              {requests.filter((r) => !chats.some((c) => (c.participants ?? []).includes(r.fromUid))).map((req) => {
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
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Sent requests awaiting response */}
        {sentRequests.length > 0 && (
          <section>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-2">
              Sent requests
            </p>
            <div className="space-y-2">
              {sentRequests.map((req) => {
                const recipient = recipientMeta[req.toUid];
                const name = recipient?.fullName ?? "Someone";
                return (
                  <div key={req.id}
                    className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2.5">
                    {recipient?.profilePhotoUrl
                      ? <img src={recipient.profilePhotoUrl} alt=""
                          className="h-8 w-8 rounded-full object-cover flex-shrink-0" />
                      : <div className="h-8 w-8 rounded-full bg-teal-100 flex items-center justify-center text-xs font-bold text-teal-700 flex-shrink-0">
                          {name[0]}
                        </div>}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-slate-700 truncate">{name}</p>
                      <p className="text-[10px] text-slate-400">Waiting for them to accept</p>
                    </div>
                    <span className="text-[10px] text-slate-300 italic flex-shrink-0">Pending</span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Active chats */}
        {chats.filter((c) => !c.deletedFor?.[currentUser?.uid]).length > 0 && (
          <section>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-2">
              Chats
            </p>
            <div className="space-y-2">
              {[...chats].filter((c) => !c.deletedFor?.[currentUser?.uid]).sort((a, b) => {
                const ua = a.unread?.[currentUser?.uid] ?? 0;
                const ub = b.unread?.[currentUser?.uid] ?? 0;
                if ((ua > 0) !== (ub > 0)) return ub - ua; // unread chats first
                return (b.lastMessageAt ?? b.createdAt ?? 0) - (a.lastMessageAt ?? a.createdAt ?? 0);
              }).map((chat) => {
                const otherUid = (chat.participants ?? []).find((u) => u !== currentUser?.uid);
                const other = partnerMeta[otherUid];
                const name = other?.fullName ?? "Someone";
                const unread = chat.unread?.[currentUser?.uid] ?? 0;
                const preview = chat.lastMessageText;
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
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-slate-700 truncate">{name}</p>
                        {unread > 0 && (
                          <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-violet-500 px-1 text-[10px] font-bold text-white flex-shrink-0">
                            {unread > 9 ? "9+" : unread}
                          </span>
                        )}
                      </div>
                      <p className={`text-[11px] truncate ${unread > 0 ? "text-slate-600 font-medium" : "text-slate-400"}`}>
                        {preview ?? "Tap to open"}
                      </p>
                    </div>
                    <MessageCircle size={14} className="text-slate-300 ml-auto flex-shrink-0" />
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Empty state */}
        {requests.length === 0 && sentRequests.length === 0 && chats.filter((c) => !c.deletedFor?.[currentUser?.uid]).length === 0 && (
          <div className="flex flex-col items-center justify-center pt-20 gap-3 text-center">
            <MessageCircle size={44} className="text-slate-200" />
            <p className="text-sm font-semibold text-slate-400">No chats yet</p>
            <p className="text-xs text-slate-300 max-w-[200px]">
              Send an invite from the Buddies panel to start a private chat
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Report reason sheet ───────────────────────────────────────────────
const REPORT_REASONS = ["Harmful", "Inappropriate", "Spam", "Other"];

function ReportSheet({ onReport, onCancel }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center" style={{ background: "rgba(0,0,0,0.4)" }} onClick={onCancel}>
      <div
        className="w-full max-w-md rounded-t-3xl bg-white px-4 pt-4 pb-8 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        style={{ animation: "seenSheetRise 300ms cubic-bezier(0.34,1.56,0.64,1) both" }}>
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-slate-200" />
        <p className="text-sm font-bold text-slate-800 mb-3">Report this message</p>
        <div className="flex flex-wrap gap-2 mb-4">
          {REPORT_REASONS.map((r) => (
            <button key={r} onClick={() => onReport(r)}
              className="rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-700 hover:bg-red-50 hover:border-red-300 hover:text-red-600 transition-colors">
              {r}
            </button>
          ))}
        </div>
        <button onClick={onCancel}
          className="w-full rounded-2xl border border-slate-200 py-2.5 text-sm text-slate-500 hover:bg-slate-50 transition-colors">
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Block confirm sheet ───────────────────────────────────────────────
function BlockSheet({ name, onBlock, onCancel }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center" style={{ background: "rgba(0,0,0,0.4)" }} onClick={onCancel}>
      <div
        className="w-full max-w-md rounded-t-3xl bg-white px-4 pt-4 pb-8 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        style={{ animation: "seenSheetRise 300ms cubic-bezier(0.34,1.56,0.64,1) both" }}>
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-slate-200" />
        <p className="text-sm font-bold text-slate-800 mb-1">Block {name}?</p>
        <p className="text-xs text-slate-500 mb-5">They won't be able to send you chat requests and this conversation will be unavailable to both of you.</p>
        <div className="flex gap-3">
          <button onClick={onCancel}
            className="flex-1 rounded-2xl border border-slate-200 py-2.5 text-sm text-slate-600 hover:bg-slate-50 transition-colors">
            Cancel
          </button>
          <button onClick={onBlock}
            className="flex-1 rounded-2xl bg-red-500 py-2.5 text-sm font-bold text-white hover:bg-red-600 transition-colors">
            Block
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Private Chat Window ───────────────────────────────────────────────
export function PrivateChatWindow({ db, currentUser, chatId, otherUid, otherName, onBack }) {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showBlockSheet, setShowBlockSheet] = useState(false);
  const [reportMsg, setReportMsg] = useState(null); // message object to report
  const [toast, setToast] = useState("");
  const [offerBlock, setOfferBlock] = useState(false);
  const [selectedMsg, setSelectedMsg] = useState(null); // message for own-message options
  const [showDeleteChatConfirm, setShowDeleteChatConfirm] = useState(false);
  const endRef = useRef(null);
  const inputRef = useRef(null);
  const longPressTimer = useRef(null);
  const lastReadLenRef = useRef(-1);

  const { blocked, iBlockedThem } = useBlockStatus(db, currentUser, otherUid);

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

  // Clear my unread count whenever the chat is open and messages are visible
  useEffect(() => {
    if (!db || !chatId || !currentUser) return;
    if (messages.length === 0) return; // nothing loaded yet
    if (messages.length === lastReadLenRef.current) return;
    lastReadLenRef.current = messages.length;
    updateDoc(doc(db, "privateChats", chatId), {
      [`unread.${currentUser.uid}`]: 0,
    }).catch((err) => console.error("[unread reset]", err));
  }, [db, chatId, currentUser?.uid, messages.length]);

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || !db || !chatId || !currentUser || sending || blocked) return;
    setSending(true);
    setDraft("");
    const ts = Date.now();
    try {
      await addDoc(collection(db, "privateChats", chatId, "messages"), {
        senderUid: currentUser.uid,
        text,
        timestamp: ts,
      });
      // Bump the other participant's unread count, store preview, un-hide if they deleted
      if (otherUid) {
        updateDoc(doc(db, "privateChats", chatId), {
          lastMessageAt: ts,
          lastMessageSenderUid: currentUser.uid,
          lastMessageText: text,
          [`unread.${otherUid}`]: increment(1),
          [`deletedFor.${otherUid}`]: deleteField(), // un-hide chat for recipient
        }).catch((err) => console.error("[send unread bump]", err));
      }
    } catch { setDraft(text); }
    setSending(false);
    inputRef.current?.focus();
  };

  const handleDeleteChat = async () => {
    if (!db || !chatId || !currentUser) return;
    setShowMenu(false);
    await updateDoc(doc(db, "privateChats", chatId), {
      [`deletedFor.${currentUser.uid}`]: true,
    }).catch((err) => console.error("[delete chat]", err));
    onBack?.();
  };

  const handleDeleteMessage = async (msgId) => {
    if (!db || !chatId) return;
    await deleteDoc(doc(db, "privateChats", chatId, "messages", msgId))
      .catch((err) => console.error("[delete msg]", err));
  };

  const handleBlock = async () => {
    if (!db || !currentUser || !otherUid) return;
    await setDoc(doc(db, "users", currentUser.uid, "blockedUsers", otherUid), {
      blockedAt: Date.now(),
    }).catch(() => {});
    setShowBlockSheet(false);
    setShowMenu(false);
    onBack?.();
  };

  const handleUnblock = async () => {
    if (!db || !currentUser || !otherUid) return;
    await deleteDoc(doc(db, "users", currentUser.uid, "blockedUsers", otherUid)).catch(() => {});
  };

  const handleReport = async (reason) => {
    if (!reportMsg || !db || !currentUser) return;
    setReportMsg(null);
    await addDoc(collection(db, "reports"), {
      reporterUid: currentUser.uid,
      chatId,
      messageId: reportMsg.id,
      messageText: reportMsg.text,
      senderUid: reportMsg.senderUid,
      reason,
      timestamp: Date.now(),
      context: "private",
    }).catch(() => {});
    setToast("Reported. Our team will review.");
    setOfferBlock(true);
    setTimeout(() => { setToast(""); setOfferBlock(false); }, 5000);
  };

  const startLongPress = (msg) => {
    longPressTimer.current = setTimeout(() => {
      if (msg.senderUid === currentUser?.uid) {
        setSelectedMsg(msg); // own message → show delete option
      } else {
        setReportMsg(msg);   // other's message → show report option
      }
    }, LONG_PRESS_MS);
  };

  const cancelLongPress = () => {
    clearTimeout(longPressTimer.current);
  };

  // Blocked state UI
  if (blocked !== null && blocked) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-white">
        <div className="seen-overlay-header flex items-center gap-3 border-b border-slate-100 px-4 py-3 flex-shrink-0">
          <button onClick={onBack} className="rounded-full p-1.5 hover:bg-slate-100 transition-colors">
            <ArrowLeft size={18} className="text-slate-600" />
          </button>
          <div className="h-7 w-7 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-400 flex-shrink-0">
            {(otherName ?? "?")[0]}
          </div>
          <h2 className="text-sm font-bold text-slate-500 truncate">{otherName ?? "Chat"}</h2>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-6">
          <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center">
            <Lock size={22} className="text-slate-400" />
          </div>
          <p className="text-sm font-semibold text-slate-500">This conversation is unavailable.</p>
          {iBlockedThem && (
            <button onClick={handleUnblock}
              className="mt-2 rounded-full border border-slate-200 px-4 py-1.5 text-xs text-slate-500 hover:bg-slate-50 transition-colors">
              Unblock {otherName}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      {/* Header */}
      <div className="seen-overlay-header flex items-center gap-3 border-b border-slate-100 px-4 py-3 flex-shrink-0">
        <button onClick={onBack}
          className="rounded-full p-1.5 hover:bg-slate-100 transition-colors">
          <ArrowLeft size={18} className="text-slate-600" />
        </button>
        <div className="h-7 w-7 rounded-full bg-teal-100 flex items-center justify-center text-xs font-bold text-teal-700 flex-shrink-0">
          {(otherName ?? "?")[0]}
        </div>
        <h2 className="text-sm font-bold text-slate-800 truncate flex-1">{otherName ?? "Chat"}</h2>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="flex items-center gap-1 rounded-full bg-violet-50 border border-violet-200 px-2 py-0.5">
            <Lock size={9} className="text-violet-500" />
            <span className="text-[10px] font-semibold text-violet-600">Private</span>
          </div>
          <button onClick={() => setShowMenu((v) => !v)}
            className="rounded-full p-1.5 hover:bg-slate-100 transition-colors">
            <MoreHorizontal size={16} className="text-slate-500" />
          </button>
        </div>
      </div>

      {/* ••• dropdown menu */}
      {showMenu && (
        <div className="absolute top-14 right-3 z-[60] bg-white rounded-2xl shadow-xl border border-slate-100 py-1 min-w-[160px]">
          <button
            onClick={() => { setShowMenu(false); setShowDeleteChatConfirm(true); }}
            className="w-full text-left px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 transition-colors">
            Delete chat
          </button>
          <div className="mx-3 border-t border-slate-100" />
          <button
            onClick={() => { setShowMenu(false); setShowBlockSheet(true); }}
            className="w-full text-left px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors">
            Block {otherName}
          </button>
        </div>
      )}

      {/* Message list */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2" onClick={() => setShowMenu(false)}>
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
              <div
                className={`max-w-[72%] rounded-2xl px-3.5 py-2.5 text-sm leading-snug break-words select-none ${
                  mine
                    ? "bg-teal-600 text-white rounded-br-sm"
                    : "bg-slate-100 text-slate-800 rounded-bl-sm"
                }`}
                onTouchStart={() => startLongPress(msg)}
                onTouchEnd={cancelLongPress}
                onTouchMove={cancelLongPress}
                onMouseDown={() => startLongPress(msg)}
                onMouseUp={cancelLongPress}
                onMouseLeave={cancelLongPress}
              >
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

      {/* Toast */}
      {toast && (
        <div className="absolute bottom-24 left-4 right-4 z-[60] flex flex-col items-center gap-2">
          <div className="rounded-2xl bg-slate-800 px-4 py-2.5 text-xs text-white shadow-lg text-center">
            {toast}
          </div>
          {offerBlock && (
            <button onClick={() => { setOfferBlock(false); setShowBlockSheet(true); }}
              className="rounded-full bg-white border border-slate-200 px-4 py-1.5 text-xs text-red-500 shadow-sm hover:bg-red-50 transition-colors">
              Also block this person?
            </button>
          )}
        </div>
      )}

      {/* Report sheet (long-press other's message) */}
      {reportMsg && (
        <ReportSheet
          onReport={handleReport}
          onCancel={() => setReportMsg(null)}
        />
      )}

      {/* Own-message options sheet (long-press own message) */}
      {selectedMsg && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center" style={{ background: "rgba(0,0,0,0.4)" }} onClick={() => setSelectedMsg(null)}>
          <div
            className="w-full max-w-md rounded-t-3xl bg-white px-4 pt-4 pb-8 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            style={{ animation: "seenSheetRise 300ms cubic-bezier(0.34,1.56,0.64,1) both" }}>
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-slate-200" />
            <div className="mb-3 rounded-xl bg-slate-50 px-3 py-2">
              <p className="text-xs text-slate-500 line-clamp-2">{selectedMsg.text}</p>
            </div>
            <button
              onClick={() => { handleDeleteMessage(selectedMsg.id); setSelectedMsg(null); }}
              className="w-full rounded-2xl bg-red-50 border border-red-100 py-2.5 text-sm font-semibold text-red-500 hover:bg-red-100 transition-colors mb-2">
              Delete message
            </button>
            <button onClick={() => setSelectedMsg(null)}
              className="w-full rounded-2xl border border-slate-200 py-2.5 text-sm text-slate-500 hover:bg-slate-50 transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Delete chat confirm sheet */}
      {showDeleteChatConfirm && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center" style={{ background: "rgba(0,0,0,0.4)" }} onClick={() => setShowDeleteChatConfirm(false)}>
          <div
            className="w-full max-w-md rounded-t-3xl bg-white px-4 pt-4 pb-8 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            style={{ animation: "seenSheetRise 300ms cubic-bezier(0.34,1.56,0.64,1) both" }}>
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-slate-200" />
            <p className="text-sm font-bold text-slate-800 mb-1">Delete this chat?</p>
            <p className="text-xs text-slate-500 mb-5">This conversation will be removed from your inbox. {otherName} will still have a copy. If they message you again it will reappear.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteChatConfirm(false)}
                className="flex-1 rounded-2xl border border-slate-200 py-2.5 text-sm text-slate-600 hover:bg-slate-50 transition-colors">
                Cancel
              </button>
              <button onClick={handleDeleteChat}
                className="flex-1 rounded-2xl bg-red-500 py-2.5 text-sm font-bold text-white hover:bg-red-600 transition-colors">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Block confirm sheet */}
      {showBlockSheet && (
        <BlockSheet
          name={otherName ?? "this person"}
          onBlock={handleBlock}
          onCancel={() => setShowBlockSheet(false)}
        />
      )}
    </div>
  );
}
