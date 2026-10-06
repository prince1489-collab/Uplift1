import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // Short commit SHA baked in at build time, so testers can verify which build a device is
    // actually running. Vercel sets VERCEL_GIT_COMMIT_SHA; Codemagic (the iOS and Android store
    // builds) sets CM_COMMIT — without it every store build said "build dev".
    __BUILD_ID__: JSON.stringify((process.env.VERCEL_GIT_COMMIT_SHA || process.env.CM_COMMIT || process.env.GITHUB_SHA || "dev").slice(0, 7)),
  },
  build: {
    rollupOptions: {
      // stripe + firebase-admin are server-only (Vercel API routes) — never bundle into the client
      external: ["stripe", "firebase-admin", "firebase-admin/app", "firebase-admin/firestore"],
      output: {
        manualChunks: {
          "vendor-firebase": [
            "firebase/app", "firebase/auth", "firebase/firestore",
            "firebase/storage", "firebase/messaging",
          ],
          "vendor-react": ["react", "react-dom"],
        },
      },
    },
  },
})
