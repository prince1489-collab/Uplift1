/**
 * Circles.jsx — Group kindness rooms (max 3 circles × 10 members each)
 *
 * Exports:
 *   useCircles(db, currentUser)         — hook: live list of user's circles
 *   useCircleInviteCount(db, currentUser) — hook: count of pending invites (badge)
 *   AddToCircleButton                   — appears in QuickReactBar on each message
 *   CirclesPanel                        — replaces BuddyPanel in the ··· menu
 */

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  addDoc, arrayRemove, arrayUnion,
  collection, deleteDoc, doc, getDocs,
  getDoc, onSnapshot, query, updateDoc, where,
} from "firebase/firestore";
import { ArrowLeft, ChevronRight, Plus, Sparkles, Users, X } from "lucide-react";

const MAX_CIRCLES = 3;
const MAX_MEMBERS = 10;

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

// ── AddToCircleButton — shown in the QuickReactBar on each message ────────────

export function AddToCircleButton({ db, currentUser, targetUid, targetName }) {
  const [open, setOpen] = useState(false);
  const [dropPos, setDropPos] = useState({ top: 0, left: 0 });
  const [circles, setCircles] = useState([]);
  const [sent, setSent] = useState({});
  const [sending, setSending] = useState(null);
  const [toast, setToast] = useState(null); // { text, emoji }
  const btnRef = useRef(null);
  const dropRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const h = (e) => {
      if (dropRef.current && dropRef.current.contains(e.target)) return;
      if (btnRef.current && !btnRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  useEffect(() => {
    if (!open || !db || !currentUser) return;
    return onSnapshot(
      collection(db, "users", currentUser.uid, "circles"),
      (snap) => setCircles(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      () => {}
    );
  }, [open, db, currentUser?.uid]);

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
    if (members.length >= MAX_MEMBERS) {
      setSent(s => ({ ...s, [circle.id]: "full" }));
      return;
    }
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
      // Close dropdown and show toast confirmation
      setOpen(false);
      showToast(`Invite sent to ${targetName ?? "them"} · ${circle.name}`, circle.emoji ?? "⭐");
    } catch {
      showToast("Couldn't send invite — try again", "⚠️");
    }
    setSending(null);
  };

  return (
    <>
      {/* Icon-only trigger — fits inside the QuickReactBar */}
      <button
        ref={btnRef}
        onClick={handleOpen}
        title="Add to Circle"
        className="seen-qrb-btn"
        style={{ fontSize: 16 }}>
        👥
      </button>

      {/* Toast confirmation */}
      {toast && createPortal(
        <div
          data-portal
          style={{
            position: "fixed",
            bottom: 90,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 400,
            animation: "cardSlideUp .25s ease both",
            whiteSpace: "nowrap",
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
            const isFull = memberCount >= MAX_MEMBERS;
            return (
              <button key={c.id}
                onClick={() => sendInvite(c)}
                disabled={!!status || sending === c.id || isFull}
                className="flex items-center justify-between w-full px-3 py-2 text-xs hover:bg-slate-50 transition-colors text-left disabled:opacity-50">
                <span className="flex items-center gap-1.5">
                  <span>{c.emoji ?? "⭐"}</span>
                  <span className="text-slate-700 font-medium truncate max-w-[100px]">{c.name}</span>
                </span>
                <span className="text-[10px] text-slate-400 ml-1 flex-shrink-0">
                  {status === "sent" ? "✓ Invited"
                    : status === "already" ? "✓ In"
                    : status === "full" || isFull ? "Full"
                    : `${memberCount}/${MAX_MEMBERS}`}
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

// ── Create / Edit Circle Modal ────────────────────────────────────────────────

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

// ── Circle Detail ─────────────────────────────────────────────────────────────

function CircleDetail({ db, currentUser, circle, circleId, onBack }) {
  const [memberProfiles, setMemberProfiles] = useState({});
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [broadcastText, setBroadcastText] = useState("");
  const [sending, setSending] = useState(false);
  const [justSent, setJustSent] = useState(false);

  const members = circle.members ?? [];
  const streak = calcStreak(circle);

  useEffect(() => {
    if (!db || members.length === 0) { setMemberProfiles({}); return; }
    Promise.all(members.map(uid => getDoc(doc(db, "users", uid)))).then(docs => {
      const map = {};
      docs.forEach(d => { if (d.exists()) map[d.id] = d.data(); });
      setMemberProfiles(map);
    });
  }, [db, members.join(",")]);

  const handleBroadcast = async () => {
    if (!broadcastText.trim() || sending || !db || members.length === 0) return;
    setSending(true);
    try {
      const text = broadcastText.trim();
      const today = todayStr();
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

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

      if (circle.lastSentDate !== today) {
        const newStreak = circle.lastSentDate === yesterday
          ? (circle.streak ?? 0) + 1
          : 1;
        await updateDoc(doc(db, "users", currentUser.uid, "circles", circleId), {
          lastSentDate: today,
          streak: newStreak,
        });
      }

      setBroadcastText("");
      setShowBroadcast(false);
      setJustSent(true);
      setTimeout(() => setJustSent(false), 3000);
    } catch {}
    setSending(false);
  };

  const removeMember = async (uid) => {
    await updateDoc(doc(db, "users", currentUser.uid, "circles", circleId), {
      members: arrayRemove(uid),
    }).catch(() => {});
  };

  return (
    <div className="flex flex-col" style={{ maxHeight: "60vh" }}>
      {/* Back header */}
      <div className="flex items-center gap-2 pb-2 border-b border-slate-100 flex-shrink-0">
        <button onClick={onBack} className="rounded-full p-1 hover:bg-slate-100 transition-colors">
          <ArrowLeft size={13} className="text-slate-500" />
        </button>
        <span className="text-base">{circle.emoji ?? "⭐"}</span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-slate-800 truncate">{circle.name}</p>
          <p className="text-[10px] text-slate-400">
            {members.length}/{MAX_MEMBERS} members
            {streak > 0 && <span className="ml-1.5 text-orange-500">🔥 {streak}d streak</span>}
          </p>
        </div>
      </div>

      {/* Members */}
      <div className="flex-1 overflow-y-auto py-2 space-y-1 min-h-0">
        {members.length === 0 ? (
          <p className="text-[11px] text-slate-400 text-center py-3 leading-relaxed">
            No members yet<br />
            <span className="text-slate-300">Tap "Add to Circle" on any message</span>
          </p>
        ) : members.map(uid => {
          const p = memberProfiles[uid];
          const name = p?.fullName ?? "Member";
          return (
            <div key={uid} className="flex items-center gap-2 rounded-xl px-1 py-1.5 hover:bg-slate-50 group">
              {p?.profilePhotoUrl
                ? <img src={p.profilePhotoUrl} alt="" className="h-6 w-6 rounded-full object-cover flex-shrink-0" />
                : <div className="h-6 w-6 rounded-full bg-teal-100 flex items-center justify-center text-[10px] font-bold text-teal-700 flex-shrink-0">{name[0]}</div>
              }
              <span className="text-[11px] text-slate-700 flex-1 truncate">{name}</span>
              <button onClick={() => removeMember(uid)}
                className="opacity-0 group-hover:opacity-100 rounded-full p-0.5 hover:bg-slate-200 transition-all">
                <X size={9} className="text-slate-400" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Broadcast */}
      {members.length > 0 && (
        <div className="flex-shrink-0 pt-2 border-t border-slate-100">
          {justSent ? (
            <p className="text-center text-xs text-teal-600 font-semibold py-2">
              ✓ Sent to {members.length} {members.length === 1 ? "person" : "people"} ✨
            </p>
          ) : showBroadcast ? (
            <div className="space-y-1.5">
              <textarea
                value={broadcastText}
                onChange={e => setBroadcastText(e.target.value)}
                placeholder={`Send kindness to ${circle.name}…`}
                rows={2}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-700 outline-none focus:border-teal-400 resize-none"
                autoFocus
              />
              <div className="flex gap-1.5">
                <button onClick={() => setShowBroadcast(false)}
                  className="flex-1 rounded-xl border border-slate-200 py-1.5 text-xs text-slate-500 hover:bg-slate-50 transition-colors">
                  Cancel
                </button>
                <button onClick={handleBroadcast}
                  disabled={!broadcastText.trim() || sending}
                  className="flex-1 rounded-xl bg-teal-600 py-1.5 text-xs font-bold text-white hover:bg-teal-700 disabled:opacity-40 transition-colors">
                  {sending ? "Sending…" : `Send to ${members.length}`}
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowBroadcast(true)}
              className="w-full rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-500 py-2 text-xs font-bold text-white hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5">
              <Sparkles size={11} /> Send kindness to all ✨
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── CirclesPanel — replaces BuddyPanel in the ··· menu ───────────────────────

export function CirclesPanel({ db, currentUser }) {
  const circles = useCircles(db, currentUser);
  const inviteCount = useCircleInviteCount(db, currentUser);
  const [showCreate, setShowCreate] = useState(false);
  const [showInvites, setShowInvites] = useState(false);
  const [activeCircle, setActiveCircle] = useState(null);

  const createCircle = async ({ name, emoji }) => {
    if (!db || !currentUser || circles.length >= MAX_CIRCLES) return;
    await addDoc(collection(db, "users", currentUser.uid, "circles"), {
      name, emoji, members: [], streak: 0, lastSentDate: null, createdAt: Date.now(),
    });
    setShowCreate(false);
  };

  const deleteCircle = async (circleId, e) => {
    e.stopPropagation();
    if (!db || !currentUser) return;
    if (!window.confirm(`Delete this circle?`)) return;
    await deleteDoc(doc(db, "users", currentUser.uid, "circles", circleId)).catch(() => {});
    if (activeCircle?.id === circleId) setActiveCircle(null);
  };

  if (activeCircle) {
    const live = circles.find(c => c.id === activeCircle.id) ?? activeCircle;
    return (
      <>
        <CircleDetail
          db={db} currentUser={currentUser}
          circle={live} circleId={activeCircle.id}
          onBack={() => setActiveCircle(null)}
        />
        {showCreate && <CreateCircleModal onSave={createCircle} onClose={() => setShowCreate(false)} />}
      </>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Circles</p>
          {inviteCount > 0 && (
            <button onClick={() => setShowInvites(true)}
              className="flex items-center gap-0.5 rounded-full bg-teal-500 px-1.5 py-0.5 text-[9px] font-bold text-white hover:bg-teal-600 transition-colors">
              {inviteCount} new
            </button>
          )}
        </div>
        {circles.length < MAX_CIRCLES && (
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
      <div className="space-y-1">
        {circles.map(c => {
          const streak = calcStreak(c);
          const memberCount = (c.members ?? []).length;
          return (
            <div key={c.id}
              className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 px-2.5 py-2 cursor-pointer hover:border-teal-200 hover:bg-teal-50/50 transition-colors group"
              onClick={() => setActiveCircle(c)}>
              <span className="text-sm flex-shrink-0">{c.emoji ?? "⭐"}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-700 truncate">{c.name}</p>
                <p className="text-[10px] text-slate-400">
                  {memberCount}/{MAX_MEMBERS}
                  {streak > 0 && <span className="ml-1 text-orange-500">🔥 {streak}d</span>}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={(e) => deleteCircle(c.id, e)}
                  className="opacity-0 group-hover:opacity-100 rounded-full p-0.5 hover:bg-slate-200 transition-all">
                  <X size={9} className="text-slate-400" />
                </button>
                <ChevronRight size={11} className="text-slate-300 flex-shrink-0" />
              </div>
            </div>
          );
        })}
      </div>

      {circles.length > 0 && circles.length < MAX_CIRCLES && (
        <p className="text-[10px] text-slate-300 text-center">
          {MAX_CIRCLES - circles.length} slot{MAX_CIRCLES - circles.length > 1 ? "s" : ""} remaining
        </p>
      )}

      {showCreate && <CreateCircleModal onSave={createCircle} onClose={() => setShowCreate(false)} />}
      {showInvites && <CircleInviteInbox db={db} currentUser={currentUser} onClose={() => setShowInvites(false)} />}
    </div>
  );
}
