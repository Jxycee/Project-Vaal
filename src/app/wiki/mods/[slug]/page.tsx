import { notFound } from 'next/navigation';
import { loadDetail } from '@/lib/wiki/load';
import { MOD_ACCENT_COLOR } from '@/lib/wiki/accent';
import { WikiBreadcrumb } from '@/components/wiki/WikiBreadcrumb';
import { TooltipDivider } from '@/components/wiki/TooltipDivider';
import { linkMentions } from '@/components/wiki/MentionLinks';
import { loadMentionIndex } from '@/lib/wiki/mentions';

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

  const mentions = await loadMentionIndex();
  const self = { kind: 'mod' as const, slug: mod.slug };

  const spawnableOn = mod.spawnWeights.filter((w) => w.weight > 0);

  const statRows = [
    { label: 'Domain', value: mod.domain },
    { label: 'Tier', value: mod.tier ?? '—' },
    { label: 'Item Level', value: mod.level },
  ];

  return (
    <div className="flex min-h-[60vh] flex-col">
      <WikiBreadcrumb kind="mod" name={mod.name} />
      <div className="flex flex-1 items-center justify-center py-8">
        {/* No icon for mods — unlike items/skills, a mod has no art of its own,
            so the name carries the header alone instead of sitting beside an
            icon box. */}
        <article
          className="relative mx-auto flex w-full max-w-lg min-h-[520px] flex-col justify-center space-y-4 rounded-lg border-2 bg-card px-8 py-6 text-center shadow-lg"
          style={{
            borderColor: MOD_ACCENT_COLOR,
            backgroundImage: `radial-gradient(120% 100% at 50% 0%, color-mix(in oklab, ${MOD_ACCENT_COLOR} 8%, transparent), transparent 65%)`,
          }}
        >
          <div className="mx-auto w-fit">
            <h1 className="font-heading text-3xl tracking-wide" style={{ color: MOD_ACCENT_COLOR }}>{mod.name}</h1>
            <p className="text-sm text-muted-foreground">{mod.generationType}</p>
          </div>

          <TooltipDivider />
          <ul className="space-y-1 text-sm text-muted-foreground">
            {statRows.map((row) => (
              <li key={row.label}>
                {row.label}: <span className="font-medium text-foreground">{row.value}</span>
              </li>
            ))}
          </ul>

          {mod.stats.length > 0 && (
            <>
              <TooltipDivider />
              <ul className="space-y-1.5 text-lg font-medium">
                {mod.stats.map((stat, i) => <li key={`${i}-${stat}`}>{linkMentions(stat, mentions, self)}</li>)}
              </ul>
            </>
          )}

          {spawnableOn.length > 0 && (
            <>
              <TooltipDivider />
              <ul className="flex flex-wrap justify-center gap-1.5">
                {spawnableOn.map((w, i) => (
                  <li key={`${i}-${w.tag}`} className="rounded border border-border bg-card px-2.5 py-1 text-sm text-muted-foreground">
                    {w.tag}
                  </li>
                ))}
              </ul>
            </>
          )}
        </article>
      </div>
    </div>
  );
}
