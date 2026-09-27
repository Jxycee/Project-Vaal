import ReadOnlyGearList from '@/components/builds/ReadOnlyGearList';
import type { GearState } from '@/lib/build/gearState';

export default function GearTab({ gear }: { gear: GearState }) {
  const jewels = Object.values(gear.jewels);
  return (
    <div id="gear-tab" role="tabpanel" data-testid="gear-tab" className="flex flex-col gap-4">
      <ReadOnlyGearList gear={gear} />
      <section>
        <h2 className="mb-2 text-sm font-semibold text-foreground">Jewels</h2>
        {jewels.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No jewels recorded.</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border bg-card/40">
            {jewels.map((item, i) => (
              <li key={`${item.slug}-${i}`} className="flex items-center gap-3 px-3 py-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-card/60">
                  {item.iconUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.iconUrl} alt="" loading="lazy" className="h-full w-full object-contain" />
                  ) : (
                    <span className="text-[10px] text-muted-foreground">—</span>
                  )}
                </span>
                <span className="min-w-0 truncate text-sm text-foreground">
                  {item.name}
                  {item.isUnique ? (
                    <span className="ml-1.5 text-xs font-medium" style={{ color: 'var(--wiki-unique)' }}>
                      Unique
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
