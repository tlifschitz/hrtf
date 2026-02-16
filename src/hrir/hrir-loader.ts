import type { HrirDataset, HrirEntry } from './types.ts';

let cachedDataset: HrirDataset | null = null;

export async function loadHrirDataset(url: string): Promise<HrirDataset> {
  if (cachedDataset) return cachedDataset;

  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to load HRIR data: ${response.status}`);

  const dataset: HrirDataset = await response.json();
  cachedDataset = dataset;
  return dataset;
}

export function findClosestEntry(dataset: HrirDataset, azimuth: number): HrirEntry {
  let closest = dataset.entries[0];
  let minDiff = Math.abs(closest.azimuth - azimuth);

  for (const entry of dataset.entries) {
    const diff = Math.abs(entry.azimuth - azimuth);
    if (diff < minDiff) {
      minDiff = diff;
      closest = entry;
    }
  }
  return closest;
}

export function createStereoBuffer(
  ctx: BaseAudioContext,
  entry: HrirEntry,
  sampleRate: number,
): AudioBuffer {
  const length = entry.left.length;
  const buffer = ctx.createBuffer(2, length, sampleRate);
  buffer.getChannelData(0).set(new Float32Array(entry.left));
  buffer.getChannelData(1).set(new Float32Array(entry.right));
  return buffer;
}
