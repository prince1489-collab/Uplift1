# Submitting Seen to Google Play

Everything the Play Console asks for, answered from the code rather than from memory. Written
for the **production release of the TWA** (`app.seenapp.twa`), which is the fastest route to
being live. The Capacitor migration is a separate job — see the note at the end.

Line references are to the code as of this document. If an answer here disagrees with the app,
the app is right and this file needs updating.

---

## 0. What actually ships

**No build is required.** A TWA is a shell that opens `seenapp.app` in Chrome — the AAB is a
pointer, not a snapshot. Bundle **versionCode 1** already in the library is the whole artifact,
and the app's real content is whatever Vercel has deployed.

So: *Production → Create new release → Add from library → bundle 1*.

**Before you promote, confirm Vercel has deployed the current branch.** That deploy is the
release. Promoting the bundle while an older build is live ships the older app.

---

## 1. App access

Seen shows nothing without an account, so reviewers cannot see the app without credentials.
Provide the tester account under *App access → All functionality is restricted*.

Include:
- email and password
- any steps needed to reach the age gate (a DOB making the account 18+, so nothing is hidden)

Verify the account signs in **from a clean browser session** before submitting. A reviewer who
cannot get in files a rejection, and this is the most common avoidable one.

---

## 2. Data safety

The form asks, per data type: is it **collected**, is it **shared**, is it **required**, and
**why**. Answers below are derived from the actual Firestore writes and API calls.

### Blanket answers

| Question | Answer | Why |
|---|---|---|
| Encrypted in transit | **Yes** | All traffic is HTTPS; Firestore and the `/api/*` endpoints are TLS-only |
| Users can request deletion | **Yes** | `public/delete-account.html`, linked in-app at `App.jsx:406` |
| Data collected is required or optional | Mixed — see below | |
| Committed to Play Families policy | **No** | 13+ app; onboarding blocks under-13 (`App.jsx:1156`) |

### Collected

**Personal info**

| Type | Collected | Required | Purpose | Notes |
|---|---|---|---|---|
| Name | Yes | Required | App functionality, Account management | `fullName`; public in-app — it is mirrored to `publicProfiles` (`publicProfile.js:22`) so people can be found by name |
| Email address | Yes | Required | Account management | From Firebase Auth |
| User IDs | Yes | Required | App functionality, Account management | Firebase `uid` |
| Other info | Yes | Required | App functionality | **Date of birth** (`dob`) — used for the 13+ gate and to age-band Practice areas (`hytPrompts.js:867`); **country** — self-selected, shown beside your messages |

**Messages**

| Type | Collected | Required | Purpose | Notes |
|---|---|---|---|---|
| Other in-app messages | Yes | Optional | App functionality | `publicMessages`, `privateReplies`, `sharedReflections`, `greetingSubmissions`, and journal entries at `users/{uid}/journal` |

Not ephemeral — these are stored. See §2.1 on the moderation call.

**Photos and videos**

| Type | Collected | Required | Purpose | Notes |
|---|---|---|---|---|
| Photos | Yes | Optional | App functionality, Personalisation | Profile photo, stored as a base64 data URL on the profile (`ProfilePhotoStep.jsx:7`), mirrored to `publicProfiles` |

**App activity**

| Type | Collected | Required | Purpose | Notes |
|---|---|---|---|---|
| App interactions | Yes | Optional | App functionality | Reactions, waves, likes, follows, streaks, presence heartbeat (`UpliftRetentionFeatures.jsx:673`) |
| Other user-generated content | Yes | Optional | App functionality | Journal reflections |

**Device or other IDs**

| Type | Collected | Required | Purpose | Notes |
|---|---|---|---|---|
| Device or other IDs | Yes | Optional | App functionality | FCM registration token in `users/{uid}.fcmToken`, for notifications only |

**Health and fitness — a judgement call, and I'd declare it**

The wellbeing check-in writes `wellbeing` and `wellbeingAt` to the profile. The app is careful
to say it is *"not a medical test"* (`App.jsx:3282`), and it is a self-reported mood reflection
rather than clinical data — so a "No" here is arguable.

**Declare it as Health info anyway.** Over-declaring costs one line in your listing.
Under-declaring is what triggers enforcement, and "we decided our mood tracker wasn't health
data" is not a position worth defending later.

### NOT collected — say No to all of these

- **Location** (precise *or* approximate). There is no `navigator.geolocation` call anywhere.
  Country is self-selected, and the globe's coordinates come from a static lookup table
  (`WorldMap.jsx:162`). This is the most commonly over-declared item on the form.
- **Financial info.** There is no reachable purchase path — see §5.
- **In-app search history.** Name search queries Firestore live; nothing is stored.
- **Crash logs / diagnostics / performance.** No crash reporter, no analytics SDK, no tag
  manager. Verified by grep across `src/`, `index.html` and `api/`.
- **Contacts, calendar, files, audio, web browsing history, installed apps.**
- **Race, ethnicity, political or religious beliefs, sexual orientation.**

### 2.1 Sharing — answer "No", and here is why

Message text is sent to **Anthropic** for the kindness check (`api/moderate-message.js:106`)
and for phrasing suggestions (`api/post-suggest.js:57`). Firebase, Vercel and Anthropic are all
**service providers processing on your behalf**, which under Play's definitions is *processing*,
not *sharing with a third party*.

Two things follow:
1. Answer **No** to "shared" for every data type.
2. Make sure your privacy policy discloses the third-party moderation processing. That is a
   privacy-policy obligation regardless of how the Data safety form classifies it.

Note also that names, countries, photos and public messages are visible **to other users** in
the app. That is not "sharing with third parties" for this form — but it must be plain in the
privacy policy, because it is the thing users most need to understand.

