import Image from 'next/image';
import { notFound } from 'next/navigation';
import { loadDetail } from '@/lib/wiki/load';

export const dynamicParams = true;
export const revalidate = 86400;

// Detail pages are rendered on first request and cached via ISR rather than
// pre-built at build time — with ~4,975 items (and ~1,118 skills / ~16,679
// mods across the sibling routes), generating all of them statically would
// make `next build` prohibitively slow. See Task 5 brief deviation notes.
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
      {item.flavourText && (
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
