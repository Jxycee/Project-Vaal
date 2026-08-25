import Link from 'next/link';
import { WIKI_BASE_PATH } from '@/lib/wiki/types';
import type { WikiEntryKind } from '@/lib/wiki/types';

const KIND_LABEL: Record<WikiEntryKind, string> = {
  item: 'Items',
  skill: 'Skills',
  mod: 'Mods',
  effect: 'Effects',
};

export function WikiBreadcrumb({ kind, name }: { kind: WikiEntryKind; name: string }) {
  const label = KIND_LABEL[kind];
  const basePath = WIKI_BASE_PATH[kind];
  return (
    <nav className="flex items-center gap-1.5 text-xs text-muted-foreground" aria-label="Breadcrumb">
      <Link href={basePath} className="hover:text-primary">{label}</Link>
      <span>/</span>
      <span className="text-foreground">{name}</span>
    </nav>
  );
}
