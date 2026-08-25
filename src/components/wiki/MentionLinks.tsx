import Link from 'next/link';
import type { ReactNode } from 'react';
import { resolveMentionTarget } from '@/lib/wiki/mentions';
import type { MentionIndex } from '@/lib/wiki/mentions';
import { WIKI_BASE_PATH } from '@/lib/wiki/types';
import type { WikiEntryKind } from '@/lib/wiki/types';

/**
 * Splits `text` on every mention-index name it contains, replacing each with
 * a link to that entry's own page - "this page mentions Scroll of Wisdom"
 * becomes a clickable, colored cross-reference instead of plain prose.
 *
 * `self` skips linking a page's own name back to itself (harmless either
 * way, but a self-link reads as a mistake) - only meaningful for an
 * entry-shaped target, since a search-fallback target never is the current
 * page.
 */
export function linkMentions(text: string, index: MentionIndex, self?: MentionTargetLike): ReactNode[] {
  return text.split(index.pattern).map((part, i) => {
    const target = resolveMentionTarget(part, index);
    if (!target) return part;
    if ('slug' in target) {
      if (self && target.kind === self.kind && target.slug === self.slug) return part;
      return (
        <Link
          key={i}
          href={`${WIKI_BASE_PATH[target.kind]}/${target.slug}`}
          className="hover:underline"
          style={{ color: 'var(--wiki-mention)' }}
        >
          {part}
        </Link>
      );
    }
    return (
      <Link
        key={i}
        href={`${WIKI_BASE_PATH[target.kind]}?q=${encodeURIComponent(target.query)}`}
        className="hover:underline"
        style={{ color: 'var(--wiki-mention)' }}
      >
        {part}
      </Link>
    );
  });
}

interface MentionTargetLike {
  kind: WikiEntryKind;
  slug: string;
}
