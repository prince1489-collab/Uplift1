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

Do **not** delete `api/goodnews.js` to free a slot. It has no caller on `v2-preview`, but
production's frozen `src/GoodNews.jsx` still calls it, so removing it breaks Good News at
merge time.

## Environment variables

Set per Vercel project — **they do not carry across projects**, and `uplift1` and
`uplift1-v2` are separate projects. A missing `FIREBASE_SERVICE_ACCOUNT_JSON` makes all
eight Firebase-Admin routes return `503 moderation_unavailable`, which for the post composer
means nothing can be published at all.

| Variable | Used by |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT_JSON` | moderate-message, post-suggest, feeling-suggest, submit-greeting, notify-feeling, notify-like, send-reminder, rotate-champions, webhook |
| `ANTHROPIC_API_KEY` | moderate-message, post-suggest, feeling-suggest, submit-greeting, goodnews |
| `CRON_SECRET` | send-reminder, rotate-champions |
| `GNEWS_API_KEY` | goodnews |
| `STRIPE_SECRET_KEY` · `STRIPE_WEBHOOK_SECRET` · `STRIPE_PRICE_ID` | create-checkout-session, create-portal-session, webhook |
| `APP_URL` | create-checkout-session, create-portal-session (both defaulted) |
