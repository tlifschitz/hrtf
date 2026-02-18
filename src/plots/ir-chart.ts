import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

export class IrChart {
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
            max: 4,
            title: { display: true, text: 'Time (ms)', color: '#aaa' },
            ticks: { color: '#888', stepSize: 0.5 },
            grid: { color: '#333' },
          },
          y: {
            min: -1.5,
            max: 1.5,
            title: { display: true, text: 'Amplitude', color: '#aaa' },
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
    const toPoints = (samples: number[]) =>
      samples.map((y, i) => ({ x: (i / sampleRate) * 1000, y }));
    this.chart.data.datasets[0].data = toPoints(left);
    this.chart.data.datasets[1].data = toPoints(right);
    this.chart.update();
  }
}
