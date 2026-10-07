import type { GemLoadout } from '@/lib/build/gemState';
import GemCard from '@/components/build/GemCard';

/**
 * The inline read-mode detail under a tapped skill row: the gem card (what the
 * skill does, its level and quality, and what each support does).
 */
export default function SkillDetail({ loadout }: { loadout: GemLoadout }) {
  return (
    <div data-testid="skill-detail" className="border-t border-border/60 bg-background/40 px-3 py-3">
      <GemCard loadout={loadout} />
    </div>
  );
}
