'use client';

// The build's settings menu: visibility, tags, rename and delete. Owner only
// (HeaderActions renders it for the owner, in view and edit mode alike; a
// reader never gets the button).
//
// Every write goes through the existing Server Functions in
// builds/actions.ts, which re-check the session and the row's ownership
// themselves — nothing here is the security boundary. After a change the
// route is refreshed so the header (visibility badge, tags, Copy link) shows
// what the database now holds.
//
// The visibility vocabulary is exactly src/lib/build/visibility.ts's:
// `unlisted` is owner-only and `private` is anyone with the link. Do not
// "fix" it.
//
// Rename has ONE source of truth. While edit mode has unsaved changes the
// header's name field is bound to the session's `meta.name`, and Save writes
// it, so a rename made here in that state edits `meta.name` and lets Save
// persist it (calling renameBuild too would fork the name and be overwritten
// by the next Save). Otherwise it calls renameBuild and tells the session the
// new name is already saved.
import { useEffect, useState, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { addBuildTag, deleteBuild, removeBuildTag, renameBuild, setBuildVisibility } from '@/app/(dashboard)/builds/actions';
import { exportPobCode, type ExportResult } from '@/app/(dashboard)/builds/exportActions';
import { MAX_BUILD_NAME_LENGTH } from '@/lib/build/constants';
import { clearDraft } from '@/lib/build/draft';
import { normalizeTag } from '@/lib/build/tags';
import type { BuildVisibility } from '@/lib/build/types';
import { BUILD_VISIBILITIES, VISIBILITY_HINT, VISIBILITY_LABEL, isBuildVisibility } from '@/lib/build/visibility';
import { callAction } from '@/lib/callAction';
import { useBuildSession } from './session/BuildSession';

const INPUT = 'h-11 min-w-0 flex-1 rounded-md border border-border bg-background px-2 text-sm text-foreground';
const BUTTON = 'flex h-11 min-w-11 shrink-0 items-center justify-center rounded-md border border-border px-3 text-sm text-foreground disabled:opacity-50';

export interface BuildSettingsProps {
  buildId: string;
  visibility: string;
  /** The tags the server loaded for the owner. */
  tags: string[] | null;
  /** Whether edit mode is on. With unsaved changes, rename edits the session instead of the database. */
  edit: boolean;
  /** Every checkpoint id of this build, so deleting it can clear each checkpoint's local draft (drafts are keyed per checkpoint). */
  checkpointIds: readonly string[];
  /** The checkpoint on screen: the one whose gear and gems a Path of Building export carries. */
  activeCheckpointId?: string;
}

export default function BuildSettings({ buildId, visibility, tags, edit, checkpointIds, activeCheckpointId }: BuildSettingsProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Build settings"
        aria-haspopup="dialog"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border text-lg leading-none text-foreground"
      >
        <span aria-hidden="true">⋯</span>
      </button>
      {/* Mounted only while open (and only on the client, like ImportSheet), so
          its fields are seeded from the current props every time it opens. */}
      {open && typeof document !== 'undefined'
        ? createPortal(
            <SettingsSheet buildId={buildId} visibility={visibility} tags={tags} edit={edit} checkpointIds={checkpointIds} activeCheckpointId={activeCheckpointId} onClose={() => setOpen(false)} />,
            document.body,
          )
        : null}
    </>
  );
}

