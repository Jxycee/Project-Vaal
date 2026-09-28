'use client';

import { headlineSet } from '@/lib/build/buildPage';
import StatsPanel from '@/components/build/StatsPanel';
import { useBuildSession } from '../session/BuildSession';

export default function StatsTab() {
  const { sheets, reserved, gems } = useBuildSession();
  const set = headlineSet(gems);
  return (
    <div id="stats-tab" role="tabpanel" data-testid="stats-tab" className="rounded-lg border border-border bg-card/40">
      <StatsPanel sheets={sheets} reserved={reserved} initialSet={set} />
    </div>
  );
}
