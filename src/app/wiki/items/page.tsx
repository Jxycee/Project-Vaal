import { WikiBrowse } from '@/components/wiki/WikiBrowse';

export default function ItemsPage() {
  return (
    <>
      <h1 className="mb-4 font-heading text-2xl text-primary">Items</h1>
      <WikiBrowse kind="item" basePath="/wiki/items" />
    </>
  );
}
