'use client';

// The export result UI, shared by Build settings (the owner, by build id) and
// ReaderExport (any viewer who can read the build, by share token): a Path of
// Building 2 code with Copy, the game's .build file with Download and Copy, and
// each export's "things to know" report. It owns its own pending/error/copied
// state and takes the two actions as closures, so which door it goes through
// (and who may use it) is decided entirely by the caller's actions; nothing
// here is a security boundary.
import { useState, useTransition } from 'react';
import type { BuildFileExportResult, ExportResult } from '@/app/(dashboard)/builds/exportActions';
import { callAction } from '@/lib/callAction';

const BUTTON = 'flex h-11 min-w-11 shrink-0 items-center justify-center rounded-md border border-border px-3 text-sm text-foreground disabled:opacity-50';

export interface ExportPanelProps {
  exportCode: () => Promise<ExportResult>;
  exportFile: () => Promise<BuildFileExportResult>;
  /** Whether the viewer is mid-edit, so the intro says unsaved edits are not exported. */
  unsavedEdits?: boolean;
}

export default function ExportPanel({ exportCode, exportFile, unsavedEdits = false }: ExportPanelProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [exported, setExported] = useState<Extract<ExportResult, { ok: true }> | null>(null);
  const [buildFile, setBuildFile] = useState<Extract<BuildFileExportResult, { ok: true }> | null>(null);
  const [copied, setCopied] = useState(false);

  function runCode() {
    setError(null);
    setCopied(false);
    startTransition(async () => {
      const result = await callAction(exportCode);
      if (!result.ok) {
        setExported(null);
        setError(result.error);
        return;
      }
      setExported(result);
    });
  }

  function runFile() {
    setError(null);
    setCopied(false);
    startTransition(async () => {
      const result = await callAction(exportFile);
      if (!result.ok) {
        setBuildFile(null);
        setError(result.error);
        return;
      }
      setBuildFile(result);
    });
  }

  const buildFileText = buildFile ? JSON.stringify(buildFile.file, null, 2) : '';

  async function copyText(text: string, failure: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      // No clipboard permission: the text is in the box, selectable by hand.
      setError(failure);
    }
  }

  function downloadBuildFile() {
    if (!buildFile) return;
    const blob = new Blob([buildFileText], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${buildFile.file.name.replace(/[^A-Za-z0-9 _-]/g, '').trim() || 'build'}.build`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="flex flex-col gap-2" data-testid="export-section">
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <p className="text-xs text-muted-foreground">
        Makes a Path of Building 2 code from the saved build{unsavedEdits ? ' (your unsaved edits are not included)' : ''}. Path of Building holds one set of gear and gems, so
        those come from the checkpoint you are viewing.
      </p>
      <button type="button" onClick={runCode} disabled={pending} className={BUTTON}>
        {pending ? 'Exporting…' : 'Export to Path of Building'}
      </button>
      {exported ? (
        <div className="flex flex-col gap-2" data-testid="export-result">
          <textarea
            readOnly
            value={exported.code}
            rows={4}
            aria-label="Path of Building code"
            data-testid="export-code"
            onFocus={(e) => e.currentTarget.select()}
            className="w-full resize-none rounded-md border border-border bg-background p-2 font-mono text-xs text-foreground"
          />
          <button type="button" onClick={() => copyText(exported.code, 'Could not copy automatically. Select the code and copy it.')} className={BUTTON}>
            {copied ? 'Copied' : 'Copy code'}
          </button>
          {exported.report.length > 0 ? (
            <details className="text-xs text-muted-foreground" data-testid="export-report">
              <summary className="flex min-h-11 cursor-pointer items-center">
                {exported.report.length} thing{exported.report.length === 1 ? '' : 's'} to know
              </summary>
              <ul className="flex list-disc flex-col gap-1 pl-4">
                {exported.report.map((entry, i) => (
                  <li key={i}>{entry.message}</li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      ) : null}

      <p className="pt-2 text-xs text-muted-foreground">
        Or make a file for the game&apos;s own Build Planner. Save it in Documents/My Games/Path of Exile 2/BuildPlanner and it shows up in game. It carries the
        passive tree (with both weapon sets) and the skill gems of the checkpoint you are viewing, not items.
      </p>
      <button type="button" onClick={runFile} disabled={pending} className={BUTTON}>
        {pending ? 'Exporting…' : "Export for the game's Build Planner"}
      </button>
      {buildFile ? (
        <div className="flex flex-col gap-2" data-testid="build-file-result">
          <textarea
            readOnly
            value={buildFileText}
            rows={5}
            aria-label="Build Planner file"
            data-testid="build-file-json"
            onFocus={(e) => e.currentTarget.select()}
            className="w-full resize-none rounded-md border border-border bg-background p-2 font-mono text-xs text-foreground"
          />
          <button type="button" onClick={downloadBuildFile} className={BUTTON}>
            Download .build
          </button>
          <button type="button" onClick={() => copyText(buildFileText, 'Could not copy automatically. Select the text and copy it.')} className={BUTTON}>
            Copy JSON
          </button>
          {buildFile.report.length > 0 ? (
            <details className="text-xs text-muted-foreground" data-testid="build-file-report">
              <summary className="flex min-h-11 cursor-pointer items-center">
                {buildFile.report.length} thing{buildFile.report.length === 1 ? '' : 's'} to know
              </summary>
              <ul className="flex list-disc flex-col gap-1 pl-4">
                {buildFile.report.map((entry, i) => (
                  <li key={i}>{entry.message}</li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
