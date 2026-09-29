'use client';

// "+ New build": class -> ascendancy (optional) -> name -> Create. Creates an
// empty build through POST /api/builds (the route the editor saves through, so
// the write gate and share-token minting stay in one place) and lands on the
// new build's Overview in edit mode. "or import from Path of Building" hands
// over to the import form.
//
// Classes and ascendancies come from the static table in
// src/lib/tree/ascendancyNames.ts (checked against the vendored tree export by
// its drift test), so this needs none of the 5.1MB tree export. The ascendancy
// saved is the display name, which is what the tree editor itself saves.
//
// Shell copied from ImportSheet: a portal at z-40 with 44px controls.
import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { MAX_BUILD_NAME_LENGTH } from '@/lib/build/constants';
import { BUILD_CLASSES, ascendanciesFor } from '@/lib/tree/ascendancyNames';

const CHOICE = 'flex min-h-11 min-w-11 items-center justify-center rounded-md border px-3 text-sm';

export default function NewBuildSheet({ onClose, onImport }: { onClose: () => void; onImport: () => void }) {
  const router = useRouter();
  const [className, setClassName] = useState<string | null>(null);
  const [ascendancy, setAscendancy] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  // Held in a ref, not read from `creating`: a double Enter (or a double tap)
  // fires both handlers before React re-renders the disabled state, and each
  // would POST a build of its own.
  const creatingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  if (typeof document === 'undefined') return null;

  const ascendancies = className ? ascendanciesFor(className) : [];
  const canCreate = className !== null && name.trim().length > 0 && !creating;

  async function create() {
    if (!className || creatingRef.current) return;
    creatingRef.current = true;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch('/api/builds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          class: className,
          ascendancy,
          level: 1,
          passive_state: { set1: [], set2: [], ascendancyNodes: [] },
          gear_state: {},
          gem_state: {},
        }),
      });
      const payload = (await res.json()) as { error?: string; build?: { share_token: string | null } };
      const token = payload.build?.share_token;
      if (!res.ok || !token) {
        setError(payload.error ?? "Couldn't create that build.");
        creatingRef.current = false;
        setCreating(false);
        return;
      }
      router.push(`/builds/${token}?tab=overview&edit=1`);
    } catch {
      setError("Couldn't reach the server. Try again.");
      creatingRef.current = false;
      setCreating(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-40 flex flex-col bg-background" data-testid="new-build-sheet" role="dialog" aria-modal="true" aria-label="New build">
      <div className="flex items-center justify-between gap-2 border-b border-border bg-card/95 px-3 py-3 backdrop-blur">
        <span className="font-heading text-sm text-foreground">New build</span>
        <button type="button" onClick={onClose} aria-label="Close new build sheet" className="flex h-11 w-11 items-center justify-center text-muted-foreground">
          <X size={18} />
        </button>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-5 overflow-y-auto px-3 py-4 *:shrink-0">
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-foreground">Class</h2>
          <div className="grid grid-cols-2 gap-2">
            {BUILD_CLASSES.map((cls) => (
              <button
                key={cls}
                type="button"
                aria-pressed={className === cls}
                onClick={() => {
                  setClassName(cls);
                  setAscendancy(null);
                }}
                className={`${CHOICE} ${className === cls ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-foreground'}`}
              >
                {cls}
              </button>
            ))}
          </div>
        </section>

        {className && ascendancies.length > 0 ? (
          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold text-foreground">Ascendancy (optional)</h2>
            <div className="flex flex-wrap gap-2">
              {ascendancies.map((asc) => (
                <button
                  key={asc}
                  type="button"
                  aria-pressed={ascendancy === asc}
                  onClick={() => setAscendancy(ascendancy === asc ? null : asc)}
                  className={`${CHOICE} ${ascendancy === asc ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-foreground'}`}
                >
                  {asc}
                </button>
              ))}
            </div>
          </section>
        ) : null}

        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-foreground">Name</h2>
          <input
            aria-label="Build name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && canCreate) void create();
            }}
            maxLength={MAX_BUILD_NAME_LENGTH}
            className="h-11 min-w-0 rounded-md border border-border bg-background px-2 text-sm text-foreground"
          />
        </section>

        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <button
          type="button"
          onClick={() => void create()}
          disabled={!canCreate}
          className="flex h-11 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {creating ? 'Creating…' : 'Create build'}
        </button>

        <button type="button" onClick={onImport} className="flex min-h-11 items-center justify-center text-sm text-muted-foreground underline">
          or import from Path of Building
        </button>
      </div>
    </div>,
    document.body,
  );
}