function SettingsSheet({ buildId, visibility, tags, edit, checkpointIds, activeCheckpointId, onClose }: BuildSettingsProps & { onClose: () => void }) {
  const router = useRouter();
  const { meta, dirty, setMeta, applySavedName } = useBuildSession();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const [shownVisibility, setShownVisibility] = useState<BuildVisibility | null>(isBuildVisibility(visibility) ? visibility : null);
  const [tagList, setTagList] = useState<string[]>(tags ?? []);
  const [tagDraft, setTagDraft] = useState('');
  const [nameDraft, setNameDraft] = useState(meta.name);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [exported, setExported] = useState<Extract<ExportResult, { ok: true }> | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  function run(action: () => Promise<{ ok: true } | { ok: false; error: string }>, onOk: () => void) {
    setError(null);
    setNote(null);
    startTransition(async () => {
      const result = await callAction(action);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onOk();
    });
  }

  function exportCode() {
    setError(null);
    setNote(null);
    setCopied(false);
    startTransition(async () => {
      const result = await callAction(() => exportPobCode(buildId, activeCheckpointId ?? null));
      if (!result.ok) {
        setExported(null);
        setError(result.error);
        return;
      }
      setExported(result);
    });
  }

  async function copyCode() {
    if (!exported) return;
    try {
      await navigator.clipboard.writeText(exported.code);
      setCopied(true);
    } catch {
      // No clipboard permission: the code is in the box, selectable by hand.
      setError('Could not copy automatically. Select the code and copy it.');
    }
  }

  function chooseVisibility(next: BuildVisibility) {
    if (next === shownVisibility) return;
    run(
      () => setBuildVisibility(buildId, next),
      () => {
        setShownVisibility(next);
        router.refresh();
      },
    );
  }

  function addTag() {
    const tag = normalizeTag(tagDraft);
    if (tag === null) {
      setError('Tags must be 1-32 characters.');
      return;
    }
    run(
      () => addBuildTag(buildId, tag),
      () => {
        setTagList((prev) => (prev.includes(tag) ? prev : [...prev, tag]));
        setTagDraft('');
        router.refresh();
      },
    );
  }

  function removeTag(tag: string) {
    run(
      () => removeBuildTag(buildId, tag),
      () => {
        setTagList((prev) => prev.filter((t) => t !== tag));
        router.refresh();
      },
    );
  }

  function saveName() {
    const name = nameDraft.trim();
    if (!name) {
      setError('Name cannot be empty.');
      return;
    }
    if (edit && dirty) {
      // Edit mode has unsaved work: the name lives in the session until Save.
      setError(null);
      setMeta({ name });
      setNote('Name changed. Save your edits to keep it.');
      return;
    }
    run(
      () => renameBuild(buildId, name),
      () => {
        applySavedName(name);
        setNameDraft(name);
        setNote('Name saved.');
        router.refresh();
      },
    );
  }

  function confirmDelete() {
    run(
      () => deleteBuild(buildId),
      () => {
        // The build is gone, so its local drafts are unreachable garbage: one per
        // checkpoint (draftKey scopes them that way) plus the bare pre-checkpoint key.
        clearDraft(buildId);
        for (const checkpointId of checkpointIds) clearDraft(buildId, checkpointId);
        onClose();
        router.push('/builds');
      },
    );
  }

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-background" data-testid="build-settings" role="dialog" aria-modal="true" aria-label="Build settings">
      <div className="flex items-center justify-between gap-2 border-b border-border bg-card/95 px-3 py-3 backdrop-blur">
        <span className="font-heading text-sm text-foreground">Build settings</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close build settings"
          className="flex h-11 w-11 items-center justify-center text-muted-foreground"
        >
          <X size={18} />
        </button>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-6 overflow-y-auto px-3 py-4 *:shrink-0">
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-foreground">Visibility</h2>
          <div role="radiogroup" aria-label="Visibility" className="flex flex-col gap-2">
            {BUILD_VISIBILITIES.map((v) => {
              const checked = shownVisibility === v;
              return (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={checked}
                  disabled={pending}
                  onClick={() => chooseVisibility(v)}
                  className={`flex min-h-11 min-w-0 flex-col items-start justify-center rounded-md border px-3 py-1.5 text-left disabled:opacity-60 ${
                    checked ? 'border-primary bg-primary/10' : 'border-border'
                  }`}
                >
                  <span className="text-sm font-medium text-foreground">{VISIBILITY_LABEL[v]}</span>
                  <span className="text-xs text-muted-foreground">{VISIBILITY_HINT[v]}</span>
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">Switching to Unlisted disables this link immediately.</p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-foreground">Tags</h2>
          {tagList.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {tagList.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  disabled={pending}
                  onClick={() => removeTag(tag)}
                  aria-label={`Remove tag ${tag}`}
                  className="flex h-11 max-w-full items-center gap-1.5 rounded-full border border-border bg-card px-3 text-xs text-muted-foreground disabled:opacity-60"
                >
                  <span className="truncate">#{tag}</span>
                  <X size={12} aria-hidden="true" />
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No tags yet.</p>
          )}
          <div className="flex gap-2">
            <input
              aria-label="New tag"
              value={tagDraft}
              onChange={(e) => setTagDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') addTag();
              }}
              maxLength={32}
              placeholder="tag name"
              className={INPUT}
            />
            <button type="button" onClick={addTag} disabled={pending || !tagDraft.trim()} className={BUTTON}>
              Add tag
            </button>
          </div>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-foreground">Rename</h2>
          <div className="flex gap-2">
            <input
              aria-label="Build name"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveName();
              }}
              maxLength={MAX_BUILD_NAME_LENGTH}
              className={INPUT}
            />
            <button type="button" onClick={saveName} disabled={pending || !nameDraft.trim()} className={BUTTON}>
              Save name
            </button>
          </div>
          {note ? (
            <p role="status" className="text-xs text-muted-foreground">
              {note}
            </p>
          ) : null}
        </section>

        <section className="flex flex-col gap-2 border-t border-border pt-4" data-testid="export-section">
          <h2 className="text-sm font-semibold text-foreground">Export</h2>
          <p className="text-xs text-muted-foreground">
            Makes a Path of Building 2 code from the saved build{edit && dirty ? ' (your unsaved edits are not included)' : ''}. Path of Building holds one set of gear and gems, so
            those come from the checkpoint you are viewing.
          </p>
          <button type="button" onClick={exportCode} disabled={pending} className={BUTTON}>
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
              <button type="button" onClick={copyCode} className={BUTTON}>
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
        </section>

        <section className="flex flex-col gap-2 border-t border-border pt-4">
          <h2 className="text-sm font-semibold text-foreground">Delete</h2>
          <p className="text-xs text-muted-foreground">Deletes this build and all of its checkpoints. This cannot be undone.</p>
          {confirmingDelete ? (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={confirmDelete}
                disabled={pending}
                className="flex h-11 min-w-0 flex-1 items-center justify-center rounded-md bg-destructive px-3 text-sm font-medium text-white disabled:opacity-50"
              >
                Confirm delete
              </button>
              <button type="button" onClick={() => setConfirmingDelete(false)} disabled={pending} className={BUTTON}>
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              disabled={pending}
              className="flex h-11 items-center justify-center rounded-md border border-destructive px-3 text-sm text-destructive disabled:opacity-50"
            >
              Delete build
            </button>
          )}
        </section>
      </div>
    </div>
  );
}
