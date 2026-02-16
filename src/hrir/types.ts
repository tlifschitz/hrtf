export interface HrirEntry {
  azimuth: number;
  left: number[];
  right: number[];
}

export interface HrirDataset {
  sampleRate: number;
  entries: HrirEntry[];
}
