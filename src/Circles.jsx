// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.

/**
 * Circles.jsx — Group kindness rooms
 *
 * Exports:
 *   useCircles(db, currentUser)           — hook: live list of user's circles
 *   useCircleInviteCount(db, currentUser)  — hook: count of pending invites (badge)
 *   AddToCircleButton                     — appears in QuickReactBar on each message
 *   CirclesPanel                          — replaces BuddyPanel in the ··· menu
 */

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  addDoc, arrayRemove, arrayUnion,
  collection, deleteDoc, doc, getDocs,
  getDoc, onSnapshot, orderBy, query, updateDoc, where,
} from "firebase/firestore";
import { ArrowLeft, ChevronRight, Plus, Sparkles, Users, X } from "lucide-react";
import { getGreetingsByCategory } from "./greetings";

const MAX_CIRCLES_FREE = 3;
const MAX_CIRCLES_PREMIUM = 6;
const MAX_MEMBERS_FREE = 10;
const MAX_MEMBERS_PREMIUM = 25;

const EMOJI_OPTIONS = [
  "☀️","🌙","⭐","🌈","🔥","💫","🎯","🌸","🍀","💎",
  "🦋","🌊","🎨","🎵","❤️","🏠","💼","🌍","🎉","🤝",
];

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function calcStreak(circle) {
  const { streak = 0, lastSentDate } = circle;
  if (!lastSentDate) return 0;
  const today = todayStr();
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (lastSentDate === today || lastSentDate === yesterday) return streak;
  return 0;
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

export function useCircles(db, currentUser) {
  const [circles, setCircles] = useState([]);
  useEffect(() => {
    if (!db || !currentUser) return;
    return onSnapshot(
      collection(db, "users", currentUser.uid, "circles"),
      (snap) => setCircles(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      () => {}
    );
  }, [db, currentUser?.uid]);
  return circles;
}

export function useCircleInviteCount(db, currentUser) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!db || !currentUser) return;
    const q = query(
      collection(db, "circleInvites"),
      where("toUid", "==", currentUser.uid),
      where("status", "==", "pending")
    );
    return onSnapshot(q, (snap) => setCount(snap.size), () => {});
  }, [db, currentUser?.uid]);
  return count;
}

// ── AddToCircleButton ─────────────────────────────────────────────────────────

