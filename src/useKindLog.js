// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.
//
// useKindLog.js — the account's own kindness log, live (3.29). See kindLog.js.
// The last `days` of it, newest first, kept with the account it was read for so a different
// account on the device never sees it (deviceOwner.js). One field in both the filter and the
// order, so no composite index is needed.

import { useEffect, useState } from "react";
import { collection, limit, onSnapshot, orderBy, query, where } from "firebase/firestore";

// `ready` (3.30): whether this account's log has arrived at least once, so a weekly summary or a
// level isn't decided from the empty list that stands in while it loads.
const NOT_YET = Object.freeze({ rows: Object.freeze([]), ready: false });

export function useKindLogState(db, uid, days = 30) {
  const [state, setState] = useState({ uid: null, rows: [] });
  useEffect(() => {
    if (!db || !uid) return undefined;
    const since = Date.now() - days * 86400000;
    const q = query(collection(db, "users", uid, "kindLog"), where("at", ">=", since), orderBy("at", "desc"), limit(80));
    return onSnapshot(q,
      (snap) => setState({ uid, rows: snap.docs.map((d) => ({ id: d.id, ...d.data() })) }),
      () => setState({ uid, rows: [] }));
  }, [db, uid, days]);
  return state.uid === uid ? { rows: state.rows, ready: true } : NOT_YET;
}

export function useKindLog(db, uid, days = 30) {
  return useKindLogState(db, uid, days).rows;
}
