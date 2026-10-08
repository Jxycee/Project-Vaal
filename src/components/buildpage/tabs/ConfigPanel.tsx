'use client';

// The build's Path of Building "Configuration" as the Stats tab shows it: which conditions are true (Moving, Hit
// recently, ...) and the stack counts. They decide which conditional modifiers the stat sheet above counts
// (stats/buildConfig.ts). The owner edits them in edit mode; a reader sees what is set. The campaign resistance
// penalty is derived from the checkpoint's level (stats/campaign.ts) and has no override in the model, so it is
// shown here, not editable.
import { CONFIG_CONDITIONS, CONFIG_MULTIPLIERS, MAX_STACKS } from '@/lib/build/stats/buildConfig';
import { campaignAt } from '@/lib/build/stats/campaign';
import { useBuildSession } from '../session/BuildSession';

export default function ConfigPanel({ edit }: { edit: boolean }) {
  const { meta, buildConfig, setConfigCondition, setConfigMultiplier } = useBuildSession();
  const campaign = campaignAt(meta.level);
  const known = new Set(CONFIG_CONDITIONS.map((c) => c.name));
  // Imported flags this panel has no toggle for: kept on every edit, shown so they are not invisible.
  const other = (buildConfig?.conditions ?? []).filter((c) => !known.has(c));
  const set = CONFIG_CONDITIONS.filter((c) => buildConfig?.conditions.includes(c.name));
  const stacks = (name: string): number => buildConfig?.multipliers[name] ?? 0;

  return (
    <section data-testid="config-panel" className="rounded-lg border border-border bg-card/40 px-3 py-3">
      <h2 className="text-sm font-semibold text-foreground">Config</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {edit
          ? 'The Path of Building settings the stat sheet uses. A setting only changes a number when the build has a modifier that depends on it.'
          : 'The Path of Building settings the stat sheet uses.'}
      </p>

      <p data-testid="config-penalty" className="mt-2 text-xs text-muted-foreground">
        Resistance penalty {campaign.resistancePenalty}% ({campaign.act}, from level {meta.level}; it follows the level and has no separate setting).
      </p>

      {buildConfig === undefined ? (
        <p data-testid="config-unset" className="mt-2 text-xs text-muted-foreground">
          {edit
            ? 'No Config yet. Until you tick something, modifiers that depend on a condition are listed under Not counted.'
            : 'No Config was set. Modifiers that depend on a condition are listed under Not counted.'}
        </p>
      ) : null}

      <div className="mt-3">
        <h3 className="text-xs text-muted-foreground">Conditions</h3>
        {edit ? (
          <ul className="mt-1 space-y-1">
            {CONFIG_CONDITIONS.map((c) => (
              <li key={c.name}>
                <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border border-border bg-background/60 px-3 text-sm text-foreground">
                  <input
                    type="checkbox"
                    data-testid={`config-condition-${c.name}`}
                    checked={buildConfig?.conditions.includes(c.name) ?? false}
                    onChange={(e) => setConfigCondition(c.name, e.target.checked)}
                    className="h-5 w-5 shrink-0 accent-primary"
                  />
                  <span className="min-w-0 break-words">{c.label}</span>
                </label>
              </li>
            ))}
          </ul>
        ) : (
          <p data-testid="config-conditions-read" className="mt-1 break-words text-sm text-foreground">
            {set.length > 0 ? set.map((c) => c.label).join(', ') : <span className="text-muted-foreground">None set</span>}
          </p>
        )}
        {other.length > 0 ? (
          <p data-testid="config-other" className="mt-2 break-words text-xs text-muted-foreground">
            Also set (kept, not editable here): {other.join(', ')}
          </p>
        ) : null}
      </div>

      <div className="mt-3">
        <h3 className="text-xs text-muted-foreground">Stacks</h3>
        <ul className="mt-1 space-y-1">
          {CONFIG_MULTIPLIERS.map((m) => (
            <li key={m.name}>
              {edit ? (
                <label className="flex min-h-11 items-center justify-between gap-3 rounded-md border border-border bg-background/60 px-3 text-sm text-foreground">
                  <span className="min-w-0 break-words">{m.label}</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={MAX_STACKS}
                    step={1}
                    placeholder="0"
                    data-testid={`config-stacks-${m.name}`}
                    value={stacks(m.name) === 0 ? '' : stacks(m.name)}
                    onChange={(e) => setConfigMultiplier(m.name, e.target.value === '' ? 0 : Number(e.target.value))}
                    className="h-11 w-20 shrink-0 rounded-md border border-border bg-background px-2 text-right text-sm tabular-nums text-foreground"
                  />
                </label>
              ) : (
                <p className="flex justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">{m.label}</span>
                  <span data-testid={`config-stacks-${m.name}-value`} className="tabular-nums text-foreground">
                    {stacks(m.name)}
                  </span>
                </p>
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
