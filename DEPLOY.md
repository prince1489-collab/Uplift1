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
2. **Grant two roles:** `Firebase Rules Admin` and `Cloud Datastore Index Admin`. If a deploy
   later fails on permissions, `Firebase Develop Admin` is the broader fallback.
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
