import { notFound } from 'next/navigation';
import { loadDetail } from '@/lib/wiki/load';
import { MAP_ACCENT_COLOR } from '@/lib/wiki/accent';
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

export default async function MapDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const map = await loadDetail('map', slug);
  if (!map) notFound();

  const mentions = await loadMentionIndex();
  const self = { kind: 'map' as const, slug: map.slug };

  return (
    <div className="flex min-h-[60vh] flex-col">
      <WikiBreadcrumb kind="map" name={map.name} />
      <div className="flex flex-1 items-center justify-center py-8">
        {/* No icon for maps — EndgameMaps references no icon art, same as effects/mods. */}
        <article
          className="relative mx-auto flex w-full max-w-lg min-h-[520px] flex-col justify-center space-y-4 rounded-lg border-2 bg-card px-8 py-6 text-center shadow-lg"
          style={{
            borderColor: MAP_ACCENT_COLOR,
            backgroundImage: `radial-gradient(120% 100% at 50% 0%, color-mix(in oklab, ${MAP_ACCENT_COLOR} 8%, transparent), transparent 65%)`,
          }}
        >
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
        </article>
      </div>
    </div>
  );
}
