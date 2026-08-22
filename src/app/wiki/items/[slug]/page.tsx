import Image from 'next/image';
import { notFound } from 'next/navigation';
import { loadDetail } from '@/lib/wiki/load';

export const dynamicParams = true;

// Detail pages are rendered on request rather than pre-built at build time
// — with ~4,975 items (and ~1,118 skills / ~16,679 mods across the sibling
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

export default async function ItemDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const item = await loadDetail('item', slug);
  if (!item) notFound();

  const reqs = Object.entries(item.requirements).filter(([, v]) => v > 0);
  const meta: [string, number][] = [];
  if (item.dropLevel > 0) meta.push(['Drop Level', item.dropLevel]);
  if (item.stackSize != null && item.stackSize > 1) meta.push(['Stack Size', item.stackSize]);

  return (
    <article className="space-y-4">
      <header className="flex items-start gap-3">
        {item.iconUrl && (
          <Image src={item.iconUrl} alt="" width={48} height={48} className="rounded border bg-card" unoptimized />
        )}
        <div>
          <h1 className="font-heading text-2xl text-primary">{item.name}</h1>
          <p className="text-sm text-muted-foreground">
            {item.itemClass ?? item.category}{item.rarity === 'unique' ? ' — Unique' : ''}
          </p>
        </div>
      </header>
      {meta.length > 0 && (
        <ul className="space-y-1 text-sm">
          {meta.map(([label, value]) => (
            <li key={label} className="text-muted-foreground">
              {label}: {value}
            </li>
          ))}
        </ul>
      )}
      {reqs.length > 0 && (
        <ul className="space-y-1 text-sm">
          {reqs.map(([key, value]) => (
            <li key={key} className="text-muted-foreground">
              <span className="capitalize">{key}</span>: {value}
            </li>
          ))}
        </ul>
      )}
      {item.armour && (
        <ul className="space-y-1 text-sm">
          {Object.entries(item.armour).filter(([, v]) => v > 0).map(([key, value]) => (
            <li key={key}><span className="capitalize">{key}</span>: {value}</li>
          ))}
        </ul>
      )}
      {item.weapon && (
        <ul className="space-y-1 text-sm">
          <li>Damage: {item.weapon.damageMin}-{item.weapon.damageMax}</li>
          <li>Attack time: {(item.weapon.attackTime / 1000).toFixed(2)}s</li>
        </ul>
      )}
      {item.description && (
        <p className="text-sm whitespace-pre-line">{item.description}</p>
      )}
      {item.directions && (
        <p className="text-sm italic text-muted-foreground whitespace-pre-line">{item.directions}</p>
      )}
      {item.flavourText && item.flavourText.length > 0 && (
        <p className="border-t pt-3 text-sm italic text-muted-foreground">
          {item.flavourText.join(' ')}
        </p>
      )}
      {item.rarity === 'unique' && (
        <p className="border-t pt-3 text-xs text-muted-foreground">
          This item&apos;s actual modifier values aren&apos;t available yet — see the wiki design doc&apos;s
          known limitation on unique items.
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        Extracted from Path of Exile 2&apos;s game files via poe2-toolkit (MIT).
      </p>
    </article>
  );
}
