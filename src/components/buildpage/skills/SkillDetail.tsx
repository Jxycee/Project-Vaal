import type { GemLoadout } from '@/lib/build/gemState';
import GemCard from '@/components/build/GemCard';
import { effectiveGemLevel, type GemLevelTable } from '@/lib/build/gemLevels';

/**
 * The inline read-mode detail under a tapped skill row: the gem card (what the
 * skill does, its level and quality, and what each support does).
 */
export default function SkillDetail({
  loadout,
  characterLevel,
  table,
}: {
  loadout: GemLoadout;
  characterLevel: number;
  table: GemLevelTable | null;
}) {
  // The card reads the gem at the level this checkpoint's character level allows; the file's level is only named in the hint.
  const level = loadout.skill ? effectiveGemLevel(table, loadout.skill.slug, loadout.level, characterLevel) : loadout.level;
  const lowered = level < loadout.level;
  return (
    <div data-testid="skill-detail" className="border-t border-border/60 bg-background/40 px-3 py-3">
      <GemCard
        loadout={lowered ? { ...loadout, level } : loadout}
        loweredFrom={lowered ? { fileLevel: loadout.level, characterLevel } : undefined}
      />
    </div>
  );
}
