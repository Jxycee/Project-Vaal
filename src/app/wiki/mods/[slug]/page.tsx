import { notFound } from 'next/navigation';
import { loadDetail } from '@/lib/wiki/load';

export const dynamicParams = true;

// Detail pages are rendered on request rather than pre-built at build time
// — with ~16,679 mods (and ~4,975 items / ~1,118 skills across the sibling
// routes), generating all of them statically would make `next build`
// prohibitively slow. See Task 5 brief deviation notes.
//
// Deliberately NOT `export const revalidate = ...` (ISR): every /wiki route
// renders through AppShell (src/components/layout/app-shell.tsx), which
// calls `supabase.auth.getUser()` — a dynamic API (reads cookies via
// next/headers) on every request, required for the auth gate. Next.js
// forbids a dynamic API call inside an ISR-cached render path and throws
// `DYNAMIC_SERVER_USAGE` at runtime if one slips through — confirmed via
// production runtime-error logs (2026-08-22) after `revalidate = 86400` was
// here. Since these pages can't be safely cached across users anyway (the
// render depends on per-request auth state), plain dynamic rendering is not
// a compromise — it's the only correct mode while AppShell reads cookies.
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

  return (
    <article className="space-y-4">
      <header>
        <h1 className="font-heading text-2xl text-primary">{mod.name}</h1>
        <p className="text-sm text-muted-foreground">
          {mod.generationType} · Tier {mod.tier ?? '—'} · Item level {mod.level}
        </p>
      </header>
      {mod.stats.length > 0 && (
        <ul className="space-y-1 text-sm">
          {mod.stats.map((stat, i) => <li key={`${i}-${stat}`}>{stat}</li>)}
        </ul>
      )}
      {spawnableOn.length > 0 && (
        <div className="border-t pt-3 text-sm">
          <p className="text-muted-foreground">Can roll on:</p>
          <ul className="flex flex-wrap gap-2 pt-1">
            {spawnableOn.map((w, i) => (
              <li key={`${i}-${w.tag}`} className="rounded border bg-card px-2 py-0.5 text-xs text-muted-foreground">
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
  );
}
