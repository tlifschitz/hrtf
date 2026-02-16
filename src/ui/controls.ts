import { AudioEngine } from '../audio-engine/engine.ts';
import { AudioMode } from '../audio-engine/modes.ts';
import type { EngineStatus } from '../audio-engine/engine.ts';

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;

export function initControls(engine: AudioEngine): void {
  const playBtn = $<HTMLButtonElement>('#play-btn');
  const modeRadios = document.querySelectorAll<HTMLInputElement>('input[name="mode"]');
  const azimuthSlider = $<HTMLInputElement>('#azimuth-slider');
  const azimuthValue = $<HTMLSpanElement>('#azimuth-value');
  const statusEl = $<HTMLDivElement>('#status');
  const controlsEl = $<HTMLDivElement>('#controls');

  function updateStatus(status: EngineStatus, detail?: string): void {
    statusEl.classList.toggle('error', status === 'error');
    const labels: Record<EngineStatus, string> = {
      loading: 'Loading…',
      ready: 'Ready',
      playing: 'Playing',
      error: `Error: ${detail ?? 'unknown'}`,
    };
    statusEl.textContent = labels[status];

    if (status === 'ready' || status === 'playing') {
      controlsEl.classList.remove('hidden');
    }
  }

  // Initialize engine
  void engine
    .init('./audio/sample.wav', './hrir/hrir-data.json', updateStatus)
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

  // Azimuth slider
  azimuthSlider.addEventListener('input', () => {
    const deg = Number(azimuthSlider.value);
    azimuthValue.textContent = `${deg}°`;
    engine.setAzimuth(deg);
  });
}
