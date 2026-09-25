'use client';

// TEST-GRADE (Slice 4, plans/2026-09-25-slice4-item-affixes.md): plain markup,
// 44px controls, functional only — the UI pass after Slice 5 replaces it.
//
// Edits one equipped item's craft: rarity, name, item level, quality,
// corruption, implicit and unique roll values, prefixes and suffixes with
// their rolled values, and socketed runes. Every value is clamped to its roll
// as it is typed (the user's "exact number, clamped"); everything else that
// can be wrong is only WARNED about, by src/lib/build/validate — this sheet
// never refuses an edit.
//
// Portaled to document.body at z-50, above GearSheet's z-40, for the same
// stacking-context reason GearSheet's header comment gives. The mod picker
// sits at z-[60]; the rune picker is ItemPickerSheet, which portals itself
// later in the document and so lands on top.

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import ItemPickerSheet from '@/components/build/ItemPickerSheet';
import { bestRolls, clampToRange, emptyCraft, MAX_ITEM_QUALITY, rangesIn, type CraftedMod, type ItemCraft, type ItemRarity, type ValueRange } from '@/lib/build/craft';
import { RUNE_PSEUDO_SLOT, type GearItem } from '@/lib/build/gearSlots';
import type { BaseData, BuildWarning, ModData } from '@/lib/build/validate';
import { fetchBaseData, fetchModData } from '@/lib/wiki/fetchCraftData';
import type { AffixKind, ModGroup } from '@/lib/wiki/modCatalogue';

const INPUT = 'h-11 w-20 rounded-md border border-input bg-background/60 px-2 text-sm text-foreground';
const BUTTON = 'flex h-11 min-w-11 items-center justify-center rounded-md border border-border px-3 text-xs font-medium';

/** One base's detail, keyed by the slug it is FOR so a stale response is ignored (same pattern as GemsSheet's hooks). */
function useBase(slug: string): BaseData | null | undefined {
  const [result, setResult] = useState<{ slug: string; data: BaseData | null | undefined } | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetchBaseData(slug).then((data) => {
      if (!cancelled) setResult({ slug, data });
    });
    return () => {
      cancelled = true;
    };
  }, [slug]);
  return result?.slug === slug ? result.data : undefined;
}

/** Chosen mods' data (display text and rolls), fetched per slug. */
function useMods(slugs: readonly string[]): Map<string, ModData | null> {
  const key = [...slugs].sort().join('|');
  const [result, setResult] = useState<Map<string, ModData | null>>(new Map());
  useEffect(() => {
    if (key === '') return;
    let cancelled = false;
    const wanted = key.split('|');
    Promise.all(wanted.map((s) => fetchModData(s))).then((mods) => {
      if (cancelled) return;
      const map = new Map<string, ModData | null>();
      wanted.forEach((s, i) => {
        if (mods[i] !== undefined) map.set(s, mods[i] as ModData | null);
      });
      setResult(map);
    });
    return () => {
      cancelled = true;
    };
  }, [key]);
  return result;
}

/** Number inputs for one line's ranges. An unset row shows empty inputs; editing one fills the rest at their best roll. */
function RangeInputs({ ranges, values, label, onChange }: { ranges: ValueRange[]; values: number[]; label: string; onChange: (values: number[]) => void }) {
  return (
    <span className="flex flex-wrap gap-2">
      {ranges.map((range, i) => (
        <label key={i} className="flex items-center gap-1 text-xs text-muted-foreground">
          <input
            type="number"
            inputMode="decimal"
            aria-label={`${label} value ${i + 1}`}
            data-testid="roll-value"
            className={INPUT}
            value={values[i] ?? ''}
            onChange={(e) => {
              const typed = Number.parseFloat(e.target.value);
              if (!Number.isFinite(typed)) return;
              const row = ranges.map((r, j) => (values.length === ranges.length ? values[j] : bestRolls([r])[0]));
              row[i] = clampToRange(typed, range);
              onChange(row);
            }}
          />
          <span>
            {range.min}–{range.max}
          </span>
        </label>
      ))}
    </span>
  );
}

