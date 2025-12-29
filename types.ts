
export type Resolution = '1K' | '2K' | '4K';
export type AspectRatio = '1:1' | '3:4' | '4:3' | '9:16' | '16:9';

export interface GeneratedImage {
  id: string;
  url: string;
  prompt: string;
  resolution: Resolution;
  timestamp: number;
}

export interface AppState {
  isKeySelected: boolean;
  isGenerating: boolean;
  history: GeneratedImage[];
  currentResolution: Resolution;
  currentAspectRatio: AspectRatio;
}
