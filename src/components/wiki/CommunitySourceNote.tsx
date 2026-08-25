import type { WikiCommunitySource } from '@/lib/wiki/types';

/**
 * Renders a hand-verified poedb.tw explanation for an entry GGPK itself
 * has no text for, visually set apart from the surrounding GGG-sourced
 * content (border + muted background, explicit attribution line) so a
 * reader never mistakes community text for an official tooltip. See
 * scripts/wiki/poedb-overrides.json and THIRD-PARTY-NOTICES.md.
 */
export function CommunitySourceNote({ source }: { source: WikiCommunitySource }) {
  return (
    <div className="rounded-md border border-dashed border-border bg-muted/30 px-3 py-2 text-left text-sm">
      <p className="text-foreground">{source.text}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Not in the game&apos;s own data — community-sourced from{' '}
        <a href={source.sourceUrl} className="underline" target="_blank" rel="noopener noreferrer">
          poedb.tw
        </a>{' '}
        (CC BY-NC-SA 3.0).
      </p>
    </div>
  );
}
