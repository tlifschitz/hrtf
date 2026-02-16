import type { HrirDataset, HrirEntry, SubjectInfo } from './types.ts';

export async function loadHrirDataset(url: string): Promise<HrirDataset> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to load HRIR data: ${response.status}`);
  return response.json();
}

export async function loadSubjectList(url: string): Promise<SubjectInfo[]> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to load subject list: ${response.status}`);
  return response.json();
}

export function findClosestEntry(
  dataset: HrirDataset,
  azimuth: number,
  elevation: number,
): HrirEntry {
  let closest = dataset.entries[0];
  let minDist = angularDistance(closest.azimuth, closest.elevation, azimuth, elevation);

  for (const entry of dataset.entries) {
    const dist = angularDistance(entry.azimuth, entry.elevation, azimuth, elevation);
    if (dist < minDist) {
      minDist = dist;
      closest = entry;
    }
  }
  return closest;
}

function angularDistance(az1: number, el1: number, az2: number, el2: number): number {
  const dAz = az1 - az2;
  const dEl = el1 - el2;
  return dAz * dAz + dEl * dEl;
}

export async function createStereoBuffer(
  ctx: BaseAudioContext,
  entry: HrirEntry,
  sampleRate: number,
): Promise<AudioBuffer> {
  const length = entry.left.length;

  if (sampleRate === ctx.sampleRate) {
    const buffer = ctx.createBuffer(2, length, sampleRate);
    buffer.getChannelData(0).set(new Float32Array(entry.left));
    buffer.getChannelData(1).set(new Float32Array(entry.right));
    return buffer;
  }

  // Resample via OfflineAudioContext to match the destination sample rate
  const resampledLength = Math.ceil(length * ctx.sampleRate / sampleRate);
  const offline = new OfflineAudioContext(2, resampledLength, ctx.sampleRate);
  const source = offline.createBufferSource();
  const srcBuffer = offline.createBuffer(2, length, sampleRate);
  srcBuffer.getChannelData(0).set(new Float32Array(entry.left));
  srcBuffer.getChannelData(1).set(new Float32Array(entry.right));
  source.buffer = srcBuffer;
  source.connect(offline.destination);
  source.start();
  return offline.startRendering();
}
