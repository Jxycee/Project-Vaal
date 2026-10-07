'use client';

// The reader's item card: what an item IS, mod by mod. Used in the gear slot
// detail (tap) and in the desktop hover popover. Quiet on purpose: the stats
// are the point, so there is no effect around the card and no animation on its
// text. A restrained shader may sit behind a unique's HEADER only (HeaderFx).
//
// Colours are the in-game convention players already read: prefixes blue,
// suffixes amber, runes teal, implicits steel. Each tier tag is P/S plus the
// tier counted from the top (1 = best); the bar under it is where the stored
// roll sits in its range. A legend at the foot says so in one line.
import dynamic from 'next/dynamic';
import { useState, useSyncExternalStore } from 'react';
import type { ItemCard as Card, CardMod, CardRarity } from '@/lib/build/itemCard';
import type { GearItem } from '@/lib/build/gearSlots';
import { useItemCard } from './useItemCard';

const ItemHeaderShader = dynamic(() => import('./item-header-shader'), { ssr: false });

const REDUCED = '(prefers-reduced-motion: reduce)';
const subscribeReduced = (cb: () => void) => {
  const q = window.matchMedia(REDUCED);
  q.addEventListener('change', cb);
  return () => q.removeEventListener('change', cb);
};
/** Whether the header shader may run: WebGPU present and no reduced-motion preference. Server and first paint say no. */
function useShaderAllowed(): boolean {
  const reduced = useSyncExternalStore(subscribeReduced, () => window.matchMedia(REDUCED).matches, () => true);
  const gpu = useSyncExternalStore(() => () => {}, () => 'gpu' in navigator && !!(navigator as { gpu?: unknown }).gpu, () => false);
  return gpu && !reduced;
}

const RARITY_COLOR: Record<CardRarity, string> = {
  normal: '#d8d2c4',
  magic: '#9aa6ff',
  rare: '#f0d070',
  unique: '#e08a3a',
};
const KIND_COLOR: Record<CardMod['kind'], string> = {
  prefix: '#9fb0ff',
  suffix: '#e6b866',
  unique: '#c9b48a',
  implicit: '#8fb3c9',
};

/** A restrained shader behind a unique's header only; the plain card is always what is underneath. */
function HeaderFx() {
  const allowed = useShaderAllowed();
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  if (!allowed || failed) return null;
  return (
    <div
      aria-hidden="true"
      data-testid="item-card-fx"
      data-ready={ready}
      className="pointer-events-none absolute inset-0 overflow-hidden mix-blend-screen transition-opacity duration-1000"
      style={{ opacity: ready ? 0.7 : 0 }}
    >
      <ItemHeaderShader onReady={() => setReady(true)} onUnavailable={() => setFailed(true)} />
    </div>
  );
}

function ModRow({ mod }: { mod: CardMod }) {
  const color = KIND_COLOR[mod.kind];
  return (
    <li data-testid="item-card-mod" data-kind={mod.kind} data-tag={mod.tag} className="flex items-start gap-2.5 text-sm leading-snug">
      <span aria-hidden="true" className="mt-[7px] size-[5px] shrink-0 rotate-45" style={{ background: color }} />
      <span className="min-w-0 flex-1" style={{ color: mod.unknown ? '#8d836f' : color }}>
        {mod.lines.map((line, i) => (
          <span key={i} className="block">
            {line}
          </span>
        ))}
        {mod.range ? <span className="text-xs text-muted-foreground/80">{mod.range}</span> : null}
      </span>
      {mod.tag ? (
        <span className="w-9 shrink-0 text-center">
          <span
            className="block rounded-[3px] border text-[11px] font-bold leading-4 tracking-wide"
            style={{ color, borderColor: color }}
            title={`${mod.kind === 'prefix' ? 'Prefix' : 'Suffix'}${mod.tag.length > 1 ? `, tier ${mod.tag.slice(1)} (1 is best)` : ''}`}
          >
            {mod.tag}
          </span>
          {mod.roll !== null ? (
            <span className="mt-1 block h-[3px] rounded-full bg-border" title={`Roll: ${mod.roll}% of the way from worst to best`}>
              <span data-testid="item-card-roll" className="block h-[3px] rounded-full" style={{ width: `${mod.roll}%`, background: color }} />
            </span>
          ) : null}
        </span>
      ) : null}
    </li>
  );
}

