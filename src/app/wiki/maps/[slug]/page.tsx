import { notFound } from 'next/navigation';
import { loadDetail } from '@/lib/wiki/load';
import { MAP_ACCENT_COLOR } from '@/lib/wiki/accent';
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

export default async function MapDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [map, mentions] = await Promise.all([loadDetail('map', slug), loadMentionIndex()]);
  if (!map) notFound();

  const self = { kind: 'map' as const, slug: map.slug };

  return (
    // No icon for maps — EndgameMaps references no icon art, same as effects/mods.
    <WikiDetailCard kind="map" name={map.name} accent={MAP_ACCENT_COLOR}>
      <div className="mx-auto w-fit">
        <h1 className="font-heading text-3xl tracking-wide" style={{ color: MAP_ACCENT_COLOR }}>{map.name}</h1>
      </div>

      <TooltipDivider />
      <p className="text-lg font-medium italic">{linkMentions(map.description, mentions, self)}</p>

      {map.keywordDefinition && (
        <>
          <TooltipDivider />
          <KeywordDefinitionNote>{linkMentions(map.keywordDefinition, mentions, self)}</KeywordDefinitionNote>
        </>
      )}

      {map.communitySource && (
        <>
          <TooltipDivider />
          <CommunitySourceNote source={map.communitySource} />
        </>
      )}
    </WikiDetailCard>
  );
}
