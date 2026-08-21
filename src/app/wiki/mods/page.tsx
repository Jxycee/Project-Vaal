import { WikiBrowse } from '@/components/wiki/WikiBrowse';

export default function ModsPage() {
  return (
    <>
      <h1 className="mb-4 font-heading text-2xl text-primary">Mods</h1>
      <WikiBrowse kind="mod" basePath="/wiki/mods" />
    </>
  );
}
