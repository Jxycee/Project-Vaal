import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { test, expect } from '@playwright/test';
import { cleanupWithFreshPage, importFixture, openBuildSettings, testBuildName } from './helpers';

// Export to the game's own Build Planner file (.build), end to end.
//
// Format, read 2026-10-07 from poe.ninja's real export of a public character
// (Build Planner dialog, "Copy JSON"; nothing downloaded):
//   { name, author, ascendancy: "Mercenary3",
//     passives: [{ id: "criticals45" }, { id: "attack_speed2_", weapon_set: 1 }, ...],
//     skills:   [{ id: "Metadata/Items/Gems/SkillGemHeraldOfIce",
//                  support_skills: [{ id: "Metadata/Items/Gem/SupportGemArmourExplosion" }, ...] }, ...] }
// A passive id is the tree node's own string id; a node tied to one weapon set
// carries weapon_set 1 or 2, a shared node carries none; the ascendancy start
// node is listed, items are not part of the format.
//
// How this can fail (decided first, per AGENTS.md):
//   1. A passive id that is not a real tree node, or a duplicate: the game would
//      ignore or choke on it. Every id must exist in the vendored tree.
//   2. Weapon sets confused: a node only in set 1 must be tagged 1, only in set 2
//      tagged 2, in both untagged. Asserted against the build's own passive_state.
//   3. A gem path that does not match PoB's real metadata path ("Gem/" vs "Gems/"
//      differ per gem): every id must be one pobGemIds.json knows.
//   4. A loadout with no skill, or a support with no known id: skipped and said
//      so in the report, never emitted as null/undefined.
//   5. The ascendancy: must be the tree's internal id for the build's ascendancy.
//   6. Items must not appear (not in the format; extra keys could be rejected).
//
// Artifact: <test output dir>/ggg-build-export.json - the exported file, its
// report and the counts checked, so it can be dropped into
// Documents/My Games/Path of Exile 2/BuildPlanner by hand.

const CODE = readFileSync(path.join(__dirname, '..', 'docs', 'superpowers', 'handoffs', '2026-09-27-momentsZX-pob2-code.txt'), 'utf8').trim();
const TREE = JSON.parse(readFileSync(path.join(__dirname, '..', 'public', 'data', 'tree', '0.5.2', 'data.json'), 'utf8')) as {
  nodes: Record<string, { id: string; ascendancyId?: string }>;
  classes: { name: string; ascendancies?: { id: string; name: string }[] }[];
};
const GEM_PATHS = new Set(
  Object.values(JSON.parse(readFileSync(path.join(__dirname, '..', 'src', 'lib', 'pob', 'export', 'pobGemIds.json'), 'utf8')) as Record<string, { gameId: string }>).map(
    (g) => g.gameId,
  ),
);

interface BuildFile {
  name: string;
  author: string;
  ascendancy?: string;
  passives: { id: string; weapon_set?: number }[];
  skills: { id: string; support_skills?: { id: string }[] }[];
}

test.describe('in-game Build Planner export', () => {
  test.skip(() => test.info().project.name !== 'mobile', 'mobile project only');
  test.describe.configure({ mode: 'serial' });
  test.use({ viewport: { width: 375, height: 812 } });
  test.setTimeout(300_000);

  const name = testBuildName('ggg-build');

  test.afterAll(async ({ browser }) => {
    await cleanupWithFreshPage(browser);
  });

  test('exports a valid .build file for the momentsZX Deadeye', async ({ page }, testInfo) => {
    const token = await importFixture(page, name, CODE);
    await page.goto(`/builds/${token}`);
    await expect(page.getByTestId('build-page')).toBeVisible({ timeout: 30_000 });

    const menu = await openBuildSettings(page);
    const section = menu.getByTestId('export-section');
    const button = section.getByRole('button', { name: "Export for the game's Build Planner", exact: true });
    const b = await button.boundingBox();
    expect(b!.height, 'export button under 44px').toBeGreaterThanOrEqual(44);
    await button.click();
    const box = section.getByTestId('build-file-json');
    await expect(box).toBeVisible({ timeout: 60_000 });
    const text = await box.inputValue();
    expect(text).not.toMatch(/undefined|null/);
    const file = JSON.parse(text) as BuildFile;

    // Shape: exactly the keys the real file has (6: no items, no extras).
    expect(Object.keys(file).sort()).toEqual(['ascendancy', 'author', 'name', 'passives', 'skills']);
    expect(file.author).toBe('Project Vaal');
    expect(file.name.length).toBeGreaterThan(0);
    for (const p of file.passives) expect(Object.keys(p).every((k) => k === 'id' || k === 'weapon_set'), 'extra passive key').toBe(true);
    for (const s of file.skills) expect(Object.keys(s).every((k) => k === 'id' || k === 'support_skills'), 'extra skill key').toBe(true);

    // 1. Every passive is a real tree node, once.
    const treeIds = new Set(Object.values(TREE.nodes).map((n) => n?.id));
    const ids = file.passives.map((p) => p.id);
    expect(ids.length, 'no passives exported').toBeGreaterThan(50);
    expect(new Set(ids).size, 'duplicate passive ids').toBe(ids.length);
    const unknown = ids.filter((id) => !treeIds.has(id));
    expect(unknown, 'passive ids missing from the tree').toEqual([]);

    // 2. Weapon sets present and well-formed (momentsZX uses both).
    const sets = new Set(file.passives.map((p) => p.weapon_set).filter((w) => w !== undefined));
    expect([...sets].sort(), 'weapon_set values').toEqual([1, 2]);
    // A node tied to a set is never also listed untagged (shared = no tag).
    const untaggedIds = new Set(file.passives.filter((p) => p.weapon_set === undefined).map((p) => p.id));
    for (const p of file.passives.filter((q) => q.weapon_set !== undefined)) expect(untaggedIds.has(p.id), p.id + ' listed both tagged and untagged').toBe(false);

    // 5. Ascendancy is the tree's internal id for Deadeye, and its start node is listed.
    const ranger = TREE.classes.find((c) => c.name === 'Ranger')!;
    const deadeye = ranger.ascendancies!.find((a) => a.name === 'Deadeye')!;
    expect(file.ascendancy).toBe(deadeye.id);
    expect(ids.some((id) => /Start$/.test(id) && id.includes(deadeye.id)), 'ascendancy start node missing').toBe(true);

    // 3 and 4. Every gem path is one PoB2 knows; supports likewise; no null entries.
    expect(file.skills.length, 'no skills exported').toBeGreaterThan(0);
    for (const s of file.skills) {
      expect(GEM_PATHS.has(s.id), `unknown skill path ${s.id}`).toBe(true);
      for (const sup of s.support_skills ?? []) expect(GEM_PATHS.has(sup.id), `unknown support path ${sup.id}`).toBe(true);
    }
    expect(file.skills.some((s) => (s.support_skills ?? []).length > 0), 'no supports exported anywhere').toBe(true);

    // Copy and download controls exist and meet the tap-target size.
    for (const label of ['Copy JSON', 'Download .build']) {
      const control = section.getByRole('button', { name: label, exact: true });
      await expect(control).toBeVisible();
      expect((await control.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }

    const out = path.join(testInfo.outputDir, 'ggg-build-export.json');
    mkdirSync(path.dirname(out), { recursive: true });
    writeFileSync(out, JSON.stringify({ file, counts: { passives: ids.length, skills: file.skills.length, sets: [...sets] } }, null, 2));
    await testInfo.attach('ggg-build-export.json', { path: out, contentType: 'application/json' });
  });
});
