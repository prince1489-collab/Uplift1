import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      // stripe + firebase-admin are server-only (Vercel API routes) — never bundle into the client
      external: ["stripe", "firebase-admin", "firebase-admin/app", "firebase-admin/firestore"],
    },
  },
})