export function AddToCircleButton({ db, currentUser, targetUid, targetName, isPremium = false }) {
  const maxMembers = isPremium ? MAX_MEMBERS_PREMIUM : MAX_MEMBERS_FREE;
  const [open, setOpen] = useState(false);
  const [dropPos, setDropPos] = useState({ top: 0, left: 0 });
  const [circles, setCircles] = useState([]);
  const [sent, setSent] = useState({});   // circleId -> "sent" | "already" | "full"
  const [sending, setSending] = useState(null);
  const [toast, setToast] = useState(null);
  const btnRef = useRef(null);
  const dropRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const h = (e) => {
      if (dropRef.current && dropRef.current.contains(e.target)) return;
      if (btnRef.current && !btnRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  // Load circles when dropdown opens
  useEffect(() => {
    if (!open || !db || !currentUser) return;
    return onSnapshot(
      collection(db, "users", currentUser.uid, "circles"),
      (snap) => setCircles(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      () => {}
    );
  }, [open, db, currentUser?.uid]);

  // Pre-load invite state from Firestore every time dropdown opens
  useEffect(() => {
    if (!open || !db || !currentUser) return;
    getDocs(query(
      collection(db, "circleInvites"),
      where("fromUid", "==", currentUser.uid),
      where("toUid", "==", targetUid),
      where("status", "==", "pending")
    )).then(snap => {
      const map = {};
      snap.docs.forEach(d => { map[d.data().circleId] = "sent"; });
      setSent(map);
    }).catch(() => {});
  }, [open, db, currentUser?.uid, targetUid]);

  if (!currentUser || currentUser.uid === targetUid) return null;

  const showToast = (text, emoji) => {
    setToast({ text, emoji });
    setTimeout(() => setToast(null), 3000);
  };

  const handleOpen = (e) => {
    e.stopPropagation();
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      const DROPDOWN_W = 210;
      const DROPDOWN_H = 180;
      const spaceBelow = window.innerHeight - rect.bottom;
      const top = spaceBelow >= DROPDOWN_H
        ? rect.bottom + 6
        : Math.max(8, rect.top - DROPDOWN_H - 6);
      const left = Math.min(rect.left, window.innerWidth - DROPDOWN_W - 8);
      setDropPos({ top, left });
    }
    setOpen(o => !o);
  };

  const sendInvite = async (circle) => {
    if (sending || !db) return;
    const members = circle.members ?? [];
    if (members.includes(targetUid)) {
      setSent(s => ({ ...s, [circle.id]: "already" }));
      setOpen(false);
      showToast(`${targetName ?? "They"} are already in this circle`, circle.emoji ?? "⭐");
      return;
    }
    if (members.length >= maxMembers) {
      setSent(s => ({ ...s, [circle.id]: "full" }));
      return;
    }
    // Already sent (from pre-loaded state)
    if (sent[circle.id] === "sent") return;

    setSending(circle.id);
    try {
      const existing = await getDocs(query(
        collection(db, "circleInvites"),
        where("fromUid", "==", currentUser.uid),
        where("toUid", "==", targetUid),
        where("circleId", "==", circle.id),
        where("status", "==", "pending")
      ));
      if (!existing.empty) {
        setSent(s => ({ ...s, [circle.id]: "sent" }));
      } else {
        await addDoc(collection(db, "circleInvites"), {
          fromUid: currentUser.uid,
          fromName: currentUser.displayName ?? "Someone",
          toUid: targetUid,
          toName: targetName ?? "Someone",
          circleName: circle.name,
          circleEmoji: circle.emoji ?? "⭐",
          circleId: circle.id,
          status: "pending",
          createdAt: Date.now(),
        });
        setSent(s => ({ ...s, [circle.id]: "sent" }));
      }
      setOpen(false);
      showToast(`Request sent to join ${circle.name}`, circle.emoji ?? "⭐");
    } catch {
      showToast("Couldn't send request — try again", "⚠️");
    }
    setSending(null);
  };

  return (
    <>
      <button
        ref={btnRef}
        onClick={handleOpen}
        title="Add to Circle"
        className="seen-qrb-btn"
        style={{ fontSize: 16 }}>
        👥
      </button>

      {toast && createPortal(
        <div
          data-portal
          style={{
            position: "fixed", bottom: 90, left: "50%",
            transform: "translateX(-50%)", zIndex: 400,
            animation: "cardSlideUp .25s ease both", whiteSpace: "nowrap",
          }}
          className={`flex items-center gap-2 rounded-full px-4 py-2.5 text-xs font-semibold text-white shadow-xl ${
            toast.emoji === "⚠️" ? "bg-amber-500" : "bg-teal-600"
          }`}>
          <span>{toast.emoji}</span>
          <span>{toast.text}</span>
        </div>,
        document.body
      )}

      {open && createPortal(
        <div
          ref={dropRef}
          data-portal
          style={{ position: "fixed", top: dropPos.top, left: dropPos.left, zIndex: 300, width: 210 }}
          className="rounded-2xl border border-slate-100 bg-white shadow-2xl py-2"
          onClick={e => e.stopPropagation()}>
          <p className="px-3 pb-1 text-[10px] font-bold text-slate-400 uppercase tracking-wide">
            Add to which circle?
          </p>
          {circles.length === 0 && (
            <p className="px-3 py-2 text-xs text-slate-400 leading-relaxed">
              No circles yet —<br />create one in the ··· menu
            </p>
          )}
          {circles.map(c => {
            const status = sent[c.id];
            const memberCount = (c.members ?? []).length;
            const isFull = memberCount >= maxMembers;
            const alreadyIn = (c.members ?? []).includes(targetUid);
            return (
              <button key={c.id}
                onClick={() => sendInvite(c)}
                disabled={!!status || sending === c.id || isFull || alreadyIn}
                className="flex items-center justify-between w-full px-3 py-2 text-xs hover:bg-slate-50 transition-colors text-left disabled:opacity-50">
                <span className="flex items-center gap-1.5">
                  <span>{c.emoji ?? "⭐"}</span>
                  <span className="text-slate-700 font-medium truncate max-w-[100px]">{c.name}</span>
                </span>
                <span className="text-[10px] text-slate-400 ml-1 flex-shrink-0">
                  {alreadyIn ? "✓ In circle"
                    : status === "sent" ? "✓ Request sent"
                    : status === "full" || isFull ? "Full"
                    : `${memberCount}/${maxMembers}`}
                </span>
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </>
  );
}

// ── Circle Invite Inbox ───────────────────────────────────────────────────────

function CircleInviteInbox({ db, currentUser, onClose }) {
  const [invites, setInvites] = useState([]);

  useEffect(() => {
    if (!db || !currentUser) return;
    const q = query(
      collection(db, "circleInvites"),
      where("toUid", "==", currentUser.uid),
      where("status", "==", "pending")
    );
    return onSnapshot(q, (snap) => {
      setInvites(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, () => {});
  }, [db, currentUser?.uid]);

  const handleAccept = async (inv) => {
    if (!db) return;
    try {
      await updateDoc(doc(db, "users", inv.fromUid, "circles", inv.circleId), {
        members: arrayUnion(currentUser.uid),
      });
      await updateDoc(doc(db, "circleInvites", inv.id), { status: "accepted" });
    } catch {}
  };

  const handleDecline = async (inv) => {
    await updateDoc(doc(db, "circleInvites", inv.id), { status: "declined" }).catch(() => {});
  };

  return createPortal(
    <div data-portal className="fixed inset-0 z-[200] flex flex-col bg-white">
      <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 flex-shrink-0">
        <button onClick={onClose} className="rounded-full p-1.5 hover:bg-slate-100">
          <ArrowLeft size={18} className="text-slate-600" />
        </button>
        <h2 className="text-sm font-bold text-slate-800">Circle Invites</h2>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {invites.length === 0 && (
          <div className="flex flex-col items-center justify-center pt-20 gap-3 text-center">
            <Users size={40} className="text-slate-200" />
            <p className="text-sm text-slate-400">No pending invites</p>
          </div>
        )}
        {invites.map(inv => (
          <div key={inv.id}
            className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3">
            <span className="text-2xl flex-shrink-0">{inv.circleEmoji ?? "⭐"}</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-slate-500 truncate">
                <span className="font-semibold text-slate-700">{inv.fromName}</span> invited you to
              </p>
              <p className="text-sm font-bold text-teal-700 truncate">{inv.circleName}</p>
            </div>
            <div className="flex gap-1.5 flex-shrink-0">
              <button onClick={() => handleAccept(inv)}
                className="rounded-full bg-teal-600 px-3 py-1 text-[11px] font-bold text-white hover:bg-teal-700 transition-colors">
                Join
              </button>
              <button onClick={() => handleDecline(inv)}
                className="rounded-full border border-slate-200 px-3 py-1 text-[11px] text-slate-500 hover:bg-slate-100 transition-colors">
                Decline
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>,
    document.body
  );
}

// ── Create Circle Modal ───────────────────────────────────────────────────────

function CreateCircleModal({ onSave, onClose, existing = null }) {
  const [name, setName] = useState(existing?.name ?? "");
  const [emoji, setEmoji] = useState(existing?.emoji ?? "⭐");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    await onSave({ name: name.trim(), emoji });
    setSaving(false);
  };

  return createPortal(
    <div data-portal className="fixed inset-0 z-[200] flex items-end justify-center bg-slate-900/40 backdrop-blur-sm p-4"
      onClick={onClose}>
      <div className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl max-h-[90dvh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <p className="font-bold text-slate-800 text-sm">
            {existing ? "Edit Circle" : "Create a Circle"}
          </p>
          <button onClick={onClose}><X size={16} className="text-slate-400" /></button>
        </div>
        <p className="text-xs text-slate-400 mb-4">Pick an emoji and give your circle a name</p>

        <div className="flex flex-wrap gap-1.5 mb-4">
          {EMOJI_OPTIONS.map(e => (
            <button key={e} onClick={() => setEmoji(e)}
              className={`text-xl p-1.5 rounded-xl transition-colors ${
                emoji === e ? "bg-teal-50 ring-2 ring-teal-400" : "hover:bg-slate-50"
              }`}>
              {e}
            </button>
          ))}
        </div>

        <input
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleSave()}
          placeholder="Name your circle (e.g. Morning Crew)"
          maxLength={30}
          className="w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm text-slate-800 outline-none focus:border-teal-400 mb-4"
          autoFocus
        />

        <button
          onClick={handleSave}
          disabled={!name.trim() || saving}
          className="w-full rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-500 py-3 text-sm font-bold text-white hover:opacity-90 transition-opacity disabled:opacity-40">
          {saving ? "Saving…"
            : existing ? "Save changes"
            : `Create ${emoji} ${name.trim() || "Circle"}`}
        </button>
      </div>
    </div>,
    document.body
  );
}

// ── CircleGreetingPicker ──────────────────────────────────────────────────────

function CircleGreetingPicker({ isPremium, onSelect, onClose }) {
  const categories = getGreetingsByCategory(isPremium);
  const [activeTab, setActiveTab] = useState(categories[0]?.id ?? "morning");

  const activeCategory = categories.find(c => c.id === activeTab) ?? categories[0];
  const greetings = activeCategory?.greetings ?? [];

  return createPortal(
    <div data-portal className="fixed inset-0 z-[220] flex flex-col bg-white">
      <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 flex-shrink-0">
        <button onClick={onClose} className="rounded-full p-1.5 hover:bg-slate-100">
          <X size={18} className="text-slate-600" />
        </button>
        <h2 className="text-sm font-bold text-slate-800">Choose a Greeting</h2>
      </div>

      {/* Category tabs */}
      <div className="flex gap-1.5 px-4 py-2.5 overflow-x-auto flex-shrink-0 border-b border-slate-100 scrollbar-none">
        {categories.map(cat => (
          <button
            key={cat.id}
            onClick={() => setActiveTab(cat.id)}
            className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors flex-shrink-0 ${
              activeTab === cat.id
                ? "bg-teal-600 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}>
            <span>{cat.emoji}</span>
            <span>{cat.label}</span>
            {cat.isPremium && !isPremium && <span className="text-[9px] opacity-70">✦</span>}
          </button>
        ))}
      </div>

      {/* Greeting list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {greetings.map((g, i) => (
          <button
            key={i}
            onClick={() => onSelect(g)}
            className="w-full text-left rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-700 hover:border-teal-200 hover:bg-teal-50 transition-colors leading-relaxed">
            {g.text}
          </button>
        ))}
      </div>
    </div>,
    document.body
  );
}

// ── CircleMembers — member list with 2-step remove ────────────────────────────

function CircleMembers({ db, currentUser, circle, circleId, isPremium, onClose }) {
  const maxMembers = isPremium ? MAX_MEMBERS_PREMIUM : MAX_MEMBERS_FREE;
  const [memberProfiles, setMemberProfiles] = useState({});
  const [confirmRemoveUid, setConfirmRemoveUid] = useState(null);

  const members = circle.members ?? [];

  useEffect(() => {
    if (!db || members.length === 0) { setMemberProfiles({}); return; }
    Promise.all(members.map(uid => getDoc(doc(db, "users", uid)))).then(docs => {
      const map = {};
      docs.forEach(d => { if (d.exists()) map[d.id] = d.data(); });
      setMemberProfiles(map);
    });
  }, [db, members.join(",")]);

  const removeMember = async (uid) => {
    await updateDoc(doc(db, "users", currentUser.uid, "circles", circleId), {
      members: arrayRemove(uid),
    }).catch(() => {});
    setConfirmRemoveUid(null);
  };

  return createPortal(
    <div data-portal className="fixed inset-0 z-[210] flex flex-col bg-white">
      <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 flex-shrink-0">
        <button onClick={onClose} className="rounded-full p-1.5 hover:bg-slate-100">
          <ArrowLeft size={18} className="text-slate-600" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-bold text-slate-800 truncate">
            {circle.emoji ?? "⭐"} {circle.name}
          </h2>
          <p className="text-xs text-slate-400">{members.length}/{maxMembers} members</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {members.length === 0 && (
          <div className="flex flex-col items-center justify-center pt-20 gap-3 text-center">
            <Users size={40} className="text-slate-200" />
            <p className="text-sm text-slate-400">No members yet</p>
            <p className="text-xs text-slate-300 mt-1">Tap "Add to Circle" on any message</p>
          </div>
        )}
        {members.map(uid => {
          const p = memberProfiles[uid];
          const name = p?.fullName ?? "Member";
          const isConfirming = confirmRemoveUid === uid;
          return (
            <div key={uid}
              className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2.5">
              {p?.profilePhotoUrl
                ? <img src={p.profilePhotoUrl} alt="" className="h-8 w-8 rounded-full object-cover flex-shrink-0" />
                : <div className="h-8 w-8 rounded-full bg-teal-100 flex items-center justify-center text-xs font-bold text-teal-700 flex-shrink-0">{name[0]}</div>
              }
              <span className="text-sm text-slate-700 flex-1 truncate">{name}</span>
              {isConfirming ? (
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => setConfirmRemoveUid(null)}
                    className="rounded-full border border-slate-200 px-2.5 py-1 text-[11px] text-slate-500 hover:bg-slate-100 transition-colors">
                    Cancel
                  </button>
                  <button
                    onClick={() => removeMember(uid)}
                    className="rounded-full bg-red-500 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-red-600 transition-colors">
                    Remove
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmRemoveUid(uid)}
                  className="rounded-full border border-slate-200 px-2.5 py-1 text-[11px] text-slate-400 hover:border-red-200 hover:text-red-400 transition-colors flex-shrink-0">
                  Remove
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>,
    document.body
  );
}

// ── CircleChat — full-screen greeting-only chat ───────────────────────────────

function CircleChat({ db, currentUser, circle, circleId, isPremium, onBack }) {
  const [messages, setMessages] = useState([]);
  const [showPicker, setShowPicker] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [sending, setSending] = useState(false);
  const [justSent, setJustSent] = useState(false);
  const bottomRef = useRef(null);

  const members = circle.members ?? [];
  const streak = calcStreak(circle);

  // Load message history from subcollection
  useEffect(() => {
    if (!db || !currentUser) return;
    const q = query(
      collection(db, "users", currentUser.uid, "circles", circleId, "messages"),
      orderBy("createdAt", "asc")
    );
    return onSnapshot(q, snap => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, () => {});
  }, [db, currentUser?.uid, circleId]);

  // Auto-scroll to newest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const sendGreeting = async (greeting) => {
    if (sending || !db) return;
    setSending(true);
    setShowPicker(false);
    try {
      const text = greeting.text;
      const today = todayStr();
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

      // Log to circle message history
      await addDoc(
        collection(db, "users", currentUser.uid, "circles", circleId, "messages"),
        {
          fromUid: currentUser.uid,
          fromName: currentUser.displayName ?? "You",
          text,
          category: greeting.category ?? "",
          createdAt: Date.now(),
        }
      );

      // Send wave notifications to all members
      if (members.length > 0) {
        await Promise.all(members.map(uid =>
          addDoc(collection(db, "waves"), {
            fromUid: currentUser.uid,
            fromName: currentUser.displayName ?? "Someone",
            toUid: uid,
            message: text,
            circleId,
            circleName: circle.name,
            circleEmoji: circle.emoji ?? "⭐",
            createdAt: Date.now(),
            read: false,
          })
        ));
      }

      // Update streak
      if (circle.lastSentDate !== today) {
        const newStreak = circle.lastSentDate === yesterday
          ? (circle.streak ?? 0) + 1
          : 1;
        await updateDoc(doc(db, "users", currentUser.uid, "circles", circleId), {
          lastSentDate: today,
          streak: newStreak,
        });
      }

      setJustSent(true);
      setTimeout(() => setJustSent(false), 3000);
    } catch {}
    setSending(false);
  };

  const formatTime = (ts) => {
    const d = new Date(ts);
    const today = new Date();
    const isToday = d.toDateString() === today.toDateString();
    if (isToday) return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }) + " · " +
      d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  };

  return createPortal(
    <div data-portal className="fixed inset-0 z-[200] flex flex-col bg-white">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 flex-shrink-0">
        <button onClick={onBack} className="rounded-full p-1.5 hover:bg-slate-100 transition-colors">
          <ArrowLeft size={18} className="text-slate-600" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-bold text-slate-800 truncate">
            {circle.emoji ?? "⭐"} {circle.name}
          </h2>
          <p className="text-xs text-slate-400">
            {members.length} member{members.length !== 1 ? "s" : ""}
            {streak > 0 && <span className="ml-1.5 text-orange-500">🔥 {streak}d streak</span>}
          </p>
        </div>
        <button
          onClick={() => setShowMembers(true)}
          className="relative rounded-full p-2 hover:bg-slate-100 transition-colors"
          title="Members">
          <Users size={18} className="text-slate-500" />
          {members.length > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-teal-500 text-[9px] font-bold text-white flex items-center justify-center">
              {members.length}
            </span>
          )}
        </button>
      </div>

      {/* Message history */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && !sending && (
          <div className="flex flex-col items-center justify-center pt-24 gap-3 text-center">
            <Sparkles size={36} className="text-teal-200" />
            <p className="text-sm font-semibold text-slate-400">No greetings sent yet</p>
            <p className="text-xs text-slate-300 leading-relaxed">
              Tap the button below to<br />send kindness to your circle
            </p>
          </div>
        )}
        {messages.map(msg => (
          <div key={msg.id} className="flex flex-col items-end">
            <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-gradient-to-br from-teal-50 to-emerald-50 border border-teal-100 px-4 py-3">
              <p className="text-sm text-slate-700 leading-relaxed">{msg.text}</p>
            </div>
            <p className="mt-1 text-[10px] text-slate-300 pr-1">{formatTime(msg.createdAt)}</p>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 border-t border-slate-100 px-4 py-3">
        {members.length === 0 ? (
          <div className="rounded-2xl bg-slate-50 border border-slate-100 px-4 py-3 text-center">
            <p className="text-xs font-medium text-slate-500">Add members to start sending greetings</p>
            <p className="text-[11px] text-slate-400 mt-1">Tap "Add to Circle" on any message in the main chat</p>
          </div>
        ) : justSent ? (
          <div className="rounded-2xl bg-teal-50 border border-teal-100 px-4 py-3 text-center">
            <p className="text-xs font-semibold text-teal-700">
              ✓ Sent to {members.length} {members.length === 1 ? "person" : "people"} ✨
            </p>
          </div>
        ) : (
          <button
            onClick={() => setShowPicker(true)}
            disabled={sending}
            className="w-full rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-500 py-3.5 text-sm font-bold text-white hover:opacity-90 transition-opacity disabled:opacity-40 flex items-center justify-center gap-2">
            <Sparkles size={15} />
            {sending ? "Sending…" : `Send a greeting to ${members.length} ${members.length === 1 ? "person" : "people"}`}
          </button>
        )}
      </div>

      {showPicker && (
        <CircleGreetingPicker
          isPremium={isPremium}
          onSelect={sendGreeting}
          onClose={() => setShowPicker(false)}
        />
      )}
      {showMembers && (
        <CircleMembers
          db={db}
          currentUser={currentUser}
          circle={circle}
          circleId={circleId}
          isPremium={isPremium}
          onClose={() => setShowMembers(false)}
        />
      )}
    </div>,
    document.body
  );
}

// ── CirclesPanel ──────────────────────────────────────────────────────────────

export function CirclesPanel({ db, currentUser, isPremium = false }) {
  const maxCircles = isPremium ? MAX_CIRCLES_PREMIUM : MAX_CIRCLES_FREE;
  const maxMembers = isPremium ? MAX_MEMBERS_PREMIUM : MAX_MEMBERS_FREE;
  const circles = useCircles(db, currentUser);
  const inviteCount = useCircleInviteCount(db, currentUser);
  const [showCreate, setShowCreate] = useState(false);
  const [showInvites, setShowInvites] = useState(false);
  const [activeCircle, setActiveCircle] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const createCircle = async ({ name, emoji }) => {
    if (!db || !currentUser || circles.length >= maxCircles) return;
    await addDoc(collection(db, "users", currentUser.uid, "circles"), {
      name, emoji, members: [], streak: 0, lastSentDate: null, createdAt: Date.now(),
    });
    setShowCreate(false);
  };

  const deleteCircle = async (circleId) => {
    if (!db || !currentUser) return;
    await deleteDoc(doc(db, "users", currentUser.uid, "circles", circleId)).catch(() => {});
    if (activeCircle?.id === circleId) setActiveCircle(null);
    setConfirmDeleteId(null);
  };

  // Keep active circle data live
  const liveActiveCircle = activeCircle
    ? (circles.find(c => c.id === activeCircle.id) ?? activeCircle)
    : null;

  return (
    <div className="flex flex-col gap-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Circles</p>
          {isPremium && (
            <span className="rounded-full bg-amber-50 border border-amber-200 px-1.5 py-0.5 text-[9px] font-bold text-amber-700">
              ✦ up to {maxCircles}
            </span>
          )}
          {inviteCount > 0 && (
            <button onClick={() => setShowInvites(true)}
              className="flex items-center gap-0.5 rounded-full bg-teal-500 px-1.5 py-0.5 text-[9px] font-bold text-white hover:bg-teal-600 transition-colors">
              {inviteCount} new
            </button>
          )}
        </div>
        {circles.length < maxCircles && (
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-0.5 rounded-full border border-slate-200 px-2 py-0.5 text-[10px] text-slate-500 hover:border-teal-300 hover:text-teal-600 transition-colors">
            <Plus size={9} /> New
          </button>
        )}
      </div>

      {/* Empty state */}
      {circles.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-3 text-center">
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Group your favourite people<br />into private circles
          </p>
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-1 rounded-full bg-teal-50 border border-teal-200 px-3 py-1.5 text-xs font-semibold text-teal-700 hover:bg-teal-100 transition-colors">
            <Plus size={10} /> Create your first Circle
          </button>
        </div>
      )}

      {/* Circle rows */}
      <div className="space-y-1.5">
        {circles.map(c => {
          const streak = calcStreak(c);
          const memberCount = (c.members ?? []).length;
          const isConfirmingDelete = confirmDeleteId === c.id;
          return (
            <div key={c.id}>
              <div
                className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 px-2.5 py-2 cursor-pointer hover:border-teal-200 hover:bg-teal-50/50 transition-colors group"
                onClick={() => { if (!isConfirmingDelete) setActiveCircle(c); }}>
                <span className="text-sm flex-shrink-0">{c.emoji ?? "⭐"}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-700 truncate">{c.name}</p>
                  <p className="text-[10px] text-slate-400">
                    {memberCount}/{maxMembers}
                    {streak > 0 && <span className="ml-1 text-orange-500">🔥 {streak}d</span>}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  {!isConfirmingDelete && (
                    <button
                      onClick={e => { e.stopPropagation(); setConfirmDeleteId(c.id); }}
                      className="opacity-0 group-hover:opacity-100 rounded-full p-0.5 hover:bg-slate-200 transition-all">
                      <X size={9} className="text-slate-400" />
                    </button>
                  )}
                  <ChevronRight size={11} className="text-slate-300 flex-shrink-0" />
                </div>
              </div>

              {/* 2-step delete confirmation */}
              {isConfirmingDelete && (
                <div className="flex items-center gap-2 px-2.5 py-2 mt-1 rounded-xl bg-red-50 border border-red-100">
                  <p className="text-[11px] text-red-600 flex-1 truncate">Delete "{c.name}"?</p>
                  <button
                    onClick={() => setConfirmDeleteId(null)}
                    className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] text-slate-500 hover:bg-slate-50 transition-colors flex-shrink-0">
                    Cancel
                  </button>
                  <button
                    onClick={() => deleteCircle(c.id)}
                    className="rounded-full bg-red-500 px-2.5 py-1 text-[10px] font-bold text-white hover:bg-red-600 transition-colors flex-shrink-0">
                    Delete
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {circles.length > 0 && circles.length < maxCircles && (
        <p className="text-[10px] text-slate-300 text-center">
          {maxCircles - circles.length} slot{maxCircles - circles.length > 1 ? "s" : ""} remaining
        </p>
      )}

      {showCreate && <CreateCircleModal onSave={createCircle} onClose={() => setShowCreate(false)} />}
      {showInvites && <CircleInviteInbox db={db} currentUser={currentUser} onClose={() => setShowInvites(false)} />}

      {/* Circle chat portal */}
      {liveActiveCircle && (
        <CircleChat
          db={db}
          currentUser={currentUser}
          circle={liveActiveCircle}
          circleId={liveActiveCircle.id}
          isPremium={isPremium}
          onBack={() => setActiveCircle(null)}
        />
      )}
    </div>
  );
}
