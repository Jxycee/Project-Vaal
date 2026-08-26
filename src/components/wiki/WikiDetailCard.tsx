import type { ReactNode } from 'react';
import { WikiBreadcrumb } from './WikiBreadcrumb';
import type { WikiEntryKind } from '@/lib/wiki/types';

/**
 * Shared outer shell for every /wiki/*\/[slug] detail page — breadcrumb,
 * centered layout, and the accent-tinted tooltip-card border/gradient. Was
 * hand-duplicated verbatim (only `accent` varying) across all five detail
 * page files; each page still owns its own inner content (stat rows, mods,
 * footer notes) since composition/ordering of those genuinely differs
 * between kinds.
 */
export function WikiDetailCard({
  kind,
  name,
  accent,
  children,
}: {
  kind: WikiEntryKind;
  name: string;
  accent: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-[60vh] flex-col">
      <WikiBreadcrumb kind={kind} name={name} />
      <div className="flex flex-1 items-center justify-center py-8">
        <article
          className="relative mx-auto flex w-full max-w-lg min-h-[520px] flex-col justify-center space-y-4 rounded-lg border-2 bg-card px-8 py-6 text-center shadow-lg"
          style={{
            borderColor: accent,
            backgroundImage: `radial-gradient(120% 100% at 50% 0%, color-mix(in oklab, ${accent} 8%, transparent), transparent 65%)`,
          }}
        >
          {children}
        </article>
      </div>
    </div>
  );
}
