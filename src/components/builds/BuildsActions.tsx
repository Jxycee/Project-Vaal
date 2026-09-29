'use client';

// The library's page actions: "+ New build" (the new build sheet), "Import"
// (the import form) and "Quick plan" (the scratch tree editor at /tree, which
// stays until the tree tab replaces it). One piece of state says which sheet
// is open, so the new build sheet's "or import from Path of Building" simply
// swaps one for the other.
import { useState } from 'react';
import Link from 'next/link';
import ImportSheet from './ImportSheet';
import NewBuildSheet from './NewBuildSheet';

const BUTTON = 'flex h-11 min-w-11 items-center justify-center rounded-md border border-border px-3 text-sm text-foreground';

export default function BuildsActions() {
  const [sheet, setSheet] = useState<'new' | 'import' | null>(null);
  return (
    <>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setSheet('new')}
          data-testid="open-new-build-sheet"
          className="flex h-11 min-w-11 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
        >
          + New build
        </button>
        <button type="button" onClick={() => setSheet('import')} data-testid="open-import-sheet" className={BUTTON}>
          Import
        </button>
        <Link href="/tree" className={BUTTON}>
          Quick plan
        </Link>
      </div>
      {sheet === 'new' ? <NewBuildSheet onClose={() => setSheet(null)} onImport={() => setSheet('import')} /> : null}
      {sheet === 'import' ? <ImportSheet onClose={() => setSheet(null)} /> : null}
    </>
  );
}
