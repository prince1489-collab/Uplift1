// test-device-owner.mjs — one account's data never shows up in another's on the same device (3.27).
//
//   node scripts/test-device-owner.mjs

import { claimDevice, releaseDevice, isPersonalKey, uidInKey, OWNER_KEY } from "../src/deviceOwner.js";

const results = [];
const check = (name, ok, detail = "") => results.push([ok, ok ? name : `${name} — ${detail}`]);

// A localStorage stand-in.
function store(init = {}) {
  const m = new Map(Object.entries(init));
  return {
    get length() { return m.size; },
    key: (i) => [...m.keys()][i] ?? null,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    has: (k) => m.has(k),
    keys: () => [...m.keys()],
  };
}

const ME = "AbCdEfGhIjKlMnOpQrStUvWxYz12";   // a Firebase-shaped uid (28)
const NEW = "ZyXwVuTsRqPoNmLkJiHgFeDcBa98";

// What the founder's phone held in the recording.
const founderPhone = () => store({
  "seen_hyt_state_2026-11-17": '{"seenCount":3,"reflected":{"answer":"Very nearly"}}',
  "seen_v2_follows": '[{"uid":"x","name":"Vidhi","label":"Family"}]',
  "seen_v2_points": "57330",
  "seen_card_feel": "{}",
  "seen_reflect_pin_2026-11-17": "Today you told Mahiman…",
  [`seen_pending_days_${ME}`]: "[]",
  [`seen_onboarded_${ME}`]: "1",
  [`seen_v2_follows_${ME}`]: "[]",
  "seen-theme": "dark",
  "seen_sound_on": "0",
  "seen_device_id_v1": "dev-1",
  "seen_intro_v1": "1",
  "seenEmailForSignIn": "a@b.c",
  "seen_update_dismissed_3.26": "1",
  "firebase:authUser:xyz:[DEFAULT]": "{…}",
});

// ── Which keys are personal ──
check("a uid is found inside a key", uidInKey(`seen_pending_days_${ME}`) === ME && uidInKey(`seen_react_v1_week_${ME}`) === ME);
check("dates and versions are not uids", uidInKey("seen_hyt_state_2026-11-17") === null && uidInKey("seen_update_dismissed_3.26") === null && uidInKey("seen_v2_points") === null);
check("today's acts, follows cache, points, journal pins are personal", ["seen_hyt_state_2026-11-17", "seen_v2_follows", "seen_v2_points", "seen_reflect_pin_2026-11-17", "seen_card_feel"].every(isPersonalKey));
check("device preferences are not", ["seen-theme", "seen_sound_on", "seen_device_id_v1", "seen_intro_v1", "seenEmailForSignIn", "seen_ref", "seen_update_dismissed_3.26", OWNER_KEY].every((k) => !isPersonalKey(k)));
check("an account's own keys are not (only ever read for that account)", !isPersonalKey(`seen_pending_days_${ME}`) && !isPersonalKey(`seen_v2_follows_${ME}`));
check("nothing that isn't Seen's is ever touched", !isPersonalKey("firebase:authUser:xyz:[DEFAULT]") && !isPersonalKey("other_app_key"));

// ── The recording: a new account on a phone with the founder's data, from before 3.27 ──
let s = founderPhone();
const r = claimDevice(NEW, s);
check("a new account over someone else's data clears it, and says so (the app restarts)", r.wiped === true && r.previous === null);
check("…their day, answers, follows, points and pins are gone", !s.has("seen_hyt_state_2026-11-17") && !s.has("seen_v2_follows") && !s.has("seen_v2_points") && !s.has("seen_reflect_pin_2026-11-17"));
check("…device preferences and sign-in plumbing stay", s.getItem("seen-theme") === "dark" && s.has("seen_device_id_v1") && s.has("seenEmailForSignIn") && s.has("seen_update_dismissed_3.26"));
check("…Firebase's own data stays", s.has("firebase:authUser:xyz:[DEFAULT]"));
check("…the device now belongs to the new account", s.getItem(OWNER_KEY) === NEW);
check("after the restart, the same account clears nothing (no restart loop)", claimDevice(NEW, s).wiped === false);

// ── The founder signing in on their own phone, before and after 3.27 ──
s = founderPhone();
check("the owner's own data from before 3.27 is kept", claimDevice(ME, s).wiped === false && s.has("seen_hyt_state_2026-11-17") && s.getItem(OWNER_KEY) === ME);
check("…and from then on it's recorded as theirs", claimDevice(ME, s).wiped === false && s.has("seen_v2_points"));
check("a different account later clears it", claimDevice(NEW, s).wiped === true && !s.has("seen_v2_points"));

// ── Signing out ──
s = founderPhone(); claimDevice(ME, s);
const n = releaseDevice(s);
check("signing out removes everything personal", n >= 5 && !s.has("seen_hyt_state_2026-11-17") && !s.has("seen_v2_points") && !s.has("seen_card_feel"));
check("…keeps preferences and the account's own unsaved days", s.has("seen-theme") && s.has(`seen_pending_days_${ME}`));
check("…and leaves the device owned by nobody", s.getItem(OWNER_KEY) === "");
// The welcome screens write a few keys while signed out; the next sign-in must not restart for them.
s.setItem("seen_visit_start", "123"); s.setItem("seen_last_active", "456");
const next = claimDevice(NEW, s);
check("the next account after a sign-out doesn't restart (sign-up isn't interrupted)", next.wiped === false && s.has("seen_visit_start") && s.getItem(OWNER_KEY) === NEW);

// ── No storage, blocked storage ──
check("no storage, no uid: nothing happens", claimDevice(null, s).wiped === false && claimDevice(NEW, null).wiped === false && releaseDevice(null) === 0);
const blocked = { get length() { throw new Error("blocked"); }, key() { throw new Error("blocked"); }, getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); }, removeItem() { throw new Error("blocked"); } };
check("blocked storage never throws and never restarts", claimDevice(NEW, blocked).wiped === false && releaseDevice(blocked) === 0);

let failed = 0;
for (const [ok, nme] of results) { console.log(`${ok ? "  ok  " : "  FAIL"}  ${nme}`); if (!ok) failed++; }
console.log(`\n  ${results.length - failed}/${results.length} device-owner tests passed.`);
process.exit(failed ? 1 : 0);
