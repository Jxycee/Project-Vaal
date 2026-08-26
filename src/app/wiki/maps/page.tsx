import { Suspense } from 'react';
import { WikiBrowse } from '@/components/wiki/WikiBrowse';

export default function MapsPage() {
  return (
    <>
      <h1 className="mb-4 font-heading text-2xl text-primary">Maps</h1>
      <Suspense>
        <WikiBrowse kind="map" />
      </Suspense>
    </>
  );
}