---

## 3. Content rating

Category: **Social Networking / Communication**.

| Question | Answer |
|---|---|
| Users can interact or exchange content | **Yes** |
| Users can share content with others | **Yes** |
| Users can share their physical location with others | **No** — country only, self-selected, never device location |
| Violence, sexual content, profanity, drugs, gambling, crude humour | **No** |
| In-app purchases | **No** |
| Contains ads | **No** |

Expect Teen / PEGI 12 or equivalent — user interaction alone drives that, and it is normal for
a social app. Do not try to argue it down.

The questionnaire will ask about moderation. You have real answers: server-side screening that
**fails closed** (nothing publishes without a clean verdict), in-app reporting
(`ReportBlockBar`, `UpliftRetentionFeatures.jsx:110`), blocking with a management screen
(`BlockedAccountsPanel`, `App.jsx:473`), and an admin moderation queue (`ModerationQueue.jsx`).

---

## 4. Target audience and content

- **Age groups**: 13–15, 16–17, 18+. **Do not tick any band under 13** — onboarding rejects
  under-13s outright (`App.jsx:1240`), so claiming otherwise would be false and would drag you
  into the Families programme.
- **Appeals to children**: No.
- **Child Safety Standards**: **required** — this applies to social apps, and you already have
  `public/child-safety.html`. Fill the form and give them that URL.

---

## 5. In-app purchases — declare "No"

Worth stating clearly because the code contains a Stripe integration that looks live and is not.

`payments.js` exports `startCheckout`, and `PremiumUpgradePrompt` wires a $3.99/mo button to it
(`UpliftRetentionFeatures.jsx:1367`). **That component can never render.** It is gated on
`showUpgrade` (`App.jsx:3236`), and all three callers are dead:

- `MeatballMenu` and `QuickReactBar` receive `onUpgrade` but never call it
- `GreetingPicker` calls it only when `locked` is true — which is `cat.isPremium && !isPremium`,
  and its local `isPremium` is hardcoded `true` (`App.jsx:1262`)
- the app-wide `isPremium` is hardcoded `true` — *"all features free — grow the user base"*
  (`App.jsx:2728`)

Sparks/drops are earned by sending greetings and spent in-app (`buyFreeze` debits `sparkBalance`,
`UpliftRetentionFeatures.jsx:251`). No real money changes hands anywhere.

So: **no IAP, no Play Billing, no external-payments disclosure.**

⚠️ **If Premium is ever switched on, this changes completely.** Digital goods sold in an Android
app must use Google Play Billing. Re-enabling `isPremium` without doing that is a policy
violation and risks the developer account, not just the release.

---

## 6. Store listing

Assets already in `public/` and `scratchpad/`:

- Icon 512×512 — `seen_icon_512.png`
- Feature graphic 1024×500 — `seen_feature_1024x500.png`
- Still needed: **at least 2 phone screenshots** (min 320px on the short side). Four to six is
  better — lead with the feed, then Reflect, Practice and the globe.

Fields:

| Field | Value |
|---|---|
| App name | Seen |
| Category | Social |
| Contact email | mahiman@seenapp.app (verified) |
| Website | https://www.seenapp.app/ (verified) |
| Privacy policy | https://www.seenapp.app/privacy.html |

Write the short description around what the app *is*, not what it aspires to. Avoid superlatives
and any claim of health benefit — a wellbeing claim invites the health-app policy questions you
otherwise sidestep entirely.

---

## 7. Remaining declarations

| Declaration | Answer |
|---|---|
| Ads | No ads |
| Advertising ID permission | Not used |
| News app | No |
| Government app | No |
| Financial features | No |
| Health apps | No — Social category; the wellbeing check-in is self-reflection, not medical |
| Data safety | §2 |
| Content rating | §3 |
| Target audience | §4 |
| App access | §1 |

---

## 8. Order of operations

1. Confirm Vercel has deployed the current branch — **that deploy is the release**.
2. App access: tester credentials, verified from a clean session.
3. Data safety (§2), Content rating (§3), Target audience + Child Safety (§4).
4. Store listing: screenshots, descriptions, graphics.
5. Production → Create new release → Add from library → bundle 1 → roll out.

Your organisation account (SEENAPP LTD) is not subject to the 12-testers-for-14-days rule, which
is why production is reachable directly.

---

## 9. Afterwards: the Capacitor migration

Not required to ship, and **not currently safe to ship**. Every native path is gated on
`isNativeIOS()` — `Capacitor.getPlatform() === "ios"` (`nativePush.js:16`). On an Android
Capacitor build:

- push never registers (`nativePush.js:26` returns early), so `google-services.json` alone
  does not fix notifications — the messaging plugin is never called on Android at all
- Google sign-in falls through to `signInWithPopup` (`App.jsx:2630`), and Google blocks OAuth
  inside embedded webviews — which is precisely why the iOS native path exists
- auth init keeps the popup/redirect resolver (`App.jsx:102`), the thing the iOS comment says
  *"stalls auth init… the app hangs on the loading spinner"*

The TWA never hit any of this because a TWA is Chrome, not a WebView.

Before attempting it: generalise `isNativeIOS()` to cover Android across auth init, Google
sign-in, Apple sign-in and push; confirm Firebase authorised domains accept the Capacitor
origin; then test on a real device via **internal testing** before promoting anything.

Also note: moving to Capacitor changes the storage origin, so device-local state does not carry
over. The Kindness Tree resets — points are localStorage-only and explicitly never written to
Firestore (`points.js:4`) — along with Practice history and local posts. At the current install
base (≤100) that is acceptable; at scale it would need a migration shipped to the TWA *first*.
