// Our build -> the game's own Build Planner file (.build), plus a report of
// what could not go. The format was read on 2026-10-07 from a real poe.ninja
// export (see e2e/ggg-build-export.spec.ts for the shape and what it pins):
//
//   { name, author, ascendancy: "Mercenary3",
//     passives: [{ id: "criticals45" }, { id: "attack_speed2_", weapon_set: 1 }],
//     skills:   [{ id: "Metadata/Items/Gems/SkillGemX", support_skills: [{ id }] }] }
//
// A passive's id is the tree node's own string id. A node tied to one weapon
// set carries weapon_set 1 or 2; a shared node carries none. The ascendancy's
// start node is listed. Items are not part of the format. Gem ids are the full
// metadata path, which differs per gem ("Gem/" vs "Gems/"), so they come from
// pobGemIds.json, the same table the Path of Building export uses.
//
// One checkpoint only (the format has one tree and one skill list), so the
// active checkpoint's tree and gems are written and the report says so.
import type { Catalogue } from '@/lib/pob/catalogue';
import type { ExportInput } from '@/lib/pob/export/exportBuild';
import gemIds from '@/lib/pob/export/pobGemIds.json';
import type { ReportEntry } from '@/lib/pob/report';

export interface BuildFile {
  name: string;
  author: string;
  ascendancy: string;
  passives: { id: string; weapon_set?: 1 | 2 }[];
  skills: { id: string; support_skills?: { id: string }[] }[];
}

export type BuildFileResult = { ok: true; file: BuildFile; report: ReportEntry[] } | { ok: false; error: string };

const GEM_IDS = gemIds as Record<string, { gameId: string }>;
const MAX_NAME_LENGTH = 80;

export function exportBuildFile(input: ExportInput, catalogue: Catalogue): BuildFileResult {
  const { build, checkpoints } = input;
  if (checkpoints.length === 0) return { ok: false, error: 'This build has no checkpoints to export.' };
  if (catalogue.tree.classIndexOf(build.class) === null) {
    return { ok: false, error: `${build.class} is not in this patch's passive tree, so it cannot be exported.` };
  }
  const active = checkpoints[Math.min(Math.max(input.activeIndex, 0), checkpoints.length - 1)];
  const report: ReportEntry[] = [];

  const ascendancy = build.ascendancy ? catalogue.tree.ascendancyIdFor(build.class, build.ascendancy) : null;
  if (!ascendancy) {
    return {
      ok: false,
      error: build.ascendancy
        ? `${build.ascendancy} is not a ${build.class} ascendancy in this patch, so the game's planner could not read the file.`
        : 'Pick an ascendancy first: the game\'s Build Planner file needs one.',
    };
  }

  // ---- Passives ---------------------------------------------------------
  const p = active.passive_state;
  const set1 = new Set(p.set1);
  const set2 = new Set(p.set2);
  const passives: BuildFile['passives'] = [];
  const seen = new Set<string>();
  const add = (node: number, weaponSet?: 1 | 2) => {
    const id = catalogue.tree.gggIdOf(node);
    if (id === null) {
      report.push({ kind: 'dropped', area: 'tree', message: `Passive node ${node} is not in this patch's tree, so it was left out.` });
      return;
    }
    if (seen.has(id)) return;
    seen.add(id);
    passives.push(weaponSet ? { id, weapon_set: weaponSet } : { id });
  };
  const start = catalogue.tree.ascendancyStartId(catalogue.tree.graphOf(ascendancy));
  if (start) {
    seen.add(start);
    passives.push({ id: start });
  }
  for (const n of p.set1) add(n, set2.has(n) ? undefined : 1);
  for (const n of p.set2) if (!set1.has(n)) add(n, 2);
  for (const n of p.ascendancyNodes) add(n);

  // ---- Skills -----------------------------------------------------------
  const pathBySlug = new Map<string, string>();
  for (const [key, gem] of catalogue.gems) {
    const ids = GEM_IDS[key];
    if (ids) pathBySlug.set(gem.slug, ids.gameId);
  }
  const skills: BuildFile['skills'] = [];
  for (const loadout of active.gem_state.loadouts) {
    if (!loadout.skill) continue;
    const id = pathBySlug.get(loadout.skill.slug);
    if (!id) {
      report.push({ kind: 'dropped', area: 'gems', message: `${loadout.skill.name} has no in-game id on record, so it was left out.` });
      continue;
    }
    const support_skills: { id: string }[] = [];
    for (const s of loadout.supports) {
      const sid = pathBySlug.get(s.slug);
      if (sid) support_skills.push({ id: sid });
      else report.push({ kind: 'dropped', area: 'gems', message: `${s.name} has no in-game id on record, so it was left out.` });
    }
    skills.push(support_skills.length > 0 ? { id, support_skills } : { id });
  }

  if (checkpoints.length > 1) {
    report.push({
      kind: 'note',
      area: 'build',
      message: `The game's planner file holds one tree and one skill list, so both come from "${active.name}"; the other ${checkpoints.length - 1} checkpoint(s) are not included.`,
    });
  }
  report.push({ kind: 'note', area: 'items', message: "Items are not part of the game's Build Planner file." });

  return {
    ok: true,
    file: { name: build.name.trim().slice(0, MAX_NAME_LENGTH) || 'Project Vaal build', author: 'Project Vaal', ascendancy, passives, skills },
    report,
  };
}
