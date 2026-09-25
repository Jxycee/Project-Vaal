// The static read-only body of /builds/[shareToken]. One vertical scroll,
// top to bottom: header, tags, gems, gear, jewels, passive tree — the same
// order pobb.in uses, which the competitor recon found to be the one
// mobile-good page in the survey (docs/superpowers/plans/2026-09-22-
// task4-sharing.md, "Read-only rendering").
//
// Every prop here comes from `get_build_by_share_token`'s own result — see
// SharedBuildRow's doc comment in lib/build/types.ts — or from
// `get_build_checkpoints_by_share_token`, keyed by the same token. Nothing on
// this page makes a second query keyed off a client-supplied id: ?checkpoint=
// only CHOOSES among the rows already returned for the token, and an id that
// is not among them simply falls back to the first.
import Link from 'next/link';
import { parseGearState } from '@/lib/build/gearState';
import { parseGemState } from '@/lib/build/gemState';
import { parsePassiveState } from '@/lib/build/passiveState';
import type { GearItem } from '@/lib/build/gearSlots';
import type { SharedBuildRow } from '@/lib/build/types';
// A generic display helper that happens to live under lib/prices (it has no
// prices-specific dependency) — reused rather than duplicated.
import { relativeTime } from '@/lib/prices/format';
import ReadOnlyGearList from './ReadOnlyGearList';
import ReadOnlyGemList from './ReadOnlyGemList';
import SharedTreePanel from './SharedTreePanel';

function JewelIcon({ item }: { item: GearItem }) {
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-card/60">
      {item.iconUrl ? (
        // Plain <img>, not next/image — see ReadOnlyGearList.tsx's SlotRow comment.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.iconUrl} alt="" loading="lazy" className="h-full w-full object-contain" />
      ) : (
        <span className="text-[10px] text-muted-foreground">—</span>
      )}
    </span>
  );
}

