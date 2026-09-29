'use client';

// One gem group's editor: the skill + supports + level/quality + weapon-set
// tags + Main skill toggle + Remove, and the skill/support pickers those
// open. Shared editor body: the build page's one-group sheet (GemGroupSheet) renders exactly
// the same controls with the same labels. Renders an <li> — callers wrap it
// in a <ul>. The pickers are ItemPickerSheet portals, so they escape any
// ancestor stacking context.
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { WeaponSet } from '@poe2-toolkit/tree-core';
import ItemPickerSheet from '@/components/build/ItemPickerSheet';
import { GEM_SKILL_PSEUDO_SLOT, GEM_SUPPORT_PSEUDO_SLOT, MAX_SUPPORTS_PER_SKILL } from '@/lib/build/gemSlots';
import { WEAPON_SET_DOT } from '@/lib/build/weaponSetColors';
import { MAX_GEM_QUALITY } from '@/lib/build/gemState';
import { fetchMaxGemLevel } from '@/lib/wiki/fetchGemScaling';
import type { GearItem } from '@/lib/build/gearSlots';
import type { GemLoadout } from '@/lib/build/gemState';

/**
 * Fetches the currently-picked skill's per-gem level cap (see
 * fetchGemScaling.ts) and keeps it in sync as the skill changes. `null`
 * while loading or when no skill is picked — GemLoadoutEditor treats that as
 * "don't clamp yet" rather than "cap is 1", so a level typed just after
 * picking a new skill isn't clobbered by a cap that hasn't arrived yet.
 */
function useMaxGemLevel(slug: string | undefined): number | null {
  // Keyed by the slug the result is FOR, not just the number — so a result
  // that resolves after the user has already switched to a different skill
  // (or cleared it) is recognised as stale and ignored below, rather than
  // requiring a synchronous setState(null) inside the effect body itself
  // (which react-hooks/set-state-in-effect flags) to reset it up front.
  const [result, setResult] = useState<{ slug: string; max: number } | null>(null);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    fetchMaxGemLevel(slug).then((max) => {
      if (!cancelled) setResult({ slug, max });
    });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (!slug || result?.slug !== slug) return null;
  return result.max;
}

function GemIcon({ item }: { item: GearItem | null }) {
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-card/60">
      {item?.iconUrl ? (
        // Plain <img>, not next/image — see PaperDoll.tsx's icon comment
        // (this icon is under /data/wiki/, a session-cookie-protected prefix
        // next/image's server-side optimizer fetch can't carry, so it would
        // get redirected to /login instead of the image).
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.iconUrl} alt="" className="h-full w-full object-contain" />
      ) : (
        <span className="text-[10px] text-muted-foreground">—</span>
      )}
    </span>
  );
}

/** `[1,2]` (both) toggling `set` off leaves `[2]`/`[1]`; toggling the last one off snaps back to `[1,2]` — normalizeSets (inside setSets, gemState.ts) owns that fallback, this just computes the raw add/remove. */
function toggleSet(current: readonly WeaponSet[], set: WeaponSet): WeaponSet[] {
  return current.includes(set) ? current.filter((s) => s !== set) : [...current, set];
}

