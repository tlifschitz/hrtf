import { AudioEngine, AUDIO_SOURCES } from '../audio-engine/engine.ts';
import { AudioMode } from '../audio-engine/modes.ts';
import { FaceTracker } from '../tracking/index.ts';
import { PlotsPanel } from '../plots/index.ts';
import { trackEvent } from '../analytics.ts';
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
  let currentMode: string = AudioMode.Binaural;

  // Debounce timer for position_set event
  let positionDebounce: ReturnType<typeof setTimeout> | null = null;

  const plotsPanel = new PlotsPanel(
    $<HTMLElement>('#plots-panel'),
    engine,
  );

  function updateStatus(status: EngineStatus): void {
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
      scene.setPlaying(false);
      trackEvent('audio_stopped', { source_id: sourceSelect.value, mode: currentMode });
    } else {
      engine.play();
      playBtn.textContent = '⏹ Stop';
      playBtn.classList.add('playing');
      scene.setPlaying(true);
      trackEvent('audio_played', { source_id: sourceSelect.value, mode: currentMode });
    }
  });

  // Mode selector
  modeRadios.forEach((radio) => {
    radio.addEventListener('change', () => {
      const previousMode = currentMode;
      currentMode = radio.value;
      engine.setMode(radio.value as AudioMode);
      plotsPanel.update();
      trackEvent('mode_changed', { mode: currentMode, previous_mode: previousMode });
    });
  });

  // Audio source selector
  sourceSelect.addEventListener('change', () => {
    void engine.setSource(sourceSelect.value);
    trackEvent('source_changed', { source_id: sourceSelect.value });
  });

  function schedulePositionEvent(): void {
    if (positionDebounce !== null) clearTimeout(positionDebounce);
    positionDebounce = setTimeout(() => {
      trackEvent('position_set', {
        azimuth_deg: sourceAzimuth,
        elevation_deg: sourceElevation,
        mode: currentMode,
      });
      positionDebounce = null;
    }, 1000);
  }

  // Azimuth slider
  azimuthSlider.addEventListener('input', () => {
    sourceAzimuth = Number(azimuthSlider.value);
    azimuthValue.textContent = `${sourceAzimuth}°`;
    updateEffectiveAngles();
    schedulePositionEvent();
  });

  // Elevation slider
  elevationSlider.addEventListener('input', () => {
    sourceElevation = Number(elevationSlider.value);
    elevationValue.textContent = `${Math.round(sourceElevation)}°`;
    updateEffectiveAngles();
    schedulePositionEvent();
  });

  // Set initial 3D position
  scene.setSourcePosition(sourceAzimuth, sourceElevation);

  // Drag clamping bounds mirror the slider HTML attributes
  const AZ_MIN = Number(azimuthSlider.min);
  const AZ_MAX = Number(azimuthSlider.max);
  const EL_MIN = Number(elevationSlider.min);
  const EL_MAX = Number(elevationSlider.max);

  scene.setOnSourceDrag((azDeg: number, elDeg: number) => {
    sourceAzimuth = Math.max(AZ_MIN, Math.min(AZ_MAX, Math.round(azDeg)));
    sourceElevation = Math.max(EL_MIN, Math.min(EL_MAX, Math.round(elDeg)));

    azimuthSlider.value = String(sourceAzimuth);
    azimuthValue.textContent = `${sourceAzimuth}°`;
    elevationSlider.value = String(sourceElevation);
    elevationValue.textContent = `${sourceElevation}°`;

    updateEffectiveAngles();
    schedulePositionEvent();
  });

  // Subject selector
  subjectSelect.addEventListener('change', () => {
    void engine.setSubject(subjectSelect.value).then(() => plotsPanel.update());
    trackEvent('subject_changed', { subject_id: subjectSelect.value });
  });

  // Head tracking
  trackingBtn.addEventListener('click', async () => {
    if (trackingActive) {
      // Stop tracking
      tracker?.stop();
      trackingActive = false;
      trackingBtn.dataset.tooltip = 'Enable Head Tracking';
      trackingBtn.classList.remove('active');
      trackingVideo.classList.add('hidden');
      trackingVideo.classList.remove('fade-hidden');
      trackingStatus.classList.add('hidden');
      trackingStatus.classList.remove('fade-hidden');

      headYaw = 0;
      headPitch = 0;
      scene.setHeadRotation(0, 0);
      scene.resumeIdleBlink();
      updateEffectiveAngles();
      return;
    }

    try {
      // Lazy-init tracker on first click
      if (!tracker) {
        trackingBtn.dataset.tooltip = 'Loading model…';
        trackingBtn.disabled = true;
        tracker = new FaceTracker(trackingVideo, (result) => {
          headYaw = -result.yawDeg;
          headPitch = -result.pitchDeg;
          trackingYawEl.textContent = `Yaw: ${Math.round(headYaw)}°`;
          trackingPitchEl.textContent = `Pitch: ${Math.round(headPitch)}°`;
          scene.setHeadRotation(-headYaw, -headPitch);
          scene.setBlendShapes(result.blendShapes);
          updateEffectiveAngles();
        });
        await tracker.init();
        trackingBtn.disabled = false;
      }

      await tracker.start();
      trackingActive = true;
      trackingBtn.dataset.tooltip = 'Disable Head Tracking';
      trackingBtn.classList.add('active');
      fadeIn(trackingVideo);
      fadeIn(trackingStatus);
      trackEvent('tracking_enabled');
    } catch (err) {
      trackingBtn.disabled = false;
      trackingBtn.dataset.tooltip = 'Enable Head Tracking';
      trackEvent('tracking_denied');
    }
  });
}
