'use client';

// Owns the checked-state for the whole tracker: local state updates
// instantly on tap, persistence to campaign_progress is debounced so rapid
// checkbox taps collapse into one write instead of one per tap. Progress is
// per-user (character_id IS NULL) — see campaign_progress's schema comment
// for why character scoping isn't wired up yet.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { CAMPAIGN, ALL_CHECKPOINT_IDS } from '@/lib/campaign/data';
import CampaignActSection from './CampaignActSection';
import CampaignResetButton from './CampaignResetButton';
import { cn } from '@/lib/utils';

const SAVE_DEBOUNCE_MS = 900;

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export default function CampaignTracker({
  initialChecked,
}: {
  initialChecked: Record<string, boolean>;
}) {
  const supabase = useMemo(() => createClient(), []);

  const [checked, setChecked] = useState<Record<string, boolean>>(initialChecked);
  // Default: expand the first act that isn't fully cleared ("pick up where
  // you left off"), collapse the rest — computed once from the server-loaded
  // progress, not recomputed as the user manually opens/closes sections.
  const [openActs, setOpenActs] = useState<Record<string, boolean>>(() => {
    const firstUnfinished = CAMPAIGN.find((act) => act.areas.some((a) => !initialChecked[a.id]));
    const targetId = firstUnfinished?.id ?? CAMPAIGN[0]?.id;
    return Object.fromEntries(CAMPAIGN.map((act) => [act.id, act.id === targetId]));
  });
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persist = useCallback(
    (next: Record<string, boolean>) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      setSaveState('saving');
      saveTimer.current = setTimeout(async () => {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          setSaveState('error');
          return;
        }
        const { error } = await supabase
          .from('campaign_progress')
          .upsert({ user_id: user.id, character_id: null, progress: next }, { onConflict: 'user_id,character_id' });
        if (error) {
          console.error('campaign_progress save failed:', error);
          setSaveState('error');
        } else {
          setSaveState('saved');
        }
      }, SAVE_DEBOUNCE_MS);
    },
    [supabase],
  );

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  const toggleArea = useCallback(
    (id: string) => {
      setChecked((cur) => {
        const next = { ...cur, [id]: !cur[id] };
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const toggleAct = useCallback((actId: string) => {
    setOpenActs((cur) => ({ ...cur, [actId]: !cur[actId] }));
  }, []);

  const handleReset = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setChecked({});
    persist({});
  }, [persist]);

  const totalDone = ALL_CHECKPOINT_IDS.filter((id) => checked[id]).length;
  const totalAll = ALL_CHECKPOINT_IDS.length;
  const pct = totalAll > 0 ? Math.round((totalDone / totalAll) * 100) : 0;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">Campaign Tracker</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every boss checkpoint and its passive/stat reward, act by act.
          </p>
        </div>
        <div className="flex items-center gap-3 sm:pt-1">
          <span
            className={cn(
              'text-xs text-muted-foreground transition-opacity',
              saveState === 'idle' ? 'opacity-0' : 'opacity-100',
            )}
            aria-live="polite"
          >
            {saveState === 'saving' && 'Saving…'}
            {saveState === 'saved' && 'Saved'}
            {saveState === 'error' && 'Save failed'}
          </span>
          <CampaignResetButton disabled={totalDone === 0} onReset={handleReset} />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Overall progress</span>
          <span className="tabular-nums">
            {totalDone} / {totalAll}
          </span>
        </div>
        <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {CAMPAIGN.map((act) => (
          <CampaignActSection
            key={act.id}
            act={act}
            checked={checked}
            open={!!openActs[act.id]}
            onToggleOpen={() => toggleAct(act.id)}
            onToggleArea={toggleArea}
          />
        ))}
      </div>
    </div>
  );
}
