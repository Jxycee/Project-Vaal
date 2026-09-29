'use client';

// "Signed in as <username|email> ✎" on the dashboard hero.
//
// Flow: ✎ -> type -> Save (or Enter) -> confirmation panel -> Confirm. Nothing
// is written until Confirm. The rules (format, word filter) come from the same
// lib the Server Function uses, so the inline feedback and the server agree;
// the server and the database remain the authority (weekly limit, uniqueness).
import { useRef, useState, useSyncExternalStore, useTransition } from 'react';
import { setUsername } from '@/app/(dashboard)/dashboard/actions';
import { callAction } from '@/lib/callAction';
import { USERNAME_CHANGE_WINDOW_DAYS, USERNAME_FORMAT_ERROR, validateUsername } from '@/lib/profile/username';
import { Input } from '@/components/ui/input';

interface Props {
  email: string;
  displayName: string | null;
  /** user_profiles.display_name_changed_at: when the name was last CHANGED (not first set). */
  changedAt: string | null;
}

type Mode = 'view' | 'edit' | 'confirm';

const WINDOW_MS = USERNAME_CHANGE_WINDOW_DAYS * 24 * 60 * 60 * 1000;

const noopSubscribe = () => () => {};

// Dates are shown in the viewer's own timezone, which the server cannot know:
// render them only after hydration so server and client markup agree.
function useMounted(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

function localDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

const buttonBase =
  'inline-flex min-h-11 items-center justify-center rounded-md px-4 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50';
const primaryButton = `${buttonBase} bg-primary text-primary-foreground hover:opacity-90`;
const secondaryButton = `${buttonBase} border border-border bg-background/45 hover:bg-accent/50`;

export function UsernameControl({ email, displayName, changedAt }: Props) {
  const mounted = useMounted();
  const [name, setName] = useState(displayName);
  const [changedMs, setChangedMs] = useState(changedAt ? Date.parse(changedAt) : null);
  const [mode, setMode] = useState<Mode>('view');
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [nowMs, setNowMs] = useState(() => Date.now());
  const editButtonRef = useRef<HTMLButtonElement>(null);

  // The weekly rule only applies to CHANGING an existing name; the first set
  // is free (the database ignores the clock until a name exists).
  const lockedUntil = name && changedMs !== null && !Number.isNaN(changedMs) ? changedMs + WINDOW_MS : null;
  const locked = lockedUntil !== null && lockedUntil > nowMs;

  const checked = validateUsername(draft);
  const liveError = draft.trim() === '' ? null : checked.ok ? null : checked.error;
  const isChange = name !== null;

  function focusEditButton() {
    requestAnimationFrame(() => editButtonRef.current?.focus());
  }

  function open() {
    setDraft(name ?? '');
    setError(null);
    setMode('edit');
  }

  function close() {
    setMode('view');
    setError(null);
    focusEditButton();
  }

  function review(e: React.FormEvent) {
    e.preventDefault();
    const result = validateUsername(draft);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    if (result.value === name) {
      setError('That is already your username.');
      return;
    }
    setError(null);
    setDraft(result.value);
    setMode('confirm');
  }

  function confirm() {
    startTransition(async () => {
      const result = await callAction(() => setUsername(draft));
      if (result.ok) {
        const now = Date.now();
        // A change (not the first set) starts the weekly clock server-side.
        if (isChange) {
          setChangedMs(now);
          setNowMs(now);
        }
        setName(result.name);
        setMode('view');
        setError(null);
        focusEditButton();
        return;
      }
      setError(result.error);
      const nextAt = 'nextChangeAt' in result ? result.nextChangeAt : undefined;
      if (nextAt) {
        // The server knows better than this page's copy: adopt its clock.
        setChangedMs(Date.parse(nextAt) - WINDOW_MS);
        setNowMs(Date.now());
        setMode('view');
      } else {
        setMode('edit');
      }
    });
  }

  return (
    <div data-testid="username-control">
      <div className="mt-2 flex flex-wrap items-center gap-x-1">
        <p className="break-all text-sm text-muted-foreground sm:break-normal">
          Signed in as{' '}
          <span data-testid="signed-in-as" className={name ? 'font-medium text-foreground' : undefined}>
            {name ?? email}
          </span>
        </p>
        <button
          ref={editButtonRef}
          type="button"
          aria-label="Edit username"
          disabled={locked || mode !== 'view'}
          onClick={open}
          className="inline-flex size-11 items-center justify-center rounded-md text-base text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground disabled:opacity-40 disabled:hover:bg-transparent"
        >
          <span aria-hidden="true">✎</span>
        </button>
      </div>

      {locked && mode === 'view' ? (
        <p data-testid="username-locked" className="text-xs text-muted-foreground">
          {mounted && lockedUntil !== null
            ? `You can change your username again on ${localDate(lockedUntil)}.`
            : 'You can change your username once a week.'}
        </p>
      ) : null}

      {mode === 'edit' ? (
        <form onSubmit={review} className="mt-2 flex flex-col gap-2" noValidate>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              aria-label="Username"
              autoFocus
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              maxLength={40}
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                setError(null);
              }}
              aria-invalid={liveError !== null || error !== null}
              className="h-11 sm:max-w-64"
            />
            <div className="flex gap-2">
              <button type="submit" className={primaryButton}>
                Save
              </button>
              <button type="button" onClick={close} className={secondaryButton}>
                Cancel
              </button>
            </div>
          </div>
          {liveError || error ? (
            <p role="alert" className="text-sm text-destructive">
              {error ?? liveError}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">{USERNAME_FORMAT_ERROR}</p>
          )}
        </form>
      ) : null}

      {mode === 'confirm' ? (
        <div
          data-testid="username-confirm"
          role="group"
          aria-label="Confirm username"
          className="mt-2 flex flex-col gap-2 rounded-lg border border-border bg-background/45 p-3"
        >
          <p className="text-sm text-foreground">
            Set your username to <strong className="break-all">{draft}</strong>?{' '}
            <span className="text-muted-foreground">
              {isChange
                ? `You won't be able to change it again for ${USERNAME_CHANGE_WINDOW_DAYS} days.`
                : 'You can change it once more right away, then once a week.'}
            </span>
          </p>
          <div className="flex gap-2">
            <button type="button" disabled={pending} onClick={confirm} className={primaryButton}>
              {pending ? 'Saving…' : 'Confirm'}
            </button>
            <button type="button" disabled={pending} onClick={() => setMode('edit')} className={secondaryButton}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {mode === 'view' && error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
