// /campaign — campaign checkpoint tracker: boss + reward checklist per act.
// Progress is per-user for now (campaign_progress.character_id IS NULL);
// see that table's schema.sql comment for why character scoping isn't wired
// up yet (the character system doesn't exist in the app).
import { createClient } from '@/lib/supabase/server';
import CampaignTracker from '@/components/campaign/CampaignTracker';

export default async function CampaignPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let initialChecked: Record<string, boolean> = {};
  if (user) {
    const { data } = await supabase
      .from('campaign_progress')
      .select('progress')
      .eq('user_id', user.id)
      .is('character_id', null)
      .maybeSingle();
    if (data?.progress && typeof data.progress === 'object' && !Array.isArray(data.progress)) {
      initialChecked = data.progress as Record<string, boolean>;
    }
  }

  return <CampaignTracker initialChecked={initialChecked} />;
}
