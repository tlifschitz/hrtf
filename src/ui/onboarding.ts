const STORAGE_KEY = 'hrtf-lab-onboarding-seen';

interface Step {
  target: string;
  title: string;
  message: string;
}

const STEPS: Step[] = [
  {
    target: '#scene-container',
    title: '3D Scene',
    message:
      'This 3D scene shows a sound source around a head. Its position determines what you hear.',
  },
  {
    target: '#mode-selector',
    title: 'Audio Modes',
    message:
      'Switch between Mono, Stereo, and Binaural to hear the difference spatial audio makes.',
  },
  {
    target: '#azimuth-group',
    title: 'Move the Source',
    message:
      'Drag the sliders to move the sound source. Notice how the audio changes.',
  },
  {
    target: '#tracking-btn',
    title: 'Head Tracking',
    message:
      'Enable head tracking to use your webcam. Turn your head and the audio follows!',
  },
];

let overlay: HTMLDivElement | null = null;
let spotlight: HTMLDivElement | null = null;
let card: HTMLDivElement | null = null;
let currentStep = 0;

function createElements(): void {
  overlay = document.createElement('div');
  overlay.className = 'onboarding-overlay';

  spotlight = document.createElement('div');
  spotlight.className = 'onboarding-spotlight';

  card = document.createElement('div');
  card.className = 'onboarding-card';

  overlay.appendChild(spotlight);
  overlay.appendChild(card);
  document.body.appendChild(overlay);
}

function positionSpotlight(el: HTMLElement): void {
  const rect = el.getBoundingClientRect();
  const pad = 8;
  spotlight!.style.left = `${rect.left - pad}px`;
  spotlight!.style.top = `${rect.top - pad}px`;
  spotlight!.style.width = `${rect.width + pad * 2}px`;
  spotlight!.style.height = `${rect.height + pad * 2}px`;
}

function positionCard(el: HTMLElement): void {
  const rect = el.getBoundingClientRect();
  const cardEl = card!;

  // Position card below or above target depending on space
  const spaceBelow = window.innerHeight - rect.bottom;
  if (spaceBelow > 200) {
    cardEl.style.top = `${rect.bottom + 16}px`;
    cardEl.style.bottom = 'auto';
  } else {
    cardEl.style.top = 'auto';
    cardEl.style.bottom = `${window.innerHeight - rect.top + 16}px`;
  }

  // Center horizontally relative to target, clamped to viewport
  const centerX = rect.left + rect.width / 2;
  const cardWidth = 320;
  const left = Math.max(16, Math.min(centerX - cardWidth / 2, window.innerWidth - cardWidth - 16));
  cardEl.style.left = `${left}px`;
}

function renderStep(): void {
  const step = STEPS[currentStep];
  const target = document.querySelector<HTMLElement>(step.target);
  if (!target) return;

  positionSpotlight(target);
  positionCard(target);

  card!.innerHTML = `
    <div class="onboarding-step-counter">Step ${currentStep + 1} of ${STEPS.length}</div>
    <h3 class="onboarding-title">${step.title}</h3>
    <p class="onboarding-message">${step.message}</p>
    <div class="onboarding-actions">
      <button class="onboarding-skip" type="button">Skip</button>
      <button class="onboarding-next" type="button">
        ${currentStep < STEPS.length - 1 ? 'Next' : 'Done'}
      </button>
    </div>
  `;

  card!.querySelector('.onboarding-skip')!.addEventListener('click', close);
  card!.querySelector('.onboarding-next')!.addEventListener('click', next);
}

function next(): void {
  currentStep++;
  if (currentStep >= STEPS.length) {
    close();
  } else {
    renderStep();
  }
}

function close(): void {
  localStorage.setItem(STORAGE_KEY, '1');
  overlay?.remove();
  overlay = null;
  spotlight = null;
  card = null;
  currentStep = 0;
}

export function maybeShowOnboarding(): void {
  if (localStorage.getItem(STORAGE_KEY)) return;

  createElements();
  renderStep();
}
