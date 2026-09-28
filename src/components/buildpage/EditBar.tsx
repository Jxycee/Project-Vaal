'use client';

// The sticky Save row, shown under the tab strip while the owner is editing
// (?edit=1). Rendered exactly once by BuildPage (never duplicated between a
// full and a compact variant) — see BuildPage's comment on why there must
// only ever be one Save button in the DOM at a time: BuildPage also hides
// this bar while the "unsaved changes" choice under the header is open,
// since that choice has its own Save action.
import { useBuildSession } from './session/BuildSession';

export default function EditBar() {
  const { saving, saveError, savedAt, dirty, save } = useBuildSession();

  let status = '';
  if (saving) status = 'Saving…';
  else if (saveError) status = saveError;
  else if (dirty) status = 'Unsaved changes';
  else if (savedAt) status = `Saved ${savedAt}`;

  return (
    <div className="flex items-center justify-between gap-3 border-t border-border bg-background/95 px-1 py-2 backdrop-blur">
      <p data-testid="save-status" role={saveError ? 'alert' : undefined} className={`min-w-0 flex-1 truncate text-sm ${saveError ? 'text-destructive' : 'text-muted-foreground'}`}>
        {status}
      </p>
      <button
        type="button"
        onClick={() => void save()}
        disabled={saving || !dirty}
        className="flex h-11 shrink-0 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        Save
      </button>
    </div>
  );
}
