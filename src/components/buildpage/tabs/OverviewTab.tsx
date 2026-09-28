'use client';

// Overview: what a reader needs in one screen — main skill group, key items, notes.
import { keyItems, headlineSet, mainSkillLoadout } from '@/lib/build/buildPage';
import { MAX_NOTES_LENGTH } from '@/lib/build/constants';
import { useBuildSession } from '../session/BuildSession';

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

export default function OverviewTab({ edit }: { edit: boolean }) {
  const { gear, gems, meta, setMeta } = useBuildSession();
  const mainSkill = mainSkillLoadout(gems);
  const set = headlineSet(gems);
  const items = keyItems(gear, set);
  return (
    <div id="overview-tab" role="tabpanel" data-testid="overview-tab" className="flex flex-col gap-4">
      <section className="rounded-lg border border-border bg-card/40 p-3">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Main skill</h2>
        {mainSkill?.skill ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <Icon src={mainSkill.skill.iconUrl} size="h-11 w-11" />
              <div className="min-w-0">
                <p className="truncate text-base font-medium text-foreground">{mainSkill.skill.name}</p>
                <p className="text-xs text-muted-foreground">
                  Level {mainSkill.level}
                  {mainSkill.quality > 0 ? ` · ${mainSkill.quality}% quality` : ''}
                </p>
              </div>
            </div>
            {mainSkill.supports.length > 0 ? (
              <ul className="flex flex-col gap-1.5 pl-14">
                {mainSkill.supports.map((s, i) => (
                  <li key={`${s.slug}-${i}`} className="flex min-w-0 items-center gap-2 text-sm text-foreground">
                    <Icon src={s.iconUrl} size="h-6 w-6" />
                    <span className="truncate">{s.name}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No main skill set.</p>
        )}
      </section>

      <section className="rounded-lg border border-border bg-card/40 p-3">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Key items</h2>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No key items yet.</p>
        ) : (
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {items.map((item, i) => (
              <li key={`${item.slug}-${i}`} className="flex min-w-0 items-center gap-3">
                <Icon src={item.iconUrl} />
                <span className="truncate text-sm text-foreground">
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

      <section className="rounded-lg border border-border bg-card/40 p-3">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Notes</h2>
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
