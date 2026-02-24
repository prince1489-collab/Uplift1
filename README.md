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
- Verify the browser has network access to Firebase
