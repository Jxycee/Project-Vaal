import { notFound } from 'next/navigation';
import { loadDetail } from '@/lib/wiki/load';
import { skillAccentColor } from '@/lib/wiki/accent';
import { RarityIconBox } from '@/components/wiki/RarityIconBox';
import { WikiBreadcrumb } from '@/components/wiki/WikiBreadcrumb';
import { TooltipDivider } from '@/components/wiki/TooltipDivider';
import { SkillScaling } from '@/components/wiki/SkillScaling';
import { linkMentions } from '@/components/wiki/MentionLinks';
import { loadMentionIndex } from '@/lib/wiki/mentions';

export const dynamicParams = true;
export const dynamic = 'force-dynamic';

// Detail pages are rendered on request rather than pre-built at build time
// — with ~1,118 skills (and ~4,975 items / ~16,679 mods across the sibling
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

const COLOR_NAME: Record<'r' | 'g' | 'b' | 'w', string> = {
  r: 'Red (Strength)',
  g: 'Green (Dexterity)',
  b: 'Blue (Intelligence)',
  w: 'White (Universal)',
};

export default async function SkillDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const skill = await loadDetail('skill', slug);
  if (!skill) notFound();

  const mentions = await loadMentionIndex();
  const self = { kind: 'skill' as const, slug: skill.slug };

  const accent = skillAccentColor(skill.color);

  const statRows: { label: string; value: string | number }[] = [
    { label: 'Level', value: skill.requirement.level },
  ];
  if (skill.requirement.strength > 0) statRows.push({ label: 'Strength', value: skill.requirement.strength });
  if (skill.requirement.dexterity > 0) statRows.push({ label: 'Dexterity', value: skill.requirement.dexterity });
  if (skill.requirement.intelligence > 0) statRows.push({ label: 'Intelligence', value: skill.requirement.intelligence });

  return (
    <div className="flex min-h-[60vh] flex-col">
      <WikiBreadcrumb kind="skill" name={skill.name} />
      <div className="flex flex-1 items-center justify-center py-8">
        <article
          className="relative mx-auto flex w-full max-w-lg min-h-[520px] flex-col justify-center space-y-4 rounded-lg border-2 bg-card px-8 py-6 text-center shadow-lg"
          style={{
            borderColor: accent,
            backgroundImage: `radial-gradient(120% 100% at 50% 0%, color-mix(in oklab, ${accent} 8%, transparent), transparent 65%)`,
          }}
        >
          <RarityIconBox iconUrl={skill.iconUrl} accentColor={accent} size={96} />
          <div className="mx-auto -mt-2 w-fit">
            <h1 className="font-heading text-2xl tracking-wide" style={{ color: accent }}>{skill.name}</h1>
            <p className="text-sm text-muted-foreground">{skill.category} — {COLOR_NAME[skill.color]}</p>
          </div>

          {skill.tags.length > 0 && (
            <ul className="flex flex-wrap justify-center gap-1.5">
              {skill.tags.map((tag, i) => (
                <li key={`${i}-${tag}`} className="rounded border border-border bg-card px-2.5 py-1 text-sm text-muted-foreground">
                  {tag}
                </li>
              ))}
            </ul>
          )}

          <TooltipDivider />
          <ul className="space-y-1 text-sm text-muted-foreground">
            {statRows.map((row) => (
              <li key={row.label}>
                {row.label}: <span className="font-medium text-foreground">{row.value}</span>
              </li>
            ))}
          </ul>

          {skill.description && (
            <>
              <TooltipDivider />
              <p className="text-base whitespace-pre-line">{linkMentions(skill.description, mentions, self)}</p>
            </>
          )}

          {skill.scaling.length > 0 && (
            <>
              <TooltipDivider />
              <SkillScaling
                levels={skill.scaling.map((level) => ({
                  level: level.level,
                  content: (
                    <ul className="space-y-0.5 font-medium">
                      {level.stats.map((stat, i) => (
                        <li key={`${i}-${stat.text}`}>{linkMentions(stat.text, mentions, self)}</li>
                      ))}
                    </ul>
                  ),
                }))}
              />
            </>
          )}
        </article>
      </div>
    </div>
  );
}