function ModPicker({ itemSlug, kind, onPick, onClose }: { itemSlug: string; kind: AffixKind; onPick: (mod: CraftedMod) => void; onClose: () => void }) {
  const [state, setState] = useState<{ status: 'loading' } | { status: 'error' } | { status: 'ready'; groups: ModGroup[] }>({ status: 'loading' });
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/wiki/mods?${new URLSearchParams({ item: itemSlug, kind })}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((body: { groups: ModGroup[] }) => {
        if (!cancelled) setState({ status: 'ready', groups: body.groups });
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, [itemSlug, kind]);

  return createPortal(
    <div className="fixed inset-0 z-[60] flex flex-col bg-background" data-testid="mod-picker">
      <div className="flex items-center justify-between border-b border-border px-3 py-3">
        <span className="font-heading text-sm">Add {kind}</span>
        <button type="button" onClick={onClose} aria-label="Close mod picker" className="flex h-11 w-11 items-center justify-center">
          <X size={18} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {state.status === 'loading' ? <p className="p-3 text-sm text-muted-foreground">Loading…</p> : null}
        {state.status === 'error' ? <p className="p-3 text-sm text-destructive">Could not load mods.</p> : null}
        {state.status === 'ready' && state.groups.length === 0 ? <p className="p-3 text-sm text-muted-foreground">Nothing can roll here.</p> : null}
        {state.status === 'ready' ? (
          <ul>
            {state.groups.map((g) => (
              <li key={g.group} className="border-b border-border/60">
                <button
                  type="button"
                  data-testid="mod-group"
                  onClick={() => setOpenGroup(openGroup === g.group ? null : g.group)}
                  className="flex min-h-11 w-full flex-col items-start px-3 py-2 text-left text-sm"
                >
                  <span>{g.tiers[g.tiers.length - 1]?.stats.join(' · ') || g.group}</span>
                  <span className="text-xs text-muted-foreground">
                    {g.group} · {g.tiers.length} tiers
                  </span>
                </button>
                {openGroup === g.group ? (
                  <ul className="bg-card/40">
                    {g.tiers.map((t) => (
                      <li key={t.slug}>
                        <button
                          type="button"
                          data-testid="mod-tier"
                          data-slug={t.slug}
                          onClick={() => onPick({ slug: t.slug, values: bestRolls(t.rolls) })}
                          className="flex min-h-11 w-full items-center gap-2 px-5 py-2 text-left text-xs"
                        >
                          <span className="shrink-0 text-muted-foreground">Lv {t.level}</span>
                          <span>{t.stats.join(' · ')}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}

export default function ItemEditorSheet({
  item,
  warnings,
  onChange,
  onClose,
}: {
  item: GearItem | null;
  /** This item's validator output. */
  warnings: readonly BuildWarning[];
  onChange: (item: GearItem) => void;
  onClose: () => void;
}) {
  const [modPicker, setModPicker] = useState<AffixKind | null>(null);
  const [runePickerOpen, setRunePickerOpen] = useState(false);
  const craft: ItemCraft = item?.craft ?? emptyCraft(item?.isUnique ?? false);
  const base = useBase(item?.slug ?? '');
  const mods = useMods([...craft.prefixes, ...craft.suffixes].map((m) => m.slug));

  if (!item || typeof document === 'undefined') return null;
  const update = (patch: Partial<ItemCraft>) => onChange({ ...item, craft: { ...craft, ...patch } });

  const lineSection = (title: string, lines: string[], rows: number[][], field: 'implicitValues' | 'uniqueValues') =>
    lines.length === 0 ? null : (
      <section className="border-b border-border px-3 py-3">
        <h3 className="mb-2 text-xs text-muted-foreground">{title}</h3>
        {lines.map((line, i) => {
          const ranges = rangesIn(line);
          return (
            <div key={i} className="py-1 text-sm">
              <p>{line}</p>
              {ranges.length > 0 ? (
                <RangeInputs
                  ranges={ranges}
                  values={rows[i] ?? []}
                  label={`${title} ${i + 1}`}
                  onChange={(values) => {
                    const next = lines.map((_, j) => rows[j] ?? []);
                    next[i] = values;
                    update({ [field]: next } as Partial<ItemCraft>);
                  }}
                />
              ) : null}
            </div>
          );
        })}
      </section>
    );

  const affixSection = (kind: AffixKind, list: CraftedMod[], field: 'prefixes' | 'suffixes') => (
    <section className="border-b border-border px-3 py-3">
      <h3 className="mb-2 text-xs text-muted-foreground">
        {kind === 'prefix' ? 'Prefixes' : 'Suffixes'} ({list.length})
      </h3>
      <ul>
        {list.map((m, i) => {
          const data = mods.get(m.slug);
          return (
            <li key={`${m.slug}-${i}`} data-testid="affix-row" data-slug={m.slug} className="flex items-start gap-2 py-1">
              <div className="min-w-0 flex-1 text-sm">
                <p>{data ? data.stats.join(' · ') : data === null ? `Unknown mod: ${m.slug}` : m.slug}</p>
                {data ? (
                  <RangeInputs
                    ranges={data.rolls}
                    values={m.values}
                    label={`${kind} ${i + 1}`}
                    onChange={(values) => update({ [field]: list.map((x, j) => (j === i ? { ...x, values } : x)) } as Partial<ItemCraft>)}
                  />
                ) : null}
              </div>
              <button
                type="button"
                aria-label={`Remove ${kind} ${i + 1}`}
                onClick={() => update({ [field]: list.filter((_, j) => j !== i) } as Partial<ItemCraft>)}
                className="flex h-11 w-11 shrink-0 items-center justify-center text-muted-foreground"
              >
                <X size={14} />
              </button>
            </li>
          );
        })}
      </ul>
      <button type="button" data-testid={`add-${kind}`} onClick={() => setModPicker(kind)} className={`${BUTTON} mt-1`}>
        + Add {kind}
      </button>
    </section>
  );

  const rarities: ItemRarity[] = item.isUnique ? ['unique'] : ['normal', 'magic', 'rare'];

  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col bg-background" data-testid="item-editor">
      <div className="flex items-center justify-between gap-2 border-b border-border bg-card/95 px-3 py-3">
        <span className="truncate font-heading text-sm">{item.name}</span>
        <button type="button" onClick={onClose} aria-label="Close item editor" className="flex h-11 w-11 shrink-0 items-center justify-center">
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {warnings.length > 0 ? (
          <ul className="border-b border-border px-3 py-2 text-xs">
            {warnings.map((w, i) => (
              <li key={`${w.code}-${i}`} data-testid="item-warning" className="py-1">
                ⚠ {w.message}
              </li>
            ))}
          </ul>
        ) : null}

        <section className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-3">
          {rarities.map((r) => (
            <button
              key={r}
              type="button"
              data-testid={`rarity-${r}`}
              aria-pressed={craft.rarity === r}
              onClick={() => update({ rarity: r })}
              className={`${BUTTON} ${craft.rarity === r ? 'bg-primary text-primary-foreground' : ''}`}
            >
              {r[0].toUpperCase() + r.slice(1)}
            </button>
          ))}
          <button
            type="button"
            aria-pressed={craft.corrupted}
            onClick={() => update({ corrupted: !craft.corrupted })}
            className={`${BUTTON} ${craft.corrupted ? 'bg-destructive text-destructive-foreground' : ''}`}
          >
            {craft.corrupted ? 'Corrupted' : 'Not corrupted'}
          </button>
        </section>

        <section className="flex flex-wrap gap-3 border-b border-border px-3 py-3 text-xs text-muted-foreground">
          {craft.rarity === 'magic' || craft.rarity === 'rare' ? (
            <label className="flex items-center gap-1.5">
              Name
              <input className={`${INPUT} w-40`} value={craft.name ?? ''} maxLength={200} onChange={(e) => update({ name: e.target.value || null })} />
            </label>
          ) : null}
          <label className="flex items-center gap-1.5">
            Item level
            <input
              type="number"
              inputMode="numeric"
              className={INPUT}
              value={craft.itemLevel ?? ''}
              onChange={(e) => {
                const n = Number.parseInt(e.target.value, 10);
                update({ itemLevel: Number.isFinite(n) ? clampToRange(n, { min: 1, max: 100 }) : null });
              }}
            />
          </label>
          <label className="flex items-center gap-1.5">
            Quality
            <input
              type="number"
              inputMode="numeric"
              className={INPUT}
              value={craft.quality}
              onChange={(e) => {
                const n = Number.parseInt(e.target.value, 10);
                if (Number.isFinite(n)) update({ quality: clampToRange(n, { min: 0, max: MAX_ITEM_QUALITY }) });
              }}
            />
          </label>
        </section>

        {base === undefined ? <p className="px-3 py-2 text-xs text-muted-foreground">Loading item data…</p> : null}
        {base ? lineSection('Implicit', base.implicitLines, craft.implicitValues, 'implicitValues') : null}
        {base && item.isUnique ? lineSection('Unique mods', base.uniqueLines, craft.uniqueValues, 'uniqueValues') : null}

        {!item.isUnique ? affixSection('prefix', craft.prefixes, 'prefixes') : null}
        {!item.isUnique ? affixSection('suffix', craft.suffixes, 'suffixes') : null}

        <section className="px-3 py-3">
          <h3 className="mb-2 text-xs text-muted-foreground">Runes and soul cores ({craft.runes.length})</h3>
          <ul>
            {craft.runes.map((slug, i) => (
              <li key={`${slug}-${i}`} data-testid="rune-row" className="flex items-center justify-between text-sm">
                <span className="truncate">{slug}</span>
                <button
                  type="button"
                  aria-label={`Remove rune ${i + 1}`}
                  onClick={() => update({ runes: craft.runes.filter((_, j) => j !== i) })}
                  className="flex h-11 w-11 items-center justify-center text-muted-foreground"
                >
                  <X size={14} />
                </button>
              </li>
            ))}
          </ul>
          <button type="button" data-testid="add-rune" onClick={() => setRunePickerOpen(true)} className={`${BUTTON} mt-1`}>
            + Add rune
          </button>
        </section>
      </div>

      {modPicker ? (
        <ModPicker
          itemSlug={item.slug}
          kind={modPicker}
          onPick={(m) => {
            if (modPicker === 'prefix') update({ prefixes: [...craft.prefixes, m] });
            else update({ suffixes: [...craft.suffixes, m] });
            setModPicker(null);
          }}
          onClose={() => setModPicker(null)}
        />
      ) : null}
      <ItemPickerSheet
        key={runePickerOpen ? 'runes-open' : 'runes-closed'}
        slot={RUNE_PSEUDO_SLOT}
        open={runePickerOpen}
        onPick={(rune) => update({ runes: [...craft.runes, rune.slug] })}
        onClose={() => setRunePickerOpen(false)}
      />
    </div>,
    document.body,
  );
}
