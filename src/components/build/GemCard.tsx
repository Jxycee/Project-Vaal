'use client';

// The reader's gem card: what a skill and each support DO. Same quiet panel as
// ItemCardView (near-black, gold hairline, no effects). Gem colour is only the
// 3px top bar and the name, as in game. Loading shows the names immediately;
// the text arrives when the wiki files do.
import type { GemCard as Card, GemColor } from '@/lib/build/gemCard';
import type { GemLoadout } from '@/lib/build/gemState';
import { useGemCard } from './useGemCard';

const GEM_COLOR: Record<GemColor, string> = { r: '#e0705f', g: '#7fd39a', b: '#8fa8ff', w: '#d8d2c4' };

function StatList({ lines, tone }: { lines: string[]; tone: string }) {
  if (lines.length === 0) return null;
  return (
    <ul className="flex flex-col gap-1.5 px-4 pb-2">
      {lines.map((l, i) => (
        <li key={i} className="flex items-start gap-2.5 text-sm leading-snug" style={{ color: tone }}>
          <span aria-hidden="true" className="mt-[7px] size-[5px] shrink-0 rotate-45" style={{ background: tone }} />
          <span className="min-w-0 flex-1">{l}</span>
        </li>
      ))}
    </ul>
  );
}

function Heading({ children }: { children: React.ReactNode }) {
  return <p className="px-4 pb-1 text-[11px] uppercase tracking-wider text-muted-foreground">{children}</p>;
}

export function GemCardView({ card, loading = false, iconUrl }: { card: Card; loading?: boolean; iconUrl?: string | null }) {
  const color = GEM_COLOR[card.color];
  return (
    <article
      data-testid="gem-card"
      aria-busy={loading}
      className="w-full max-w-[26rem] overflow-hidden rounded-md border border-primary/40 bg-[#110e0b] text-foreground"
    >
      <div className="h-[3px]" style={{ background: color }} />
      <header className="flex items-center gap-2.5 px-4 pb-2 pt-3">
        {iconUrl ? (
          // Plain <img>, not next/image: wiki icons sit behind a session-cookie-protected prefix.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={iconUrl} alt="" className="size-10 shrink-0 rounded-md border border-border object-contain" />
        ) : null}
        <div className="min-w-0">
          <h3 data-testid="gem-card-name" className="font-heading text-lg font-semibold leading-tight" style={{ color }}>
            {card.name}
          </h3>
          {card.slug ? (
            <p className="text-[13px] text-muted-foreground">
              Level <span className="tabular-nums text-foreground">{card.level}</span>
              {card.quality > 0 ? (
                <>
                  {' '}
                  · Quality <span className="tabular-nums text-foreground">{card.quality}%</span>
                </>
              ) : null}
            </p>
          ) : null}
        </div>
      </header>

      {card.tags.length > 0 ? (
        <div className="flex flex-wrap gap-1 px-4 pb-2">
          {card.tags.map((t) => (
            <span key={t} className="rounded-[3px] border border-border px-1.5 text-[11px] text-muted-foreground">
              {t}
            </span>
          ))}
        </div>
      ) : null}

      {card.description ? (
        <p data-testid="gem-card-desc" className="px-4 pb-2 text-[13px] leading-relaxed text-muted-foreground">
          {card.description}
        </p>
      ) : null}
      {card.figures.length > 0 ? <p className="px-4 pb-2 text-[13px] text-muted-foreground">{card.figures.join(' · ')}</p> : null}

      {card.stats.length > 0 || card.qualityStats.length > 0 ? (
        <div className="mx-4 mb-2.5 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
      ) : null}
      <StatList lines={card.stats} tone="#8fb3c9" />
      {card.qualityStats.length > 0 ? (
        <>
          <Heading>Quality (shown at 20%)</Heading>
          <StatList lines={card.qualityStats} tone="#c9b48a" />
        </>
      ) : null}

      {card.supports.length > 0 ? (
        <>
          <div className="mx-4 mb-2.5 mt-1 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
          <Heading>Supports ({card.supports.length})</Heading>
          <ul className="flex flex-col gap-2 px-4 pb-3">
            {card.supports.map((s, i) => (
              <li
                key={`${s.slug}-${i}`}
                data-testid="skill-support"
                data-slug={s.slug}
                className="flex items-start gap-2.5 rounded border border-border/70 bg-white/[0.015] px-2.5 py-2"
              >
                <span className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded border border-border/60">
                  {s.iconUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.iconUrl} alt="" loading="lazy" className="h-full w-full object-contain" />
                  ) : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-foreground">{s.name}</span>
                  {s.description ? (
                    <span data-testid="gem-card-support-desc" className="block text-[12.5px] leading-snug text-muted-foreground">
                      {s.description}
                    </span>
                  ) : null}
                  {s.stats.map((l, j) => (
                    <span key={j} className="block text-[12.5px] leading-snug" style={{ color: '#8fb3c9' }}>
                      {l}
                    </span>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="px-4 pb-3 text-xs text-muted-foreground">No supports.</p>
      )}
    </article>
  );
}

/** Loads and renders one gem group's card. */
export default function GemCard({ loadout }: { loadout: GemLoadout }) {
  const { card, loading } = useGemCard(loadout);
  return <GemCardView card={card} loading={loading} iconUrl={loadout.skill?.iconUrl ?? null} />;
}
