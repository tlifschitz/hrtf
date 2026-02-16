import type { AudioEngine } from '../audio-engine/engine.ts';
import { IrChart } from './ir-chart.ts';
import { SpectrumChart } from './spectrum-chart.ts';

type TabId = 'ir' | 'spectrum';

export class PlotsPanel {
  private engine: AudioEngine;
  private irChart!: IrChart;
  private spectrumChart!: SpectrumChart;
  private tabs: Map<TabId, HTMLElement> = new Map();
  private tabBtns: Map<TabId, HTMLButtonElement> = new Map();

  constructor(container: HTMLElement, engine: AudioEngine) {
    this.engine = engine;
    this.buildUI(container);
  }

  private buildUI(container: HTMLElement): void {
    // Tab bar
    const tabBar = document.createElement('div');
    tabBar.className = 'edu-tab-bar';

    const tabDefs: { id: TabId; label: string }[] = [
      { id: 'ir', label: 'IR Plot' },
      { id: 'spectrum', label: 'Spectrum (FFT)' },
    ];

    for (const { id, label } of tabDefs) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'edu-tab-btn';
      btn.textContent = label;
      btn.addEventListener('click', () => this.switchTab(id));
      tabBar.appendChild(btn);
      this.tabBtns.set(id, btn);
    }

    container.appendChild(tabBar);

    // Tab content panels
    const irPane = document.createElement('div');
    irPane.className = 'edu-tab-pane';
    const irCanvas = document.createElement('canvas');
    irPane.appendChild(irCanvas);
    container.appendChild(irPane);
    this.tabs.set('ir', irPane);

    const spectrumPane = document.createElement('div');
    spectrumPane.className = 'edu-tab-pane';
    const spectrumCanvas = document.createElement('canvas');
    spectrumPane.appendChild(spectrumCanvas);
    container.appendChild(spectrumPane);
    this.tabs.set('spectrum', spectrumPane);

    // Create charts
    this.irChart = new IrChart(irCanvas);
    this.spectrumChart = new SpectrumChart(spectrumCanvas);

    // Show initial tab
    this.switchTab('ir');
  }

  private switchTab(id: TabId): void {
    for (const [tabId, pane] of this.tabs) {
      pane.style.display = tabId === id ? 'block' : 'none';
    }
    for (const [tabId, btn] of this.tabBtns) {
      btn.classList.toggle('active', tabId === id);
    }
  }

  update(): void {
    const entry = this.engine.getCurrentHrirEntry();
    if (!entry) return;

    const sr = this.engine.getSampleRate();
    this.irChart.update(entry.left, entry.right, sr);
    this.spectrumChart.update(entry.left, entry.right, sr);
  }
}
