/**
 * Minimal radix-2 FFT — returns magnitude in dB and frequency bins.
 */
export function computeFFT(
  signal: number[],
  sampleRate: number,
): { magnitudeDb: number[]; freqBins: number[] } {
  // Zero-pad to next power of 2
  const N = nextPow2(Math.max(signal.length, 2));
  const re = new Float64Array(N);
  const im = new Float64Array(N);
  for (let i = 0; i < signal.length; i++) re[i] = signal[i];

  fft(re, im);

  // Only first half (positive frequencies)
  const half = N / 2;
  const magnitudeDb: number[] = new Array(half);
  const freqBins: number[] = new Array(half);
  const binWidth = sampleRate / N;

  for (let k = 0; k < half; k++) {
    const mag = Math.sqrt(re[k] * re[k] + im[k] * im[k]) / N;
    magnitudeDb[k] = 20 * Math.log10(Math.max(mag, 1e-12));
    freqBins[k] = k * binWidth;
  }

  return { magnitudeDb, freqBins };
}

function nextPow2(n: number): number {
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}

/** In-place Cooley-Tukey radix-2 FFT */
function fft(re: Float64Array, im: Float64Array): void {
  const N = re.length;

  // Bit-reversal permutation
  for (let i = 1, j = 0; i < N; i++) {
    let bit = N >> 1;
    while (j & bit) {
      j ^= bit;
      bit >>= 1;
    }
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }

  // Butterfly stages
  for (let len = 2; len <= N; len <<= 1) {
    const halfLen = len >> 1;
    const angle = (-2 * Math.PI) / len;
    const wRe = Math.cos(angle);
    const wIm = Math.sin(angle);

    for (let i = 0; i < N; i += len) {
      let curRe = 1;
      let curIm = 0;
      for (let j = 0; j < halfLen; j++) {
        const a = i + j;
        const b = a + halfLen;
        const tRe = curRe * re[b] - curIm * im[b];
        const tIm = curRe * im[b] + curIm * re[b];
        re[b] = re[a] - tRe;
        im[b] = im[a] - tIm;
        re[a] += tRe;
        im[a] += tIm;
        const nextRe = curRe * wRe - curIm * wIm;
        curIm = curRe * wIm + curIm * wRe;
        curRe = nextRe;
      }
    }
  }
}
