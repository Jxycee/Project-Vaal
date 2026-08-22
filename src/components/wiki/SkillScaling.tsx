'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';

export interface SkillScalingLevel {
  level: number;
  /** Pre-rendered stat lines (mention-linked server-side — a client component can't receive the RegExp/Map a `MentionIndex` carries as a prop). */
  content: ReactNode;
}

const COLLAPSED_COUNT = 5;

/** A gem's per-level stat progression, collapsed to the first few levels with a "show more" toggle — some skills have 40+ levels, too many to dump into a tooltip-style card at once. */
export function SkillScaling({ levels }: { levels: SkillScalingLevel[] }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? levels : levels.slice(0, COLLAPSED_COUNT);
  const hiddenCount = levels.length - COLLAPSED_COUNT;

  return (
    <div className="space-y-3 text-base">
      {visible.map((level) => (
        <div key={level.level}>
          <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Level {level.level}</p>
          {level.content}
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
