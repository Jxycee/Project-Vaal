import Image from 'next/image';
import { notFound } from 'next/navigation';
import { loadDetail } from '@/lib/wiki/load';

export const dynamicParams = true;

// Detail pages are rendered on request rather than pre-built at build time
// — with ~1,118 skills (and ~4,975 items / ~16,679 mods across the sibling
// routes), generating all of them statically would make `next build`
// prohibitively slow. See Task 5 brief deviation notes.
//
// Deliberately NOT `export const revalidate = ...` (ISR): every /wiki route
// renders through AppShell (src/components/layout/app-shell.tsx), which
// calls `supabase.auth.getUser()` — a dynamic API (reads cookies via
// next/headers) on every request, required for the auth gate. Next.js
// forbids a dynamic API call inside an ISR-cached render path and throws
// `DYNAMIC_SERVER_USAGE` at runtime if one slips through — confirmed via
// production runtime-error logs (2026-08-22) after `revalidate = 86400` was
// here. Since these pages can't be safely cached across users anyway (the
// render depends on per-request auth state), plain dynamic rendering is not
// a compromise — it's the only correct mode while AppShell reads cookies.
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
