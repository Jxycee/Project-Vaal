import type { WeaponSet } from '@poe2-toolkit/tree-core';
import StatsPanel from '@/components/build/StatsPanel';
import type { ReservedSpiritResult } from '@/components/build/useReservedSpirit';
import type { Sheets } from '../HeaderStats';

export default function StatsTab({ sheets, reserved, set }: { sheets: Sheets; reserved: ReservedSpiritResult | null; set: WeaponSet }) {
  return (
    <div id="stats-tab" role="tabpanel" data-testid="stats-tab" className="rounded-lg border border-border bg-card/40">
      <StatsPanel sheets={sheets} reserved={reserved} initialSet={set} />
    </div>
  );
}
