# Deploying

Three things ship independently, and forgetting the second is how the app broke for a week.

| what | where it goes | how |
|---|---|---|
| the web app | Vercel | push to `claude/improve-app-design-HJrCm` |
| Firestore rules + indexes | Firebase | push the same branch — automatic, see below |
| iOS / Android | Codemagic | push triggers both workflows |

**None of this needs a machine you can install things on.** Everything here can be done from a
browser. That is deliberate: the person deploying this app works on a locked-down laptop, and
every procedure that assumed otherwise is what went undone.

## Firestore rules and indexes

`firestore.rules` and `firestore.indexes.json` live in this repo, and until recently the repo
had no connection to Firebase at all — they only reached the server if a human remembered to
run a command from a checkout. That gap caused three separate failures:

- Rules went **24 days** without being deployed. Private replies, shared reflections and
  public profiles were all denied, and the app told users to check their connection.
- Indexes had never been declared at all. A query would fail on the server while the local
  cache made it look like it had briefly worked — the symptom was a received reply appearing
  for a second and then vanishing.
- The `follows` rule shipped and **following silently failed** until someone published it by
  hand.

The common cause was never carelessness; it was that deploying sat outside the thing that
ships. So it moved inside.

### How it deploys now: automatically

`.github/workflows/firestore.yml` publishes rules and indexes on every push to `main` or
`claude/improve-app-design-HJrCm` that touches `firestore.rules`, `firestore.indexes.json` or
`firebase.json`. Change the rules, push, done.

It runs `npm run check:rules` **before** touching Firebase, so a rules file missing a
collection the app writes fails the job instead of shipping.

It deliberately does **not** pass `--force`. If a deploy would DELETE an index the job fails
loudly rather than destroying it quietly — a dropped index is a query that breaks in production
and looks like data vanishing.

**To deploy without pushing anything:** GitHub → **Actions** → *Deploy Firestore rules and
indexes* → **Run workflow**. That button is the entire procedure, in a browser.

> One Firebase project, so there is no staging. A rules change on the working branch reaches
> live users immediately — the same as already happens via Vercel for that branch, but worth
> knowing that this branch is production for rules too.

### One-time setup (browser only)

The workflow needs a `FIREBASE_SERVICE_ACCOUNT` repository secret. Once, ever:

1. **Create the account.** Firebase Console → ⚙ **Project settings** → **Service accounts** →
   *Manage service account permissions* (opens Google Cloud IAM) → **Create service account**.
   Name it `github-firestore-deploy`.
2. **Grant three roles:** `Firebase Rules Admin`, `Cloud Datastore Index Admin`, and
   **`Service Usage Viewer`**.

   The third one is not obvious and this cost a real detour. Before deploying anything,
   `firebase-tools` prints *"ensuring required API firestore.googleapis.com is enabled…"* and
   asks the Service Usage API whether that API is on. An account without read access there gets:

   ```
   Request to https://serviceusage.googleapis.com/v1/projects/<project>/services/
   firestore.googleapis.com had HTTP Error: 403, Permission denied to get service
   ```

   which reads like a Firestore permission problem and is not one — the deploy never reaches
   Firestore. `Service Usage Viewer` grants `serviceusage.services.get` and nothing else; it
   cannot enable or disable anything, and it cannot read a single document. `Service Usage
   Consumer` also works and is slightly broader.

   If a deploy later fails on permissions in some *other* way, `Firebase Develop Admin` is the
   broad fallback — but prefer adding the specific role the error names. The whole point of a
   scoped account is that a key sitting in a public repo cannot read your users' journals.
3. **Create a JSON key:** the account's **Keys** tab → *Add key* → *Create new key* → JSON.
4. **Store it:** repo → **Settings** → **Secrets and variables** → **Actions** → **New
   repository secret**, named exactly `FIREBASE_SERVICE_ACCOUNT`, value = the whole JSON file.
   Then delete the download.