export default function GemLoadoutEditor({
  loadout,
  index,
  isPrimary,
  onSetSkill,
  onAddSupport,
  onRemoveSupport,
  onRemove,
  onSetSets,
  onSetPrimary,
  onSetLevel,
  onSetQuality,
}: {
  loadout: GemLoadout;
  /** Display index — "Skill {index + 1}" and the "Remove skill {index + 1}" label. */
  index: number;
  isPrimary: boolean;
  // Every callback is already bound to this loadout's id by the caller.
  onSetSkill: (item: GearItem | null) => void;
  onAddSupport: (item: GearItem) => void;
  onRemoveSupport: (supportIndex: number) => void;
  onRemove: () => void;
  onSetSets: (sets: readonly WeaponSet[]) => void;
  onSetPrimary: () => void;
  onSetLevel: (level: number) => void;
  onSetQuality: (quality: number) => void;
}) {
  // Which picker is open, if any. One at a time — same pattern as GearSlotDetail's
  // picker state / JewelsSheet's pickerSocketId.
  const [pickerKind, setPickerKind] = useState<'skill' | 'support' | null>(null);
  const atCap = loadout.supports.length >= MAX_SUPPORTS_PER_SKILL;
  // Per-gem cap (see gemState.ts's GemLoadout.level doc comment) — not
  // hardcoded 40, since Support Gems have no level field at all (see below)
  // and some Spirit Gems cap lower than 40.
  const maxLevel = useMaxGemLevel(loadout.skill?.slug);

  return (
    <li className="border-b border-border/60 px-3 py-3">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">Skill {index + 1}</span>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove skill ${index + 1}`}
          className="flex h-11 w-11 shrink-0 items-center justify-center text-muted-foreground"
        >
          <X size={16} />
        </button>
      </div>

      <button type="button" onClick={() => setPickerKind('skill')} className="flex h-14 w-full items-center gap-3 text-left">
        <GemIcon item={loadout.skill} />
        <span className="flex min-w-0 flex-col">
          <span className="text-xs text-muted-foreground">Skill</span>
          <span className="truncate text-sm text-foreground">{loadout.skill ? loadout.skill.name : 'Empty'}</span>
        </span>
      </button>

      {/*
        Level/quality: SKILL-only fields (see GemLoadout's doc comments in
        gemState.ts) — supports never get inputs here, deliberately, since
        every sampled Support Gem caps at level 1 and no gem carries a
        quality field in our data at all. Plain number inputs, not buttons,
        so e2e/mobile-layout.spec.ts's `button, a[href]` tap-target scan
        doesn't need to cover them; h-11 keeps them visually consistent with
        everything else on this card regardless.
      */}
      {loadout.skill ? (
        <div className="flex items-center gap-3 pt-2">
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            Level
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={maxLevel ?? undefined}
              value={loadout.level}
              onChange={(e) => {
                const parsed = Number.parseInt(e.target.value, 10);
                if (!Number.isFinite(parsed)) return;
                onSetLevel(maxLevel !== null ? Math.min(parsed, maxLevel) : parsed);
              }}
              className="h-11 w-16 rounded-md border border-input bg-background/60 px-2 text-sm text-foreground focus:outline-none focus:ring-3 focus:ring-ring/50"
            />
            {maxLevel !== null ? <span className="text-muted-foreground/70">/ {maxLevel}</span> : null}
          </label>
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            Quality
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={MAX_GEM_QUALITY}
              value={loadout.quality}
              onChange={(e) => {
                const parsed = Number.parseInt(e.target.value, 10);
                if (!Number.isFinite(parsed)) return;
                onSetQuality(Math.min(parsed, MAX_GEM_QUALITY));
              }}
              className="h-11 w-16 rounded-md border border-input bg-background/60 px-2 text-sm text-foreground focus:outline-none focus:ring-3 focus:ring-ring/50"
            />
            <span className="text-muted-foreground/70">%</span>
          </label>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-1.5 pt-1">
        {loadout.supports.map((support, supportIndex) => (
          <span
            key={`${support.slug}-${supportIndex}`}
            className="flex h-11 items-center gap-1.5 rounded-lg border border-border bg-card/60 py-1 pl-1.5 pr-1 text-xs text-foreground"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded border border-border/60">
              {support.iconUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={support.iconUrl} alt="" className="h-full w-full object-contain" />
              ) : null}
            </span>
            <span className="max-w-24 truncate">{support.name}</span>
            <button
              type="button"
              onClick={() => onRemoveSupport(supportIndex)}
              aria-label={`Remove ${support.name}`}
              // Full height AND w-11. This was a ~20px-wide target inside an
              // h-11 chip, which looks compliant if you only measure height —
              // which is exactly what the tap-target e2e check used to do.
              className="flex h-full w-11 items-center justify-center text-muted-foreground"
            >
              <X size={12} />
            </button>
          </span>
        ))}
        {!atCap ? (
          <button
            type="button"
            onClick={() => setPickerKind('support')}
            aria-label="Add support"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-dashed border-border/70 text-muted-foreground"
          >
            +
          </button>
        ) : null}
      </div>
      <p className="pt-1 text-xs text-muted-foreground">
        {loadout.supports.length} / {MAX_SUPPORTS_PER_SKILL} supports
      </p>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
        <div className="flex gap-1.5">
          {([1, 2] as const).map((set) => {
            const active = loadout.sets.includes(set);
            return (
              <button
                key={set}
                type="button"
                onClick={() => onSetSets(toggleSet(loadout.sets, set))}
                className={
                  active
                    ? 'flex h-11 items-center gap-1.5 rounded-full px-3 text-xs font-medium bg-primary text-primary-foreground'
                    : 'flex h-11 items-center gap-1.5 rounded-full px-3 text-xs font-medium bg-background/60 text-muted-foreground'
                }
              >
                <span className={`h-2 w-2 rounded-full ${WEAPON_SET_DOT[set]}`} />
                Set {set === 1 ? 'I' : 'II'}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={onSetPrimary}
          disabled={!loadout.skill}
          aria-pressed={isPrimary}
          className={
            isPrimary
              ? 'flex h-11 items-center gap-1.5 rounded-full bg-primary px-3 text-xs font-medium text-primary-foreground disabled:opacity-50'
              : 'flex h-11 items-center gap-1.5 rounded-full border border-border bg-background/60 px-3 text-xs font-medium text-muted-foreground disabled:opacity-50'
          }
        >
          Main skill
        </button>
      </div>
      <ItemPickerSheet
        // Keyed by kind: opening the other picker remounts it, resetting its
        // internal search query for free (same reasoning as GearSlotDetail's own
        // keyed ItemPickerSheet).
        key={pickerKind ?? 'closed'}
        slot={pickerKind === 'support' ? GEM_SUPPORT_PSEUDO_SLOT : GEM_SKILL_PSEUDO_SLOT}
        open={pickerKind !== null}
        onPick={(item) => {
          if (pickerKind === 'skill') onSetSkill(item);
          else if (pickerKind === 'support') onAddSupport(item);
        }}
        onClose={() => setPickerKind(null)}
      />
    </li>
  );
}

