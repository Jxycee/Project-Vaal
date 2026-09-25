'use client';

// Full-screen gems sheet: one stacked card per skill loadout (active/meta
// gem + up to MAX_SUPPORTS_PER_SKILL supports + weapon-set tags + a Main
// skill toggle). See docs/superpowers/plans/2026-09-22-task3-gems.md.
//
// Mobile interaction, concretely at 375px: one vertical scroll of stacked
// cards, no tabs, no two-pane anything, no horizontal scroll strip — the
// competitor recon's "single most copyable failure mode" for a build
// planner's item picker (2026-09-20-competitor-build-planner-recon.md:85).
// Picking a skill or a support reuses ItemPickerSheet (already a full-width,
// single-column, search-first list) rather than a gem-specific picker.
//
// Portaled to document.body for the same reason as GearSheet.tsx/
// JewelsSheet.tsx (read GearSheet's header comment): /tree's canvas wrapper
// is `position: fixed`, which always creates its own stacking context, so a
// plain `fixed inset-0 z-*` here would sit under the shell's `sticky z-20`
// mobile header no matter its z-index.
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import type { WeaponSet } from '@poe2-toolkit/tree-core';
import ItemPickerSheet from '@/components/build/ItemPickerSheet';
import { GEM_SKILL_PSEUDO_SLOT, GEM_SUPPORT_PSEUDO_SLOT, MAX_SUPPORTS_PER_SKILL } from '@/lib/build/gemSlots';
import { WEAPON_SET_DOT } from '@/lib/build/weaponSetColors';
import { MAX_GEM_QUALITY } from '@/lib/build/gemState';
import { reservedSpirit } from '@/lib/build/validate';
import { fetchMaxGemLevel, fetchReservationScaling, type ReservationScalingEntry } from '@/lib/wiki/fetchGemScaling';
import type { GearItem } from '@/lib/build/gearSlots';
import type { GemLoadout, GemState } from '@/lib/build/gemState';

/**
 * Every loaded gem's reservation scaling, keyed by slug (`null` = no data),
 * or `null` while a fetch for the current set of gems is still in flight.
 * Keyed by the slug list the result is FOR, same stale-result reasoning as
 * useMaxGemLevel below.
 */
function useReservationScaling(slugs: readonly string[]): Map<string, ReservationScalingEntry[] | null> | null {
  const key = [...slugs].sort().join('|');
  const [result, setResult] = useState<{ key: string; data: Map<string, ReservationScalingEntry[] | null> } | null>(null);

  useEffect(() => {
    if (key === '') return;
    let cancelled = false;
    const wanted = key.split('|');
    Promise.all(wanted.map((slug) => fetchReservationScaling(slug))).then((scalings) => {
      if (!cancelled) setResult({ key, data: new Map(wanted.map((slug, i) => [slug, scalings[i]])) });
    });
    return () => {
      cancelled = true;
    };
  }, [key]);

  if (key === '') return new Map();
  return result?.key === key ? result.data : null;
}

/**
 * TEST-GRADE (Slice 3, plans/2026-09-24-slice3-structural-validation.md):
 * plain text, functional only — the UI pass after Slice 5 replaces it. The
 * raw reserved total per weapon set; comparing it with the character's
 * Spirit needs the Slice 5 engine.
 */
function ReservedSpiritLine({ gemState }: { gemState: GemState }) {
  const gems = gemState.loadouts.flatMap((l) => (l.skill ? [l.skill, ...l.supports] : []));
  const slugs = Array.from(new Set(gems.map((g) => g.slug)));
  const scaling = useReservationScaling(slugs);

  if (scaling === null) {
    return <p className="px-3 pt-3 text-xs text-muted-foreground">Spirit reserved: calculating…</p>;
  }
  const known = new Map<string, ReservationScalingEntry[]>();
  for (const [slug, entries] of scaling) if (entries) known.set(slug, entries);
  const total = reservedSpirit(gemState, known);
  const missingNames = total.missing.map((slug) => gems.find((g) => g.slug === slug)?.name ?? slug);

  return (
    <div className="px-3 pt-3 text-xs text-muted-foreground">
      <p data-testid="spirit-reserved" className="text-sm text-foreground">
        Spirit reserved — Set I: {total.set1} · Set II: {total.set2}
      </p>
      <p>Before reservation modifiers; not yet compared with your Spirit.</p>
      {missingNames.length > 0 ? <p>Data missing for: {missingNames.join(', ')}</p> : null}
    </div>
  );
}

