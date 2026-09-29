// One build in the library, as a profile-style card. The whole card is ONE
// link to the build page: rename, visibility, link, tags and delete are in the
// build page's settings menu, never on a card (spec §8.3).
//
// Presentational and server-renderable (no state), used by the Mine tab
// (MyBuildsList, visibility badge) and the Public tab (BuildFinder, views).
//
// The icon slot is a placeholder: the class initial. `builds.main_skill` is
// only the skill's NAME, and finding its gem icon would mean loading wiki
// data for every row of a list — not worth it here.
import Link from 'next/link';
import { relativeTime } from '@/lib/prices/format';
import { ascendancyLabel } from '@/lib/tree/ascendancyNames';

export interface BuildCardProps {
  href: string;
  name: string;
  className: string;
  ascendancy: string | null;
  level: number;
  league: string;
  mainSkill: string | null;
  updatedAt: string;
  /** Owner flavour: the visibility label. Reader flavour: the view count. */
  badge: string;
  /** Explains the badge on hover/long-press; not the only place it is said. */
  badgeTitle?: string;
  tags?: string[];
}

export default function BuildCard({
  href,
  name,
  className,
  ascendancy,
  level,
  league,
  mainSkill,
  updatedAt,
  badge,
  badgeTitle,
  tags = [],
}: BuildCardProps) {
  return (
    <Link
      href={href}
      data-testid="build-card"
      className="flex min-h-11 min-w-0 items-start gap-3 rounded-lg border border-border bg-card/40 p-3 transition-colors hover:bg-accent/40"
    >
      <span
        aria-hidden="true"
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-border bg-card/60 font-heading text-lg text-muted-foreground"
      >
        {className.charAt(0).toUpperCase()}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span data-testid="build-card-name" className="line-clamp-2 break-words font-medium text-foreground">{name}</span>
        <span className="truncate text-xs text-muted-foreground">
          {ascendancyLabel(className, ascendancy)} · Level {level}
        </span>
        {mainSkill ? <span className="truncate text-xs text-foreground/80">{mainSkill}</span> : null}
        <span className="truncate text-xs text-muted-foreground">
          {league} · updated {relativeTime(updatedAt)}
        </span>
        <span className="mt-1 flex flex-wrap gap-1.5">
          <span title={badgeTitle} className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
            {badge}
          </span>
          {tags.map((tag) => (
            <span key={tag} className="rounded-full border border-border bg-card/60 px-2 py-0.5 text-[11px] text-muted-foreground">
              #{tag}
            </span>
          ))}
        </span>
      </span>
    </Link>
  );
}
