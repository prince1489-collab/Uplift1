# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## Enable live chat greetings

In this app, chat is already implemented with Firebase Auth + Firestore and appears once onboarding is complete.

1. Start the app and complete onboarding (or sign in with an existing email profile).
2. Open the greeting picker at the bottom of the chat screen.
3. Choose a greeting; it is written to Firestore at:
   - `artifacts/{appId}/public/data/messages`
4. Every connected user sees new greetings in real time through a Firestore `onSnapshot` listener.

### If chat is not updating live

- Make sure your Firebase project is reachable and the app can authenticate (the app signs in users anonymously first).
- Ensure Firestore Security Rules allow authenticated users to read/write under `artifacts/{appId}/public/data/messages`.
- Verify the browser has network access to Firebase.


## Fixing the “Unable to save your profile right now” onboarding error

If users can sign in but fail on the profile form, Firebase usually rejected the profile write. Check these items:

1. **Firestore Security Rules**
   - Allow authenticated users to read/write their own profile document:
     - `artifacts/{appId}/users/{uid}/data/profile`
   - Allow profile index writes for the signed-in owner:
     - `artifacts/{appId}/public/data/userProfiles/{emailKey}`

2. **Authentication provider setup**
   - Enable the provider you use (Google and/or Email link) in **Firebase Authentication → Sign-in method**.
   - Add your deployed domain (for example, your Vercel URL) in **Authentication → Settings → Authorized domains**.

3. **Firestore availability/configuration**
   - Confirm Firestore is created in the Firebase project.
   - If Firestore reports `failed-precondition`, finish any pending setup (indexes/rules/region initialization).

4. **Environment and networking**
   - Confirm the app is pointed at the intended Firebase project values in `src/App.jsx`.
   - Verify the client has network access and no blockers are preventing calls to Firebase services.

The app now surfaces clearer onboarding save errors for common Firestore codes (`permission-denied`, `unavailable`, and `failed-precondition`) to help diagnose this faster.