/**
 * Fetches the currently-picked skill's per-gem level cap (see
 * fetchGemScaling.ts) and keeps it in sync as the skill changes. `null`
 * while loading or when no skill is picked — LoadoutCard treats that as
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
        // Plain <img>, not next/image — see GearSheet.tsx's SlotRow comment
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

function LoadoutCard({
  loadout,
  index,
  isPrimary,
  onOpenSkillPicker,
  onOpenSupportPicker,
  onRemoveSupport,
  onRemove,
  onToggleSet,
  onSetPrimary,
  onSetLevel,
  onSetQuality,
}: {
  loadout: GemLoadout;
  index: number;
  isPrimary: boolean;
  onOpenSkillPicker: () => void;
  onOpenSupportPicker: () => void;
  onRemoveSupport: (supportIndex: number) => void;
  onRemove: () => void;
  onToggleSet: (set: WeaponSet) => void;
  onSetPrimary: () => void;
  onSetLevel: (level: number) => void;
  onSetQuality: (quality: number) => void;
}) {
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

      <button type="button" onClick={onOpenSkillPicker} className="flex h-14 w-full items-center gap-3 text-left">
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
            onClick={onOpenSupportPicker}
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
                onClick={() => onToggleSet(set)}
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
    </li>
  );
}

export default function GemsSheet({
  open,
  gemState,
  onAddLoadout,
  onRemoveLoadout,
  onSetSkill,
  onAddSupport,
  onRemoveSupport,
  onSetSets,
  onSetPrimary,
  onSetLevel,
  onSetQuality,
  onClose,
}: {
  open: boolean;
  gemState: GemState;
  onAddLoadout: () => void;
  onRemoveLoadout: (id: string) => void;
  onSetSkill: (id: string, item: GearItem | null) => void;
  onAddSupport: (id: string, item: GearItem) => void;
  onRemoveSupport: (id: string, supportIndex: number) => void;
  onSetSets: (id: string, sets: readonly WeaponSet[]) => void;
  onSetPrimary: (id: string) => void;
  onSetLevel: (id: string, level: number) => void;
  onSetQuality: (id: string, quality: number) => void;
  onClose: () => void;
}) {
  // Which loadout's skill-or-support picker is open, if any. Only one picker
  // at a time — same pattern as GearSheet's pickerSlot / JewelsSheet's
  // pickerSocketId.
  const [pickerTarget, setPickerTarget] = useState<{ loadoutId: string; kind: 'skill' | 'support' } | null>(null);

  // Also gates the SSR pass, same reasoning as GearSheet/JewelsSheet.
  if (!open || typeof document === 'undefined') return null;

  const pickerKey = pickerTarget ? `${pickerTarget.loadoutId}:${pickerTarget.kind}` : 'closed';
  const pickerSlot = pickerTarget?.kind === 'support' ? GEM_SUPPORT_PSEUDO_SLOT : GEM_SKILL_PSEUDO_SLOT;

  return createPortal(
    <div className="fixed inset-0 z-40 flex flex-col bg-background">
      <div className="flex items-center justify-between gap-2 border-b border-border bg-card/95 px-3 py-3 backdrop-blur">
        <span className="flex min-w-0 flex-col">
          <span className="font-heading text-sm text-foreground">Gems</span>
          <span className="text-xs text-muted-foreground">Main skill is what other players filter by.</span>
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close gems sheet"
          className="flex h-11 w-11 shrink-0 items-center justify-center text-muted-foreground"
        >
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <ReservedSpiritLine gemState={gemState} />
        {gemState.loadouts.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">No skills yet.</p>
        ) : (
          <ul>
            {gemState.loadouts.map((loadout, index) => (
              <LoadoutCard
                key={loadout.id}
                loadout={loadout}
                index={index}
                isPrimary={gemState.primaryId === loadout.id}
                onOpenSkillPicker={() => setPickerTarget({ loadoutId: loadout.id, kind: 'skill' })}
                onOpenSupportPicker={() => setPickerTarget({ loadoutId: loadout.id, kind: 'support' })}
                onRemoveSupport={(supportIndex) => onRemoveSupport(loadout.id, supportIndex)}
                onRemove={() => onRemoveLoadout(loadout.id)}
                onToggleSet={(set) => onSetSets(loadout.id, toggleSet(loadout.sets, set))}
                onSetPrimary={() => onSetPrimary(loadout.id)}
                onSetLevel={(level) => onSetLevel(loadout.id, level)}
                onSetQuality={(quality) => onSetQuality(loadout.id, quality)}
              />
            ))}
          </ul>
        )}
        <button
          type="button"
          onClick={onAddLoadout}
          className="mx-3 my-3 flex h-11 w-[calc(100%-1.5rem)] items-center justify-center rounded-lg border border-dashed border-border/70 text-sm font-medium text-muted-foreground"
        >
          + Add skill
        </button>
      </div>

      <ItemPickerSheet
        // Keyed by loadout id + kind: opening a different picker remounts
        // it, resetting its internal search query for free (same reasoning
        // as GearSheet's own keyed ItemPickerSheet).
        key={pickerKey}
        slot={pickerSlot}
        open={pickerTarget !== null}
        onPick={(item) => {
          if (!pickerTarget) return;
          if (pickerTarget.kind === 'skill') onSetSkill(pickerTarget.loadoutId, item);
          else onAddSupport(pickerTarget.loadoutId, item);
        }}
        onClose={() => setPickerTarget(null)}
      />
    </div>,
    document.body,
  );
}
