import { AudioEngine, AUDIO_SOURCES } from '../audio-engine/engine.ts';
import { AudioMode } from '../audio-engine/modes.ts';
import { FaceTracker } from '../tracking/index.ts';
import { PlotsPanel } from '../plots/index.ts';
import type { EngineStatus } from '../audio-engine/engine.ts';
import type { SubjectInfo } from '../hrir/types.ts';
import type { SceneManager } from '../visualization/index.ts';

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;

function fadeIn(el: HTMLElement): void {
  el.classList.remove('hidden');
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

export function initControls(
  engine: AudioEngine,
  scene: SceneManager,
  onReady?: () => void,
): void {
  const playBtn = $<HTMLButtonElement>('#play-btn');
  const modeRadios = document.querySelectorAll<HTMLInputElement>('input[name="mode"]');
  const azimuthSlider = $<HTMLInputElement>('#azimuth-slider');
  const azimuthValue = $<HTMLSpanElement>('#azimuth-value');
  const elevationSlider = $<HTMLInputElement>('#elevation-slider');
  const elevationValue = $<HTMLSpanElement>('#elevation-value');
  const subjectSelect = $<HTMLSelectElement>('#subject-select');
  const sourceSelect = $<HTMLSelectElement>('#source-select');
  const statusEl = $<HTMLDivElement>('#status');
  const controlsEl = $<HTMLDivElement>('#controls');
  const trackingBtn = $<HTMLButtonElement>('#tracking-btn');
  const trackingVideo = $<HTMLVideoElement>('#tracking-video');
  const trackingStatus = $<HTMLDivElement>('#tracking-status');
  const trackingYawEl = $<HTMLSpanElement>('#tracking-yaw');
  const trackingPitchEl = $<HTMLSpanElement>('#tracking-pitch');

  let sourceAzimuth = 0;
  let sourceElevation = 0;
  let headYaw = 0;
  let headPitch = 0;

  let tracker: FaceTracker | null = null;
  let trackingActive = false;

  const plotsPanel = new PlotsPanel(
    $<HTMLElement>('#plots-panel'),
    engine,
  );

  function updateStatus(status: EngineStatus, detail?: string): void {
    statusEl.classList.toggle('error', status === 'error');
    const labels: Record<EngineStatus, string> = {
      loading: detail ?? 'Loading…',
      ready: 'Ready',
      playing: 'Playing',
      error: `Error: ${detail ?? 'unknown'}`,
    };
    statusEl.textContent = labels[status];

    if (status === 'ready' || status === 'playing') {
      if (controlsEl.classList.contains('hidden')) {
        fadeIn(controlsEl);
        onReady?.();
      }
    }
  }

  function updateEffectiveAngles(): void {
    const azMin = Number(azimuthSlider.min);
    const azMax = Number(azimuthSlider.max);
    const elMin = Number(elevationSlider.min);
    const elMax = Number(elevationSlider.max);

    const effectiveAz = Math.max(azMin, Math.min(azMax, sourceAzimuth - headYaw));
    const effectiveEl = Math.max(elMin, Math.min(elMax, sourceElevation - headPitch));

    engine.setAzimuth(effectiveAz);
    engine.setElevation(effectiveEl);
    scene.setSourcePosition(sourceAzimuth, sourceElevation);
    plotsPanel.update();
  }

  function populateSubjects(subjects: SubjectInfo[]): void {
    subjectSelect.innerHTML = '';
    for (const s of subjects) {
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = s.label;
      subjectSelect.appendChild(opt);
    }
  }

  // Populate audio sources
  for (const src of AUDIO_SOURCES) {
    const opt = document.createElement('option');
    opt.value = src.id;
    opt.textContent = src.label;
    sourceSelect.appendChild(opt);
  }

  // Initialize engine
  void engine
    .init('./hrir', updateStatus)
    .then((subjects) => {
      populateSubjects(subjects);
      plotsPanel.update();
    })
    .catch(() => {});

  // Play / Pause
  playBtn.addEventListener('click', () => {
    if (engine.playing) {
      engine.stop();
      playBtn.textContent = '▶ Play';
      playBtn.classList.remove('playing');
    } else {
      engine.play();
      playBtn.textContent = '⏹ Stop';
      playBtn.classList.add('playing');
    }
  });

  // Mode selector
  modeRadios.forEach((radio) => {
    radio.addEventListener('change', () => {
      engine.setMode(radio.value as AudioMode);
    });
  });

  // Audio source selector
  sourceSelect.addEventListener('change', () => {
    void engine.setSource(sourceSelect.value);
  });

  // Azimuth slider
  azimuthSlider.addEventListener('input', () => {
    sourceAzimuth = Number(azimuthSlider.value);
    azimuthValue.textContent = `${sourceAzimuth}°`;
    updateEffectiveAngles();
  });

  // Elevation slider
  elevationSlider.addEventListener('input', () => {
    sourceElevation = Number(elevationSlider.value);
    elevationValue.textContent = `${Math.round(sourceElevation)}°`;
    updateEffectiveAngles();
  });

  // Set initial 3D position
  scene.setSourcePosition(sourceAzimuth, sourceElevation);

  // Subject selector
  subjectSelect.addEventListener('change', () => {
    void engine.setSubject(subjectSelect.value).then(() => plotsPanel.update());
  });

  // Head tracking
  trackingBtn.addEventListener('click', async () => {
    if (trackingActive) {
      // Stop tracking
      tracker?.stop();
      trackingActive = false;
      trackingBtn.textContent = 'Enable Head Tracking';
      trackingBtn.classList.remove('active');
      trackingVideo.classList.add('hidden');
      trackingVideo.classList.remove('fade-hidden');
      trackingStatus.classList.add('hidden');
      trackingStatus.classList.remove('fade-hidden');

      headYaw = 0;
      headPitch = 0;
      scene.setHeadRotation(0, 0);
      updateEffectiveAngles();
      return;
    }

    try {
      // Lazy-init tracker on first click
      if (!tracker) {
        trackingBtn.textContent = 'Loading model…';
        trackingBtn.disabled = true;
        tracker = new FaceTracker(trackingVideo, (result) => {
          headYaw = result.yawDeg;
          headPitch = result.pitchDeg;
          trackingYawEl.textContent = `Yaw: ${Math.round(headYaw)}°`;
          trackingPitchEl.textContent = `Pitch: ${Math.round(headPitch)}°`;
          scene.setHeadRotation(headYaw, headPitch);
          updateEffectiveAngles();
        });
        await tracker.init();
        trackingBtn.disabled = false;
      }

      await tracker.start();
      trackingActive = true;
      trackingBtn.textContent = 'Disable Head Tracking';
      trackingBtn.classList.add('active');
      fadeIn(trackingVideo);
      fadeIn(trackingStatus);
    } catch (err) {
      trackingBtn.disabled = false;
      trackingBtn.textContent = 'Enable Head Tracking';
      const msg = err instanceof Error ? err.message : 'Camera access denied';
      statusEl.textContent = `Tracking error: ${msg}`;
      statusEl.classList.add('error');
    }
  });
}
