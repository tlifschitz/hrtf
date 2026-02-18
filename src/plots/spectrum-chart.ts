import { Chart, registerables } from 'chart.js';
import { computeFFT } from './fft.ts';

Chart.register(...registerables);

export class SpectrumChart {
  private chart: Chart;

  constructor(canvas: HTMLCanvasElement) {
    this.chart = new Chart(canvas, {
      type: 'line',
      data: {
        datasets: [
          {
            label: 'Left ear',
            data: [],
            borderColor: '#00d4ff',
            borderWidth: 1.5,
            pointRadius: 0,
          },
          {
            label: 'Right ear',
            data: [],
            borderColor: '#ff8c00',
            borderWidth: 1.5,
            pointRadius: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        scales: {
          x: {
            type: 'linear',
            min: 0,
            max: 20000,
            title: { display: true, text: 'Frequency (Hz)', color: '#aaa' },
            ticks: { color: '#888', stepSize: 2500 },
            grid: { color: '#333' },
          },
          y: {
            min: -80,
            max: -30,
            title: { display: true, text: 'Magnitude (dB)', color: '#aaa' },
            ticks: { color: '#888' },
            grid: { color: '#333' },
          },
        },
        plugins: {
          legend: { labels: { color: '#ccc' } },
        },
      },
    });
  }

  update(left: number[], right: number[], sampleRate: number): void {
    const leftFFT = computeFFT(left, sampleRate);
    const rightFFT = computeFFT(right, sampleRate);

    const toPoints = (fft: typeof leftFFT) =>
      fft.freqBins.map((x, i) => ({ x, y: fft.magnitudeDb[i] }));
    this.chart.data.datasets[0].data = toPoints(leftFFT);
    this.chart.data.datasets[1].data = toPoints(rightFFT);
    this.chart.update();
  }
}
