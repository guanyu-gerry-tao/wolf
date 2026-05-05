// Viewport widths matching real Chrome side panel sizes the user can drag
// to. Heights are kept tall enough to capture the full scroll content.

export interface Viewport {
  id: string;
  width: number;
  height: number;
}

export const VIEWPORTS: Viewport[] = [
  { id: 'narrow', width: 320, height: 1400 },
  { id: 'default', width: 400, height: 1400 },
  { id: 'wide', width: 560, height: 1400 },
];
