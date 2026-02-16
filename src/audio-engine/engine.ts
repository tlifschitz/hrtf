import { AudioMode } from './modes.ts';
import { ConvolverPair } from './convolver-pair.ts';
import {
  loadHrirDataset,
  findClosestEntry,
  createStereoBuffer,
} from '../hrir/hrir-loader.ts';
import type { HrirDataset } from '../hrir/types.ts';

export type EngineStatus = 'loading' | 'ready' | 'playing' | 'error';
export type StatusCallback = (status: EngineStatus, detail?: string) => void;

import workletUrl from '../worklet/passthrough-processor.js?url';

export class AudioEngine {
  private ctx!: AudioContext;
  private sourceBuffer: AudioBuffer | null = null;
  private sourceNode: AudioBufferSourceNode | null = null;
  private workletNode!: AudioWorkletNode;
  private stereoPanner!: StereoPannerNode;
  private convolverPair!: ConvolverPair;
  private hrirDataset: HrirDataset | null = null;

  private _mode: AudioMode = AudioMode.Mono;
  private _azimuth = 0;
  private _playing = false;
  private onStatus: StatusCallback = () => {};

  async init(
    audioUrl: string,
    hrirUrl: string,
    onStatus: StatusCallback,
  ): Promise<void> {
    this.onStatus = onStatus;
    this.onStatus('loading');

    try {
      this.ctx = new AudioContext();

      // Load worklet, audio file, and HRIR data in parallel
      const [, audioBuffer, hrirDataset] = await Promise.all([
        this.ctx.audioWorklet.addModule(workletUrl),
        this.loadAudio(audioUrl),
        loadHrirDataset(hrirUrl),
      ]);

      this.sourceBuffer = audioBuffer;
      this.hrirDataset = hrirDataset;

      // Create nodes
      this.workletNode = new AudioWorkletNode(this.ctx, 'passthrough-processor');
      this.stereoPanner = this.ctx.createStereoPanner();
      this.convolverPair = new ConvolverPair(this.ctx);

      // Set initial HRIR buffer
      const entry = findClosestEntry(this.hrirDataset, 0);
      const irBuffer = createStereoBuffer(this.ctx, entry, this.hrirDataset.sampleRate);
      this.convolverPair.setBuffer(irBuffer);

      this.onStatus('ready');
    } catch (err) {
      this.onStatus('error', (err as Error).message);
      throw err;
    }
  }

  private async loadAudio(url: string): Promise<AudioBuffer> {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to load audio: ${response.status}`);
    const arrayBuffer = await response.arrayBuffer();
    return this.ctx.decodeAudioData(arrayBuffer);
  }

  private connectGraph(): void {
    // Disconnect everything from worklet output first
    this.workletNode.disconnect();
    this.stereoPanner.disconnect();
    this.convolverPair.output.disconnect();

    switch (this._mode) {
      case AudioMode.Mono:
        this.workletNode.connect(this.ctx.destination);
        break;

      case AudioMode.Stereo:
        this.stereoPanner.pan.value = this._azimuth / 80; // normalize to -1..1
        this.workletNode.connect(this.stereoPanner).connect(this.ctx.destination);
        break;

      case AudioMode.Binaural:
        this.workletNode.connect(this.convolverPair.input);
        this.convolverPair.output.connect(this.ctx.destination);
        break;
    }
  }

  play(): void {
    if (this._playing || !this.sourceBuffer) return;

    // Resume context (handles browser autoplay policy)
    void this.ctx.resume();

    this.sourceNode = this.ctx.createBufferSource();
    this.sourceNode.buffer = this.sourceBuffer;
    this.sourceNode.loop = true;
    this.sourceNode.connect(this.workletNode);

    this.connectGraph();
    this.sourceNode.start();
    this._playing = true;
    this.onStatus('playing');
  }

  stop(): void {
    if (!this._playing || !this.sourceNode) return;

    this.sourceNode.stop();
    this.sourceNode.disconnect();
    this.sourceNode = null;
    this._playing = false;
    this.onStatus('ready');
  }

  get playing(): boolean {
    return this._playing;
  }

  setMode(mode: AudioMode): void {
    this._mode = mode;
    if (this._playing) {
      this.connectGraph();
    }
  }

  setAzimuth(degrees: number): void {
    this._azimuth = degrees;

    if (this._mode === AudioMode.Stereo) {
      this.stereoPanner.pan.value = degrees / 80;
    }

    if (this._mode === AudioMode.Binaural && this.hrirDataset) {
      const entry = findClosestEntry(this.hrirDataset, degrees);
      const irBuffer = createStereoBuffer(this.ctx, entry, this.hrirDataset.sampleRate);
      this.convolverPair.setBuffer(irBuffer);
    }
  }
}