There is a faster one-click route — Project settings → Service accounts → *Generate new private
key* — but that key carries broad project-wide rights and will sit in GitHub indefinitely. The
two-role account is worth three extra clicks. (Workload Identity Federation avoids the
long-lived key entirely; more setup than this project warrants.)

Authentication uses `google-github-actions/auth`, which exports
`GOOGLE_APPLICATION_CREDENTIALS` for `firebase-tools` to read. No `firebase login:ci` token —
generating one would itself need a CLI, which is the problem being removed.

## Publishing rules by hand, from a browser

Needed if the Action isn't set up yet, or something urgent has to go out now. You do **not**
need the file on your machine.

### 0. Check you would not overwrite something newer

Firebase Console → **Firestore Database** → **Rules** → look at *Last published*. If it is
**newer** than the last commit touching `firestore.rules` (`git log -1 -- firestore.rules`),
someone edited rules directly in the console and those edits exist nowhere else. Reconcile them
into the repo first; pasting over them loses them silently.

### 1. Copy the file out of GitHub

Repo on github.com → branch **`claude/improve-app-design-HJrCm`** → **`firestore.rules`** →
the **Copy raw file** button (clipboard icon, top right).

Use that button, not a mouse drag-select. A drag-select is how a paste ends up truncated, and
the newest rules are at the *end* of the file — so a truncated paste silently drops exactly the
ones you were trying to publish.

### 2. Publish

Firebase Console → project **`uplift-6d9ea`** → **Build** → **Firestore Database** → **Rules**
→ click in the editor → select all (Ctrl+A) → paste → **Publish**.

### 3. Verify it took

This is the step that has silently failed before. In the console editor, Ctrl+F for each:

| search for | should exist |
|---|---|
| `match /follows/` | follows persisting across devices |
| `match /referrals/` | referral rewards |
| `match /kindMoments/` | broadcast kind interactions |
| `match /publicProfiles/` | search-to-follow |

Then confirm the text **ends** with the `match /meta/{docId}` block and two closing braces.

Finally, exercise the rule rather than trusting the editor: follow someone, hard-refresh, and
confirm they are still followed.

### "I can't find collection X"

Two different screens, and the difference matters:

- **Rules** tab — plain text. Ctrl+F is authoritative here. If a block is missing after
  publishing, the paste was incomplete.
- **Data** tab — a collection only appears once it contains a document. `kindMoments` is only
  written when two members have a private interaction, so an empty project shows no such
  collection. **That is expected, not a missing rule.**

## Indexes

Firebase Console → **Firestore Database** → **Indexes** → **Composite**. These three must exist
and read *Enabled*, not *Building*:

| collection | fields |
|---|---|
| `privateReplies` | `toUid` ASC, `ts` DESC |
| `publicMessages` | `uid` ASC, `timestamp` DESC |
| `publicMessages` | `country` ASC, `timestamp` DESC |

Missing ones can be added with **Create index** using exactly those fields. Indexes take a few
minutes to build, and queries needing one keep failing until it says Enabled — a missing index
is the "reply appears for a second then vanishes" symptom, because the listener serves the
local cache before the server rejects the query.

A range filter and an `orderBy` on the *same* field need no composite index; Firestore creates
single-field indexes automatically. That is why the 30-day feed window costs nothing.

## Storage rules

`storage.rules` covers the bucket that holds profile photos. It is **not** deployed by the
GitHub Action or by `npm run deploy:firestore` — both pass `--only firestore` — so it will not
go out by accident, and it has to be published deliberately, once:

```
npm run deploy:storage
```

### Read this before the first time you run it

That command **overwrites whatever the Firebase console currently says**, and unlike Firestore
there is no committed history of what that was — the rules have only ever existed in the
console. So before the first deploy:

1. Firebase Console → **Storage** → **Rules**. Read what is there now and note the *Last
   published* date, exactly as for Firestore rules above.
2. If it says anything other than owner-scoped access to `profilePhotos/{uid}/…`, **copy it
   somewhere first**. Reverting needs a copy; there is nothing to roll back to.
