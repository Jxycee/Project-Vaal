// The signed-in user's own builds, as cards — presentational, no state.
//
// All data (the rows, any load error, each build's tags) comes down as props
// from the Server Component at builds/page.tsx. A card is one link to the
// build page; everything you can do to a build (visibility, tags, rename,
// delete) lives in that page's settings menu, so nothing on this list
// mutates anything.
import Link from 'next/link';
import type { LibraryBuildRow } from '@/lib/build/types';
import { VISIBILITY_HINT, VISIBILITY_LABEL } from '@/lib/build/visibility';
import BuildCard from './BuildCard';

interface MyBuildsListProps {
  builds: LibraryBuildRow[] | null;
  loadError: string | null;
  tagsByBuildId: Record<string, string[]>;
}

export default function MyBuildsList({ builds, loadError, tagsByBuildId }: MyBuildsListProps) {
  if (loadError) {
    return (
      <p className="text-sm text-destructive" role="alert">
        {loadError}
      </p>
    );
  }

  if (builds === null) {
    return <p className="text-sm text-muted-foreground">Loading your builds…</p>;
  }

  if (builds.length === 0) {
    return (
      <div className="py-10 text-center">
        <p className="text-sm text-muted-foreground">You have not saved a build yet.</p>
        <Link href="/builds?tab=public" className="mt-2 inline-flex h-11 items-center justify-center text-sm underline">
          Browse public builds
        </Link>
      </div>
    );
  }

  return (
    <ul data-testid="my-builds" className="flex flex-col gap-3">
      {builds.map((b) =>
        // share_token is minted on every insert, so a null one should not
        // exist; skip it rather than render a card that goes nowhere.
        b.share_token ? (
          <li key={b.id}>
            <BuildCard
              id={b.id}
              href={`/builds/${b.share_token}`}
              name={b.name}
              className={b.class}
              ascendancy={b.ascendancy}
              level={b.level}
              league={b.league}
              mainSkill={b.main_skill}
              updatedAt={b.updated_at}
              badge={VISIBILITY_LABEL[b.visibility] ?? b.visibility}
              badgeTitle={VISIBILITY_HINT[b.visibility]}
              tags={tagsByBuildId[b.id] ?? []}
            />
          </li>
        ) : null,
      )}
    </ul>
  );
}
