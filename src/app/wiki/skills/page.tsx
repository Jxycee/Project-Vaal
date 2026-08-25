import { Suspense } from 'react';
import { WikiBrowse } from '@/components/wiki/WikiBrowse';

export default function SkillsPage() {
  return (
    <>
      <h1 className="mb-4 font-heading text-2xl text-primary">Skill Gems</h1>
      <Suspense>
        <WikiBrowse kind="skill" basePath="/wiki/skills" />
      </Suspense>
    </>
  );
}