export function ItemCardView({ card, compact = false }: { card: Card; compact?: boolean }) {
  const color = RARITY_COLOR[card.rarity];
  return (
    <article
      data-testid="item-card"
      data-rarity={card.rarity}
      className="w-full max-w-[26rem] overflow-hidden rounded-md border border-primary/40 bg-[#110e0b] text-foreground"
    >
      <div className="h-[3px]" style={{ background: color }} />
      <header data-testid="item-card-header" className="relative px-4 pb-2 pt-3">
        {card.rarity === 'unique' ? <HeaderFx /> : null}
        <h3 data-testid="item-card-name" className="font-heading text-lg font-semibold leading-tight" style={{ color }}>
          {card.name}
        </h3>
        <p className="text-[13px] text-muted-foreground">{card.base}</p>
      </header>

      {card.stats.length > 0 || card.requirements ? (
        <div className="px-4 pb-2 text-[13px] leading-relaxed text-muted-foreground">
          {card.stats.map((s) => (
            <p key={s.label}>
              {s.label}: <span className="font-bold text-[#a9b8ff]">{s.value}</span>
            </p>
          ))}
          {card.requirements ? <p className={card.stats.length > 0 ? 'mt-1' : ''}>{card.requirements}</p> : null}
        </div>
      ) : null}

      {card.runes.map((r) => (
        <div key={r.name} data-testid="item-card-rune" className="mx-4 mb-2 rounded border border-[#1f3a37] bg-[#143c38]/20 px-2.5 py-2 text-[13px] leading-snug">
          <p className="font-semibold text-[#6fcfc0]">{r.count > 1 ? `${r.count} × ${r.name}` : r.name}</p>
          {r.effect.map((line) => (
            <p key={line} className="text-[#8fd9cd]">
              {line}
            </p>
          ))}
        </div>
      ))}

      <div className="mx-4 mb-2.5 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

      <ul className={`flex flex-col px-4 pb-3 ${compact ? 'gap-1.5' : 'gap-2'}`}>
        {card.implicits.map((m, i) => (
          <li key={`i${i}`} data-testid="item-card-implicit" className="text-sm leading-snug" style={{ color: KIND_COLOR.implicit }}>
            {m.lines.join(' ')}
          </li>
        ))}
        {card.mods.map((m, i) => (
          <ModRow key={i} mod={m} />
        ))}
        {card.mods.length === 0 && card.implicits.length === 0 ? <li className="text-sm text-muted-foreground">No modifiers recorded.</li> : null}
      </ul>

      {card.flavour ? <p className="px-4 pb-3 text-xs italic text-muted-foreground/80">{card.flavour}</p> : null}
      {card.corrupted ? <p className="px-4 pb-3 text-sm font-semibold text-[#c0453a]">Corrupted</p> : null}

      {card.mods.some((m) => m.tag) ? (
        <footer className="flex items-center gap-2 border-t border-border bg-[#0e0b09] px-4 py-2 text-xs text-muted-foreground">
          <span aria-hidden="true" className="flex size-[18px] shrink-0 items-center justify-center rounded-full border border-primary/50 font-bold text-primary">
            ?
          </span>
          <span>P prefix · S suffix · number is the tier, 1 is best · bar is where the roll sits in its range</span>
        </footer>
      ) : null}
    </article>
  );
}

/** Loads and renders one item's card; a quiet skeleton while it loads. */
export default function ItemCard({ item, compact }: { item: GearItem; compact?: boolean }) {
  const card = useItemCard(item);
  if (!card) {
    return <div data-testid="item-card-loading" className="h-40 animate-pulse rounded-md border border-border bg-card/40" aria-busy="true" />;
  }
  return <ItemCardView card={card} compact={compact} />;
}
