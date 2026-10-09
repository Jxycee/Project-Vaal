'use client';

import { useState } from 'react';
import { loadoutsMainFirst, mainSkillLoadout } from '@/lib/build/buildPage';
import { WEAPON_SET_DOT } from '@/lib/build/weaponSetColors';
import type { GemLoadout } from '@/lib/build/gemState';
import { effectiveGemLevel } from '@/lib/build/gemLevels';
import { useGemLevelTable } from '@/components/build/useGemLevelTable';
import { useBuildSession } from '../session/BuildSession';
import SkillDetail from './SkillDetail';

function rowLabel(loadout: GemLoadout, shownLevel: number): string {
  const k = loadout.supports.length;
  return `${loadout.skill ? loadout.skill.name : 'Empty group'}, level ${shownLevel},${k} ${k === 1 ? 'support' : 'supports'}`;
}

function SkillRow({
  loadout,
  isMain,
  expanded,
  onTap,
  edit,
  characterLevel,
}: {
  loadout: GemLoadout;
  isMain: boolean;
  expanded: boolean;
  onTap: () => void;
  edit: boolean;
  /** The viewed checkpoint's character level: a gem level above what it allows shows lowered (read mode only). */
  characterLevel: number;
}) {
  const table = useGemLevelTable();
  // Edit mode keeps editing the stored level; read mode shows what the character level allows.
  const shown = !edit && loadout.skill ? effectiveGemLevel(table, loadout.skill.slug, loadout.level, characterLevel) : loadout.level;
  const lowered = shown < loadout.level;
  return (
    <button
      type="button"
      data-testid="skill-row"
      data-loadout-id={loadout.id}
      aria-label={rowLabel(loadout, shown)}
      // Read mode toggles an inline detail; edit mode opens the group's sheet.
      {...(edit ? { 'aria-haspopup': 'dialog' as const } : { 'aria-expanded': expanded })}
      onClick={onTap}
      className="flex h-14 w-full items-center gap-2 px-3 text-left"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-card/60">
        {loadout.skill?.iconUrl ? (
          // Plain <img>, not next/image — see SkillDetail.tsx.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={loadout.skill.iconUrl} alt="" loading="lazy" className="h-full w-full object-contain" />
        ) : (
          <span className="text-[10px] text-muted-foreground">—</span>
        )}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm text-foreground">{loadout.skill ? loadout.skill.name : 'Empty group'}</span>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="shrink-0 tabular-nums">
            Lv {shown}
            {loadout.quality > 0 ? ` · ${loadout.quality}%` : ''}
          </span>
          {lowered ? (
            <span
              data-testid="skill-level-lowered"
              title={`Lv ${shown} at character level ${characterLevel}; the file has Lv ${loadout.level}`}
              className="shrink-0 text-[10px] text-muted-foreground/70"
            >
              file Lv {loadout.level}
            </span>
          ) : null}
          {loadout.sets.length < 2
            ? loadout.sets.map((set) => (
                <span
                  key={set}
                  data-testid="skill-set-dot"
                  data-set={set}
                  className={`h-2 w-2 shrink-0 rounded-full ${WEAPON_SET_DOT[set]}`}
                />
              ))
            : null}
          {isMain ? (
            <span
              data-testid="skill-main-badge"
              className="shrink-0 rounded-full bg-primary/15 px-2 text-[10px] font-medium text-primary"
            >
              Main
            </span>
          ) : null}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-0.5">
        {loadout.supports.slice(0, 5).map((support, i) => (
          <span
            key={`${support.slug}-${i}`}
            className="h-5 w-5 shrink-0 overflow-hidden rounded border border-border/60 bg-card/60"
          >
            {support.iconUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={support.iconUrl} alt="" loading="lazy" className="h-full w-full object-contain" />
            ) : null}
          </span>
        ))}
      </span>
    </button>
  );
}

/**
 * The Skills tab's compact list: one row per gem group, main skill first
 * (loadoutsMainFirst). Read mode: a tap toggles that row's inline detail, one
 * open at a time. Edit mode: a tap hands the group to `onEdit` (the tab opens
 * GemGroupSheet on it).
 */
export default function SkillRows({ edit, onEdit }: { edit: boolean; onEdit: (id: string) => void }) {
  const { gems, meta } = useBuildSession();
  const table = useGemLevelTable();
  const [openId, setOpenId] = useState<string | null>(null);
  if (gems.loadouts.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">No gems recorded.</p>;
  }
  // The badge follows mainSkillLoadout (deriveMainSkill's rule: the primary, else the first loadout with a skill),
  // so it always marks the skill builds.main_skill names.
  const mainId = mainSkillLoadout(gems)?.id;
  return (
    <ul className="divide-y divide-border rounded-lg border border-border bg-card/40">
      {loadoutsMainFirst(gems).map((loadout) => (
        <li key={loadout.id}>
          <SkillRow
            loadout={loadout}
            isMain={loadout.id === mainId}
            expanded={!edit && openId === loadout.id}
            edit={edit}
            characterLevel={meta.level}
            onTap={() => (edit ? onEdit(loadout.id) : setOpenId((cur) => (cur === loadout.id ? null : loadout.id)))}
          />
          {!edit && openId === loadout.id ? (
            <SkillDetail loadout={loadout} characterLevel={meta.level} table={table} />
          ) : null}
        </li>
      ))}
    </ul>
  );
}
