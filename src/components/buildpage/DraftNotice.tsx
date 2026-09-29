'use client';

// "Unsaved changes from last time." with Restore / Discard, shown under the
// header while editing when localStorage holds a draft that differs from what
// is saved. Shared by the build page and the scratch planner; both render it
// inside a BuildSessionProvider, which owns the draft itself.
import { useBuildSession } from './session/BuildSession';

export default function DraftNotice({ edit }: { edit: boolean }) {
  const { draftPromptOpen, restoreDraft, dismissDraft } = useBuildSession();
  if (!edit || !draftPromptOpen) return null;
  return (
    <div data-testid="draft-notice" className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card/95 px-3 py-2">
      <p className="text-sm text-foreground">Unsaved changes from last time.</p>
      <div className="flex gap-2">
        <button type="button" onClick={restoreDraft} className="h-11 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">
          Restore
        </button>
        <button type="button" onClick={dismissDraft} className="h-11 rounded-md border border-border px-4 text-sm font-medium text-muted-foreground">
          Discard
        </button>
      </div>
    </div>
  );
}
