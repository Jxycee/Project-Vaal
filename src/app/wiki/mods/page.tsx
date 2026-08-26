import { Suspense } from 'react';
import { WikiBrowse } from '@/components/wiki/WikiBrowse';

export default function ModsPage() {
  return (
    <>
      <h1 className="mb-4 font-heading text-2xl text-primary">Mods</h1>
      <Suspense>
        <WikiBrowse kind="mod" />
      </Suspense>
    </>
  );
}
