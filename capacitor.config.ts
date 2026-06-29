import type { CapacitorConfig } from "@capacitor/cli";

// Seen — iOS (and future Android) native shell.
// Bundled mode: the built web app (dist/) ships inside the binary — offline-capable and
// the lowest App-Store-review risk. No server.url, so it does NOT load the live site at runtime.
const config: CapacitorConfig = {
  appId: "app.seenapp.ios",
  appName: "Seen",
  webDir: "dist",
  ios: {
    contentInset: "always",
  },
  plugins: {
    // Native push permission prompt presentation (foreground alerts/sound/badge).
    PushNotifications: {
      presentationOptions: ["alert", "sound", "badge"],
    },
  },
};

export default config;
