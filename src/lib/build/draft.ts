// src/lib/build/draft.ts
// In-progress editor state, kept so a refresh mid-edit does not discard an
// unsaved allocation. This is NOT the save mechanism – it is a safety net that
// the server save clears on success.
//
// Keyed by BUILD CONTEXT (buildId ?? 'scratch'), not by classId/ascendancyId.
// The old key scheme could never be restored: neither classId nor
// ascendancyId is known until PassiveTree reports its seeded state upward via
// onStateChange — and that first report fires on MOUNT, before any restore
// logic could run, immediately overwriting whatever draft was stored under
// the key it was about to compute. buildId is known at mount (it's a prop),
// so TreeBuildSession reads the draft in a lazy `useState` initialiser during
// the first render, before PassiveTree's mount effect ever fires.
import type { BuildEditorState } from '@/lib/build/types';

export function draftKey(buildId: string | undefined): string {
  return `vaal:tree-draft:${buildId ?? 'scratch'}`;
}

export function saveDraft(buildId: string | undefined, state: BuildEditorState): void {
  try {
    localStorage.setItem(draftKey(buildId), JSON.stringify(state));
  } catch {
    // Private window, blocked site data, or quota exceeded. A draft is a
    // convenience; losing it must never break the editor.
  }
}

// Validates the parsed shape rather than casting it. A draft written under
// the OLD key scheme, or hand-edited localStorage, must yield null rather
// than a malformed object that reaches PassiveTree as `initialState`.
function isValidDraft(value: unknown): value is BuildEditorState {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  if (typeof v.classId !== 'number') return false;
  if (typeof v.className !== 'string') return false;
  if (v.ascendancyId !== undefined && typeof v.ascendancyId !== 'string') return false;
  if (!Array.isArray(v.ascendancyNodes)) return false;
  const main = v.main;
  if (!main || typeof main !== 'object') return false;
  if (!Array.isArray((main as Record<string, unknown>).allocated)) return false;
  return true;
}

export function loadDraft(buildId: string | undefined): BuildEditorState | null {
  try {
    const raw = localStorage.getItem(draftKey(buildId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return isValidDraft(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function clearDraft(buildId: string | undefined): void {
  try {
    localStorage.removeItem(draftKey(buildId));
  } catch {
    // See saveDraft.
  }
}
