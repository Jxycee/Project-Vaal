import { WikiBrowse } from '@/components/wiki/WikiBrowse';

export default function EffectsPage() {
  return (
    <>
      <h1 className="mb-4 font-heading text-2xl text-primary">Effects</h1>
      <WikiBrowse kind="effect" basePath="/wiki/effects" />
    </>
  );
}
