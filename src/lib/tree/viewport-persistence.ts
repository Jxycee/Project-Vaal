// Pure viewport (pan/zoom) serialization + clamping for the passive tree.
// Persisted to localStorage so the tab restores where the user last was.

export interface Viewport {
  x: number;
  y: number;
  scale: number;
}

const STORAGE_KEY = 'vaal.tree.viewport.v1';
export const MIN_SCALE = 0.004; // must be small enough to fit the ~45k-unit tree on a phone
export const MAX_SCALE = 4;

export function clampScale(scale: number): number {
  if (!Number.isFinite(scale)) return MIN_SCALE;
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

/** Parse + validate a stored viewport; null if missing/malformed. Scale is clamped. */
export function parseViewport(raw: string | null): Viewport | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    const { x, y, scale } = o;
    if (![x, y, scale].every((n) => typeof n === 'number' && Number.isFinite(n))) return null;
    return { x: x as number, y: y as number, scale: clampScale(scale as number) };
  } catch {
    return null;
  }
}

export function serializeViewport(v: Viewport): string {
  return JSON.stringify({ x: Math.round(v.x), y: Math.round(v.y), scale: v.scale });
}

export function loadViewport(): Viewport | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    return parseViewport(localStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

export function saveViewport(v: Viewport): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, serializeViewport(v));
  } catch {
    /* quota exceeded / private mode — non-fatal */
  }
}
