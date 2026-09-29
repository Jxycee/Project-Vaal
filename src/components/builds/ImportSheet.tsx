'use client';

// Import a Path of Building 2 build. Opened from the library's "Import"
// button or from the new build sheet's "or import from Path of Building"
// (BuildsActions owns which sheet is open; this one renders while mounted).
//
// Preview and Import both go through importActions.ts. Import sends the raw
// input again, not the previewed result: the server re-runs the whole
// pipeline rather than trusting anything the browser hands back. Editing the
// input clears the preview, so what is imported is always what was shown.
//
// After a preview the sheet leads with a one-screen summary (class, ascendancy,
// level, what was kept and dropped, the name, Import); the per-checkpoint list
// and the full report sit behind "Show details". On success it lands on the
// new build's Overview in edit mode, by share token.
//
// Shell: a portal at z-40 with 44px controls,
// which is what e2e/mobile-layout.spec.ts's tap-target scan measures.
// The scroll body's children are shrink-0: in a flex column, a long preview
// otherwise squeezes the Preview button to 22px (caught by pob-import.spec.ts).
import { useState, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { importPobBuild, previewPobImport, type ImportSummary } from '@/app/(dashboard)/builds/importActions';
import type { ReportEntry } from '@/lib/pob/report';
import { callAction } from '@/lib/callAction';

const BUTTON = 'flex h-11 min-w-11 items-center justify-center rounded-md border border-border px-3 text-sm text-foreground disabled:opacity-50';

const SECTIONS: Array<{ kind: ReportEntry['kind']; title: string }> = [
  { kind: 'dropped', title: 'Dropped' },
  { kind: 'inferred', title: 'Inferred' },
  { kind: 'note', title: 'Notes' },
];

export default function ImportSheet({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [input, setInput] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [details, setDetails] = useState(false);
  const [preview, setPreview] = useState<{ summary: ImportSummary; report: ReportEntry[] } | null>(null);

  const onInput = (value: string) => {
    setInput(value);
    setPreview(null);
    setDetails(false);
    setError(null);
  };

  const runPreview = () => {
    setError(null);
    startTransition(async () => {
      const result = await callAction(() => previewPobImport(input));
      if (!result.ok) {
        setPreview(null);
        setError(result.error);
        return;
      }
      setPreview({ summary: result.summary, report: result.report });
      setName(result.summary.name);
    });
  };

  const runImport = () => {
    setError(null);
    startTransition(async () => {
      const result = await callAction(() => importPobBuild(input, name));
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(`/builds/${result.share_token}?tab=overview&edit=1`);
    });
  };

  // Also gates the SSR pass, same reasoning as the other sheets.
  if (typeof document === 'undefined') return null;

  const count = (kind: ReportEntry['kind']) => (preview ? preview.report.filter((r) => r.kind === kind).length : 0);

  return createPortal(
    <div className="fixed inset-0 z-40 flex flex-col bg-background" data-testid="import-sheet" role="dialog" aria-modal="true" aria-label="Import from Path of Building 2">
      <div className="flex items-center justify-between gap-2 border-b border-border bg-card/95 px-3 py-3 backdrop-blur">
        <span className="font-heading text-sm text-foreground">Import from Path of Building 2</span>
        <button type="button" onClick={onClose} aria-label="Close import sheet" className="flex h-11 w-11 items-center justify-center text-muted-foreground">
          <X size={18} />
        </button>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-3 overflow-y-auto px-3 py-3 *:shrink-0">
        <label className="flex flex-col gap-1 text-sm text-foreground">
          Path of Building 2 code, or a pobb.in / Maxroll / poe.ninja / poe2db.tw link
          <textarea
            value={input}
            onChange={(e) => onInput(e.target.value)}
            rows={preview ? 2 : 5}
            className="rounded-md border border-border bg-card p-2 font-mono text-xs text-foreground"
            data-testid="import-input"
          />
        </label>
        <button type="button" onClick={runPreview} disabled={pending || !input.trim()} className={BUTTON}>
          {pending && !preview ? 'Reading…' : 'Preview'}
        </button>

        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}

        {preview ? (
          <div className="flex flex-col gap-3" data-testid="import-preview">
            <section className="flex flex-col gap-1">
              <h2 className="text-sm font-semibold text-foreground">Kept</h2>
              <p className="text-sm text-foreground" data-testid="import-summary">
                {preview.summary.ascendancy ?? preview.summary.className} ({preview.summary.className}), level{' '}
                {preview.summary.level}. {preview.summary.checkpoints.length} checkpoints, {preview.summary.skills} skills
                with {preview.summary.gems} gems, {preview.summary.items} items, {preview.summary.jewels} jewels.
              </p>
              <p className="text-xs text-muted-foreground">
                Dropped {count('dropped')} · Inferred {count('inferred')} · Notes {count('note')}
              </p>
            </section>

            <label className="flex flex-col gap-1 text-sm text-foreground">
              Build name
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
                className="h-11 rounded-md border border-border bg-card px-2 text-sm text-foreground"
                data-testid="import-name"
              />
            </label>
            <button type="button" onClick={runImport} disabled={pending || !name.trim()} className={BUTTON}>
              {pending ? 'Importing…' : 'Import'}
            </button>

            <button type="button" onClick={() => setDetails((d) => !d)} aria-expanded={details} className={BUTTON}>
              {details ? 'Hide details' : 'Show details'}
            </button>

            {details ? (
              <div className="flex flex-col gap-3" data-testid="import-details">
                <ul className="flex flex-col gap-1 text-sm text-muted-foreground" data-testid="import-checkpoints">
                  {preview.summary.checkpoints.map((c, i) => (
                    <li key={i}>
                      {c.name} — level {c.level}, {c.passives} passives, {c.ascendancyPassives} ascendancy
                    </li>
                  ))}
                </ul>

                {SECTIONS.map(({ kind, title }) => {
                  const entries = preview.report.filter((r) => r.kind === kind);
                  if (entries.length === 0) return null;
                  return (
                    <section key={kind} data-testid={`import-report-${kind}`}>
                      <h2 className="text-sm font-semibold text-foreground">
                        {title} ({entries.length})
                      </h2>
                      <ul className="mt-1 flex list-disc flex-col gap-1 pl-5 text-sm text-muted-foreground">
                        {entries.map((entry, i) => (
                          <li key={i}>{entry.message}</li>
                        ))}
                      </ul>
                    </section>
                  );
                })}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
