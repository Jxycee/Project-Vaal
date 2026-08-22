import { notFound } from 'next/navigation';
import { loadDetail } from '@/lib/wiki/load';
import { itemAccentColor } from '@/lib/wiki/accent';
import { RarityIconBox } from '@/components/wiki/RarityIconBox';
import { WikiBreadcrumb } from '@/components/wiki/WikiBreadcrumb';
import { TooltipDivider } from '@/components/wiki/TooltipDivider';
import { mergeDirectionsWithConsoleButtons } from '@/components/wiki/ConsoleButtonBadge';
import { linkMentions } from '@/components/wiki/MentionLinks';
import { loadMentionIndex } from '@/lib/wiki/mentions';

export const dynamicParams = true;
export const dynamic = 'force-dynamic';

// Detail pages are rendered on request rather than pre-built at build time
// — with ~4,975 items (and ~1,118 skills / ~16,679 mods across the sibling
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

export default async function ItemDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const item = await loadDetail('item', slug);
  if (!item) notFound();

  const mentions = await loadMentionIndex();
  const self = { kind: 'item' as const, slug: item.slug };

  const accent = itemAccentColor(item.rarity);

  const statRows: { label: string; value: string | number }[] = [];
  if (item.dropLevel > 0) statRows.push({ label: 'Drop Level', value: item.dropLevel });
  if (item.stackSize != null && item.stackSize > 1) statRows.push({ label: 'Stack Size', value: item.stackSize });
  for (const [key, value] of Object.entries(item.requirements)) {
    if (value > 0) statRows.push({ label: cap(key), value });
  }
  if (item.armour) {
    const ARMOUR_LABEL: Record<string, string> = {
      armour: 'Armour',
      evasion: 'Evasion',
      energyShield: 'Energy Shield',
      ward: 'Ward',
      block: 'Block',
    };
    for (const [key, value] of Object.entries(item.armour)) {
      if (value > 0) statRows.push({ label: ARMOUR_LABEL[key], value });
    }
  }
  if (item.weapon) {
    statRows.push({ label: 'Damage', value: `${item.weapon.damageMin}-${item.weapon.damageMax}` });
    statRows.push({ label: 'Attack Time', value: `${(item.weapon.attackTime / 1000).toFixed(2)}s` });
  }
  if (item.flask) {
    if (item.flask.lifeRecovery > 0) statRows.push({ label: 'Life Recovery', value: item.flask.lifeRecovery });
    if (item.flask.manaRecovery > 0) statRows.push({ label: 'Mana Recovery', value: item.flask.manaRecovery });
    statRows.push({ label: 'Duration', value: `${item.flask.duration.toFixed(1)}s` });
  }

  const hasUseText = Boolean(item.description || item.directions || item.consoleDirections);
  const modLines = [...item.implicitMods, ...(item.uniqueMods?.explicitMods ?? [])];
  const hasFlavour = Boolean(item.flavourText && item.flavourText.length > 0);
  const subtitleClass = item.uniqueMods?.baseType ?? item.itemClass ?? item.category;

  return (
    <div className="flex min-h-[60vh] flex-col">
      <WikiBreadcrumb kind="item" name={item.name} />
      <div className="flex flex-1 items-center justify-center py-8">
        <article
          className="relative mx-auto flex w-full max-w-lg min-h-[520px] flex-col justify-center space-y-4 rounded-lg border-2 bg-card px-8 py-6 text-center shadow-lg"
          style={{
            borderColor: accent,
            backgroundImage: `radial-gradient(120% 100% at 50% 0%, color-mix(in oklab, ${accent} 8%, transparent), transparent 65%)`,
          }}
        >
          <RarityIconBox
            iconUrl={item.iconUrl}
            accentColor={accent}
            size={item.rarity === 'unique' ? 120 : 96}
            iconWidth={item.iconWidth}
            iconHeight={item.iconHeight}
          />
          <div className="mx-auto -mt-2 w-fit">
            <h1
              className="font-heading text-2xl tracking-wide"
              style={item.rarity === 'unique' ? { color: accent } : undefined}
            >
              {item.name}
            </h1>
            <p className="text-sm text-muted-foreground">
              {subtitleClass}{item.rarity === 'unique' ? ' — Unique' : ''}
            </p>
          </div>

          {(modLines.length > 0 || statRows.length > 0 || hasFlavour) && (
            <>
              <TooltipDivider />
              {modLines.length > 0 && (
                <ul className="space-y-1.5 text-base font-medium">
                  {modLines.map((stat, i) => <li key={`${i}-${stat}`}>{linkMentions(stat, mentions, self)}</li>)}
                </ul>
              )}
              {statRows.length > 0 && (
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {statRows.map((row) => (
                    <li key={row.label}>
                      {row.label}: <span className="font-medium text-foreground">{row.value}</span>
                    </li>
                  ))}
                </ul>
              )}
              {item.flavourText && item.flavourText.length > 0 && (
                <p className="text-base italic text-muted-foreground">{linkMentions(item.flavourText.join(' '), mentions, self)}</p>
              )}
            </>
          )}

          {hasUseText && (
            <>
              <TooltipDivider />
              {item.description && (
                <p className="text-base whitespace-pre-line">{linkMentions(item.description, mentions, self)}</p>
              )}
              {item.directions && item.consoleButtons && (
                <p className="text-base italic text-muted-foreground whitespace-pre-line">
                  {mergeDirectionsWithConsoleButtons(item.directions, item.consoleButtons).map((node, i) => (
                    <span key={i}>{typeof node === 'string' ? linkMentions(node, mentions, self) : node}</span>
                  ))}
                </p>
              )}
              {item.directions && !item.consoleButtons && (
                <p className="text-base italic text-muted-foreground whitespace-pre-line">{linkMentions(item.directions, mentions, self)}</p>
              )}
              {item.consoleDirections && !item.consoleButtons && item.consoleDirections !== item.directions && (
                <p className="text-base italic text-muted-foreground whitespace-pre-line">
                  <span className="not-italic font-medium text-foreground">Console: </span>
                  {linkMentions(item.consoleDirections, mentions, self)}
                </p>
              )}
            </>
          )}

          {item.uniqueMods?.dropSource && (
            <>
              <TooltipDivider />
              <p className="text-base font-bold">{linkMentions(item.uniqueMods.dropSource, mentions, self)}</p>
            </>
          )}

          {item.rarity === 'unique' && !item.uniqueMods && (
            <p className="border-t border-border pt-3 text-xs text-muted-foreground">
              This item&apos;s actual modifier values aren&apos;t available yet — see the wiki design doc&apos;s
              known limitation on unique items.
            </p>
          )}
        </article>
      </div>
    </div>
  );
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
