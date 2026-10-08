// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.
//
// /api/delete-account — deletes the caller's Seen account and everything it made (3.20).
//
// Called from the in-app "Delete account" sheet (src/DeleteAccount.jsx) after the person has
// typed DELETE. The caller is identified by their Firebase ID token (requireCaller), so nobody
// can delete anyone else; the body must carry { confirm: "DELETE" } as well, so no stray request
// from an old client can do it by accident. What goes and what stays is in _deleteAccount.js.
//
// Sign in with Apple tokens are revoked on the device before this is called (src/accountDeletion.js)
// — that needs a fresh authorisation code from the Apple sheet, which only the device can get.

import Stripe from "stripe";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { getStorage } from "firebase-admin/storage";
import { cors, requireCaller } from "./_auth.js";
import { deleteAccountData, CONFIRM_WORD } from "./_deleteAccount.js";

// The app's own bucket (src/App.jsx firebaseConfig.storageBucket). Overridable for a staging project.
const BUCKET = process.env.FIREBASE_STORAGE_BUCKET || "uplift-6d9ea.firebasestorage.app";

export default async function handler(req, res) {
  if (!cors(req, res)) return;
  const uid = await requireCaller(req, res, "delete-account");
  if (!uid) return;
  if (req.body?.confirm !== CONFIRM_WORD) return res.status(400).json({ error: "confirm_required" });

  const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;
  try {
    const counts = await deleteAccountData({
      db: getFirestore(),
      uid,
      deleteAuthUser: (id) => getAuth().deleteUser(id),
      deleteStoragePrefix: (prefix) => getStorage().bucket(BUCKET).deleteFiles({ prefix }),
      cancelSubscription: stripe ? (id) => stripe.subscriptions.cancel(id) : null,
      log: (label, err) => console.error(`[delete-account] ${label}`, err?.code || err?.message),
    });
    console.log("[delete-account] done", uid.slice(0, 6), JSON.stringify(counts));
    return res.status(200).json({ ok: true, counts });
  } catch (err) {
    console.error("[delete-account] failed", err?.code || err?.message);
    return res.status(500).json({ error: "failed" });
  }
}
