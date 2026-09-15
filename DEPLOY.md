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

## GIFs — getting and restricting the Tenor key

GIF search needs `VITE_TENOR_KEY`. Without it the composer simply hides the "Add a GIF" button,
so the app works fine until you set it.

### Get the key

Tenor v2 uses a **Google Cloud API key**. In the [Google Cloud console](https://console.cloud.google.com):

1. Pick or create a project → **APIs & Services** → **Library** → enable **Tenor API**.
2. **Credentials** → **Create credentials** → **API key**.
3. Add it to Vercel as `VITE_TENOR_KEY`, then **redeploy** — Vite bakes `VITE_` variables into
   the bundle at build time, so setting it without a new build changes nothing.

### Restrict it — the required step, and the optional one

This key ships inside the JavaScript bundle. That is deliberate (`src/tenor.js` explains why: a
proxy route would be a 13th serverless function, which fails the Vercel build). What matters is
that a key which is *going* to be public is bounded before it is.

There are two independent restriction types, and conflating them is easy:

| | answers | breaks the Capacitor apps? |
|---|---|---|
| **API restrictions** | *what may this key call?* | **no** |
| **Application restrictions** | *who may call with it?* | yes, if set to Websites |

**API restrictions → Restrict key → tick `Tenor API` only. This one is required.**

Not a precaution — the alternative is genuinely dangerous. Google's rule is that *"standard API
keys can be used with any API that accepts API keys, unless API restrictions have been added"*,
and `uplift-6d9ea` is not an isolated project. It runs Identity Toolkit (auth), Cloud Firestore,
Firebase Cloud Messaging, Firebase Rules and the Google Play Android Developer API. An
unrestricted key minted there is not a GIF key; it is a key to that project's whole
API-key-accepting surface, published in a file anyone can read. Restricted to Tenor, what it is
worth to a thief is read-only GIF search against a free quota.

**Create a NEW key for this.** Do not reuse the Firebase web API key — that one is public by
design and Firebase-restricted, and widening it to cover Tenor would be the wrong direction.

**Application restrictions can stay `None`,** once the API restriction is set. Setting them to
Websites (`https://www.seenapp.app/*`) tightens the web a little further, but it **breaks GIFs in
the Android and iOS apps**: a referrer restriction checks the `Referer` header, and the Capacitor
build is a WebView whose origin is `capacitor://localhost`, which sends nothing Google
recognises. Same shape of trap as the invite link, which had to be built on the production origin
rather than `window.location.origin` for exactly this reason. If you do want it, you need two
keys — a referrer-restricted one for the web build and an unrestricted one injected by Codemagic
for native — which is a real cost in moving parts for a modest gain.

Finally, set a **quota limit** (APIs & Services → Tenor API → Quotas). That is what actually caps
the damage from a scraped key, and it works regardless of the choices above.

### Verify

Open the composer, tap **Add a GIF**, and confirm the sheet fills with results. If it says
"GIFs aren't switched on yet" the variable is missing from that build; if it says "Couldn't
reach the GIF library" the key exists but is being refused — usually a restriction mismatch, and
on a phone that is almost always the referrer problem above.

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
