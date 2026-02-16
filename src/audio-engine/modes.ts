export const AudioMode = {
  Mono: 'mono',
  Stereo: 'stereo',
  Binaural: 'binaural',
} as const;

export type AudioMode = (typeof AudioMode)[keyof typeof AudioMode];
