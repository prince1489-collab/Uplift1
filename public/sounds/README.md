# Sound assets

The app synthesises every sound in `src/sounds.js` using the Web Audio API — there are no
audio files by default, which is why the bundle ships no audio at all.

The one exception is the Kindness Tree watering pour, which will use a real recording if
one is present here:

    public/sounds/watering.mp3      →  served at /sounds/watering.mp3

If the file is missing or fails to decode, `playWatering()` falls back to the synthesised
pour automatically. Nothing breaks either way — the file is a pure upgrade.

## What to generate

> Clean, high-fidelity close-up recording of a gentle garden watering can pouring a soft,
> steady stream of water onto lush soil and green leaves, peaceful outdoor ambiance, no
> background noise.

## Requirements

- **Dry and loopable.** The clip is looped to fill the ~7s pour and shaped by an amplitude
  envelope in `playWatering()`, so it swells as the can tips and fades as it rights itself.
  A fade or room tail baked into the file will fight that shaping.
- **2–4 seconds is plenty.** Longer just costs download.
- **Mono is fine** and halves the size.
- **No music, no birds, no speech.** The world map already has its own ambience; anything
  melodic here will clash with the growth notes that play over the top.
- Keep it modest in level — the envelope peaks at `WATER_PEAK = 0.055`, deliberately below
  the map ambience, so the pour sits under the rest of the UI rather than on top of it.

The first pour of a session may still use the synthesised version, because the file is
fetched and decoded in the background; every pour after that uses the recording.
