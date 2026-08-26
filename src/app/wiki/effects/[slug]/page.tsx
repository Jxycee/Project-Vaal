import { notFound } from 'next/navigation';
import { loadDetail } from '@/lib/wiki/load';
import { EFFECT_ACCENT_COLOR } from '@/lib/wiki/accent';
import { WikiDetailCard } from '@/components/wiki/WikiDetailCard';
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
  const [effect, mentions] = await Promise.all([loadDetail('effect', slug), loadMentionIndex()]);
  if (!effect) notFound();

  const self = { kind: 'effect' as const, slug: effect.slug };

  return (
    // No icon for effects — BuffDefinitions references no icon art, same as mods.
    <WikiDetailCard kind="effect" name={effect.name} accent={EFFECT_ACCENT_COLOR}>
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
    </WikiDetailCard>
  );
}
