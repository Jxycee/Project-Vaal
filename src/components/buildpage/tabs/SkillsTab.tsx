'use client';

import { headlineSet } from '@/lib/build/buildPage';
import ReadOnlyGemList from '@/components/builds/ReadOnlyGemList';
import { useBuildSession } from '../session/BuildSession';

export default function SkillsTab() {
  const { gems, reserved, sheets } = useBuildSession();
  const set = headlineSet(gems);
  const reservedHere = reserved ? reserved.total[set === 1 ? 'set1' : 'set2'] : null;
  const spirit = sheets && !('error' in sheets) ? sheets[set].sheet.spirit : null;
  return (
    <div id="skills-tab" role="tabpanel" data-testid="skills-tab" className="flex flex-col gap-3">
      {reservedHere !== null ? (
        <p className="text-sm text-muted-foreground">
          Spirit reserved (Set {set === 1 ? 'I' : 'II'}): <span className="tabular-nums text-foreground">{reservedHere}</span>
          {spirit !== null ? <span className="tabular-nums"> / {spirit}</span> : null}
        </p>
      ) : null}
      <ReadOnlyGemList gemState={gems} />
    </div>
  );
}
