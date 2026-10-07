'use client';

// The tapped doll cell's detail panel, below the doll. Readers get the item's
// card (every mod, tier and roll), its craft summary and warnings; the owner (edit mode) also gets Choose
// item / Edit affixes / Clear, which drive the standalone ItemPickerSheet and
// ItemEditorSheet (both portal themselves, so no stacking-context care here).
import { useState } from 'react';
import ItemCard from '@/components/build/ItemCard';
import ItemEditorSheet from '@/components/build/ItemEditorSheet';
import ItemPickerSheet from '@/components/build/ItemPickerSheet';
import { craftSummary } from '@/lib/build/craft';
import { GEAR_SLOT_LABELS, type GearItem, type GearSlot } from '@/lib/build/gearSlots';
import type { BuildWarning } from '@/lib/build/validate';

const ACTION_BUTTON =
  'flex h-11 min-w-11 items-center justify-center rounded-lg border border-border px-4 text-sm font-medium text-foreground';

export default function GearSlotDetail({
  slot,
  item,
  occupiedBy,
  warnings,
  edit,
  onChange,
}: {
  slot: GearSlot;
  item: GearItem | null;
  /** The two-hander filling this (empty) off-hand. */
  occupiedBy: GearItem | null;
  /** This slot's validation results only. */
  warnings: readonly BuildWarning[];
  edit: boolean;
  onChange: (slot: GearSlot, item: GearItem | null) => void;
}) {
  const [picking, setPicking] = useState(false);
  const [editing, setEditing] = useState(false);
  const craft = item?.craft;

  return (
    <section data-testid="gear-slot-detail" className="flex flex-col gap-2 rounded-lg border border-border bg-card/40 p-3">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-card/60">
          {item?.iconUrl ? (
            // Plain <img>: /data/wiki/ is auth-gated, see PaperDoll.tsx.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.iconUrl} alt="" className="h-full w-full object-contain" />
          ) : (
            <span className="text-[10px] text-muted-foreground">—</span>
          )}
        </span>
        <div className="flex min-w-0 flex-col">
          <h2 className="text-xs text-muted-foreground">{GEAR_SLOT_LABELS[slot]}</h2>
          <p className="text-sm text-foreground">
            {item ? (
              <>
                {item.name}
                {item.isUnique ? (
                  <span className="ml-1.5 text-xs font-medium" style={{ color: 'var(--wiki-unique)' }}>
                    Unique
                  </span>
                ) : null}
              </>
            ) : occupiedBy ? (
              <span className="text-muted-foreground">Occupied by {occupiedBy.name}</span>
            ) : (
              <span className="text-muted-foreground">Empty</span>
            )}
          </p>
          {craft ? (
            <p data-testid={`gear-craft-${slot}`} className="text-xs text-muted-foreground">
              {craftSummary(craft)}
            </p>
          ) : null}
        </div>
      </div>

      {/* The whole item for a reader: every mod with its tier and roll. */}
      {item ? <ItemCard item={item} /> : null}

      {warnings.length > 0 ? (
        <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
          {warnings.map((w, i) => (
            // A slot can carry several warnings with one code (two out-of-range rolls).
            <li key={`${w.code}-${i}`}>
              {w.severity === 'warning' ? '⚠ ' : 'ⓘ '}
              {w.message}
            </li>
          ))}
        </ul>
      ) : null}

      {edit ? (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setPicking(true)} className={ACTION_BUTTON}>
            Choose item
          </button>
          {item ? (
            <button type="button" onClick={() => setEditing(true)} className={ACTION_BUTTON}>
              Edit affixes
            </button>
          ) : null}
          {item ? (
            <button type="button" onClick={() => onChange(slot, null)} className={ACTION_BUTTON}>
              Clear
            </button>
          ) : null}
        </div>
      ) : null}

      {edit ? (
        <>
          <ItemEditorSheet
            item={editing ? item : null}
            warnings={editing ? warnings : []}
            onChange={(next) => onChange(slot, next)}
            onClose={() => setEditing(false)}
          />
          <ItemPickerSheet
            // Keyed by slot: a different slot remounts the
            // picker, which resets its search query without an effect.
            key={slot}
            slot={slot}
            open={picking}
            onPick={(next) => onChange(slot, next)}
            onClose={() => setPicking(false)}
          />
        </>
      ) : null}
    </section>
  );
}
