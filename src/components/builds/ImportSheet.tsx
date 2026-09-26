'use client';

// TEST-GRADE UI. Functional only, deliberately unstyled beyond the existing
// sheet shell, so the Path of Building 2 import can be exercised by hand and
// by e2e before the UI session designs the real thing. Replace, do not
// polish.
//
// Preview and Import both go through importActions.ts. Import sends the raw
// input again, not the previewed result: the server re-runs the whole
// pipeline rather than trusting anything the browser hands back. Editing the
// input clears the preview, so what is imported is always what was shown.
//
// Shell copied from CheckpointsSheet: a portal at z-40 with 44px controls,
// which is what e2e/mobile-layout.spec.ts's tap-target scan measures.
// The scroll body's children are shrink-0: in a flex column, a long preview
// otherwise squeezes the Preview button to 22px (caught by pob-import.spec.ts).
import { useRef, useState, useTransition } from 'react';
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

export default function ImportSheet() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [input, setInput] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ summary: ImportSummary; report: ReportEntry[] } | null>(null);

  // The text as it is NOW, for a preview that resolves after it changed.
  const latestInput = useRef('');

  const onInput = (value: string) => {
    latestInput.current = value;
    setInput(value);
    setPreview(null);
    setError(null);
  };

  const runPreview = () => {
    setError(null);
    const asked = input;
    startTransition(async () => {
      const result = await callAction(() => previewPobImport(asked));
      // The text changed while this preview was fetched (a link preview goes
      // to the build site): showing it would pair build A's summary and name
      // with build B's text, and Import would then write B under A's name.
      if (latestInput.current !== asked) return;
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
      router.push(`/tree?build=${result.id}`);
    });
  };

  const trigger = (
    <button type="button" onClick={() => setOpen(true)} className={`${BUTTON} self-start`} data-testid="open-import-sheet">
      Import from PoB
    </button>
  );

  // Also gates the SSR pass, same reasoning as CheckpointsSheet.
  if (!open || typeof document === 'undefined') return trigger;

  return (
    <>
      {trigger}
      {createPortal(
        <div className="fixed inset-0 z-40 flex flex-col bg-background" data-testid="import-sheet">
          <div className="flex items-center justify-between gap-2 border-b border-border bg-card/95 px-3 py-3 backdrop-blur">
            <span className="font-heading text-sm text-foreground">Import from Path of Building 2 (test UI)</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close import sheet"
              className="flex h-11 w-11 items-center justify-center text-muted-foreground"
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-3 py-3 *:shrink-0">
            <label className="flex flex-col gap-1 text-sm text-foreground">
              Path of Building 2 code, or a pobb.in / Maxroll / poe.ninja / poe2db.tw link
              <textarea
                value={input}
                onChange={(e) => onInput(e.target.value)}
                rows={5}
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
                <section>
                  <h2 className="text-sm font-semibold text-foreground">Kept</h2>
                  <p className="text-sm text-foreground" data-testid="import-summary">
                    {preview.summary.ascendancy ?? preview.summary.className} ({preview.summary.className}), level{' '}
                    {preview.summary.level}. {preview.summary.checkpoints.length} checkpoints, {preview.summary.skills} skills
                    with {preview.summary.gems} gems, {preview.summary.items} items, {preview.summary.jewels} jewels.
                  </p>
                  <ul className="mt-1 flex flex-col gap-1 text-sm text-muted-foreground" data-testid="import-checkpoints">
                    {preview.summary.checkpoints.map((c, i) => (
                      <li key={i}>
                        {c.name} — level {c.level}, {c.passives} passives, {c.ascendancyPassives} ascendancy
                      </li>
                    ))}
                  </ul>
                </section>

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
              </div>
            ) : null}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
