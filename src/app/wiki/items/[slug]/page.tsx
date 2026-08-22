import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { loadDetail } from '@/lib/wiki/load';
import { itemAccentColor } from '@/lib/wiki/accent';
import { RarityIconBox } from '@/components/wiki/RarityIconBox';
import { DetailInfoPanel } from '@/components/wiki/DetailInfoPanel';

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

  const accent = itemAccentColor(item.rarity);

  const rows: { label: string; value: string | number }[] = [
    { label: 'Item Class', value: item.itemClass ?? item.category },
    { label: 'Rarity', value: item.rarity === 'unique' ? 'Unique' : 'Normal' },
  ];
  if (item.dropLevel > 0) rows.push({ label: 'Drop Level', value: item.dropLevel });
  if (item.stackSize != null && item.stackSize > 1) rows.push({ label: 'Stack Size', value: item.stackSize });
  for (const [key, value] of Object.entries(item.requirements)) {
    if (value > 0) rows.push({ label: cap(key), value });
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
      if (value > 0) rows.push({ label: ARMOUR_LABEL[key], value });
    }
  }
  if (item.weapon) {
    rows.push({ label: 'Damage', value: `${item.weapon.damageMin}-${item.weapon.damageMax}` });
    rows.push({ label: 'Attack Time', value: `${(item.weapon.attackTime / 1000).toFixed(2)}s` });
  }

  return (
    <div className="space-y-4">
      <nav className="flex items-center gap-1.5 text-xs text-muted-foreground" aria-label="Breadcrumb">
        <Link href="/wiki" className="hover:text-primary">Wiki</Link>
        <span>/</span>
        <Link href="/wiki/items" className="hover:text-primary">Items</Link>
        <span>/</span>
        <span className="text-foreground">{item.name}</span>
      </nav>
      <div className="grid gap-8 md:grid-cols-[1fr_280px] md:items-start">
        <article className="space-y-4">
          <header className="flex items-center gap-4">
            <RarityIconBox iconUrl={item.iconUrl} alt="" accentColor={accent} />
            <div>
              <h1
                className="font-heading text-2xl"
                style={item.rarity === 'unique' ? { color: accent } : undefined}
              >
                {item.name}
              </h1>
              <p className="text-sm text-muted-foreground">
                {item.itemClass ?? item.category}{item.rarity === 'unique' ? ' — Unique' : ''}
              </p>
            </div>
          </header>
          <Image
            src="/ornaments/divider.png"
            alt=""
            width={1096}
            height={182}
            className="h-auto w-32 opacity-60"
          />
          {item.description && (
            <p className="text-sm whitespace-pre-line">{item.description}</p>
          )}
          {item.directions && (
            <p className="text-sm italic text-muted-foreground whitespace-pre-line">{item.directions}</p>
          )}
          {item.flavourText && item.flavourText.length > 0 && (
            <p className="border-t border-border pt-3 text-sm italic text-muted-foreground">
              {item.flavourText.join(' ')}
            </p>
          )}
          {item.rarity === 'unique' && (
            <p className="border-t border-border pt-3 text-xs text-muted-foreground">
              This item&apos;s actual modifier values aren&apos;t available yet — see the wiki design doc&apos;s
              known limitation on unique items.
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Extracted from Path of Exile 2&apos;s game files via poe2-toolkit (MIT).
          </p>
        </article>
        <DetailInfoPanel title={item.name} accentColor={accent} rows={rows} />
      </div>
    </div>
  );
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
