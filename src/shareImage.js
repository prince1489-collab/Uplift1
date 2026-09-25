// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.
//
// shareImage.js — hand a generated PNG to whatever the device actually uses to share.
//
// ── WHY navigator.share WAS NOT ENOUGH, AND WHY THE BUTTON DID NOTHING ───────────────────────
// The certificate share was written as: navigator.canShare({files}) → navigator.share, with an
// <a download> fallback. On a browser that is correct. This app is not a browser.
//
// The Web Share API is a BROWSER feature, not a WebView one. Android's WebView does not implement
// navigator.share at all, and WKWebView does not expose it usefully either — so `canShare` is
// undefined, the optional call yields undefined, and every native user fell straight through to
// the fallback. Which then also does nothing, because a WebView has no download manager: an
// <a download> click is silently discarded unless the host app registered a DownloadListener,
// and Capacitor does not.
//
// So the button ran, threw nothing, and set the note "Saved to your downloads." That was the
// worst part — not that it failed, but that it reported success. Both stores had it: the iOS
// build released as 1.4 and the Play build at 2.6.
//
// The fix is the plugin that exists for exactly this. On a native platform the bytes are written
// to the app's cache directory and handed to the OS share sheet by file URI, which is what
// WhatsApp, Messages and the rest actually accept. The browser path stays as it was, because
// there it was right.
import { Capacitor } from "@capacitor/core";
import { Share } from "@capacitor/share";
import { Filesystem, Directory } from "@capacitor/filesystem";

// Blob → bare base64, no data: preamble. Filesystem.writeFile wants it that way, and it is the
// same conversion imagePrep.js does for the moderation call.
function toBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read_failed"));
    reader.onload = () => {
      const s = String(reader.result || "");
      const comma = s.indexOf(",");
      comma < 0 ? reject(new Error("unexpected_data_url")) : resolve(s.slice(comma + 1));
    };
    reader.readAsDataURL(blob);
  });
}

// Returns one of:
//   "shared"     — handed to the OS share sheet (or the browser's)
//   "downloaded" — saved via the browser's download manager
//   "cancelled"  — the person dismissed the sheet; NOT a failure and must not be reported as one
// Throws only when nothing worked, so the caller can say so instead of claiming success.
export async function shareImage({ blob, fileName, title }) {
  const native = (() => {
    try { return Capacitor.getPlatform() !== "web"; } catch { return false; }
  })();

  if (native) {
    try {
      // Cache, not Documents: this is a file the OS is about to copy somewhere else, not one the
      // person is keeping. It can be cleaned up by the system whenever it likes.
      const { uri } = await Filesystem.writeFile({
        path: fileName,
        data: await toBase64(blob),
        directory: Directory.Cache,
      });
      await Share.share({ title, files: [uri] });
      return "shared";
    } catch (err) {
      // Every share sheet reports a dismissal as an error of some kind, and the wording is not
      // stable across platforms — so match loosely rather than let "I changed my mind" surface
      // as "something went wrong".
      const m = String(err?.message || "").toLowerCase();
      if (m.includes("cancel") || m.includes("abort") || m.includes("dismiss")) return "cancelled";
      throw err;
    }
  }

  const file = new File([blob], fileName, { type: blob.type || "image/png" });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title });
      return "shared";
    } catch (err) {
      if (err?.name === "AbortError") return "cancelled";
      throw err;
    }
  }

  // Browser fallback. Only reachable on the web, where a download genuinely happens.
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    return "downloaded";
  } finally {
    // Not immediately: revoking before the browser has started the transfer cancels it.
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
}
