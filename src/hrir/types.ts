export interface HrirEntry {
  azimuth: number;
  elevation: number;
  left: number[];
  right: number[];
}

export interface HrirDataset {
  sampleRate: number;
  subjectId: string;
  entries: HrirEntry[];
}

export interface SubjectInfo {
  id: string;
  label: string;
  file: string;
}
