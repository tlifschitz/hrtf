import './ui/styles.css';
import { AudioEngine } from './audio-engine/engine.ts';
import { SceneManager } from './visualization/index.ts';
import { initControls } from './ui/controls.ts';
import { maybeShowOnboarding } from './ui/onboarding.ts';

const engine = new AudioEngine();
const scene = new SceneManager(document.getElementById('scene-container')!);
initControls(engine, scene, () => {
  maybeShowOnboarding();
});
