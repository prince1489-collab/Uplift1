// check-privacy.cjs — guards the users/publicProfiles split.
//
// `users/{uid}` holds email, date of birth, WHO-5 wellbeing scores, the FCM push token and
// the timezone. firestore.rules restricts reads to the owner (plus admin). That means any
// code path that reads ANOTHER member's `users` document is now a silent runtime failure —
// the read is denied, the catch swallows it, and a name renders as "Someone" forever.
//
// This is exactly the class of bug that does not show up in a build or a lint, so it gets
// its own check. Cross-user profile reads must go through readPublicProfile().
//
// Run: node scripts/check-privacy.cjs

const fs = require("fs");
const path = require("path");

const SRC = path.join(__dirname, "..", "src");

// Reading your own document is fine, but only the EXPLICIT forms count as self-scoped.
// A bare `uid` is deliberately not on this list: it means "me" in Journal and KindnessBoard
// and "them" in UserGlimpse, so accepting it let a real regression through when this check
// was first tested. If a read is genuinely of your own document, say so at the call site.
const SELF = /^(currentUser\??\.uid|user\??\.uid|myUid|auth\.currentUser\.uid)$/;

// Subcollections under users/{uid}/… have their own rules and their own owner checks; this
// check is about the profile document itself.
const PROFILE_READ = /(?:getDoc|tx\.get)\(\s*doc\(\s*db\s*,\s*"users"\s*,\s*([^),]+)\)\s*\)/g;
const COLLECTION_READ = /getDocs\(\s*collection\(\s*db\s*,\s*"users"\s*\)\s*\)/g;

const problems = [];

for (const file of fs.readdirSync(SRC)) {
  if (!/\.(js|jsx)$/.test(file)) continue;
  if (file === "publicProfile.js") continue; // the one legitimate reader (own doc, for backfill)
  const full = path.join(SRC, file);
  const src = fs.readFileSync(full, "utf8");

  for (const m of src.matchAll(PROFILE_READ)) {
    const arg = m[1].trim();
    if (SELF.test(arg)) continue;
    const line = src.slice(0, m.index).split("\n").length;
    problems.push(`${file}:${line} reads users/${arg} — use readPublicProfile() instead`);
  }
  for (const m of src.matchAll(COLLECTION_READ)) {
    const line = src.slice(0, m.index).split("\n").length;
    // The admin console legitimately lists users (the rule permits it via isAdmin()), so
    // look back to the enclosing function declaration rather than a fixed number of
    // characters — the admin reset walks several collections before reaching this one.
    const before = src.slice(0, m.index);
    const fnStart = Math.max(
      before.lastIndexOf("const handle"),
      before.lastIndexOf("async function"),
      before.lastIndexOf("function ")
    );
    const enclosing = fnStart === -1 ? "" : before.slice(fnStart);
    if (/Admin|adminClear|ADMIN_EMAIL|FullReset|ClearAll/i.test(enclosing)) continue;
    problems.push(`${file}:${line} lists the whole users collection outside an admin path`);
  }
}

if (problems.length) {
  console.error(`${problems.length} cross-user profile read(s) that the rules will now deny:`);
  problems.forEach((p) => console.error("  " + p));
  process.exit(1);
}

// The rules themselves must still say what this check assumes.
const rules = fs.readFileSync(path.join(__dirname, "..", "firestore.rules"), "utf8");
const usersBlock = rules.slice(rules.indexOf("match /users/{userId}"));
const usersRead = usersBlock.slice(0, usersBlock.indexOf("allow create"));
if (/allow read: if request\.auth != null;/.test(usersRead)) {
  console.error("firestore.rules: users/{userId} is world-readable again — the split is undone.");
  process.exit(1);
}
if (!/match \/publicProfiles\/\{uid\}/.test(rules)) {
  console.error("firestore.rules: no publicProfiles rule — reads will be denied for everyone.");
  process.exit(1);
}

console.log("OK — no cross-user reads of users/{uid}; rules keep it owner-only.");
