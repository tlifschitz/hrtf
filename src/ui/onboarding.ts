import { AudioEngine } from '../audio-engine/engine.ts';
import { AudioMode } from '../audio-engine/modes.ts';
import { FaceTracker } from '../tracking/index.ts';
import { trackEvent } from '../analytics.ts';
import type { SceneManager } from '../visualization/index.ts';

const STORAGE_KEY = 'hrtf-lab-onboarding-seen';

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function show(el: HTMLElement): void {
  el.classList.remove('hidden', 'ob-hide');
  el.classList.add('fade-enter');
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      el.classList.add('fade-enter-active');
      el.classList.remove('fade-enter');
      el.addEventListener('transitionend', () => {
        el.classList.remove('fade-enter-active');
      }, { once: true });
    });
  });
}

interface Segment {
  mode: AudioMode;
  animFn: (elapsed: number, dur: number) => { az: number; el: number };
}

const SEGMENTS: Segment[] = [
  {
    mode: AudioMode.Mono,
    animFn: (t) => ({ az: 70 * Math.sin((2 * Math.PI * t) / 8000), el: 0 }),
  },
  {
    mode: AudioMode.Stereo,
    animFn: (t) => ({ az: 75 * Math.sin((2 * Math.PI * t) / 3000), el: 0 }),
  },
  {
    mode: AudioMode.Binaural,
    animFn: (t) => ({
      az: 80 * Math.sin((2 * Math.PI * t) / 6000),
      el: 30 * Math.sin((2 * Math.PI * t) / 4000),
    }),
  },
  {
    mode: AudioMode.Binaural,
    animFn: (t) => ({
      az: 80 * Math.sin((2 * Math.PI * t) / 5000 + 1.5),
      el: 40 * Math.sin((2 * Math.PI * t) / 3500),
    }),
  },
  {
    mode: AudioMode.Binaural,
    animFn: (t, dur) => ({
      az: 70 * Math.sin((2 * Math.PI * t) / 4000) * (1 - t / dur),
      el: 0,
    }),
  },
];

export function runOnboarding(engine: AudioEngine, scene: SceneManager): void {
  // Step A: Hide non-scene UI immediately (synchronous, before any paint)
  const controlsEl = document.querySelector<HTMLElement>('#controls')!;
  const plotsPanel = document.querySelector<HTMLElement>('#plots-panel')!;
  const sceneContainer = document.querySelector<HTMLElement>('#scene-container')!;

  controlsEl.classList.add('hidden');
  plotsPanel.classList.add('ob-hide');
  // Step B: Show "tap to begin" overlay inside scene container
  const startOverlay = document.createElement('div');
  startOverlay.id = 'ob-start';
  startOverlay.innerHTML = `
    <p>Put on your headphones</p>
    <button type="button">Tap to begin</button>
  `;
  sceneContainer.appendChild(startOverlay);

  // Step C: Init face tracker in parallel (while overlay is visible)
  const trackingVideo = document.querySelector<HTMLVideoElement>('#tracking-video')!;
  const tracker = new FaceTracker(trackingVideo, (result) => {
    scene.setHeadRotation(-result.yawDeg, -result.pitchDeg);
    scene.setBlendShapes(result.blendShapes);
  });
  void tracker.init();

  // Step D: Pre-load all 5 voiceover MP3s (parallel with model loading + user tap)
  const voiceoverPromise = Promise.all(
    [1, 2, 3, 4, 5].map(async (i) => {
      const res = await fetch(`./onboarding/en/${i}.mp3`);
      const ab = await res.arrayBuffer();
      return engine.audioCtx.decodeAudioData(ab);
    }),
  );

  // Step E: Wait for user click (required user gesture → unblocks AudioContext)
  const startBtn = startOverlay.querySelector<HTMLButtonElement>('button')!;
  const clickPromise = new Promise<void>((resolve) => {
    startBtn.addEventListener('click', () => {
      trackEvent('onboarding_started');
      resolve();
    }, { once: true });
  });

  void (async () => {
    await clickPromise;

    // Step F: Start camera and remove overlay
    await tracker.start().catch(() => { /* camera denied: continue without tracking */ });
    startOverlay.remove();

    // Add discrete skip button
    let skipped = false;
    let currentSegment = 0;
    let skipResolve!: () => void;
    const skipPromise = new Promise<void>((r) => {
      skipResolve = () => { skipped = true; r(); };
    });
    const skipBtn = document.createElement('button');
    skipBtn.id = 'ob-skip';
    skipBtn.type = 'button';
    skipBtn.textContent = 'Skip';
    skipBtn.addEventListener('click', () => {
      trackEvent('onboarding_skipped', { at_segment: currentSegment + 1 });
      skipResolve();
    }, { once: true });
    sceneContainer.appendChild(skipBtn);

    const voiceovers = await voiceoverPromise;

    // Step G: Play segments sequentially
    for (let i = 0; i < SEGMENTS.length; i++) {
      currentSegment = i;
      const seg = SEGMENTS[i];
      const buffer = voiceovers[i];
      engine.setMode(seg.mode);
      trackEvent('onboarding_segment', { segment: i + 1, mode: seg.mode });

      const start = performance.now();
      let rafId: number;
      const animate = () => {
        const elapsed = performance.now() - start;
        const { az, el } = seg.animFn(elapsed, buffer.duration * 1000);
        engine.setAzimuth(az);
        engine.setElevation(el);
        scene.setSourcePosition(az, el);
        rafId = requestAnimationFrame(animate);
      };
      rafId = requestAnimationFrame(animate);
      scene.setPlaying(true);

      await Promise.race([engine.playBuffer(buffer), skipPromise]);
      cancelAnimationFrame(rafId);
      scene.setPlaying(false);
      if (skipped) { engine.stopBuffer(); break; }

      if (i < SEGMENTS.length - 1) {
        await Promise.race([sleep(2000), skipPromise]);
        if (skipped) break;
      }
    }

    skipBtn.remove();
    if (!skipped) trackEvent('onboarding_completed');

    // Step H: Onboarding complete
    tracker.stop();
    localStorage.setItem(STORAGE_KEY, '1');
    show(controlsEl);
    show(plotsPanel);
  })();
}
