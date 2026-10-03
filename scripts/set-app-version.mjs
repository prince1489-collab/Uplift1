// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.
//
// set-app-version.mjs — tell the installed apps which version is newest (meta/appVersion).
//
// Run after a release is LIVE in both stores (not before — the note would send people to a store
// page that still has the old version):
//
//   SEEN_SERVICE_ACCOUNT=/path/to/key.json node scripts/set-app-version.mjs 3.8
//   SEEN_SERVICE_ACCOUNT=… node scripts/set-app-version.mjs 3.8 --minimum 3.4
//   SEEN_SERVICE_ACCOUNT=… node scripts/set-app-version.mjs --ios-url https://apps.apple.com/app/id123456789
//   SEEN_SERVICE_ACCOUNT=… node scripts/set-app-version.mjs --show
//
// Phones older than `latest` see a dismissible "A new version of Seen is ready" line (once per
// version). Phones older than `minimum` see it without the close button. Nothing is ever blocked.

import { readFileSync } from "node:fs";

const args = process.argv.slice(2);
const flag = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const isVersion = (v) => /^\d+(\.\d+){1,2}$/.test(String(v || ""));

const { cert, initializeApp } = await import("firebase-admin/app");
const { getFirestore } = await import("firebase-admin/firestore");
const path = process.env.SEEN_SERVICE_ACCOUNT || process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (process.env.FIRESTORE_EMULATOR_HOST) initializeApp({ projectId: process.env.GCLOUD_PROJECT || "demo-seen" });
else if (path) initializeApp({ credential: cert(JSON.parse(readFileSync(path, "utf8"))) });
else { console.error("Set SEEN_SERVICE_ACCOUNT to the path of a service-account JSON file."); process.exit(1); }

const ref = getFirestore().collection("meta").doc("appVersion");
if (args.includes("--show")) { console.log((await ref.get()).data() || "(not set)"); process.exit(0); }

const patch = {};
const latest = args.find((a) => isVersion(a));
if (latest) patch.latest = latest;
if (flag("--minimum")) { if (!isVersion(flag("--minimum"))) { console.error("--minimum must look like 3.4"); process.exit(1); } patch.minimum = flag("--minimum"); }
if (flag("--ios-url")) patch.iosUrl = flag("--ios-url");
if (flag("--android-url")) patch.androidUrl = flag("--android-url");
if (!Object.keys(patch).length) { console.error("Nothing to set. Example: node scripts/set-app-version.mjs 3.8"); process.exit(1); }
patch.updatedAt = Date.now();
await ref.set(patch, { merge: true });
console.log("meta/appVersion is now:", (await ref.get()).data());
