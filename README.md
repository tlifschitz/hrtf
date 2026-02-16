# Spatial Audio Demo

A browser-based demo of binaural audio using Head-Related Transfer Functions (HRTF). Plays a mono audio source through three rendering modes: direct mono, stereo panning, and binaural convolution with HRTF impulse responses from the CIPIC dataset.

## Requirements

- Node.js 18+
- A browser with AudioWorklet support (Chrome, Firefox, Edge)
- Headphones (required to hear binaural spatialization)

## Setup

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. Click Play, pick a mode, and move the azimuth slider.

## Modes

- **Mono** — source plays directly to both ears, no spatialization
- **Stereo** — standard left/right panning via `StereoPannerNode`
- **Binaural** — convolves the source with left/right HRIR pairs, simulating a sound source at a specific azimuth around the listener's head

## How it works

The audio signal chain is:

```
AudioBufferSource → AudioWorkletNode (passthrough) → mode-specific processing → destination
```

In binaural mode, processing uses a pair of `ConvolverNode`s in a double-buffer arrangement. When the azimuth changes, the standby convolver loads the new impulse response and a 25ms linear crossfade switches to it. This avoids clicks and glitches during rapid azimuth changes.

HRIR data covers 25 azimuths (-80° to +80°) at 0° elevation, 200 samples each at 44.1kHz. The data is stored as JSON in `public/hrir/hrir-data.json`.

## Project structure

```
src/
  main.ts                           entry point
  audio-engine/engine.ts            AudioEngine class — init, play/stop, mode switching
  audio-engine/convolver-pair.ts    double-buffered ConvolverNode with crossfade
  audio-engine/modes.ts             mono / stereo / binaural constants
  hrir/hrir-loader.ts               loads HRIR JSON, nearest-azimuth lookup
  hrir/types.ts                     HrirEntry, HrirDataset types
  worklet/passthrough-processor.js  AudioWorklet processor
  ui/controls.ts                    DOM event wiring
  ui/styles.css                     dark theme
scripts/
  convert-cipic.py                  CIPIC .mat → JSON (requires scipy)
  generate-hrir.py                  synthetic HRIR + sample WAV generator (no deps)
```

## Build

```bash
npm run build      # type-check + production build → dist/
npm run preview    # serve the production build locally
```

The build is configured with `base: './'` for deployment to GitHub Pages or any static host.

## Generating test data

The `public/` assets (WAV + HRIR JSON) were generated with:

```bash
python3 scripts/generate-hrir.py
```

This produces synthetic but perceptually plausible impulse responses (modelling ITD, ILD, and basic pinna filtering) and a 5-second mono test signal. No external Python dependencies needed.

To use real CIPIC data instead, download a subject directory from the [CIPIC HRTF Database](https://www.ece.ucdavis.edu/cipic/spatial-sound/hrtf-data/) and run:

```bash
pip install scipy numpy
python3 scripts/convert-cipic.py path/to/hrir_final.mat
```