3. Compare it with `storage.rules`. If the console is broader — the Firebase default is
   `allow read, write: if request.auth != null`, which lets any signed-in user overwrite
   anyone else's avatar — then deploying is a straight improvement and the only thing that
   changes for real users is that files over 2MB and non-images are refused.
4. If the console is *narrower* in some way this repo does not know about, say so before
   deploying rather than after; the file is the thing to change, not the console, or the next
   deploy silently undoes it again.

### Verify it took

Console → **Storage** → **Rules** should show the new text and a fresh *Last published*. Then
set a profile photo from the app to confirm a normal upload still works, and try a file over
2MB to confirm it is refused with a message about the file rather than a permissions error.

## GIFs — getting a KLIPY app key

GIF search needs `VITE_KLIPY_KEY`. Without it the composer simply hides the "Add a GIF" button,
so the app works fine until you set it.

### Why KLIPY and not Tenor

This was written for Tenor first, and that was wrong. **Google closed the Tenor API to new
clients on 13 January 2026 and shut the public API down entirely on 30 June 2026.** Searching the
Google Cloud API Library for "Tenor" now returns nothing because there is nothing to return; X,
Discord, WhatsApp and Bluesky all had to migrate off it.

KLIPY is where that migration went — built by the ex-Tenor founders and engineering team as a
near drop-in replacement, with a lifetime-free tier. WhatsApp is replacing Tenor with it, and it
already backs Canva, Figma, Miro and Outlook.

### Get the key

