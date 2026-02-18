import type { AudioEngine } from '../audio-engine/engine.ts';
import { IrChart } from './ir-chart.ts';
import { SpectrumChart } from './spectrum-chart.ts';

export class PlotsPanel {
  private engine: AudioEngine;
  private irChart!: IrChart;
  private spectrumChart!: SpectrumChart;

  constructor(container: HTMLElement, engine: AudioEngine) {
    this.engine = engine;
    this.buildUI(container);
  }

  private buildUI(container: HTMLElement): void {
    const irCol = document.createElement('div');
    irCol.className = 'edu-chart-col';
    irCol.innerHTML = '<h3>Impulse Response</h3>';
    const irCanvas = document.createElement('canvas');
    irCol.appendChild(irCanvas);

    const specCol = document.createElement('div');
    specCol.className = 'edu-chart-col';
    specCol.innerHTML = '<h3>Spectrum</h3>';
    const specCanvas = document.createElement('canvas');
    specCol.appendChild(specCanvas);

    container.appendChild(irCol);
    container.appendChild(specCol);

    this.irChart = new IrChart(irCanvas);
    this.spectrumChart = new SpectrumChart(specCanvas);
  }

  update(): void {
    const data = this.engine.getPlotData();
    if (!data) return;
    const sr = this.engine.getSampleRate();
    this.irChart.update(data.left, data.right, sr);
    this.spectrumChart.update(data.left, data.right, sr);
  }
}
