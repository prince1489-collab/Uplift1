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
const PROJ = "ios/App/App.xcodeproj/project.pbxproj";
// The pbxproj file reference (added below) resolves relative to the group it lands in — observed to
// be ios/App/GoogleService-Info.plist. Copy the plist to BOTH the conventional App source folder and
// the project root so the build finds it wherever the reference points (bulletproof).
const DESTS = ["ios/App/App/GoogleService-Info.plist", "ios/App/GoogleService-Info.plist"];

if (!fs.existsSync(SRC)) {
  console.error(`[inject-google-plist] missing ${SRC}`);
  process.exit(1);
}
if (!fs.existsSync(APP_DIR)) {
  console.error(`[inject-google-plist] ${APP_DIR} not found — run "npx cap add ios" first.`);
  process.exit(1);
}

for (const dest of DESTS) {
  fs.copyFileSync(SRC, dest);
  console.log(`[inject-google-plist] copied plist → ${dest}`);
}

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
  // The xcode lib's addResourceFile() calls correctForResourcesPath(), which crashes with
  // "Cannot read properties of null (reading 'path')" when the project has no PBXGroup named
  // "Resources" — Capacitor projects don't have one. Create an empty one so the lookup succeeds.
  if (!proj.pbxGroupByName("Resources")) {
    proj.addPbxGroup([], "Resources", "Resources");
  }
  const groupKey = proj.findPBXGroupKey({ name: "App" }); // Capacitor app-sources group (maps to ios/App/App)
  proj.addResourceFile(
    "GoogleService-Info.plist",
    { target: proj.getFirstTarget().uuid },
    groupKey
  );
  fs.writeFileSync(PROJ, proj.writeSync());
  console.log("[inject-google-plist] registered plist in the Xcode project (App target resources).");
}

// ── Entitlements: push (aps-environment) + Sign in with Apple ──────────────────────
// The App ID (and provisioning profile) enable Push Notifications and Sign in with Apple, so the
// app binary must declare the matching entitlements — otherwise push won't deliver on iOS and the
// native Apple sheet errors. Write App.entitlements and point CODE_SIGN_ENTITLEMENTS at it (App
// target build configs only, so the Pods project is untouched).
const ENTITLEMENTS = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
\t<key>aps-environment</key>
\t<string>production</string>
\t<key>com.apple.developer.applesignin</key>
\t<array>
\t\t<string>Default</string>
\t</array>
</dict>
</plist>
`;
fs.writeFileSync(path.join(APP_DIR, "App.entitlements"), ENTITLEMENTS);
console.log("[inject-google-plist] wrote App.entitlements (push + Sign in with Apple).");

// Set CODE_SIGN_ENTITLEMENTS on the App target's build configurations only.
const proj2 = xcode.project(PROJ);
proj2.parseSync();
const firstTarget = proj2.getFirstTarget().firstTarget; // { buildConfigurationList, ... }
const cfgListKey = firstTarget.buildConfigurationList;
const cfgList = proj2.hash.project.objects.XCConfigurationList[cfgListKey];
const buildCfgs = proj2.hash.project.objects.XCBuildConfiguration;
let patched = 0;
for (const ref of cfgList.buildConfigurations) {
  const cfg = buildCfgs[ref.value];
  if (cfg && cfg.buildSettings) {
    cfg.buildSettings.CODE_SIGN_ENTITLEMENTS = '"App/App.entitlements"';
    // -ObjC: the @capacitor-firebase plugins ship as STATIC frameworks (static_framework = true,
    // required by the Firebase iOS SDK). Their @objc plugin classes are only discovered by Capacitor
    // at runtime via the ObjC runtime — nothing references them at link time, so without -ObjC the
    // linker dead-strips them from the static archive and Capacitor.isPluginAvailable(...) is false
    // (native sign-in fails with UNIMPLEMENTED). -ObjC forces all ObjC/@objc classes from static libs
    // to be loaded, so the plugins register.
    cfg.buildSettings.OTHER_LDFLAGS = '"$(inherited) -ObjC"';
    patched++;
  }
}
fs.writeFileSync(PROJ, proj2.writeSync());
console.log(`[inject-google-plist] set CODE_SIGN_ENTITLEMENTS + OTHER_LDFLAGS(-ObjC) on ${patched} App build config(s).`);
