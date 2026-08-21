import Image from 'next/image';
import { notFound } from 'next/navigation';
import { loadDetail } from '@/lib/wiki/load';

export const dynamicParams = true;
export const revalidate = 86400;

// Detail pages are rendered on first request and cached via ISR rather than
// pre-built at build time — with ~1,118 skills (and ~4,975 items / ~16,679
// mods across the sibling routes), generating all of them statically would
// make `next build` prohibitively slow. See Task 5 brief deviation notes.
export async function generateStaticParams() {
  return [];
}

export default async function SkillDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const skill = await loadDetail('skill', slug);
  if (!skill) notFound();

  return (
    <article className="space-y-4">
      <header className="flex items-start gap-3">
        {skill.iconUrl && (
          <Image src={skill.iconUrl} alt="" width={48} height={48} className="rounded border bg-card" unoptimized />
        )}
        <div>
          <h1 className="font-heading text-2xl text-primary">{skill.name}</h1>
          <p className="text-sm text-muted-foreground">{skill.category}</p>
        </div>
      </header>
      {skill.tags.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {skill.tags.map((tag, i) => (
            <li key={`${i}-${tag}`} className="rounded border bg-card px-2 py-0.5 text-xs text-muted-foreground">
              {tag}
            </li>
          ))}
        </ul>
      )}
      {skill.description && <p>{skill.description}</p>}
      {skill.scaling.length > 0 && (
        <div className="space-y-2 border-t pt-3 text-sm">
          {skill.scaling.map((level) => (
            <div key={level.level}>
              <p className="text-muted-foreground">Level {level.level}</p>
              <ul className="space-y-1">
                {level.stats.map((stat, i) => <li key={`${i}-${stat.text}`}>{stat.text}</li>)}
              </ul>
            </div>
          ))}
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Extracted from Path of Exile 2&apos;s game files via poe2-toolkit (MIT).
      </p>
    </article>
  );
}
