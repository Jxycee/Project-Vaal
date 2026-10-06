'use client';

import { headlineSet } from '@/lib/build/buildPage';
import StatsPanel from '@/components/build/StatsPanel';
import { useBuildSession } from '../session/BuildSession';
import QuestChoices from './QuestChoices';

export default function StatsTab({ edit = false }: { edit?: boolean }) {
  const { sheets, reserved, gems } = useBuildSession();
  const set = headlineSet(gems);
  return (
    <div id="stats-tab" role="tabpanel" data-testid="stats-tab" className="space-y-3">
      <div className="rounded-lg border border-border bg-card/40">
        <StatsPanel sheets={sheets} reserved={reserved} initialSet={set} />
      </div>
      <QuestChoices edit={edit} />
    </div>
  );
}
