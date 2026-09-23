// Presentational, read-only rendering of a saved GearState — no state, no
// fetch, no portal. See docs/superpowers/plans/2026-09-22-task4-sharing.md,
// "Read-only rendering": the sheets exist to solve a stacking-context problem
// (portal escaping /tree's `position: fixed` canvas) and an editing-state
// problem (ItemPickerSheet 401s with no session) that this static page has
// neither of, so it gets its own small component instead of a `readOnly`
// prop threaded into GearSheet.
import { GEAR_SLOT_LABELS, type GearItem, type GearSlot } from '@/lib/build/gearSlots';
import { WEAPON_SET_DOT } from '@/lib/build/weaponSetColors';
import type { GearState } from '@/lib/build/gearState';

const FIXED_SLOTS: readonly GearSlot[] = [
  'head',
  'body',
  'gloves',
  'boots',
  'amulet',
  'ring1',
  'ring2',
  'belt',
  'flask1',
  'flask2',
  'charm1',
  'charm2',
  'charm3',
];

function SlotRow({ slot, item }: { slot: GearSlot; item: GearItem | null }) {
  return (
    <li className="flex h-14 w-full items-center gap-3 px-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-card/60">
        {item?.iconUrl ? (
          // Plain <img>, not next/image: this icon comes from /data/wiki/
          // (PROTECTED_PREFIXES in src/proxy.ts) — next/image's server-side
          // optimizer fetch would not carry the viewer's session cookie and
          // would get redirected to /login instead of the image. Same
          // reasoning as GearSheet.tsx's SlotRow.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.iconUrl} alt="" loading="lazy" className="h-full w-full object-contain" />
        ) : (
          <span className="text-[10px] text-muted-foreground">—</span>
        )}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="text-xs text-muted-foreground">{GEAR_SLOT_LABELS[slot]}</span>
        <span className="truncate text-sm text-foreground">
          {item ? item.name : 'Empty'}
          {item?.isUnique ? (
            <span className="ml-1.5 text-xs font-medium" style={{ color: 'var(--wiki-unique)' }}>
              Unique
            </span>
          ) : null}
        </span>
      </span>
    </li>
  );
}

function WeaponSetGroup({ set, gear }: { set: 1 | 2; gear: GearState }) {
  const slots: readonly GearSlot[] = set === 1 ? ['weapon1_main', 'weapon1_off'] : ['weapon2_main', 'weapon2_off'];
  return (
    <div>
      <div className="flex items-center gap-1.5 border-b border-border/60 px-3 py-1.5">
        <span className={`h-2 w-2 rounded-full ${WEAPON_SET_DOT[set]}`} />
        <span className="text-xs font-medium text-muted-foreground">Weapon Set {set === 1 ? 'I' : 'II'}</span>
      </div>
      <ul className="divide-y divide-border/60">
        {slots.map((slot) => (
          <SlotRow key={slot} slot={slot} item={gear[slot]} />
        ))}
      </ul>
    </div>
  );
}

/**
 * Both weapon sets stacked rather than GearSheet's set-switching toggle: the
 * toggle is an editing affordance for a page with 17 slots to review at
 * once, and on a static read-only page vertical space is cheaper than a
 * control (Task 4 plan, Task 4 §4).
 */
export default function ReadOnlyGearList({ gear }: { gear: GearState }) {
  const anyGear =
    FIXED_SLOTS.some((slot) => gear[slot] !== null) ||
    gear.weapon1_main !== null ||
    gear.weapon1_off !== null ||
    gear.weapon2_main !== null ||
    gear.weapon2_off !== null;

  if (!anyGear) {
    return <p className="py-6 text-center text-sm text-muted-foreground">No gear recorded.</p>;
  }

  return (
    <div className="divide-y divide-border rounded-lg border border-border bg-card/40">
      <WeaponSetGroup set={1} gear={gear} />
      <WeaponSetGroup set={2} gear={gear} />
      <ul className="divide-y divide-border/60">
        {FIXED_SLOTS.map((slot) => (
          <SlotRow key={slot} slot={slot} item={gear[slot]} />
        ))}
      </ul>
    </div>
  );
}
