#!/usr/bin/env python3
"""gen-icons.py — expand assets/icon.png into every icon the web app needs.

WHY THIS EXISTS
The app icon lives in two unrelated places, and only one of them is automated:

  assets/icon.png  -> @capacitor/assets expands it into the native iOS + Android icon sets
                      during the Codemagic build (codemagic.yaml). Automatic.
  public/icon-*.png -> the PWA, the installed Android TWA, and the browser tab. NOT generated
                      by anything. Static files, previously hand-made.

That asymmetry is a trap: replace only assets/icon.png and the App Store build gets the new
icon while every installed PWA/TWA user keeps the old one. This script closes it, so there is
one master and everything else is derived.

THE MASKABLE ICON IS THE PART THAT GOES WRONG
Android crops a maskable icon to a circle or squircle of its own choosing. The spec guarantees
only the centre 80% survives — anything in the outer 10% on each side can be cut. A previous
version of this app's icon was generated at full bleed and had its edges clipped on device.
So the maskable variant is drawn at 80% scale on a filled background, which is what SAFE_ZONE
below is for. It will look like it has too much padding when viewed as a square. That is
correct; the mask eats it.

Usage:
    python3 scripts/gen-icons.py                 # generate from assets/icon.png
    python3 scripts/gen-icons.py --check         # verify outputs exist and are the right size
"""

import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    sys.exit("Pillow is required:  pip install Pillow")

ROOT = Path(__file__).resolve().parent.parent
MASTER = ROOT / "assets" / "icon.png"
PUBLIC = ROOT / "public"

# Background for flattening transparency and for the maskable padding. The sand from the
# Phase 5 palette — a transparent icon on a dark launcher would otherwise show as a floating
# shape with no ground.
BG = (255, 246, 239, 255)  # #FFF6EF

# Fraction of the maskable canvas the artwork may occupy. 0.8 is the Android guarantee.
SAFE_ZONE = 0.8

# name -> (size, maskable?)
OUTPUTS = {
    "icon-192.png": (192, False),
    "icon-512.png": (512, False),
    "icon-maskable-512.png": (512, True),
    "apple-touch-icon.png": (180, False),
}


def load_master():
    if not MASTER.exists():
        sys.exit(
            f"Missing {MASTER.relative_to(ROOT)}.\n"
            "Drop a 1024x1024 PNG there — it is the single source for every app icon."
        )
    img = Image.open(MASTER).convert("RGBA")
    if min(img.size) < 512:
        print(f"!! {MASTER.name} is {img.size[0]}x{img.size[1]} — 1024x1024 is wanted for crisp output.")
    return img


def flatten(img, size):
    """Composite onto the brand background and resize. Transparency is flattened rather than
    kept: iOS rejects alpha in app icons outright, and a transparent PWA icon renders
    unpredictably against whatever the launcher happens to be."""
    out = Image.new("RGBA", (size, size), BG)
    scaled = img.resize((size, size), Image.LANCZOS)
    out.alpha_composite(scaled)
    return out.convert("RGB")


def maskable(img, size):
    """Artwork at SAFE_ZONE scale, centred, on a full-bleed background."""
    inner = int(size * SAFE_ZONE)
    out = Image.new("RGBA", (size, size), BG)
    scaled = img.resize((inner, inner), Image.LANCZOS)
    off = (size - inner) // 2
    out.alpha_composite(scaled, (off, off))
    return out.convert("RGB")


def generate():
    img = load_master()
    for name, (size, is_maskable) in OUTPUTS.items():
        result = maskable(img, size) if is_maskable else flatten(img, size)
        path = PUBLIC / name
        result.save(path, "PNG", optimize=True)
        note = f"  (artwork at {int(SAFE_ZONE * 100)}% — the rest is mask headroom)" if is_maskable else ""
        print(f"wrote {path.relative_to(ROOT)}  {size}x{size}{note}")
    print(
        "\nNative iOS/Android icons are NOT written here — @capacitor/assets generates those\n"
        "from the same assets/icon.png during the Codemagic build."
    )


def check():
    problems = []
    if not MASTER.exists():
        problems.append(f"{MASTER.relative_to(ROOT)} is missing")
    else:
        w, h = Image.open(MASTER).size
        if w != h:
            problems.append(f"assets/icon.png is {w}x{h} — must be square")
        if w < 512:
            problems.append(f"assets/icon.png is {w}px — too small to generate from")
    for name, (size, _) in OUTPUTS.items():
        path = PUBLIC / name
        if not path.exists():
            problems.append(f"public/{name} is missing")
            continue
        w, h = Image.open(path).size
        if (w, h) != (size, size):
            problems.append(f"public/{name} is {w}x{h}, expected {size}x{size}")
    if problems:
        print(f"{len(problems)} icon problem(s):")
        for p in problems:
            print("  " + p)
        return 1
    print(f"OK — master present and all {len(OUTPUTS)} derived icons at the right size.")
    return 0


if __name__ == "__main__":
    sys.exit(check() if "--check" in sys.argv else (generate() or 0))
