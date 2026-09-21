'use client';

// Full-screen gear sheet: 17 slots as labelled, full-width tap-target rows —
// not a character-silhouette paper doll (needs ~500px to be legible; this
// app's primary viewport is a phone). See docs/superpowers/specs/2026-09-20-
// gear-design.md, "Mobile interaction."
//
// Rendered through a portal into document.body rather than in place. /tree's
// canvas wrapper (TreeEditor.tsx) is `position: fixed`, which — per the CSS
// spec, not a bug in that file — always creates its own stacking context.
// Any `z-*` on a descendant only ever competes within THAT stacking context;
// it can never out-rank the shell's `sticky ... z-20` mobile header
// (shell-chrome.tsx), which sits in the root stacking context, no matter how
// high the descendant's z-index is set. A plain `fixed inset-0 z-40` here
// visually sat under the header and made its buttons intercept clicks meant
// for this sheet — caught by e2e/gear-persistence.spec.ts's "Close gear
// sheet" click timing out. Portaling to `document.body` escapes the
// canvas's stacking context entirely, so `z-40`/`z-50` compare directly
// against the header's `z-20` in the root context and correctly win.
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import ItemPickerSheet from '@/components/build/ItemPickerSheet';
import { GEAR_SLOT_LABELS, type GearItem, type GearSlot } from '@/lib/build/gearSlots';
import { WEAPON_SET_DOT } from '@/lib/build/weaponSetColors';
import type { GearState } from '@/lib/build/gearState';
import type { WeaponSet } from '@poe2-toolkit/tree-core';

/** Slot order for the sheet's non-weapon rows, top to bottom. */
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

function weaponSlots(set: WeaponSet): readonly GearSlot[] {
  return set === 1 ? ['weapon1_main', 'weapon1_off'] : ['weapon2_main', 'weapon2_off'];
}

function SlotRow({
  slot,
  item,
  onOpenPicker,
  onClear,
}: {
  slot: GearSlot;
  item: GearItem | null;
  onOpenPicker: () => void;
  onClear: () => void;
}) {
  return (
    <li className="border-b border-border/60">
      <div className="flex h-14 w-full items-center gap-3 px-3">
        <button
          type="button"
          onClick={onOpenPicker}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-card/60 overflow-hidden">
            {item?.iconUrl ? (
              // Plain <img>, not next/image: this icon comes from
              // /data/wiki/ (PROTECTED_PREFIXES in src/proxy.ts), so
              // next/image's server-side optimizer fetch would not carry the
              // user's session cookie and would get redirected to /login
              // instead of the image — same reasoning as PricesClient.tsx's
              // icons. It's also a tiny fixed-size icon where the optimizer
              // buys nothing.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.iconUrl} alt="" className="h-full w-full object-contain" />
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
                  {' '}
                  Unique
                </span>
              ) : null}
            </span>
          </span>
        </button>
        {item ? (
          <button
            type="button"
            onClick={onClear}
            aria-label={`Clear ${GEAR_SLOT_LABELS[slot]}`}
            className="flex h-11 w-11 shrink-0 items-center justify-center text-muted-foreground"
          >
            <X size={16} />
          </button>
        ) : null}
      </div>
    </li>
  );
}

export default function GearSheet({
  open,
  gear,
  onChange,
  onClose,
}: {
  open: boolean;
  gear: GearState;
  onChange: (slot: GearSlot, item: GearItem | null) => void;
  onClose: () => void;
}) {
  // Which weapon set's two slots (main/off) the sheet currently shows. Purely
  // a display toggle for this sheet — both sets' gear always exists in
  // `gear`, same as the tree's set1/set2 both always existing regardless of
  // which one is being painted.
  const [weaponSet, setWeaponSet] = useState<WeaponSet>(1);
  const [pickerSlot, setPickerSlot] = useState<GearSlot | null>(null);

  // Also gates the SSR pass, where `document` does not exist — moot in
  // practice since `open` starts `false` and only flips true from a client
  // event, but cheap to guard explicitly rather than rely on that.
  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-40 flex flex-col bg-background">
      <div className="flex items-center justify-between gap-2 border-b border-border bg-card/95 px-3 py-3 backdrop-blur">
        <span className="font-heading text-sm text-foreground">Gear</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close gear sheet"
          className="flex h-11 w-11 items-center justify-center text-muted-foreground"
        >
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="flex items-center gap-2 border-b border-border px-3 py-3">
          <span className="text-xs text-muted-foreground">Weapon set</span>
          <div className="flex gap-1.5">
            {([1, 2] as const).map((set) => (
              <button
                key={set}
                type="button"
                onClick={() => setWeaponSet(set)}
                className={
                  set === weaponSet
                    ? 'flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-medium bg-primary text-primary-foreground'
                    : 'flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-medium bg-background/60 text-muted-foreground'
                }
              >
                <span className={`h-2 w-2 rounded-full ${WEAPON_SET_DOT[set]}`} />
                Set {set === 1 ? 'I' : 'II'}
              </button>
            ))}
          </div>
        </div>

        <ul>
          {weaponSlots(weaponSet).map((slot) => (
            <SlotRow
              key={slot}
              slot={slot}
              item={gear[slot]}
              onOpenPicker={() => setPickerSlot(slot)}
              onClear={() => onChange(slot, null)}
            />
          ))}
          {FIXED_SLOTS.map((slot) => (
            <SlotRow
              key={slot}
              slot={slot}
              item={gear[slot]}
              onOpenPicker={() => setPickerSlot(slot)}
              onClear={() => onChange(slot, null)}
            />
          ))}
        </ul>
      </div>

      <ItemPickerSheet
        // Keyed by slot: opening the picker for a different slot remounts
        // it, which resets its internal search query for free instead of
        // needing an effect to clear a stale one (react-hooks/
        // set-state-in-effect flags a setState in an effect body).
        key={pickerSlot ?? 'closed'}
        slot={pickerSlot ?? 'head'}
        open={pickerSlot !== null}
        onPick={(item) => {
          if (pickerSlot) onChange(pickerSlot, item);
        }}
        onClose={() => setPickerSlot(null)}
      />
    </div>,
    document.body,
  );
}