Nothing to do with Google Cloud. At **[partner.klipy.com](https://partner.klipy.com)**:

1. Create an account → **Add Platform** → generate an app key.
2. Add it in **two places**, because two systems build the bundle and Vite bakes `VITE_`
   variables in at build time:
   - **Vercel** → Environment Variables → `VITE_KLIPY_KEY`, type **Config** (not Secret — it
     ships in a public bundle either way), Preview + Production. Then **redeploy**: setting it
     without a new build changes nothing.
   - **Codemagic** → Environment variables → group **`seen_web`** → `VITE_KLIPY_KEY`, same
     value, not secure. `codemagic.yaml` already references that group in both workflows.

   Setting it in Vercel only gives you GIFs on the web and no GIF button at all on iOS and
   Android, with nothing in any log to explain it.

The free tier's test key allows **100 calls an hour**, and a production key is requested from the
same panel. One call is one sheet-open or one search, so 100/hour is comfortable for testing and
a small group, and is the first thing to outgrow.

### About the key being public

It ships in the bundle, deliberately — `src/klipy.js` explains why a proxy route would be a 13th
serverless function and fail the Vercel build. A KLIPY app key reaches KLIPY and nothing else.

Worth saying because the Tenor version of these instructions had a real hazard that this one does
not: a **Google Cloud** key minted in `uplift-6d9ea` would, without API restrictions, have been
usable against Firestore, Identity Toolkit, FCM and the Play Developer API — every API-key-
accepting service enabled on that project. None of that applies here. There is no Google Cloud
key, no API restriction to set, and no connection to the Firebase project at all.

### Two things to check in the Partner Panel

1. **Content filter.** The app requests `content_filter=high` on every call, which is a constant
   in `src/klipy.js` so no call site can loosen it — KLIPY defaults to *medium*, so leaving it
   out would be a choice rather than a neutral omission. If the panel also exposes an
   account-level filter or a blocked-keyword list, set those to the strictest available too.
   This is a 13+ app and the entire safety argument for GIFs is that someone else rated the
   catalogue and we asked for the safest tier.
2. **Advertisements — leave the Ads API OFF.** When creating a key, KLIPY offers *"Want to
   start earning? Enable the Ads API"* as a toggle, off by default. Leave it off. With it on,
   sponsored items are interleaved into results as `type: "ad"`, which would put adverts inside
   the compose flow of a wellbeing app used by 13-year-olds.

   (An earlier version of this file said ads were inherent to the free tier and warned that
   filtering them might breach the terms. That was wrong — they are opt-in. `src/klipy.js`
   still drops `type: "ad"` items, but as a second line of defence: the toggle lives in a web
   console rather than in this repo, so it could be switched on years from now without anyone
   seeing the code.)

### The URL pin

`firestore.rules` pins the stored GIF URL to `*.klipy.com`, so a client cannot write an arbitrary
URL into the feed — a tracking pixel that fires for every viewer, a host that logs the IP of
everyone who follows you, or an image swapped for something else after it was seen.

Confirmed working in production: a real GIF attached and rendered, which it could not have done
if the rule had refused the write.

It is deliberately the registrable domain rather than one exact CDN subdomain. A CDN may answer
from `media1`, `media2`, `cdn` or anything else on a given day, and narrowing within a domain
KLIPY already controls entirely would protect against nobody while risking attachments that fail
intermittently and look like a bug in the picker.

### Verify it took

Console → **Storage** → **Rules** should show the new text and a fresh *Last published*. Then
set a profile photo from the app to confirm a normal upload still works, and try a file over
2MB to confirm it is refused with a message about the file rather than a permissions error.

## GIFs — getting a KLIPY app key

GIF search needs `VITE_KLIPY_KEY`. Without it the composer simply hides the "Add a GIF" button,
so the app works fine until you set it.

### Why KLIPY and not Tenor

This was written for Tenor first, and that was wrong. **Google closed the Tenor API to new
clients on 13 January 2026 and shut the public API down entirely on 30 June 2026.** Searching the
Google Cloud API Library for "Tenor" now returns nothing because there is nothing to return; X,
Discord, WhatsApp and Bluesky all had to migrate off it.

KLIPY is where that migration went — built by the ex-Tenor founders and engineering team as a
near drop-in replacement, with a lifetime-free tier. WhatsApp is replacing Tenor with it, and it
already backs Canva, Figma, Miro and Outlook.

### Get the key

Nothing to do with Google Cloud. At **[partner.klipy.com](https://partner.klipy.com)**:

1. Create an account → **Add Platform** → generate an app key.
2. Add it in **two places**, because two systems build the bundle and Vite bakes `VITE_`
   variables in at build time:
   - **Vercel** → Environment Variables → `VITE_KLIPY_KEY`, type **Config** (not Secret — it
     ships in a public bundle either way), Preview + Production. Then **redeploy**: setting it
     without a new build changes nothing.
   - **Codemagic** → Environment variables → group **`seen_web`** → `VITE_KLIPY_KEY`, same
     value, not secure. `codemagic.yaml` already references that group in both workflows.

   Setting it in Vercel only gives you GIFs on the web and no GIF button at all on iOS and
   Android, with nothing in any log to explain it.

The free tier's test key allows **100 calls an hour**, and a production key is requested from the
same panel. One call is one sheet-open or one search, so 100/hour is comfortable for testing and
a small group, and is the first thing to outgrow.

### About the key being public

It ships in the bundle, deliberately — `src/klipy.js` explains why a proxy route would be a 13th
serverless function and fail the Vercel build. A KLIPY app key reaches KLIPY and nothing else.

Worth saying because the Tenor version of these instructions had a real hazard that this one does
not: a **Google Cloud** key minted in `uplift-6d9ea` would, without API restrictions, have been
usable against Firestore, Identity Toolkit, FCM and the Play Developer API — every API-key-
accepting service enabled on that project. None of that applies here. There is no Google Cloud
key, no API restriction to set, and no connection to the Firebase project at all.

### Two things to check in the Partner Panel

1. **Content filter.** The app requests `content_filter=high` on every call, which is a constant
   in `src/klipy.js` so no call site can loosen it — KLIPY defaults to *medium*, so leaving it
   out would be a choice rather than a neutral omission. If the panel also exposes an
   account-level filter or a blocked-keyword list, set those to the strictest available too.
   This is a 13+ app and the entire safety argument for GIFs is that someone else rated the
   catalogue and we asked for the safest tier.
2. **Advertisements — leave the Ads API OFF.** When creating a key, KLIPY offers *"Want to
   start earning? Enable the Ads API"* as a toggle, off by default. Leave it off. With it on,
   sponsored items are interleaved into results as `type: "ad"`, which would put adverts inside
   the compose flow of a wellbeing app used by 13-year-olds.

   (An earlier version of this file said ads were inherent to the free tier and warned that
   filtering them might breach the terms. That was wrong — they are opt-in. `src/klipy.js`
   still drops `type: "ad"` items, but as a second line of defence: the toggle lives in a web
   console rather than in this repo, so it could be switched on years from now without anyone
   seeing the code.)

### The one unconfirmed thing

`firestore.rules` pins the stored GIF URL to the provider's domain, so a client cannot write an
arbitrary URL into the feed. KLIPY's docs were unreachable from the environment this was written
in, so the pin is `*.klipy.com` — the registrable domain rather than the exact CDN subdomain,
which nobody has seen yet.

**Before deploying the rules: make one real call and read the host off `file.md.gif.url`.** If it
is not under `klipy.com`, update the two `matches(...)` patterns in `firestore.rules` and the
`KLIPY` constant in `scripts/test-rules.mjs` together.

If the pin is wrong the symptom is contained: the media write is refused and the post still
publishes without its GIF, because `Feed2.jsx` treats a failed attach that way on purpose. A
wrong pin costs a missing GIF, never a lost post.

### Verify

Open the composer, tap **Add a GIF**, and confirm the sheet fills with results. If it says
"GIFs aren't switched on yet" the variable is missing from that build. If it says "Couldn't
reach the GIF library" the key exists but is being refused — KLIPY answers a bad app key with
HTTP 404 *and* `result: false`, so check the key itself before suspecting the network.

## The CLI (fallback)

Only needed if you have a machine you can run commands on and want to deploy outside GitHub.

```bash
npm run deploy:login       # once
npm run deploy:firestore   # rules AND indexes
npm run deploy:rules       # rules only
npm run deploy:indexes     # indexes only
```

Run from the repo root, so the CLI can see `firebase.json` and `.firebaserc`. The scripts use
`npx --yes firebase-tools`, which fetches the CLI on demand rather than installing globally —
no `sudo`, no `EACCES`, no admin terminal, nothing added to the Vercel build. The project is
pinned in `.firebaserc` (`uplift-6d9ea`), so there is nothing to select.

Checking what is actually live — the repo cannot tell you this, it only knows what *should* be
deployed:

```bash
npm run firebase -- firestore:indexes    # prints the live indexes
npm run firebase -- login:list           # which account you are deploying as
npm run firebase -- projects:list        # confirms access to uplift-6d9ea
```

## Before changing rules

```bash
npm run check:rules
```

Cross-references every collection the client writes against `firestore.rules` and fails if one
has no rule. It found `referrals`, which had never had a rule and had been silently denying
every referral reward. It cannot see what is deployed — only that the file is complete. The
Action runs it too, so this is a faster local copy of a gate that is already enforced.

## If a deploy fails

**In the Action:**

- **`Failed to authenticate` / permission denied** → the `FIREBASE_SERVICE_ACCOUNT` secret is
  missing, malformed (it must be the *entire* JSON), or the account lacks the two roles above.
- **`check:rules` failed** → a collection the app writes has no rule. Nothing was published;
  fix `firestore.rules` and push again.
- **An index would be deleted** → intentional failure. Either restore the index to
  `firestore.indexes.json`, or, if the deletion is genuinely wanted, delete it in the console
  by hand so it is a deliberate act.

**Either route:**

- **Rules compile error** → the message names a line in `firestore.rules`. Nothing is published
  when compilation fails, so the live rules are untouched.
- **Deployed to the wrong project** → `npm run firebase -- login:list`. Being signed in as a
  different Google account is the usual cause of "it said success but nothing changed".

Rules are versioned: Console → Rules → history, and you can revert in two clicks.
