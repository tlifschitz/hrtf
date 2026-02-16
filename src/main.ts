import './ui/styles.css';
import { AudioEngine } from './audio-engine/engine.ts';
import { initControls } from './ui/controls.ts';

const engine = new AudioEngine();
initControls(engine);
