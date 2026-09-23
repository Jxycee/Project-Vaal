// The Public tab's body on /builds — presentational. The query itself lives
// in the Server Component (builds/page.tsx); this only renders filter chips
// and the result list. Server-rendered and URL-driven by design: every chip
// is a plain <Link>, so a filtered finder is a shareable URL and the Back
// button works, with no client state to reconcile.
import Link from 'next/link';
import type { BuildFinderFilters } from '@/lib/build/finderFilters';
import type { PublicBuildRow } from '@/lib/build/types';

function hrefFor(base: BuildFinderFilters, overrides: Partial<BuildFinderFilters>): string {
  const merged = { ...base, ...overrides };
  const params = new URLSearchParams();
  params.set('tab', 'public');
  if (merged.class) params.set('class', merged.class);
  if (merged.league) params.set('league', merged.league);
  if (merged.skill) params.set('skill', merged.skill);
  if (merged.tag) params.set('tag', merged.tag);
  return `/builds?${params.toString()}`;
}

function FilterChipRow({
  label,
  options,
  active,
  filters,
  field,
}: {
  label: string;
  options: string[];
  active: string | null;
  filters: BuildFinderFilters;
  field: keyof BuildFinderFilters;
}) {
  if (options.length === 0) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      {/* flex-wrap, never a horizontally-clipped strip — a scrolling row of
          chips off the edge of a 375px screen is the recon's named failure
          mode (2026-09-20-competitor-build-planner-recon.md:59). */}
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => {
          const isActive = active === option;
          return (
            <Link
              key={option}
              href={hrefFor(filters, { [field]: isActive ? null : option })}
              className={
                isActive
                  ? 'flex h-11 items-center rounded-full bg-primary px-3 text-sm font-medium text-primary-foreground'
                  : 'flex h-11 items-center rounded-full bg-card px-3 text-sm text-muted-foreground'
              }
            >
              {option}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export interface BuildFinderProps {
  filters: BuildFinderFilters;
  classes: string[];
  leagues: string[];
  skills: string[];
  builds: PublicBuildRow[] | null;
  loadError: string | null;
}

export default function BuildFinder({ filters, classes, leagues, skills, builds, loadError }: BuildFinderProps) {
  const anyFilterActive = Boolean(filters.class || filters.league || filters.skill || filters.tag);

  return (
    <div className="flex flex-col gap-4">
      <FilterChipRow label="Class" options={classes} active={filters.class} filters={filters} field="class" />
      <FilterChipRow label="League" options={leagues} active={filters.league} filters={filters} field="league" />
      <FilterChipRow label="Main skill" options={skills} active={filters.skill} filters={filters} field="skill" />

      {/* Tag search — a plain GET form, not client state: preserves the
          other filters as hidden inputs so submitting doesn't drop them. */}
      <form action="/builds" method="get" className="flex items-center gap-2">
        <input type="hidden" name="tab" value="public" />
        {filters.class ? <input type="hidden" name="class" value={filters.class} /> : null}
        {filters.league ? <input type="hidden" name="league" value={filters.league} /> : null}
        {filters.skill ? <input type="hidden" name="skill" value={filters.skill} /> : null}
        <input
          type="search"
          name="tag"
          defaultValue={filters.tag ?? ''}
          placeholder="Filter by tag…"
          className="h-11 flex-1 rounded-lg border border-input bg-card px-3 text-sm placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none"
        />
        <button
          type="submit"
          className="flex h-11 shrink-0 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"
        >
          Filter
        </button>
      </form>

      {anyFilterActive ? (
        <Link href="/builds?tab=public" className="self-start text-xs text-muted-foreground underline">
          Clear filters
        </Link>
      ) : null}

      {loadError ? (
        <p className="text-sm text-destructive" role="alert">
          {loadError}
        </p>
      ) : builds === null ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : builds.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          {anyFilterActive ? 'No public builds match these filters.' : 'No public builds yet.'}
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-card/40">
          {builds.map((b) => {
            const row = (
              <>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">{b.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {b.ascendancy ?? b.class} · Level {b.level} · {b.league}
                    {b.main_skill ? ` · ${b.main_skill}` : ''}
                  </p>
                </div>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {b.view_count.toLocaleString()} views
                </span>
              </>
            );
            return (
              <li key={b.id}>
                {/* share_token is minted on every insert, so a null one
                    shouldn't exist — but render it non-clickable rather
                    than crash if it ever does. */}
                {b.share_token ? (
                  <Link href={`/builds/${b.share_token}`} className="flex items-center gap-3 px-3 py-2.5">
                    {row}
                  </Link>
                ) : (
                  <div className="flex items-center gap-3 px-3 py-2.5 opacity-60">{row}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
