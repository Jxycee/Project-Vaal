import { notFound } from 'next/navigation';
import { loadDetail } from '@/lib/wiki/load';
import { EFFECT_ACCENT_COLOR } from '@/lib/wiki/accent';
import { WikiBreadcrumb } from '@/components/wiki/WikiBreadcrumb';
import { TooltipDivider } from '@/components/wiki/TooltipDivider';
import { linkMentions } from '@/components/wiki/MentionLinks';
import { loadMentionIndex } from '@/lib/wiki/mentions';
import { CommunitySourceNote } from '@/components/wiki/CommunitySourceNote';
import { KeywordDefinitionNote } from '@/components/wiki/KeywordDefinitionNote';

export const dynamicParams = true;
export const dynamic = 'force-dynamic';

// See src/app/wiki/mods/[slug]/page.tsx for why this route is on-demand
// rather than statically generated — same reasoning applies here.
export async function generateStaticParams() {
  return [];
}

export default async function EffectDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const effect = await loadDetail('effect', slug);
  if (!effect) notFound();

  const mentions = await loadMentionIndex();
  const self = { kind: 'effect' as const, slug: effect.slug };

  return (
    <div className="flex min-h-[60vh] flex-col">
      <WikiBreadcrumb kind="effect" name={effect.name} />
      <div className="flex flex-1 items-center justify-center py-8">
        {/* No icon for effects — BuffDefinitions references no icon art,
            same as mods, so the name carries the header alone. */}
        <article
          className="relative mx-auto flex w-full max-w-lg min-h-[520px] flex-col justify-center space-y-4 rounded-lg border-2 bg-card px-8 py-6 text-center shadow-lg"
          style={{
            borderColor: EFFECT_ACCENT_COLOR,
            backgroundImage: `radial-gradient(120% 100% at 50% 0%, color-mix(in oklab, ${EFFECT_ACCENT_COLOR} 8%, transparent), transparent 65%)`,
          }}
        >
          <div className="mx-auto w-fit">
            <h1 className="font-heading text-3xl tracking-wide" style={{ color: EFFECT_ACCENT_COLOR }}>{effect.name}</h1>
          </div>

          <TooltipDivider />
          <p className="text-lg font-medium">{linkMentions(effect.description, mentions, self)}</p>

          {effect.keywordDefinition && (
            <>
              <TooltipDivider />
              <KeywordDefinitionNote>{linkMentions(effect.keywordDefinition, mentions, self)}</KeywordDefinitionNote>
            </>
          )}

          {effect.communitySource && (
            <>
              <TooltipDivider />
              <CommunitySourceNote source={effect.communitySource} />
            </>
          )}
        </article>
      </div>
    </div>
  );
}
