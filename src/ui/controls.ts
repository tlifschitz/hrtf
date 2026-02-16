import { AudioEngine, AUDIO_SOURCES } from '../audio-engine/engine.ts';
import { AudioMode } from '../audio-engine/modes.ts';
import type { EngineStatus } from '../audio-engine/engine.ts';
import type { SubjectInfo } from '../hrir/types.ts';
import type { SceneManager } from '../visualization/index.ts';

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;

export function initControls(engine: AudioEngine, scene: SceneManager): void {
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
      controlsEl.classList.remove('hidden');
    }
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
    .then((subjects) => populateSubjects(subjects))
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

  let currentAzimuth = 0;
  let currentElevation = 0;

  // Azimuth slider
  azimuthSlider.addEventListener('input', () => {
    currentAzimuth = Number(azimuthSlider.value);
    azimuthValue.textContent = `${currentAzimuth}°`;
    engine.setAzimuth(currentAzimuth);
    scene.setSourcePosition(currentAzimuth, currentElevation);
  });

  // Elevation slider
  elevationSlider.addEventListener('input', () => {
    currentElevation = Number(elevationSlider.value);
    elevationValue.textContent = `${Math.round(currentElevation)}°`;
    engine.setElevation(currentElevation);
    scene.setSourcePosition(currentAzimuth, currentElevation);
  });

  // Set initial 3D position
  scene.setSourcePosition(currentAzimuth, currentElevation);

  // Subject selector
  subjectSelect.addEventListener('change', () => {
    void engine.setSubject(subjectSelect.value);
  });
}
