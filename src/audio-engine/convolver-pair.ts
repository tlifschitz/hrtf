const CROSSFADE_MS = 25;

export class ConvolverPair {
  private convA: ConvolverNode;
  private convB: ConvolverNode;
  private gainA: GainNode;
  private gainB: GainNode;
  private activeIsA = true;

  readonly input: GainNode;
  readonly output: GainNode;

  private ctx: AudioContext;

  constructor(ctx: AudioContext) {
    this.ctx = ctx;
    this.input = ctx.createGain();
    this.output = ctx.createGain();

    this.convA = ctx.createConvolver();
    this.convB = ctx.createConvolver();
    this.convA.normalize = false;
    this.convB.normalize = false;

    this.gainA = ctx.createGain();
    this.gainB = ctx.createGain();
    this.gainA.gain.value = 1;
    this.gainB.gain.value = 0;

    this.input.connect(this.convA).connect(this.gainA).connect(this.output);
    this.input.connect(this.convB).connect(this.gainB).connect(this.output);
  }

  setBuffer(buffer: AudioBuffer): void {
    const now = this.ctx.currentTime;
    const fadeEnd = now + CROSSFADE_MS / 1000;

    if (this.activeIsA) {
      this.convB.buffer = buffer;
      this.gainA.gain.linearRampToValueAtTime(0, fadeEnd);
      this.gainB.gain.linearRampToValueAtTime(1, fadeEnd);
    } else {
      this.convA.buffer = buffer;
      this.gainB.gain.linearRampToValueAtTime(0, fadeEnd);
      this.gainA.gain.linearRampToValueAtTime(1, fadeEnd);
    }
    this.activeIsA = !this.activeIsA;
  }

  disconnect(): void {
    this.input.disconnect();
    this.convA.disconnect();
    this.convB.disconnect();
    this.gainA.disconnect();
    this.gainB.disconnect();
    this.output.disconnect();
  }
}
