import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { notFound } from 'next/navigation';
import { WikiSearch } from '@/components/wiki/WikiSearch';
import { WIKI_DATA_VERSION } from '@/lib/wiki/types';
import type { WikiIndexFile } from '@/lib/wiki/types';

export default async function ItemsPage() {
  let raw: string | undefined;
  try {
    raw = await readFile(
      path.join(process.cwd(), 'public', 'data', 'wiki', WIKI_DATA_VERSION, 'item-index.json'),
      'utf8',
    );
  } catch {
    notFound();
  }

  const index = JSON.parse(raw!) as WikiIndexFile;
  return (
    <>
      <h1 className="mb-4 font-heading text-2xl text-primary">Items</h1>
      <WikiSearch entries={index.entries} basePath="/wiki/items" />
    </>
  );
}
