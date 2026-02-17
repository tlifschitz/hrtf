import './ui/styles.css';
import { AudioEngine } from './audio-engine/engine.ts';
import { SceneManager } from './visualization/index.ts';
import { initControls } from './ui/controls.ts';
import { runOnboarding } from './ui/onboarding.ts';

const STORAGE_KEY = 'hrtf-lab-onboarding-seen';

const engine = new AudioEngine();
const scene = new SceneManager(document.getElementById('scene-container')!);
initControls(engine, scene, () => {
  if (!localStorage.getItem(STORAGE_KEY)) {
    runOnboarding(engine, scene);
  }
});
