// One-off generator for the notification badge (status-bar icon).
//
// Android renders the notification `badge` using ONLY the alpha channel, flattening
// it to a white silhouette. So the badge must be a transparent PNG whose opaque shape
// is the "seen" four-point sparkle — not a filled square. Run: node scripts/make-badge.mjs
import sharp from "sharp";

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">
  <path fill="#ffffff" d="M48 6 Q48 48 90 48 Q48 48 48 90 Q48 48 6 48 Q48 48 48 6 Z"/>
</svg>`;

await sharp(Buffer.from(svg)).png().toFile("public/badge-96.png");
console.log("wrote public/badge-96.png");
