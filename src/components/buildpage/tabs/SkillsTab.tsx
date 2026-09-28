'use client';

import { useState } from 'react';
import { headlineSet } from '@/lib/build/buildPage';
import ReadOnlyGemList from '@/components/builds/ReadOnlyGemList';
import GemsSheet from '@/components/build/GemsSheet';
import { useBuildSession } from '../session/BuildSession';

export default function SkillsTab({ edit }: { edit: boolean }) {
  const { gems, reserved, sheets, gemActions } = useBuildSession();
  const set = headlineSet(gems);
  const reservedHere = reserved ? reserved.total[set === 1 ? 'set1' : 'set2'] : null;
  const spirit = sheets && !('error' in sheets) ? sheets[set].sheet.spirit : null;
  const [gemsSheetOpen, setGemsSheetOpen] = useState(false);
  return (
    <div id="skills-tab" role="tabpanel" data-testid="skills-tab" className="flex flex-col gap-3">
      {edit ? (
        <button
          type="button"
          onClick={() => setGemsSheetOpen(true)}
          className="flex h-11 w-fit items-center rounded-lg border border-border px-4 text-sm font-medium text-foreground"
        >
          Edit skills
        </button>
      ) : null}
      {reservedHere !== null ? (
        <p className="text-sm text-muted-foreground">
          Spirit reserved (Set {set === 1 ? 'I' : 'II'}): <span className="tabular-nums text-foreground">{reservedHere}</span>
          {spirit !== null ? <span className="tabular-nums"> / {spirit}</span> : null}
        </p>
      ) : null}
      <ReadOnlyGemList gemState={gems} />
      {edit ? (
        <GemsSheet
          open={gemsSheetOpen}
          gemState={gems}
          onAddLoadout={gemActions.add}
          onRemoveLoadout={gemActions.remove}
          onSetSkill={gemActions.setSkill}
          onAddSupport={gemActions.addSupport}
          onRemoveSupport={gemActions.removeSupport}
          onSetSets={gemActions.setSets}
          onSetPrimary={gemActions.setPrimary}
          onSetLevel={gemActions.setLevel}
          onSetQuality={gemActions.setQuality}
          onClose={() => setGemsSheetOpen(false)}
        />
      ) : null}
    </div>
  );
}
