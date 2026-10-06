// src/lib/pob/mapQuests.ts
// =============================================================================
// PoB2's quest-reward config inputs -> PassiveState.questChoices.
//
// PoB2 stores each choice quest as <Input name="quest<Act><Area><Info>"
// string="<the chosen reward's text>"/> in the active <ConfigSet>
// (src/Modules/ConfigOptions.lua:56-100; confirmed against the momentsZX
// export). An unchosen quest has no input, or the value "None" (the list's
// "Nothing" entry). Both read as no choice.
//
// A key or a reward text we do not know is reported and not imported — never
// guessed at: PoB2's list can move between patches ahead of ours.
// =============================================================================

import { CHOICE_QUESTS } from '@/lib/build/stats/campaign';
import type { ReportEntry } from './report';

/** PoB writes a reward's lines with "\n\t" between them; ours use " / ". Compare with neither. */
function squash(text: string): string {
  return text.replace(/\s*\/\s*/g, ' ').replace(/\s+/g, ' ').trim();
}

export function mapQuests(inputs: readonly { name: string; value: string }[]): { value: Record<string, string>; report: ReportEntry[] } {
  const value: Record<string, string> = {};
  const report: ReportEntry[] = [];
  for (const { name, value: raw } of inputs) {
    const text = squash(raw);
    if (text === '' || text === 'None') continue;
    const quest = CHOICE_QUESTS.find((q) => q.pobKey === name);
    if (!quest) {
      report.push({
        kind: 'dropped',
        area: 'build',
        message: `Path of Building's quest setting "${name}" is not a quest reward choice this builder knows, so it was left out.`,
      });
      continue;
    }
    const option = quest.options.find((o) => squash(o.text) === text);
    if (!option) {
      report.push({
        kind: 'dropped',
        area: 'build',
        message: `${quest.name}: "${text}" is not one of this builder's options for that quest, so the choice was left out.`,
      });
      continue;
    }
    value[quest.id] = option.id;
  }
  return { value, report };
}
