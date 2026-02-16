# Spatial Audio Demo

A browser-based demo of binaural audio using Head-Related Transfer Functions (HRTF). Plays a mono audio source through three rendering modes: direct mono, stereo panning, and binaural convolution with HRTF impulse responses from the CIPIC dataset.

## Requirements

- Node.js 18+
- Python 3.8+ (for HRIR data conversion only)
- A browser with AudioWorklet support (Chrome, Firefox, Edge)
- Headphones (required to hear binaural spatialization)

## Setup

```bash
npm install
```

Generate HRIR data from real CIPIC SOFA files:

```bash
pip install netcdf4 requests
python3 scripts/convert-cipic-sofa.py
```

This downloads 5 CIPIC subjects from [sofacoustics.org](https://sofacoustics.org/data/database/cipic/) and writes JSON files to `public/hrir/`. Each subject contains 1250 measurement positions (25 azimuths × 50 elevations).

Then start the dev server:

```bash
npm run dev
```

Open the local URL printed by Vite. Select an HRTF subject, click Play, pick a mode, and move the azimuth/elevation sliders.

## Modes

- **Mono** — source plays directly to both ears, no spatialization
- **Stereo** — standard left/right panning via `StereoPannerNode`
- **Binaural** — convolves the source with left/right HRIR pairs, simulating a sound source at a specific azimuth and elevation around the listener's head

## Controls

- **HRTF Subject** — dropdown to switch between different CIPIC subjects (includes KEMAR mannequin heads 021/165 and human subjects)
- **Azimuth** — horizontal angle from -80° to +80°
- **Elevation** — vertical angle from -45° to +230.625° (full CIPIC range covering below to behind-and-above)

## How it works

The audio signal chain is:

```
AudioBufferSource → AudioWorkletNode (passthrough) → mode-specific processing → destination
```

In binaural mode, processing uses a pair of `ConvolverNode`s in a double-buffer arrangement. When the azimuth or elevation changes, the standby convolver loads the new impulse response and a 25ms linear crossfade switches to it. This avoids clicks and glitches during rapid parameter changes.

HRIR data is sourced from real CIPIC SOFA files, containing 1250 positions per subject (25 azimuths × 50 elevations), 200 samples each at 44.1kHz. When the AudioContext runs at a different sample rate (e.g. 48kHz), impulse responses are resampled via `OfflineAudioContext`.

## Project structure

```
src/
  main.ts                           entry point
  audio-engine/engine.ts            AudioEngine class — init, play/stop, mode/subject switching
  audio-engine/convolver-pair.ts    double-buffered ConvolverNode with crossfade
  audio-engine/modes.ts             mono / stereo / binaural constants
  hrir/hrir-loader.ts               loads HRIR JSON, 2D nearest-neighbor lookup, resampling
  hrir/types.ts                     HrirEntry, HrirDataset, SubjectInfo types
  worklet/passthrough-processor.js  AudioWorklet processor
  ui/controls.ts                    DOM event wiring (play, mode, subject, azimuth, elevation)
  ui/styles.css                     dark theme
scripts/
  convert-cipic-sofa.py             downloads CIPIC SOFA files → JSON (requires netcdf4)
public/
  hrir/subjects.json                manifest of available HRTF subjects
  hrir/<id>.json                    per-subject HRIR data (generated, not checked in)
  audio/sample.wav                  test audio signal
```

## Build

```bash
npm run build      # type-check + production build → dist/
npm run preview    # serve the production build locally
```

The build is configured with `base: './'` for deployment to GitHub Pages or any static host.

## Regenerating HRIR data

To regenerate the HRIR JSON files from CIPIC SOFA sources:

```bash
pip install netcdf4 requests
python3 scripts/convert-cipic-sofa.py
```

Downloaded SOFA files are cached in `scripts/.sofa-cache/` to avoid re-downloading. To add more subjects, edit the `SUBJECTS` list in the script.
