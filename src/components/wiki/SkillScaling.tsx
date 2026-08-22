'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { WikiSkillLevelScaling } from '@/lib/wiki/types';

const COLLAPSED_COUNT = 5;

/** A gem's per-level stat progression, collapsed to the first few levels with a "show more" toggle — some skills have 40+ levels, too many to dump into a tooltip-style card at once. */
export function SkillScaling({ scaling }: { scaling: WikiSkillLevelScaling[] }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? scaling : scaling.slice(0, COLLAPSED_COUNT);
  const hiddenCount = scaling.length - COLLAPSED_COUNT;

  return (
    <div className="space-y-3 text-sm">
      {visible.map((level) => (
        <div key={level.level}>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Level {level.level}</p>
          <ul className="space-y-0.5 font-medium">
            {level.stats.map((stat, i) => <li key={`${i}-${stat.text}`}>{stat.text}</li>)}
          </ul>
        </div>
      ))}
      {hiddenCount > 0 && !expanded && (
        <Button variant="outline" size="sm" onClick={() => setExpanded(true)}>
          Show {hiddenCount} more levels
        </Button>
      )}
    </div>
  );
}
