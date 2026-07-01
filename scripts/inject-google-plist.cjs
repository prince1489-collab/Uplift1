/**
 * Injects GoogleService-Info.plist into the (CI-generated) Capacitor iOS project.
 *
 * The ios/ project is generated fresh on the Codemagic Mac (`npx cap add ios`), so we keep the
 * plist committed at ios-config/GoogleService-Info.plist and, after `cap sync`, (1) copy it into
 * ios/App/App/ and (2) add it as a resource in the Xcode project so it lands in the app bundle —
 * without which the native Firebase SDK cannot initialise on iOS.
 *
 * Run in CI:  npm i xcode --no-save && node scripts/inject-google-plist.cjs
 */
const fs = require("fs");
const path = require("path");

const SRC = "ios-config/GoogleService-Info.plist";
const APP_DIR = "ios/App/App";
const DEST = path.join(APP_DIR, "GoogleService-Info.plist");
const PROJ = "ios/App/App.xcodeproj/project.pbxproj";

if (!fs.existsSync(SRC)) {
  console.error(`[inject-google-plist] missing ${SRC}`);
  process.exit(1);
}
if (!fs.existsSync(APP_DIR)) {
  console.error(`[inject-google-plist] ${APP_DIR} not found — run "npx cap add ios" first.`);
  process.exit(1);
}

fs.copyFileSync(SRC, DEST);
console.log(`[inject-google-plist] copied plist → ${DEST}`);

const xcode = require("xcode");
const proj = xcode.project(PROJ);
proj.parseSync();

// Skip if a reference already exists (idempotent).
const refs = proj.pbxFileReferenceSection();
const already = Object.keys(refs).some(
  (k) => typeof refs[k] === "object" && String(refs[k].path || "").includes("GoogleService-Info.plist")
);

if (already) {
  console.log("[inject-google-plist] plist already referenced — nothing to do.");
} else {
  const groupKey = proj.findPBXGroupKey({ name: "App" }); // Capacitor app-sources group (maps to ios/App/App)
  proj.addResourceFile(
    "GoogleService-Info.plist",
    { target: proj.getFirstTarget().uuid },
    groupKey
  );
  fs.writeFileSync(PROJ, proj.writeSync());
  console.log("[inject-google-plist] registered plist in the Xcode project (App target resources).");
}
