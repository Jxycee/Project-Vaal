import Link from 'next/link';

const KIND_INFO: Record<'item' | 'skill' | 'mod', { label: string; basePath: string }> = {
  item: { label: 'Items', basePath: '/wiki/items' },
  skill: { label: 'Skills', basePath: '/wiki/skills' },
  mod: { label: 'Mods', basePath: '/wiki/mods' },
};

export function WikiBreadcrumb({ kind, name }: { kind: 'item' | 'skill' | 'mod'; name: string }) {
  const { label, basePath } = KIND_INFO[kind];
  return (
    <nav className="flex items-center gap-1.5 text-xs text-muted-foreground" aria-label="Breadcrumb">
      <Link href={basePath} className="hover:text-primary">{label}</Link>
      <span>/</span>
      <span className="text-foreground">{name}</span>
    </nav>
  );
}
