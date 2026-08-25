import type { ReactNode } from 'react';

/**
 * Renders GGG's own in-game keyword-tooltip glossary explanation (see
 * `keywordDefinition` on `WikiDetailBase`, types.ts) - a second, usually
 * longer and more mechanical explanation alongside whatever shorter
 * description the entry already has. Unlike `CommunitySourceNote`, this is
 * first-party GGPK data (same source/license as the rest of the page), so
 * it gets its own plain, undecorated styling rather than the dashed-border
 * "not official" treatment - it IS official, just from a different table.
 */
export function KeywordDefinitionNote({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-md border border-border bg-card/60 px-3 py-2 text-left text-sm">
      <p className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">In-Depth</p>
      <p className="whitespace-pre-line text-foreground">{children}</p>
    </div>
  );
}
