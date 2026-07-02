/**
 * Enables native Google sign-in for @capacitor-firebase/authentication on iOS WITHOUT switching the
 * pod to its `/Google` subspec.
 *
 * Why not the subspec: on-device diagnostics proved that
 *   pod 'CapacitorFirebaseAuthentication/Google'
 * stops the plugin class from registering with Capacitor (isPluginAvailable() === false → native
 * calls return UNIMPLEMENTED), while the plain `pod 'CapacitorFirebaseAuthentication'` line registers
 * fine (like the untouched FirebaseMessaging plugin). So we keep the default pod line and instead:
 *   1. add the GoogleSignIn pod (so `import GoogleSignIn` resolves), and
 *   2. define RGCFA_INCLUDE_GOOGLE on the plugin's pod target so its Google sign-in code
 *      (guarded by `#if RGCFA_INCLUDE_GOOGLE`) compiles in.
 * This is exactly what the /Google subspec does (GoogleSignIn dependency + the -D flag) — applied to
 * the registering default pod instead.
 *
 * Run in CI after `npx cap sync ios`, then re-run `pod install`.
 */
const fs = require("fs");

const PODFILE = "ios/App/Podfile";
let src = fs.readFileSync(PODFILE, "utf8");

// 1. Add the GoogleSignIn pod inside the App target (right after the capacitor_pods call).
if (!src.includes("pod 'GoogleSignIn'")) {
  src = src.replace(/(target 'App' do\r?\n\s*capacitor_pods)/, (m) => `${m}\n  pod 'GoogleSignIn', '~> 7.1'`);
}

// 2. Turn on RGCFA_INCLUDE_GOOGLE for the auth plugin's pod target inside the existing post_install
//    (injected right after the assertDeploymentTarget(installer) line so we don't add a 2nd hook).
if (!src.includes("RGCFA_INCLUDE_GOOGLE")) {
  src = src.replace(
    /(post_install do \|installer\|\r?\n\s*assertDeploymentTarget\(installer\))/,
    (m) =>
      `${m}
  installer.pods_project.targets.each do |t|
    if t.name == 'CapacitorFirebaseAuthentication'
      t.build_configurations.each do |c|
        c.build_settings['OTHER_SWIFT_FLAGS'] = '$(inherited) -DRGCFA_INCLUDE_GOOGLE'
      end
    end
  end`
  );
}

fs.writeFileSync(PODFILE, src);
const okPod = src.includes("pod 'GoogleSignIn'");
const okFlag = src.includes("RGCFA_INCLUDE_GOOGLE");
console.log(`[enable-google-signin] GoogleSignIn pod: ${okPod ? "added" : "MISSING"}; RGCFA_INCLUDE_GOOGLE flag: ${okFlag ? "added" : "MISSING"}.`);
if (!okPod || !okFlag) process.exit(1);
