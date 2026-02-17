import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

export class IrChart {
  private chart: Chart;

  constructor(canvas: HTMLCanvasElement) {
    this.chart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: [],
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
            title: { display: true, text: 'Time (ms)', color: '#aaa' },
            ticks: { color: '#888', maxTicksLimit: 8 },
            grid: { color: '#333' },
          },
          y: {
            min: -1,
            max: 1,
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
    const labels = left.map((_, i) => ((i / sampleRate) * 1000).toFixed(2));
    this.chart.data.labels = labels;
    this.chart.data.datasets[0].data = left;
    this.chart.data.datasets[1].data = right;
    this.chart.update();
  }
}
