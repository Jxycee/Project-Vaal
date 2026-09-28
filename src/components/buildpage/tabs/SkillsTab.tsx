import type { WeaponSet } from '@poe2-toolkit/tree-core';
import ReadOnlyGemList from '@/components/builds/ReadOnlyGemList';
import type { GemState } from '@/lib/build/gemState';
import type { ReservedSpiritResult } from '@/components/build/useReservedSpirit';
import type { Sheets } from '../HeaderStats';

export default function SkillsTab({ gemState, reserved, sheets, set }: { gemState: GemState; reserved: ReservedSpiritResult | null; sheets: Sheets; set: WeaponSet }) {
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
      <ReadOnlyGemList gemState={gemState} />
    </div>
  );
}
