# Serverless functions

Every `.js` file in this directory becomes its own Vercel serverless function.

## Function budget — read before adding a route

**This plan allows 12 functions per deployment, and `api/` is at exactly 12.**
Adding a 13th fails the **build**, so nothing deploys at all — the site keeps serving the
previous build and your change silently never arrives.

**If you add a route here, remove one.**

The trap: `npm run build` is `vite build`, which only compiles `src/`. It never touches
`api/`. So this failure passes locally every single time and only ever appears on Vercel.
A green local build tells you nothing about whether this will deploy — check the deployment
state instead.

This happened: `api/post-suggest.js` took the count to 13, the build failed, and two
subsequent commits went out believing they were live when they weren't.
`api/lifehacks.js` was deleted to make room — it had no callers on either branch.

`api/goodnews.js` used to carry a "do not delete" warning: it had no caller on the V2 preview
branch, but production's frozen `src/GoodNews.jsx` still called it, so removing it would have
broken Good News at merge time. That merge has happened. `src/GoodNews.jsx` no longer exists
on any branch and the endpoint has no caller left in `src/`.

It is kept anyway, because at 10 of 12 slots there is no pressure to reclaim one, and an
endpoint with no caller in this repo is not proof of an endpoint with no caller — anything
already pointed at the deployed URL would break silently. Retiring it is a deliberate
decision to make on its own, not a slot-freeing convenience.

## Environment variables

Set per Vercel project — **they do not carry across projects**, and `uplift1` and
`uplift1-v2` are separate projects. A missing `FIREBASE_SERVICE_ACCOUNT_JSON` makes all
eight Firebase-Admin routes return `503 moderation_unavailable`, which for the post composer
means nothing can be published at all.

| Variable | Used by |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT_JSON` | moderate-message, post-suggest, feeling-suggest, submit-greeting, notify-feeling, notify-like, send-reminder, rotate-champions, webhook |
| `ANTHROPIC_API_KEY` | moderate-message, post-suggest, feeling-suggest, submit-greeting, goodnews |

`ANTHROPIC_API_KEY` has one consumer that treats its absence as a hard stop rather than a
degraded mode: the **image** branch of `moderate-message`, which screens profile photos. Text
falls back to a word list when the key is missing; pixels have no equivalent, so the endpoint
answers `checked: false` and the client refuses the upload. If avatars stop saving with "we
couldn't check that photo just now", this key is the first thing to look at.
| `CRON_SECRET` | send-reminder, rotate-champions |
| `GNEWS_API_KEY` | goodnews |
| `STRIPE_SECRET_KEY` · `STRIPE_WEBHOOK_SECRET` · `STRIPE_PRICE_ID` | create-checkout-session, create-portal-session, webhook |
| `APP_URL` | create-checkout-session, create-portal-session (both defaulted) |

### Client-side variables

`VITE_`-prefixed variables are a different thing from the table above. Vite **inlines them into
the bundle at build time**, so they are readable by anyone who opens the site — they are
configuration, not secrets, and nothing that must stay private may be given one.

| Variable | Used by |
|---|---|
| `VITE_FIREBASE_VAPID_KEY` | web push registration (`src/App.jsx`) |
| `VITE_KLIPY_KEY` | GIF search (`src/klipy.js`) — a KLIPY app key, nothing to do with Google Cloud |

Both are absent-safe: without the VAPID key web push does not register, and without the KLIPY
key the composer hides the "Add a GIF" button entirely rather than offering one that fails.
A rebuild is needed after changing either, because the value is baked in — setting it in Vercel
and redeploying nothing will change nothing.

**And they belong in TWO places, unlike everything in the table above.** The `api/` variables are
read by serverless functions at runtime, so Vercel is the only place they exist. A `VITE_` one is
inlined into the bundle at build time, and two systems build that bundle: Vercel for the web, and
Codemagic for the iOS and Android apps (`codemagic.yaml` runs `npm run build` itself). Set one in
Vercel only and the feature works on the web and is silently missing on both phones.

`VITE_KLIPY_KEY` is therefore in Codemagic too, in the `seen_web` environment group.
`VITE_FIREBASE_VAPID_KEY` deliberately is NOT: it feeds the web service-worker token path, which
native never reaches — `App.jsx` returns after `registerNativePush` before the VAPID branch.
