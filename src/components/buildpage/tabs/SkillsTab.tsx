'use client';

import { useState } from 'react';
import { headlineSet, loadoutsMainFirst } from '@/lib/build/buildPage';
import { useBuildSession } from '../session/BuildSession';
import GemGroupSheet from '../skills/GemGroupSheet';
import SkillRows from '../skills/SkillRows';

export default function SkillsTab({ edit }: { edit: boolean }) {
  const { gems, reserved, sheets, gemActions } = useBuildSession();
  const set = headlineSet(gems);
  const reservedHere = reserved ? reserved.total[set === 1 ? 'set1' : 'set2'] : null;
  const spirit = sheets && !('error' in sheets) ? sheets[set].sheet.spirit : null;

  // Which group's sheet is open. Tapping a row sets `sheetId`; "+ Add skill
  // group" cannot know the new group's id up front (the session mints it), so
  // it remembers the ids that existed and the sheet follows whichever group
  // appears that was not among them.
  const [sheetId, setSheetId] = useState<string | null>(null);
  const [idsBeforeAdd, setIdsBeforeAdd] = useState<ReadonlySet<string> | null>(null);
  const rows = loadoutsMainFirst(gems);
  const sheetIndex = rows.findIndex(
    (l) => l.id === sheetId || (sheetId === null && idsBeforeAdd !== null && !idsBeforeAdd.has(l.id)),
  );
  // A group that disappears (removed from its own sheet) leaves no index, so the sheet closes.
  const sheetLoadout = edit && sheetIndex >= 0 ? rows[sheetIndex] : null;
  const closeSheet = () => {
    setSheetId(null);
    setIdsBeforeAdd(null);
  };

  return (
    <div id="skills-tab" role="tabpanel" data-testid="skills-tab" className="flex flex-col gap-3">
      {reservedHere !== null ? (
        <p className="text-sm text-muted-foreground">
          Spirit reserved (Set {set === 1 ? 'I' : 'II'}): <span className="tabular-nums text-foreground">{reservedHere}</span>
          {spirit !== null ? <span className="tabular-nums"> / {spirit}</span> : null}
        </p>
      ) : null}
      {edit ? (
        <button
          type="button"
          onClick={() => {
            setSheetId(null);
            setIdsBeforeAdd(new Set(gems.loadouts.map((l) => l.id)));
            gemActions.add();
          }}
          className="flex h-11 w-fit items-center rounded-lg border border-dashed border-border/70 px-4 text-sm font-medium text-foreground"
        >
          + Add skill group
        </button>
      ) : null}
      <SkillRows
        edit={edit}
        onEdit={(id) => {
          setIdsBeforeAdd(null);
          setSheetId(id);
        }}
      />
      {edit ? <GemGroupSheet loadout={sheetLoadout} index={Math.max(sheetIndex, 0)} onClose={closeSheet} /> : null}
    </div>
  );
}
