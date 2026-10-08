'use client';

import { headlineSet } from '@/lib/build/buildPage';
import { CONFIG_CONDITIONS, CONFIG_MULTIPLIERS } from '@/lib/build/stats/buildConfig';
import StatsPanel from '@/components/build/StatsPanel';
import { useBuildSession } from '../session/BuildSession';
import ConfigPanel from './ConfigPanel';
import QuestChoices from './QuestChoices';

export default function StatsTab({ edit = false }: { edit?: boolean }) {
  const { sheets, reserved, gems, buildConfig } = useBuildSession();
  const set = headlineSet(gems);
  // What the numbers below were computed under, in words (the Config section has the controls).
  const on = CONFIG_CONDITIONS.filter((c) => buildConfig?.conditions.includes(c.name)).map((c) => c.label);
  for (const m of CONFIG_MULTIPLIERS) {
    const n = buildConfig?.multipliers[m.name] ?? 0;
    if (n > 0) on.push(`${m.label} ${n}`);
  }
  return (
    <div id="stats-tab" role="tabpanel" data-testid="stats-tab" className="space-y-3">
      <div className="rounded-lg border border-border bg-card/40">
        <p data-testid="stats-config-hint" className="border-b border-border px-3 py-2 text-xs text-muted-foreground">
          {buildConfig === undefined
            ? 'Numbers use no Config settings: conditional modifiers are not counted.'
            : `Numbers use these settings: ${on.length > 0 ? on.join(', ') : 'nothing ticked'}.`}
        </p>
        <StatsPanel sheets={sheets} reserved={reserved} initialSet={set} />
      </div>
      <ConfigPanel edit={edit} />
      <QuestChoices edit={edit} />
    </div>
  );
}
