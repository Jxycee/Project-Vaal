'use client';

// Overview: the build's front page. Main skill card, key items as an icon
// grid, the checkpoints at a glance, notes. Cards and tiles are buttons that
// open the tab that holds the detail (in-page, via tabNav's pushState). An
// empty build shows plain "No skills yet" / "No gear yet" text, and its owner
// (only) gets a button that opens the right tab in edit mode — in-page too
// (pushState + replaceState, no remount), so an unsaved edit survives the tap.
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { keyItems, headlineSet, mainSkillLoadout, patchQuery } from '@/lib/build/buildPage';
import { MAX_NOTES_LENGTH } from '@/lib/build/constants';
import { useBuildSession } from '../session/BuildSession';
import { enterEdit, selectTab } from '../tabNav';

function Icon({ src, size = 'h-9 w-9' }: { src: string | null; size?: string }) {
  return (
    <span className={`${size} shrink-0 overflow-hidden rounded-md border border-border bg-card/60`}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" loading="lazy" className="h-full w-full object-contain" />
      ) : null}
    </span>
  );
}

const SECTION = 'rounded-lg border border-border bg-card/40 p-3';
const HEADING = 'mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground';

export default function OverviewTab({
  edit,
  shareToken,
  checkpoints,
  activeCheckpointId,
}: {
  edit: boolean;
  shareToken: string;
  checkpoints: { id: string; name: string; level: number }[];
  activeCheckpointId: string | undefined;
}) {
  const { gear, gems, meta, setMeta, canEdit } = useBuildSession();
  const searchParams = useSearchParams();
  const mainSkill = mainSkillLoadout(gems);
  const set = headlineSet(gems);
  const items = keyItems(gear, set);
  const activeId = checkpoints.find((c) => c.id === activeCheckpointId)?.id ?? checkpoints[0]?.id;

  // Owner-only CTA target: open `tab` in edit mode. Both calls are History API
  // only — no server request, no remount — so nothing unsaved is lost.
  function openForEditing(tab: 'skills' | 'gear') {
    selectTab(tab);
    if (!edit) enterEdit();
  }

  return (
    <div id="overview-tab" role="tabpanel" data-testid="overview-tab" className="flex min-w-0 flex-col gap-3">
      <section className={SECTION}>
        <h2 className={HEADING}>Main skill</h2>
        {mainSkill?.skill ? (
          <button
            type="button"
            data-testid="overview-main-skill"
            onClick={() => selectTab('skills')}
            className="flex min-h-11 w-full min-w-0 flex-col gap-2 rounded-md text-left"
          >
            <span className="flex min-w-0 items-center gap-3">
              <Icon src={mainSkill.skill.iconUrl} size="h-11 w-11" />
              <span className="min-w-0">
                <span className="block truncate text-base font-medium text-foreground">{mainSkill.skill.name}</span>
                <span className="block text-xs text-muted-foreground">
                  Level {mainSkill.level}
                  {mainSkill.quality > 0 ? ` · ${mainSkill.quality}% quality` : ''}
                </span>
              </span>
            </span>
            {mainSkill.supports.length > 0 ? (
              <span className="flex flex-col gap-1.5 pl-14">
                {mainSkill.supports.map((s, i) => (
                  <span key={`${s.slug}-${i}`} className="flex min-w-0 items-center gap-2 text-sm text-foreground">
                    <Icon src={s.iconUrl} size="h-6 w-6" />
                    <span className="truncate">{s.name}</span>
                  </span>
                ))}
              </span>
            ) : null}
          </button>
        ) : (
          <div className="flex flex-col items-start gap-2">
            <p className="text-sm text-muted-foreground">No skills yet</p>
            {canEdit ? (
              <button
                type="button"
                data-testid="overview-cta-skills"
                onClick={() => openForEditing('skills')}
                className="h-11 min-w-11 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
              >
                Pick your main skill
              </button>
            ) : null}
          </div>
        )}
      </section>

      <section className={SECTION}>
        <h2 className={HEADING}>Key items</h2>
        {items.length === 0 ? (
          <div className="flex flex-col items-start gap-2">
            <p className="text-sm text-muted-foreground">No gear yet</p>
            {canEdit ? (
              <button
                type="button"
                data-testid="overview-cta-gear"
                onClick={() => openForEditing('gear')}
                className="h-11 min-w-11 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
              >
                Add gear
              </button>
            ) : null}
          </div>
        ) : (
          <div data-testid="overview-key-items" className="grid grid-cols-4 gap-2 md:grid-cols-6">
            {items.map((item, i) => (
              <button
                key={`${item.slug}-${i}`}
                type="button"
                data-testid="overview-key-item"
                aria-label={item.name}
                onClick={() => selectTab('gear')}
                className="flex min-h-11 min-w-11 flex-col items-center gap-1 rounded-md"
              >
                <Icon src={item.iconUrl} size="h-11 w-11" />
                <span
                  className="w-full truncate text-center text-[11px] leading-tight text-foreground"
                  style={item.isUnique ? { color: 'var(--wiki-unique)' } : undefined}
                >
                  {item.name}
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      {checkpoints.length >= 2 ? (
        <section className={SECTION}>
          <h2 className={HEADING}>Checkpoints</h2>
          <ul data-testid="overview-checkpoints" className="flex flex-col">
            {checkpoints.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/builds/${shareToken}${patchQuery(searchParams.toString(), { checkpoint: c.id })}`}
                  aria-current={c.id === activeId ? 'true' : undefined}
                  className={`flex h-11 min-w-11 items-center justify-between gap-3 rounded-md px-2 text-sm ${
                    c.id === activeId ? 'bg-accent font-medium text-foreground' : 'text-muted-foreground'
                  }`}
                >
                  <span className="truncate">{c.name}</span>
                  <span className="shrink-0 tabular-nums">Lvl {c.level}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section data-testid="overview-notes" className={SECTION}>
        <h2 className={HEADING}>Notes</h2>
        {edit ? (
          <textarea
            id="build-notes"
            value={meta.notes}
            onChange={(e) => setMeta({ notes: e.target.value })}
            maxLength={MAX_NOTES_LENGTH}
            placeholder="Why this build works, leveling notes, anything a reader would want…"
            className="min-h-32 w-full resize-y rounded-md border border-input bg-background/60 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-3 focus:ring-ring/50"
          />
        ) : meta.notes ? (
          <p className="whitespace-pre-line break-words text-sm text-foreground">{meta.notes}</p>
        ) : (
          <p className="text-sm text-muted-foreground">No notes yet.</p>
        )}
      </section>
    </div>
  );
}
