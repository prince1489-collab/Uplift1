# Deploying

Three things ship independently, and forgetting the second is how the app broke for a week.

| what | where it goes | how |
|---|---|---|
| the web app | Vercel | push to `claude/improve-app-design-HJrCm` |
| Firestore rules + indexes | Firebase | `npm run deploy:firestore` |
| iOS / Android | Codemagic | push triggers both workflows |

## Firestore rules and indexes

**Nothing deploys these automatically.** `firestore.rules` and `firestore.indexes.json` live in
this repo, but the repo has no connection to Firebase unless you run the command. That gap
caused two separate outages:

- Rules went **24 days** without being deployed. Private replies, shared reflections and
  public profiles were all denied, and the app told users to check their connection.
- Indexes had never been declared at all. A query would fail on the server while the local
  cache made it look like it had briefly worked — the symptom was a received reply appearing
  for a second and then vanishing.

### One-time setup

```bash
npm run deploy:login
```

That's it. The deploy scripts use `npx --yes firebase-tools`, which fetches the CLI on demand
and caches it — there is **no global install**, which is where this usually falls over
(`EACCES` on macOS/Linux, needing an admin terminal on Windows). No `sudo`, no
`devDependency`, nothing added to the Vercel build.

The project is pinned in `.firebaserc` (`uplift-6d9ea`), so there is nothing to select.

### Deploying

```bash
npm run deploy:firestore   # rules AND indexes — the usual one
npm run deploy:rules       # rules only
npm run deploy:indexes     # indexes only
```

Run from the repo root, so the CLI can see `firebase.json` and `.firebaserc`.

Indexes take a few minutes to build. Firebase Console → Firestore → **Indexes** shows
*Building* then *Enabled*; queries that need one keep failing until it says Enabled.

### Checking what is actually live

The repo cannot tell you this — it only knows what *should* be deployed.

```bash
npm run firebase -- firestore:indexes    # prints the live indexes
npm run firebase -- login:list           # which account you are deploying as
npm run firebase -- projects:list        # confirms access to uplift-6d9ea
```

For rules, Firebase Console → Firestore → **Rules** shows the published copy and a
*Last published* timestamp. If that date is older than your last change to `firestore.rules`,
the live rules are stale — that is exactly the state that caused the first outage.

### Before changing rules

```bash
npm run check:rules
```

Cross-references every collection the client writes against `firestore.rules` and fails if one
has no rule. It found `referrals`, which had never had a rule and had been silently denying
every referral reward. It cannot see what is deployed — only that the file is complete.

## If a deploy fails

- **`Failed to authenticate`** → `npm run deploy:login` again.
- **`Not in a Firebase project directory`** → you are not in the repo root.
- **Rules compile error** → the message names a line in `firestore.rules`. Nothing is
  published when compilation fails, so the live rules are untouched.
- **Deployed to the wrong project** → `npm run firebase -- login:list`. Being signed in as a
  different Google account is the usual cause of "it said success but nothing changed".

Rules are versioned: Console → Rules → history, and you can revert in two clicks.
