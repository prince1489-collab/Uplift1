import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // Short commit SHA baked in at build time (Vercel sets VERCEL_GIT_COMMIT_SHA)
    // so testers can verify which build a device is actually running.
    __BUILD_ID__: JSON.stringify((process.env.VERCEL_GIT_COMMIT_SHA || "dev").slice(0, 7)),
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
