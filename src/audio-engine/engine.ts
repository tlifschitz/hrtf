import { AudioMode } from './modes.ts';
import { ConvolverPair } from './convolver-pair.ts';
import {
  loadHrirDataset,
  loadSubjectList,
  findClosestEntry,
  createStereoBuffer,
} from '../hrir/hrir-loader.ts';
import type { HrirDataset, SubjectInfo } from '../hrir/types.ts';

export type EngineStatus = 'loading' | 'ready' | 'playing' | 'error';
export type StatusCallback = (status: EngineStatus, detail?: string) => void;

import workletUrl from '../worklet/passthrough-processor.js?url';

export interface AudioSource {
  id: string;
  label: string;
  url: string;
}

export const AUDIO_SOURCES: AudioSource[] = [
  { id: 'white-noise',  label: 'White noise',      url: './audio/white-noise.wav' },
  { id: 'pink-noise',   label: 'Pink noise',       url: './audio/pink-noise.wav' },
  { id: 'brown-noise',  label: 'Brown noise',      url: './audio/brown-noise.wav' },
  { id: 'real-speech',  label: 'Speech',           url: './audio/a-dream-within-a-dream.wav' },
  { id: 'synth-speech', label: 'Synthetic Speech', url: './audio/speech.wav' },
];

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
  private _elevation = 0;
  private _playing = false;
  private onStatus: StatusCallback = () => {};

  private subjects: SubjectInfo[] = [];
  private hrirBaseUrl = './hrir';

  async init(
    hrirBaseUrl: string,
    onStatus: StatusCallback,
  ): Promise<SubjectInfo[]> {
    this.onStatus = onStatus;
    this.hrirBaseUrl = hrirBaseUrl;
    this.onStatus('loading');

    try {
      this.ctx = new AudioContext();

      // Load worklet, default audio, and subject manifest in parallel
      const [, audioBuffer, subjects] = await Promise.all([
        this.ctx.audioWorklet.addModule(workletUrl),
        this.loadAudio(AUDIO_SOURCES[0].url),
        loadSubjectList(`${hrirBaseUrl}/subjects.json`),
      ]);

      this.sourceBuffer = audioBuffer;
      this.subjects = subjects;

      // Create nodes
      this.workletNode = new AudioWorkletNode(this.ctx, 'passthrough-processor');
      this.stereoPanner = this.ctx.createStereoPanner();
      this.convolverPair = new ConvolverPair(this.ctx);

      // Load default subject (first in manifest)
      if (subjects.length > 0) {
        await this.loadSubjectData(subjects[0]);
      }

      this.onStatus('ready');
      return this.subjects;
    } catch (err) {
      this.onStatus('error', (err as Error).message);
      throw err;
    }
  }

  private async loadSubjectData(subject: SubjectInfo): Promise<void> {
    const url = `${this.hrirBaseUrl}/${subject.file}`;
    this.hrirDataset = await loadHrirDataset(url);
    this.updateHrir();
  }

  private async loadAudio(url: string): Promise<AudioBuffer> {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to load audio: ${response.status}`);
    const arrayBuffer = await response.arrayBuffer();
    return this.ctx.decodeAudioData(arrayBuffer);
  }

  private async updateHrir(): Promise<void> {
    if (!this.hrirDataset) return;
    const entry = findClosestEntry(this.hrirDataset, this._azimuth, this._elevation);
    const irBuffer = await createStereoBuffer(this.ctx, entry, this.hrirDataset.sampleRate);
    this.convolverPair.setBuffer(irBuffer);
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

    if (this._mode === AudioMode.Binaural) {
      void this.updateHrir();
    }
  }

  setElevation(degrees: number): void {
    this._elevation = degrees;

    if (this._mode === AudioMode.Binaural) {
      void this.updateHrir();
    }
  }

  async setSubject(subjectId: string): Promise<void> {
    const subject = this.subjects.find((s) => s.id === subjectId);
    if (!subject) throw new Error(`Unknown subject: ${subjectId}`);

    const prevStatus = this._playing ? 'playing' : 'ready';
    this.onStatus('loading', `Loading ${subject.label}…`);

    await this.loadSubjectData(subject);

    this.onStatus(prevStatus as EngineStatus);
  }

  async setSource(sourceId: string): Promise<void> {
    const source = AUDIO_SOURCES.find((s) => s.id === sourceId);
    if (!source) throw new Error(`Unknown source: ${sourceId}`);

    const wasPlaying = this._playing;
    if (wasPlaying) this.stop();

    this.onStatus('loading', `Loading ${source.label}…`);
    this.sourceBuffer = await this.loadAudio(source.url);
    this.onStatus('ready');

    if (wasPlaying) this.play();
  }
}
