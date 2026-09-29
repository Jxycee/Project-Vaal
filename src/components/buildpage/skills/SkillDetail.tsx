import type { GemLoadout } from '@/lib/build/gemState';

/**
 * The inline read-mode detail under a tapped skill row: level and quality,
 * then every support by name with its icon. The row itself shows icons only,
 * so this is where a reader learns what each support is.
 */
export default function SkillDetail({ loadout }: { loadout: GemLoadout }) {
  return (
    <div data-testid="skill-detail" className="border-t border-border/60 bg-background/40 px-3 py-2">
      {loadout.skill ? (
        <p className="pb-1.5 text-xs text-muted-foreground">
          Level <span className="tabular-nums text-foreground">{loadout.level}</span>
          {loadout.quality > 0 ? (
            <>
              {' '}
              · Quality <span className="tabular-nums text-foreground">{loadout.quality}%</span>
            </>
          ) : null}
        </p>
      ) : null}
      {loadout.supports.length === 0 ? (
        <p className="text-xs text-muted-foreground">No supports.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {loadout.supports.map((support, i) => (
            <li key={`${support.slug}-${i}`} data-testid="skill-support" className="flex items-center gap-2 text-sm text-foreground">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded border border-border/60">
                {support.iconUrl ? (
                  // Plain <img>, not next/image: wiki icons live under a session-cookie-protected prefix
                  // that next/image's server-side optimizer cannot carry (see PaperDoll.tsx's icon comment).
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={support.iconUrl} alt="" loading="lazy" className="h-full w-full object-contain" />
                ) : null}
              </span>
              <span className="min-w-0 truncate">{support.name}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
