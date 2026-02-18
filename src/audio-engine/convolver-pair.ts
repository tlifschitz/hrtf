const CROSSFADE_MS = 80;

export class ConvolverPair {
  private convA: ConvolverNode;
  private convB: ConvolverNode;
  private gainA: GainNode;
  private gainB: GainNode;
  private activeIsA = true;
  private fadeEndTime = 0;
  private pendingBuffer: AudioBuffer | null = null;

  readonly input: GainNode;
  readonly output: GainNode;

  private ctx: AudioContext;

  // Equal-power crossfade curves: sin²(x) + cos²(x) = 1 → constant energy
  private static readonly FADE_IN_CURVE: Float32Array = (() => {
    const N = 128;
    const c = new Float32Array(N);
    for (let i = 0; i < N; i++) c[i] = Math.sin((i / (N - 1)) * (Math.PI / 2));
    return c;
  })();

  private static readonly FADE_OUT_CURVE: Float32Array = (() => {
    const N = 128;
    const c = new Float32Array(N);
    for (let i = 0; i < N; i++) c[i] = Math.cos((i / (N - 1)) * (Math.PI / 2));
    return c;
  })();

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
    if (this.ctx.currentTime < this.fadeEndTime) {
      this.pendingBuffer = buffer;
      return;
    }
    this.applyBuffer(buffer);
  }

  private applyBuffer(buffer: AudioBuffer): void {
    const now = this.ctx.currentTime;
    const duration = CROSSFADE_MS / 1000;
    const fadeEnd = now + duration;
    this.fadeEndTime = fadeEnd;

    if (this.activeIsA) {
      // Read current values before any cancel calls
      const curA = this.gainA.gain.value;

      // Hard-zero inactive gain before buffer assignment to prevent transient
      this.gainB.gain.cancelScheduledValues(now);
      this.gainB.gain.setValueAtTime(0, now);
      this.convB.buffer = buffer;

      // Anchor active gain at current value, then fade out
      this.gainA.gain.cancelScheduledValues(now);
      this.gainA.gain.setValueAtTime(curA, now);
      this.gainA.gain.setValueCurveAtTime(ConvolverPair.FADE_OUT_CURVE, now, duration);

      // Fade in inactive (FADE_IN_CURVE[0] = 0, so no discontinuity from hard-zero above)
      this.gainB.gain.setValueCurveAtTime(ConvolverPair.FADE_IN_CURVE, now, duration);
    } else {
      // Read current values before any cancel calls
      const curB = this.gainB.gain.value;

      // Hard-zero inactive gain before buffer assignment to prevent transient
      this.gainA.gain.cancelScheduledValues(now);
      this.gainA.gain.setValueAtTime(0, now);
      this.convA.buffer = buffer;

      // Anchor active gain at current value, then fade out
      this.gainB.gain.cancelScheduledValues(now);
      this.gainB.gain.setValueAtTime(curB, now);
      this.gainB.gain.setValueCurveAtTime(ConvolverPair.FADE_OUT_CURVE, now, duration);

      // Fade in inactive (FADE_IN_CURVE[0] = 0, so no discontinuity from hard-zero above)
      this.gainA.gain.setValueCurveAtTime(ConvolverPair.FADE_IN_CURVE, now, duration);
    }
    this.activeIsA = !this.activeIsA;

    const msRemaining = (fadeEnd - this.ctx.currentTime) * 1000;
    setTimeout(() => {
      if (this.pendingBuffer !== null) {
        const pending = this.pendingBuffer;
        this.pendingBuffer = null;
        this.applyBuffer(pending);
      }
    }, msRemaining + 30);
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
