'use client';

// Owns the checked-state for the whole tracker: local state updates
// instantly on tap, persistence to campaign_progress is debounced so rapid
// checkbox taps collapse into one write instead of one per tap, and each
// write merges only the changed ticks onto the stored row (ProgressSaver). Progress is
// per-user (character_id IS NULL) — see campaign_progress's schema comment
// for why character scoping isn't wired up yet.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { CAMPAIGN, ALL_CHECKPOINT_IDS } from '@/lib/campaign/data';
import { ProgressSaver, type Progress } from '@/lib/campaign/progressSaver';
import CampaignActSection from './CampaignActSection';
import CampaignResetButton from './CampaignResetButton';
import { cn } from '@/lib/utils';

const SAVE_DEBOUNCE_MS = 900;

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

/**
 * A ProgressSaver bound to this user's campaign_progress row (character_id
 * IS NULL). Outside the component: it keeps the signed-in user's id between
 * its read and its write.
 */
function campaignSaver(supabase: ReturnType<typeof createClient>): ProgressSaver {
  let userId: string | null = null;
  return new ProgressSaver(
    async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('signed out');
      userId = user.id;
      const { data, error } = await supabase
        .from('campaign_progress')
        .select('progress')
        .eq('user_id', user.id)
        .is('character_id', null)
        .maybeSingle();
      if (error) throw error;
      const stored = data?.progress;
      return stored && typeof stored === 'object' && !Array.isArray(stored) ? (stored as Progress) : {};
    },
    async (next) => {
      if (!userId) throw new Error('signed out');
      const { error } = await supabase
        .from('campaign_progress')
        .upsert({ user_id: userId, character_id: null, progress: next }, { onConflict: 'user_id,character_id' });
      if (error) throw error;
    },
  );
}

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

  // Saves changes, not the whole checklist, merged onto the row as it is now,
  // one save at a time — see src/lib/campaign/progressSaver.ts for why the
  // old whole-blob upsert reverted ticks.
  const saver = useMemo(() => campaignSaver(supabase), [supabase]);

  const flush = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = null;
    if (!saver.hasPending()) return;
    saver.flush().then(
      (row) => {
        // Show what is stored — it may hold ticks made elsewhere — unless
        // newer changes are already queued; their own save reports again.
        if (row && !saver.hasPending()) setChecked(row);
        setSaveState('saved');
      },
      (err: unknown) => {
        console.error('campaign_progress save failed:', err);
        setSaveState('error');
      },
    );
  }, [saver]);

  const schedule = useCallback(() => {
    setSaveState('saving');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(flush, SAVE_DEBOUNCE_MS);
  }, [flush]);

  // Leaving the page (a nav link, closing the tab) must SAVE what is pending,
  // not drop it: clearing the timer here used to lose the last tick.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', flush);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, [flush]);

  const toggleArea = useCallback(
    (id: string) => {
      setChecked((cur) => {
        const next = { ...cur, [id]: !cur[id] };
        saver.set(id, next[id]);
        return next;
      });
      schedule();
    },
    [saver, schedule],
  );

  const toggleAct = useCallback((actId: string) => {
    setOpenActs((cur) => ({ ...cur, [actId]: !cur[actId] }));
  }, []);

  const handleReset = useCallback(() => {
    saver.reset();
    setChecked({});
    schedule();
  }, [saver, schedule]);

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

      <p className="mt-2 border-t border-border pt-4 text-xs text-muted-foreground">
        Quest reward data cross-checked against{' '}
        <a
          href="https://github.com/PathOfBuildingCommunity/PathOfBuilding-PoE2"
          className="underline"
        >
          Path of Building Community&apos;s PathOfBuilding-PoE2
        </a>{' '}
        (MIT). Path of Exile 2 is a trademark of Grinding Gear Games. This project is not
        affiliated with or endorsed by Grinding Gear Games.
      </p>
    </div>
  );
}
