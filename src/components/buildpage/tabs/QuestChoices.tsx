'use client';

// The campaign quests whose reward the player chooses, for the checkpoint's
// level (stats/campaign.ts). The owner picks one in edit mode; a reader sees
// what was chosen. A choice counts on the stat sheet above once made — an
// unchosen quest is listed under "Not counted" there.
import { CHOICE_QUESTS } from '@/lib/build/stats/campaign';
import { useBuildSession } from '../session/BuildSession';

const NO_CHOICE = '';

export default function QuestChoices({ edit }: { edit: boolean }) {
  const { meta, questChoices, setQuestChoice } = useBuildSession();
  // Same gate as campaignAt: a quest counts once the level reaches its area level.
  const reached = CHOICE_QUESTS.filter((q) => meta.level >= q.areaLevel);
  if (reached.length === 0) return null;

  return (
    <section data-testid="quest-choices" className="rounded-lg border border-border bg-card/40 px-3 py-3">
      <h2 className="text-sm font-semibold text-foreground">Quest rewards</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {edit ? 'Pick the reward you chose for each quest; it counts on the sheet above.' : 'The rewards chosen for the quests this level has reached.'}
      </p>
      <ul className="mt-2 space-y-3">
        {reached.map((quest) => {
          const chosen = quest.options.find((o) => o.id === questChoices[quest.id]);
          return (
            <li key={quest.id} data-testid={`quest-choice-${quest.id}`} className="min-w-0">
              {edit ? (
                <label className="block min-w-0">
                  <span className="mb-1 block text-xs text-muted-foreground">{quest.name}</span>
                  <select
                    value={chosen ? chosen.id : NO_CHOICE}
                    onChange={(e) => setQuestChoice(quest.id, e.target.value === NO_CHOICE ? null : e.target.value)}
                    className="h-11 w-full min-w-0 rounded-md border border-border bg-background px-2 text-sm text-foreground"
                  >
                    <option value={NO_CHOICE}>Nothing chosen</option>
                    {quest.options.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.text}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <>
                  <span className="block text-xs text-muted-foreground">{quest.name}</span>
                  <span data-testid={`quest-choice-${quest.id}-value`} className={`block break-words text-sm ${chosen ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {chosen ? chosen.text : 'No choice recorded'}
                  </span>
                </>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