export default function SharedBuildView({
  row,
  authorName,
  isOwner,
  tags,
  shareToken,
  checkpoints,
  activeCheckpointId,
}: {
  /**
   * The build as the CHOSEN checkpoint sees it — the page substitutes that
   * checkpoint's tree, gear, gems and level — so everything below renders the
   * selected stage without knowing checkpoints exist.
   */
  row: SharedBuildRow;
  authorName: string;
  isOwner: boolean;
  /**
   * Only ever populated by the page for `visibility === 'public'` builds —
   * `build_tags`' SELECT policy is `own OR builds.visibility = 'public'` and
   * covers only own-or-public (verified against pg_policies 2026-09-23), so
   * a plain select returns zero rows for a link-shared ('private') build even
   * though the build itself renders fine via the RPC. Passing `[]` here for
   * a link-shared build would read as "this build has no tags" rather than
   * "we cannot see them" — so the page never even queries build_tags for a
   * non-public build, and this prop is `null` (not `[]`) in that case, which
   * is what tells this component to omit the section entirely rather than
   * render a lying empty one.
   */
  tags: string[] | null;
  shareToken: string;
  /** The build's checkpoints in position order; empty if they failed to load. */
  checkpoints: Array<{ id: string; name: string; level: number }>;
  activeCheckpointId: string | undefined;
}) {
  const gear = parseGearState(row.gear_state);
  const gemState = parseGemState(row.gem_state);
  const passiveState = parsePassiveState(row.passive_state);
  const jewels = Object.values(gear.jewels);

  return (
    <div className="flex flex-col gap-5">
      {/* Header — house list language from /prices' "icon chip" + list styling. */}
      <div className="rounded-lg border border-border bg-card/40 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate font-heading text-xl font-bold text-foreground">{row.name}</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {row.ascendancy ?? row.class} · Level {row.level} · {row.league}
            </p>
          </div>
          {isOwner ? (
            <Link
              href={
                activeCheckpointId
                  ? `/tree?build=${row.id}&checkpoint=${activeCheckpointId}`
                  : `/tree?build=${row.id}`
              }
              className="flex h-11 shrink-0 items-center rounded-lg border border-border px-3 text-sm font-medium text-foreground"
            >
              Edit
            </Link>
          ) : null}
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground sm:grid-cols-4">
          <div>
            <dt className="text-muted-foreground/70">Main skill</dt>
            <dd className="text-foreground">{row.main_skill ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground/70">Author</dt>
            <dd className="text-foreground">{authorName}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground/70">Views</dt>
            <dd className="text-foreground">{row.view_count.toLocaleString()}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground/70">Updated</dt>
            <dd className="text-foreground">{relativeTime(row.updated_at)}</dd>
          </div>
        </dl>
      </div>

      {/* TEST-GRADE: a plain checkpoint picker, pending the UI session. Shown
          only when there is more than one stage to choose between. Each link
          is a navigation the server answers, so the page re-reads fresh rows. */}
      {checkpoints.length > 1 ? (
        <nav aria-label="Checkpoints" data-testid="shared-checkpoints" className="flex flex-wrap gap-2">
          {checkpoints.map((checkpoint) => {
            const isActive = checkpoint.id === activeCheckpointId;
            return (
              <Link
                key={checkpoint.id}
                href={`/builds/${shareToken}?checkpoint=${checkpoint.id}`}
                aria-current={isActive ? 'page' : undefined}
                className={
                  isActive
                    ? 'flex h-11 min-w-11 items-center rounded-lg border border-foreground px-3 text-sm font-medium text-foreground'
                    : 'flex h-11 min-w-11 items-center rounded-lg border border-border px-3 text-sm text-muted-foreground'
                }
              >
                {checkpoint.name} · {checkpoint.level}
              </Link>
            );
          })}
        </nav>
      ) : null}

      {/* Tags — see the `tags` prop's doc comment above for why this omits
          the section entirely (not an empty one) for a non-public build. */}
      {tags !== null && tags.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-border bg-card/60 px-2.5 py-1 text-xs text-muted-foreground"
            >
              {tag}
            </span>
          ))}
        </div>
      ) : null}

      {/* Notes — only when the owner wrote something. "why does this build
          work" is the thing readers of a shared build want and could not
          get anywhere else before this field existed. */}
      {row.notes ? (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-foreground">Notes</h2>
          <p className="whitespace-pre-line rounded-lg border border-border bg-card/40 p-3 text-sm text-foreground">
            {row.notes}
          </p>
        </section>
      ) : null}

      {/* Gems */}
      <section>
        <h2 className="mb-2 text-sm font-semibold text-foreground">Gems</h2>
        <ReadOnlyGemList gemState={gemState} />
      </section>

      {/* Gear */}
      <section>
        <h2 className="mb-2 text-sm font-semibold text-foreground">Gear</h2>
        <ReadOnlyGearList gear={gear} />
      </section>

      {/* Jewels — flat list of gear_state.jewels values, no socket names.
          Resolving socket names needs summarizeJewels(raw: GggTreeJson, ...),
          i.e. the 5.1MB tree export, on a page that otherwise needs none
          before a tap. Deliberate (Task 4 plan, Task 4 §5). */}
      <section>
        <h2 className="mb-2 text-sm font-semibold text-foreground">Jewels</h2>
        {jewels.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No jewels recorded.</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border bg-card/40">
            {jewels.map((item, i) => (
              <li key={`${item.slug}-${i}`} className="flex items-center gap-3 px-3 py-2.5">
                <JewelIcon item={item} />
                <span className="min-w-0 truncate text-sm text-foreground">
                  {item.name}
                  {item.isUnique ? (
                    <span className="ml-1.5 text-xs font-medium" style={{ color: 'var(--wiki-unique)' }}>
                      Unique
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Passive tree — below everything else, and behind a tap (SharedTreePanel). */}
      <section>
        <h2 className="mb-2 text-sm font-semibold text-foreground">Passive tree</h2>
        <SharedTreePanel
          className={row.class}
          ascendancyId={row.ascendancy}
          passiveState={passiveState}
          level={row.level}
        />
      </section>
    </div>
  );
}
