import Link from 'next/link';
import type { ReactNode } from 'react';
import type { MentionIndex } from '@/lib/wiki/mentions';

const KIND_PATH: Record<'item' | 'skill' | 'mod', string> = {
  item: '/wiki/items',
  skill: '/wiki/skills',
  mod: '/wiki/mods',
};

/**
 * Splits `text` on every mention-index name it contains, replacing each with
 * a link to that entry's own page - "this page mentions Scroll of Wisdom"
 * becomes a clickable, colored cross-reference instead of plain prose.
 *
 * `self` skips linking a page's own name back to itself (harmless either
 * way, but a self-link reads as a mistake).
 */
export function linkMentions(text: string, index: MentionIndex, self?: MentionTargetLike): ReactNode[] {
  return text.split(index.pattern).map((part, i) => {
    const target = index.targets.get(part);
    if (!target) return part;
    if (self && target.kind === self.kind && target.slug === self.slug) return part;
    return (
      <Link
        key={i}
        href={`${KIND_PATH[target.kind]}/${target.slug}`}
        className="hover:underline"
        style={{ color: 'var(--wiki-mention)' }}
      >
        {part}
      </Link>
    );
  });
}

interface MentionTargetLike {
  kind: 'item' | 'skill' | 'mod';
  slug: string;
}
