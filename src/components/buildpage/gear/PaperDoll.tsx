'use client';

// The Gear tab's paper doll: the build's equipment laid out the way the game
// arranges an inventory, one tappable cell per slot. Placeholder visuals only —
// neutral frames, the item's own icon, a text label. No GGG/Mobalytics slot art
// (AGENTS.md "GGG art use"). Layout lives in src/lib/build/paperDoll.ts; each
// cell's position is handed to CSS through custom properties so ONE DOM
// switches from the 6-column phone grid to the 8-column desktop grid at `md:`.
import type { CSSProperties } from 'react';
import type { WeaponSet } from '@poe2-toolkit/tree-core';
import { GEAR_SLOT_LABELS, type GearItem, type GearSlot } from '@/lib/build/gearSlots';
import type { GearState } from '@/lib/build/gearState';
import { DESKTOP_DOLL, DOLL_KEYS, PHONE_DOLL, dollSlot, type DollSlotKey } from '@/lib/build/paperDoll';
import type { BuildWarning } from '@/lib/build/validate';
import { WEAPON_SET_DOT } from '@/lib/build/weaponSetColors';

/** Whether a cell has room for its slot label under the item name. */
function roomForLabel(cell: { w: number; h: number }): boolean {
  return cell.w * cell.h >= 2;
}

function DollCell({
  dollKey,
  slot,
  item,
  occupiedBy,
  warnings,
  selected,
  onSelect,
}: {
  dollKey: DollSlotKey;
  slot: GearSlot;
  item: GearItem | null;
  /** The two-hander filling this (empty) off-hand, as the game draws it. */
  occupiedBy: GearItem | null;
  warnings: readonly BuildWarning[];
  selected: boolean;
  onSelect: () => void;
}) {
  const phone = PHONE_DOLL.cells[dollKey];
  const desktop = DESKTOP_DOLL.cells[dollKey];
  const label = GEAR_SLOT_LABELS[slot];
  const hasWarning = warnings.some((w) => w.severity === 'warning');
  const hasNote = warnings.some((w) => w.severity === 'note');

  const style = {
    '--pc': phone.col,
    '--pr': phone.row,
    '--pw': phone.w,
    '--ph': phone.h,
    '--dc': desktop.col,
    '--dr': desktop.row,
    '--dw': desktop.w,
    '--dh': desktop.h,
  } as CSSProperties;

  // A cell too small for its label still shows it while empty, so an empty
  // ring cell says what it is rather than a bare "Empty".
  const phoneLabel = roomForLabel(phone) || !item ? 'block' : 'hidden';
  const desktopLabel = roomForLabel(desktop) || !item ? 'md:block' : 'md:hidden';

  const shownName = item ? item.name : occupiedBy ? `Occupied by ${occupiedBy.name}` : 'Empty';

  return (
    <button
      type="button"
      data-testid={`doll-slot-${slot}`}
      aria-label={`${label}: ${shownName}`}
      aria-pressed={selected}
      onClick={onSelect}
      style={style}
      className={[
        '[grid-column:var(--pc)/span_var(--pw)] [grid-row:var(--pr)/span_var(--ph)]',
        'md:[grid-column:var(--dc)/span_var(--dw)] md:[grid-row:var(--dr)/span_var(--dh)]',
        'relative flex h-full min-h-11 w-full min-w-11 flex-col items-center justify-center gap-0.5 overflow-hidden rounded-lg border p-1 text-center',
        selected ? 'border-primary bg-primary/10' : 'border-border bg-card/40',
      ].join(' ')}
    >
      {hasWarning ? (
        <span data-testid={`gear-warning-${slot}`} aria-label="Warning" className="absolute right-0.5 top-0.5 text-[10px] leading-none text-destructive">
          ⚠
        </span>
      ) : hasNote ? (
        <span data-testid={`gear-note-${slot}`} aria-label="Note" className="absolute right-0.5 top-0.5 text-[10px] leading-none text-muted-foreground">
          ⓘ
        </span>
      ) : null}
      {item?.iconUrl ? (
        // Plain <img>, not next/image: this icon comes from /data/wiki/
        // (PROTECTED_PREFIXES in src/proxy.ts), so next/image's server-side
        // optimizer fetch would not carry the viewer's session cookie and
        // would be redirected to /login. Same reasoning for every wiki icon in the build page.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.iconUrl} alt="" loading="lazy" className="min-h-0 w-full flex-1 object-contain" />
      ) : null}
      <span className={`${phoneLabel} ${desktopLabel} w-full truncate text-[9px] leading-tight text-muted-foreground`}>{label}</span>
      {item ? (
        <span className="line-clamp-2 w-full break-words text-[9px] leading-tight text-foreground md:text-xs">{item.name}</span>
      ) : occupiedBy ? (
        <span data-testid={`gear-occupied-${slot}`} className="line-clamp-3 w-full break-words text-[9px] leading-tight text-muted-foreground md:text-xs">
          Occupied by {occupiedBy.name}
        </span>
      ) : (
        <span className="w-full truncate text-[9px] leading-tight text-muted-foreground md:text-xs">Empty</span>
      )}
    </button>
  );
}

export default function PaperDoll({
  gear,
  weaponSet,
  onWeaponSet,
  selected,
  onSelect,
  warnings,
  offHandOccupied,
}: {
  gear: GearState;
  weaponSet: WeaponSet;
  onWeaponSet: (set: WeaponSet) => void;
  /** The doll key whose detail is open, if any. */
  selected: DollSlotKey | null;
  onSelect: (key: DollSlotKey) => void;
  warnings: readonly BuildWarning[];
  offHandOccupied: Record<WeaponSet, GearItem | null>;
}) {
  return (
    <div data-testid="paper-doll" className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Weapon set</span>
        <div className="flex gap-1.5">
          {([1, 2] as const).map((set) => (
            <button
              key={set}
              type="button"
              aria-pressed={set === weaponSet}
              onClick={() => onWeaponSet(set)}
              className={
                set === weaponSet
                  ? 'flex h-11 min-w-11 items-center gap-1.5 rounded-full bg-primary px-3 text-xs font-medium text-primary-foreground'
                  : 'flex h-11 min-w-11 items-center gap-1.5 rounded-full bg-background/60 px-3 text-xs font-medium text-muted-foreground'
              }
            >
              <span className={`h-2 w-2 rounded-full ${WEAPON_SET_DOT[set]}`} />
              {set === 1 ? 'Set I' : 'Set II'}
            </button>
          ))}
        </div>
      </div>
      <div className="mx-auto grid w-full max-w-xl grid-cols-6 auto-rows-[3.25rem] gap-1.5 md:grid-cols-8 md:auto-rows-[4rem]">
        {DOLL_KEYS.map((key) => {
          const slot = dollSlot(key, weaponSet);
          return (
            <DollCell
              key={key}
              dollKey={key}
              slot={slot}
              item={gear[slot]}
              occupiedBy={key === 'weapon_off' ? offHandOccupied[weaponSet] : null}
              warnings={warnings.filter((w) => w.target.kind === 'gear' && w.target.slot === slot)}
              selected={selected === key}
              onSelect={() => onSelect(key)}
            />
          );
        })}
      </div>
    </div>
  );
}
