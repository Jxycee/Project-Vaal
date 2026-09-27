'use client';

// At-a-glance stats for the header: Life, ES, Mana, the four resistances and
// Spirit, for one weapon set. A skeleton until the tree export and stat data
// arrive; "Stats unavailable" if either failed.
import type { WeaponSet } from '@poe2-toolkit/tree-core';
import type { SetResult } from '@/components/build/useDefenceSheets';
import type { ReservedSpiritResult } from '@/components/build/useReservedSpirit';

export type Sheets = { 1: SetResult; 2: SetResult } | { error: string } | null;

export function statLine(sheets: Sheets, set: WeaponSet, reserved: ReservedSpiritResult | null) {
  if (sheets === null || 'error' in sheets) return null;
  const s = sheets[set].sheet;
  const r = reserved ? reserved.total[set === 1 ? 'set1' : 'set2'] : null;
  return {
    life: s.life,
    es: s.energyShield,
    mana: s.mana,
    res: `${s.fire.value}/${s.cold.value}/${s.lightning.value}/${s.chaos.value}`,
    spirit: r === null ? String(s.spirit) : `${r}/${s.spirit}`,
  };
}

export default function HeaderStats({ sheets, set, reserved }: { sheets: Sheets; set: WeaponSet; reserved: ReservedSpiritResult | null }) {
  if (sheets !== null && 'error' in sheets) {
    return (
      <p data-testid="header-stats" className="text-xs text-muted-foreground">
        Stats unavailable
      </p>
    );
  }
  const line = statLine(sheets, set, reserved);
  if (!line) {
    return (
      <div data-testid="header-stats" aria-busy="true" className="flex flex-wrap gap-2">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className="h-4 w-16 animate-pulse rounded bg-muted" />
        ))}
      </div>
    );
  }
  const items: [string, string, string][] = [
    ['Life', String(line.life), 'header-stat-life'],
    ['ES', String(line.es), 'header-stat-es'],
    ['Mana', String(line.mana), 'header-stat-mana'],
    ['Res', line.res, 'header-stat-res'],
    ['Spirit', line.spirit, 'header-stat-spirit'],
  ];
  return (
    <dl data-testid="header-stats" className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
      {items.map(([label, value, id]) => (
        <div key={id} className="flex gap-1">
          <dt className="text-muted-foreground">{label}</dt>
          <dd data-testid={id} className="tabular-nums text-foreground">
            {value}
          </dd>
        </div>
      ))}
      <div className="text-muted-foreground">· Set {set === 1 ? 'I' : 'II'}</div>
    </dl>
  );
}
