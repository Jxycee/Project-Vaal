import Link from 'next/link';
import type { WikiEntryKind } from '@/lib/wiki/types';

const KIND_INFO: Record<WikiEntryKind, { label: string; basePath: string }> = {
  item: { label: 'Items', basePath: '/wiki/items' },
  skill: { label: 'Skills', basePath: '/wiki/skills' },
  mod: { label: 'Mods', basePath: '/wiki/mods' },
  effect: { label: 'Effects', basePath: '/wiki/effects' },
};

export function WikiBreadcrumb({ kind, name }: { kind: WikiEntryKind; name: string }) {
  const { label, basePath } = KIND_INFO[kind];
  return (
    <nav className="flex items-center gap-1.5 text-xs text-muted-foreground" aria-label="Breadcrumb">
      <Link href={basePath} className="hover:text-primary">{label}</Link>
      <span>/</span>
      <span className="text-foreground">{name}</span>
    </nav>
  );
}
