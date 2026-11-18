// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.
//
// appVersionCheck.js — simple version checking for in-app updates (3.36.2).

export const CURRENT_VERSION = "3.36.2";

// Parse a version string into [major, minor, patch] for comparison.
export const parseVersion = (v) => {
  const parts = String(v || "").split(".").map((x) => parseInt(x, 10));
  return parts.length === 3 ? parts : [0, 0, 0];
};

// Return true if newer > current.
export const isNewerVersion = (current, newer) => {
  const [cmaj, cmin, cpat] = parseVersion(current);
  const [nmaj, nmin, npat] = parseVersion(newer);
  if (nmaj !== cmaj) return nmaj > cmaj;
  if (nmin !== cmin) return nmin > cmin;
  return npat > cpat;
};
