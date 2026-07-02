/**
 * Enables native Google sign-in for @capacitor-firebase/authentication on iOS by patching the
 * plugin's PODSPEC (run once, right after `npm ci`, before `npx cap add/sync ios`).
 *
 * Why this and not the /Google subspec: on-device diagnostics proved that using
 *   pod 'CapacitorFirebaseAuthentication/Google'
 * stops the plugin class from registering with Capacitor (isPluginAvailable() === false → native
 * calls return UNIMPLEMENTED). The plain default pod line registers fine (Apple sign-in works). But
 * the default build omits Google (its code is behind `#if RGCFA_INCLUDE_GOOGLE` and needs the
 * GoogleSignIn module), so `import GoogleSignIn` fails to compile.
 *
 * So we add Google's two ingredients to the ROOT spec — which the DEFAULT pod inherits — so the
 * registering default build also compiles Google in, resolved together with Firebase in ONE pod
 * install pass:
 *   1. s.dependency 'GoogleSignIn' — makes the module importable BY THE PLUGIN'S OWN pod target.
 *   2. -DRGCFA_INCLUDE_GOOGLE on the pod target — turns on the plugin's #if-guarded Google code.
 */
const fs = require("fs");

const PODSPEC = "node_modules/@capacitor-firebase/authentication/CapacitorFirebaseAuthentication.podspec";
// Unique marker — NOT "RGCFA_INCLUDE_GOOGLE" (that already exists inside the unused Google subspec,
// so guarding on it would skip the patch and silently do nothing).
const MARKER = "SEEN_GOOGLE_ROOT_ENABLED";

let src = fs.readFileSync(PODSPEC, "utf8");

if (!src.includes(MARKER)) {
  if (!/s\.static_framework\s*=\s*true/.test(src)) {
    console.error("[enable-google-signin] anchor 's.static_framework = true' not found in podspec");
    process.exit(1);
  }
  src = src.replace(
    /(s\.static_framework\s*=\s*true)/,
    (m) =>
      `${m}\n` +
      `  # ${MARKER}\n` +
      `  s.dependency 'GoogleSignIn', '7.1.0'\n` +
      `  s.pod_target_xcconfig = { 'OTHER_SWIFT_FLAGS' => '$(inherited) -DRGCFA_INCLUDE_GOOGLE' }`
  );
  fs.writeFileSync(PODSPEC, src);
}

const out = fs.readFileSync(PODSPEC, "utf8");
const ok = out.includes(MARKER);
console.log(`[enable-google-signin] root GoogleSignIn dep + RGCFA_INCLUDE_GOOGLE flag: ${ok ? "added" : "MISSING"}.`);
if (!ok) process.exit(1);
