// src/lib/build/draft.ts
// In-progress editor state, kept so a refresh mid-edit does not discard an
// unsaved allocation. This is NOT the save mechanism – it is a safety net that
// the server save clears on success.
import type { BuildEditorState } from '@/lib/build/types';

export function draftKey(classId: number, ascendancyId: string | undefined): string {
  return `vaal:tree-draft:${classId}:${ascendancyId ?? 'none'}`;
}

export function saveDraft(state: BuildEditorState): void {
  try {
    localStorage.setItem(
      draftKey(state.classId, state.ascendancyId),
      JSON.stringify(state),
    );
  } catch {
    // Private window, blocked site data, or quota exceeded. A draft is a
    // convenience; losing it must never break the editor.
  }
}

export function loadDraft(
  classId: number,
  ascendancyId: string | undefined,
): BuildEditorState | null {
  try {
    const raw = localStorage.getItem(draftKey(classId, ascendancyId));
    if (!raw) return null;
    return JSON.parse(raw) as BuildEditorState;
  } catch {
    return null;
  }
}

export function clearDraft(classId: number, ascendancyId: string | undefined): void {
  try {
    localStorage.removeItem(draftKey(classId, ascendancyId));
  } catch {
    // See saveDraft.
  }
}
