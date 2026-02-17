# 🎧 Spatial Audio Lab

> An interactive browser demo that teaches binaural audio and HRTF through
> real-time spatial sound, 3D visualization, and webcam head tracking.

**[🌐 Live Demo](https://hrtf.tlifschitz.com)**

---

## Overview

Spatial Audio Lab makes the physics of 3D hearing tangible. Put on headphones,
press play, and a sound source orbits your virtual head, rendered binaurally
using real acoustic measurements from human ears and KEMAR mannequins.
Enable the webcam and your actual head movements shift the sound field in
real time, exactly as AirPods Spatial Audio does under the hood.

The app doubles as a teaching tool: switch between Mono, Stereo, and Binaural
modes to hear the difference at every step, explore the impulse response and
frequency spectrum of the current HRTF filter pair, and follow a guided
voiceover onboarding that explains the phenomenon as you listen.

---

## ✨ Features

| | |
|---|---|
| 🎚️ **Three rendering modes** | Mono (no spatialization), Stereo panning, and full Binaural HRTF convolution |
| 📷 **Real-time head tracking** | Webcam-powered via MediaPipe,  yaw and pitch update the sound field live |
| 🌐 **3D visualization** | Animated Three.js scene,  head model, orbiting source sphere, expanding sound waves |
| 📊 **HRTF spectrum explorer** | Per-direction impulse response and FFT magnitude plots (left vs right ear) |
| 🎓 **Guided onboarding** | 5-segment voiceover sequence that walks through mono → binaural progression |
| 👤 **5 CIPIC subjects** | Includes two KEMAR mannequin heads (large/small pinna) and three human subjects |
| 🔊 **Multiple audio sources** | White noise, pink noise, brown noise, speech, and music |

---

## 🕹️ How to Use

1. **Open the app** and put on headphones,  binaural audio requires headphones to work.
2. An onboarding sequence plays automatically. Follow along as it steps through
   Mono → Stereo → Binaural so you can hear the difference.
3. After onboarding the main controls appear:
   - **Mode**:  switch between Mono / Stereo / Binaural at any time.
   - **Azimuth / Elevation**:  drag the sliders to move the sound source in 3D space.
   - **HRTF Subject**:  change whose ear measurements are used for convolution.
   - **Audio Source**:  try different signals (noise is especially revealing for spectral differences).
4. Click **Enable Head Tracking** and grant camera access. Turning your head now
   rotates the sound field,  if the source is on your right and you turn right,
   it moves toward the front, just like a real sound.
5. The spectrum panel updates live: left/right impulse responses and their
   frequency magnitude show exactly which frequencies the HRTF is boosting or
   cutting for the current source direction.

---

## 🧠 About HRTF

### What is a Head-Related Transfer Function?

When a sound reaches your ears from a specific direction in space, your head,
shoulders, and outer ears (pinnae) physically filter it in a direction-dependent
way before it enters your ear canal. These filtering effects encode spatial
information: elevation, front-vs-back, and distance. Your brain has learned to
decode them into perceived 3D position.

A Head-Related Transfer Function (HRTF) captures this filtering as a pair of
finite-impulse-response (FIR) filters,  one per ear,  for every direction around
the head. Convolving a mono audio signal with an HRTF pair produces **binaural
audio**: when played through headphones, the sound appears to come from that
direction in 3D space.

### 🎧 Why headphones?

Speakers mix both ears,  your left ear hears the right speaker and vice versa
(crosstalk). This blurs the inter-aural cues. Headphones deliver each HRTF
channel to exactly the right ear, preserving the cues intact.

### Acoustic cues involved

| Cue | Full name | What it encodes |
|---|---|---|
| **ITD** | Interaural Time Difference | Left/right angle (azimuth) |
| **ILD** | Interaural Level Difference | Left/right angle, especially at high frequencies |
| **Spectral shape** | Pinna-induced colouration | Elevation and front-vs-back ambiguity |

### 📐 The CIPIC dataset

This app uses impulse responses from the
[CIPIC HRTF database](https://www.ece.ucdavis.edu/cipic/spatial-sound/hrtf-data/),
a public collection of measurements taken at UC Davis. Each subject was measured
at **1 250 directions** (25 azimuths × 50 elevations), with 200-sample impulse
responses at 44.1 kHz per ear. The dataset includes KEMAR acoustic mannequins
(subjects 021 and 165, differing in pinna size) and human participants.

---

## 🛠️ Tech Stack

- **[Vite](https://vite.dev/)**: build tool & dev server
- **[Three.js](https://threejs.org/)**:  3D scene and WebGL rendering
- **[Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)**:  AudioWorklet, ConvolverNode, StereoPannerNode
- **[MediaPipe Tasks Vision](https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker)**:  real-time face landmark detection
- **[Chart.js](https://www.chartjs.org/)**:  impulse response and FFT plots
- **TypeScript 5**:  end-to-end type safety

---

## 🚀 Quick Start

**Requirements:** Node.js 18+, a Chromium-based browser (AudioWorklet + MediaPipe
GPU delegate), headphones.

```bash
git clone https://github.com/tlifschitz/hrtf.git
cd hrtf
npm install
npm run dev
```

Open the local URL printed by Vite. HRIR data is already generated and committed
under `public/hrir/`,  no extra steps needed.

---

## 📦 Build & Deploy

```bash
npm run build      # TypeScript check + Vite production build → dist/
npm run preview    # Serve production build locally
```

Deployment to **GitHub Pages** is automated via `.github/workflows/deploy.yml`
on every push to `master`. The Vite config sets `base: './'` so all asset paths
resolve correctly under the Pages subdirectory.

---

## 🔬 Generating HRIR Data

The JSON files under `public/hrir/` are pre-generated from CIPIC SOFA files.
To regenerate (e.g. to add subjects):

```bash
pip install netcdf4 requests
python3 scripts/convert-cipic-sofa.py
```

The script downloads SOFA files from
[sofacoustics.org](https://sofacoustics.org/data/database/cipic/) (cached in
`scripts/.sofa-cache/`), extracts left/right impulse responses, and writes
compact JSON to `public/hrir/`. To add subjects, edit the `SUBJECTS` list at
the top of the script.

---

## 🏗️ Architecture

### 🔉 Audio signal chain

```
AudioBufferSource
      │
      ▼
AudioWorkletNode      ← runs on audio thread, never blocks UI
      │
      ├─ Mono ──────────────────────────────────────────► destination
      │
      ├─ Stereo ──► StereoPannerNode ──────────────────► destination
      │
      └─ Binaural ─► ConvolverPair (L + R FIR) ────────► destination
                          ▲
                   HRIR lookup (nearest-neighbour
                   in azimuth × elevation space)
                   + crossfade on direction change
```

In **Binaural** mode, two `ConvolverNode` instances (one per ear) operate as a
double buffer. When the source position changes, the standby convolver loads the
new HRIR and a 50 ms linear crossfade switches to it,  eliminating clicks during
rapid slider movement.

If the AudioContext sample rate differs from the HRIR native rate (44.1 kHz),
impulse responses are transparently resampled via `OfflineAudioContext`.

### 🎥 Head tracking

MediaPipe `FaceLandmarker` runs in the browser and extracts a 4×4 face
transformation matrix each frame. Yaw and pitch are derived via `atan2` / `asin`
and smoothed with an exponential filter (α = 0.3) before being subtracted from
the slider position to compute the effective source direction.

### Modules

| Module | Responsibility |
|---|---|
| `audio-engine/` | `AudioEngine` class: init, playback, mode switching, HRIR-driven convolution |
| `hrir/` | JSON loading, nearest-neighbour lookup, stereo AudioBuffer creation, resampling |
| `tracking/` | MediaPipe `FaceLandmarker` wrapper, angle extraction, smoothing filter |
| `visualization/` | Three.js scene: head model, source sphere, sound wave animation |
| `plots/` | Chart.js IR and FFT panels, updates on direction/subject change |
| `ui/` | DOM wiring (`controls.ts`), guided onboarding sequence (`onboarding.ts`) |
| `analytics.ts` | Thin `gtag` wrapper for GA4 custom events |
| `worklet/` | `PassthroughProcessor`: keeps audio on the audio thread |

---

## 📁 Project Structure

```
hrtf/
├── public/
│   ├── hrir/
│   │   ├── subjects.json          # subject manifest
│   │   └── <id>.json              # per-subject HRIR data (1 250 positions)
│   ├── audio/                     # source WAV files
│   ├── models/head.glb            # Ready Player Me head (with ARKit blend shapes)
│   └── onboarding/
│       ├── en/1.mp3 … 5.mp3       # English voiceover segments
│       └── es/1.mp3 … 5.mp3       # Spanish voiceover segments
├── scripts/
│   └── convert-cipic-sofa.py      # SOFA → JSON converter
└── src/
    ├── main.ts                    # entry point
    ├── analytics.ts               # GA4 event wrapper
    ├── audio-engine/
    │   ├── engine.ts              # AudioEngine class
    │   ├── convolver-pair.ts      # double-buffered FIR with crossfade
    │   └── modes.ts               # Mono / Stereo / Binaural constants
    ├── hrir/
    │   ├── hrir-loader.ts         # fetch, nearest-neighbour lookup, resampling
    │   └── types.ts               # HrirEntry, HrirDataset, SubjectInfo
    ├── tracking/
    │   ├── face-tracker.ts        # MediaPipe integration + smoothing
    │   └── index.ts
    ├── visualization/
    │   ├── scene.ts               # SceneManager (Three.js orchestration)
    │   ├── head-model.ts          # GLB loader, blend shapes, idle blink
    │   ├── source-model.ts        # glowing source sphere
    │   ├── sound-waves.ts         # expanding ring animation
    │   └── index.ts
    ├── plots/                     # Chart.js IR + FFT visualizations
    ├── ui/
    │   ├── controls.ts            # DOM event wiring, head-tracking toggle
    │   └── onboarding.ts          # 5-segment guided sequence
    └── worklet/
        └── passthrough-processor.js
```

---
