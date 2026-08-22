import Link from 'next/link';
import { notFound } from 'next/navigation';
import { loadDetail } from '@/lib/wiki/load';
import { MOD_ACCENT_COLOR } from '@/lib/wiki/accent';
import { DetailInfoPanel } from '@/components/wiki/DetailInfoPanel';

export const dynamicParams = true;
export const dynamic = 'force-dynamic';

// Detail pages are rendered on request rather than pre-built at build time
// — with ~16,679 mods (and ~4,975 items / ~1,118 skills across the sibling
// routes), generating all of them statically would make `next build`
// prohibitively slow. See Task 5 brief deviation notes.
//
// `dynamic = 'force-dynamic'` is required, not optional: every /wiki route
// renders through AppShell (src/components/layout/app-shell.tsx), which
// calls `supabase.auth.getUser()` — a dynamic API (reads cookies via
// next/headers) on every request, required for the auth gate. `dynamicParams
// = true` plus an empty `generateStaticParams()` puts this route in Next's
// on-demand static-generation path (render once per param on first request,
// then cache the result like ISR) unless told otherwise — and a dynamic API
// call from an ancestor layout during that path throws `DYNAMIC_SERVER_USAGE`
// at request time instead of gracefully falling back, confirmed via
// production runtime-error logs (2026-08-22): removing just
// `revalidate = 86400` was NOT sufficient, the crash persisted until this
// explicit `force-dynamic` was added. These pages can't be safely cached
// across users anyway (the render depends on per-request auth state), so
// unconditional per-request rendering isn't a compromise — it's the only
// correct mode while AppShell reads cookies.
export async function generateStaticParams() {
  return [];
}

export default async function ModDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const mod = await loadDetail('mod', slug);
  if (!mod) notFound();

  const spawnableOn = mod.spawnWeights.filter((w) => w.weight > 0);

  const rows: { label: string; value: string | number }[] = [
    { label: 'Domain', value: mod.domain },
    { label: 'Generation Type', value: mod.generationType },
    { label: 'Tier', value: mod.tier ?? '—' },
    { label: 'Item Level', value: mod.level },
  ];

  return (
    <div className="space-y-4">
      <nav className="flex items-center gap-1.5 text-xs text-muted-foreground" aria-label="Breadcrumb">
        <Link href="/wiki" className="hover:text-primary">Wiki</Link>
        <span>/</span>
        <Link href="/wiki/mods" className="hover:text-primary">Mods</Link>
        <span>/</span>
        <span className="text-foreground">{mod.name}</span>
      </nav>
      <div className="grid gap-8 md:grid-cols-[1fr_280px] md:items-start">
        <article className="space-y-4">
          <header>
            <h1 className="font-heading text-2xl" style={{ color: MOD_ACCENT_COLOR }}>{mod.name}</h1>
            <p className="text-sm text-muted-foreground">
              {mod.generationType} · Tier {mod.tier ?? '—'} · Item level {mod.level}
            </p>
          </header>
          {mod.stats.length > 0 && (
            <ul className="space-y-1 border-t border-border pt-3 text-sm">
              {mod.stats.map((stat, i) => <li key={`${i}-${stat}`}>{stat}</li>)}
            </ul>
          )}
          {spawnableOn.length > 0 && (
            <div className="border-t border-border pt-3 text-sm">
              <p className="text-muted-foreground">Can roll on:</p>
              <ul className="flex flex-wrap gap-2 pt-1">
                {spawnableOn.map((w, i) => (
                  <li key={`${i}-${w.tag}`} className="rounded border border-border bg-card px-2 py-0.5 text-xs text-muted-foreground">
                    {w.tag}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Extracted from Path of Exile 2&apos;s game files via poe2-toolkit (MIT).
          </p>
        </article>
        <DetailInfoPanel title={mod.name} accentColor={MOD_ACCENT_COLOR} rows={rows} />
      </div>
    </div>
  );
}
