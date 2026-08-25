// check-android-config.cjs — validate android-config/google-services.json before it costs a build.
//
// This file is inert-looking config that fails LATE. Download it before registering SHA-1
// fingerprints and everything still looks fine: it parses, the build goes green, the AAB uploads,
// and then Google sign-in does nothing on a real device with no error pointing back here. The
// same class of problem as the other check:* scripts in this folder, so it gets the same
// treatment — caught at `npm run check` rather than by a user.
//
// See android-config/README.md for how to produce the file correctly.

const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "..", "android-config", "google-services.json");
const PROJECT_ID = "uplift-6d9ea";   // the Firebase project this app belongs to
const PACKAGE = "app.seenapp.twa";   // the package Play already knows — must match exactly

// Absent is not an error. The file is legitimately missing until someone sets Firebase up, and
// `npm run check` must not fail for everyone in the meantime — the Codemagic inject step takes
// the same non-fatal stance.
if (!fs.existsSync(FILE)) {
  console.log("SKIP — android-config/google-services.json not present.");
  console.log("       Android Google sign-in and push will not work until it is. See android-config/README.md.");
  process.exit(0);
}

let cfg;
try {
  cfg = JSON.parse(fs.readFileSync(FILE, "utf8"));
} catch (err) {
  console.error(`google-services.json is not valid JSON: ${err.message}`);
  console.error("Re-download it from the Firebase console rather than editing it by hand.");
  process.exit(1);
}

// Wrong Firebase project — the app would talk to a database that knows nothing about it.
const projectId = cfg?.project_info?.project_id;
if (projectId !== PROJECT_ID) {
  console.error(`google-services.json is for project "${projectId}", expected "${PROJECT_ID}".`);
  console.error("It was downloaded from the wrong Firebase project.");
  process.exit(1);
}

// Wrong package — README.md is explicit that this must match the package Play already knows.
const client = (cfg.client || []).find(
  (c) => c?.client_info?.android_client_info?.package_name === PACKAGE
);
if (!client) {
  const found = (cfg.client || [])
    .map((c) => c?.client_info?.android_client_info?.package_name)
    .filter(Boolean);
  console.error(`google-services.json has no client for package "${PACKAGE}".`);
  console.error(`Packages present: ${found.length ? found.join(", ") : "(none)"}`);
  process.exit(1);
}

// THE POINT OF THIS SCRIPT.
//
// Firebase writes one oauth_client entry of client_type 1 per registered SHA-1 fingerprint. None
// means the file was downloaded BEFORE any fingerprint was added — the config looks complete and
// Google sign-in cannot work, because sign-in matches the certificate the app was signed with.
const androidOauth = (client.oauth_client || []).filter((o) => o?.client_type === 1);

if (androidOauth.length === 0) {
  console.error("google-services.json contains no Android OAuth clients (client_type 1).");
  console.error("No SHA-1 fingerprints were registered when this file was downloaded, so Google");
  console.error("sign-in will fail on device. Add BOTH fingerprints in the Firebase console");
  console.error("(Project settings -> Your apps -> Add fingerprint), then RE-DOWNLOAD the file —");
  console.error("the OAuth clients are baked in at download time.");
  process.exit(1);
}

// Two are expected: the upload key and Play App Signing's key. Only a warning, because a
// single-fingerprint setup is legitimate in some projects and this check should not be the thing
// that blocks a release on an inference.
if (androidOauth.length === 1) {
  console.log("WARNING — only one SHA-1 fingerprint is registered.");
  console.log("          Play App Signing re-signs installs with Google's key, so if the one");
  console.log("          registered is the upload key, sign-in will work in testing and fail for");
  console.log("          every real install. Both certificates are in Play Console -> App integrity.");
}

console.log(
  `OK — google-services.json: project ${projectId}, package ${PACKAGE}, ` +
  `${androidOauth.length} SHA-1 fingerprint${androidOauth.length === 1 ? "" : "s"} registered.`
);
