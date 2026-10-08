import { test, expect, type Page } from '@playwright/test';
import { accessToken, cleanupWithFreshPage, importFixture, measureTapTargets, MIN_TAP_PX, readBuildId, testBuildName } from './helpers';

// Board item 23: a one-tap "Duplicate" on every row of the checkpoint manage
// view. Written FIRST; the control, hook method and server action land after,
// so every test below is expected to fail until then (at the first
// "Duplicate" button). Not run by the agent that wrote it - the controller runs
// specs, because the shared test account and the one dev port cannot take
// parallel runs.
//
// Contract pinned here:
//   - each `checkpoint-row` in the manager has a button with
//     aria-label="Duplicate <checkpoint name>" and visible text "Duplicate";
//   - one tap inserts a checkpoint RIGHT AFTER the source, named
//     "<name> (copy)" (the base is cut so the whole stays within the 80-char
//     name CHECK), same level, same passive/gear/gem state;
//   - the page navigates to the copy (?checkpoint=<new id>), like Add does;
//   - the source row is never written; nothing else changes order;
//   - readers (view mode, no manage bundle) never see the control.
//
// Failure modes, each with a test below:
//   1. Duplicate of the LAST checkpoint: the "after it" splice runs off the
//      end of the list. Expect position n, not a dropped or misplaced copy.
//   2. Name length edge: an 80-char name cannot take " (copy)" verbatim (CHECK
//      is 1..80) and a 73-char one fits exactly. Expect 80 chars either way,
//      never a 23514 error and never a truncated " (copy)" suffix.
//   3. Double tap: two clicks in the same task, before React re-renders,
//      must make ONE copy (a `pending` flag alone would let both through).
//   4. Original untouched, and copy equals original: asserted from the
//      database, not the UI. Both are paired with a guard that the state is
//      populated, so "equal" cannot be two empty objects.
//   5. Reader cannot see the control. Only one test account exists, so the
//      reader is the owner's own view mode and the share-link view; an
//      actually different account is out of reach for this suite (same limit
//      as sharing.spec.ts).
//   6. Positions stay a contiguous 0..n-1 after the insert-then-reorder, and
//      the other checkpoints keep their relative order.
//
// NOT a failure mode here: the per-build checkpoint cap. There is none in the
// schema or in addCheckpoint (only import_build's own 1..100 bound), so
// nothing is enforced for duplicate either and there is nothing to test at a
// cap. If a cap is ever added, add it to addCheckpoint AND duplicateCheckpoint
// and extend this file.
//
// Also deliberately NOT asserted: updated_at of the other rows. The reorder
// that places the copy rewrites every row's position, which fires the
// updated_at trigger on all of them; content columns are the contract.
//
// Writes real rows under the shared test account; everything is E2E- prefixed
// and removed in afterAll (the builds delete cascades to checkpoints).

interface Row {
  id: string;
  position: number;
  name: string;
  level: number;
  passive_state: { set1?: unknown[] } & Record<string, unknown>;
  gear_state: Record<string, unknown>;
  gem_state: Record<string, unknown>;
}

/** The build's checkpoints straight from PostgREST as the signed-in owner (RLS applies), in position order. */
async function fetchRows(page: Page, buildId: string): Promise<Row[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  expect(url && key, 'NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be in .env.local').toBeTruthy();
  const res = await page.request.get(
    `${url}/rest/v1/build_checkpoints?build_id=eq.${buildId}&select=id,position,name,level,passive_state,gear_state,gem_state&order=position.asc`,
    { headers: { apikey: key!, authorization: `Bearer ${await accessToken(page)}` } },
  );
  expect(res.status(), 'reading build_checkpoints').toBe(200);
  return (await res.json()) as Row[];
}

/** The content columns that a duplicate must neither change on the source nor fail to copy. */
function content(r: Row) {
  return { name: r.name, level: r.level, passive_state: r.passive_state, gear_state: r.gear_state, gem_state: r.gem_state };
}

/** Guards against the "equal because both empty" pass. */
function expectPopulated(r: Row) {
  expect(JSON.stringify([r.passive_state, r.gear_state, r.gem_state]).length, `checkpoint ${r.name} has no state to copy`).toBeGreaterThan(200);
}

async function goto(page: Page, url: string): Promise<void> {
  try {
    await page.goto(url);
  } catch (err) {
    if (!/ERR_ABORTED/.test(String(err))) throw err;
    await page.goto(url);
  }
}

async function openManage(page: Page) {
  await page.getByTestId('checkpoint-switcher').click();
  const menu = page.getByTestId('checkpoint-menu');
  await expect(menu).toBeVisible();
  await menu.getByRole('button', { name: 'Manage', exact: true }).click();
  const manager = page.getByTestId('checkpoint-manager');
  await expect(manager).toBeVisible();
  return manager;
}

function rowFor(page: Page, id: string) {
  return page.locator(`[data-testid="checkpoint-row"][data-checkpoint-id="${id}"]`);
}

/** The ids of every checkpoint row currently listed in the manager. */
async function listedIds(page: Page): Promise<string[]> {
  return page.locator('[data-testid="checkpoint-row"]').evaluateAll((els) => els.map((el) => el.getAttribute('data-checkpoint-id') ?? ''));
}

/**
 * Taps Duplicate on the row for `id` and waits for the page to land on the copy; returns the copy's id.
 * The URL alone is not a safe signal: while the action runs the page can settle on the build's active checkpoint,
 * a different id from the source that is NOT the copy. The copy is the one id that was not listed before the tap.
 */
async function duplicateAndLand(page: Page, id: string): Promise<string> {
  const before = await listedIds(page);
  await rowFor(page, id).getByRole('button', { name: /^Duplicate /, exact: false }).click();
  await page.waitForURL(
    (url) => {
      const c = url.searchParams.get('checkpoint');
      return c !== null && !before.includes(c);
    },
    { timeout: 30_000 },
  );
  return new URL(page.url()).searchParams.get('checkpoint')!;
}

test.describe('checkpoint duplicate', () => {
  test.skip(() => test.info().project.name !== 'mobile', 'mobile project only');
  test.describe.configure({ mode: 'serial' });
  test.use({ viewport: { width: 375, height: 812 } });
  test.setTimeout(300_000);

  const name = testBuildName('cp-duplicate');
  let token = '';
  let buildId = '';

  test.afterAll(async ({ browser }) => {
    await cleanupWithFreshPage(browser);
  });

  test('duplicating a middle checkpoint: copy lands right after it, equals it, original untouched', async ({ page }) => {
    token = await importFixture(page, name);
    buildId = await readBuildId(page, name);

    const before = await fetchRows(page, buildId);
    expect(before.length, 'the fixture should give several checkpoints').toBeGreaterThanOrEqual(4);
    const source = before[2];
    expectPopulated(source);

    await goto(page, `/builds/${token}?edit=1`);
    await expect(page.getByTestId('build-page')).toBeVisible({ timeout: 30_000 });
    const manager = await openManage(page);
    await expect(manager.getByTestId('checkpoint-row')).toHaveCount(before.length);

    // The new control meets the phone floor and does not overflow the page.
    const { scanned, tooSmall } = await measureTapTargets(page, '[data-testid="checkpoint-menu"]');
    expect(scanned, 'nothing measured in the checkpoint menu').toBeGreaterThanOrEqual(before.length * 5);
    expect(tooSmall, `controls under ${MIN_TAP_PX}px with Duplicate in the manager`).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);

    const copyId = await duplicateAndLand(page, source.id);
    expect(copyId).not.toBe(source.id);

    const after = await fetchRows(page, buildId);
    expect(after.length, 'exactly one checkpoint added').toBe(before.length + 1);
    expect(after.map((r) => r.position), 'positions are contiguous from 0').toEqual(after.map((_, i) => i));

    // Order: the old sequence with the copy spliced in right after the source.
    const expectedOrder = before.map((r) => r.id);
    expectedOrder.splice(2 + 1, 0, copyId);
    expect(after.map((r) => r.id)).toEqual(expectedOrder);

    const copy = after[3];
    expect(copy.id).toBe(copyId);
    expect(copy.name).toBe(`${source.name} (copy)`);
    expect(content({ ...copy, name: source.name }), 'copy differs from its source in level or state').toEqual(content(source));

    // Original untouched, and so is every other checkpoint's content.
    for (const original of before) {
      const now = after.find((r) => r.id === original.id);
      expect(now, `checkpoint ${original.name} vanished`).toBeTruthy();
      expect(content(now!), `checkpoint ${original.name} changed`).toEqual(content(original));
    }
  });

  test('duplicating the last checkpoint puts the copy at the end', async ({ page }) => {
    const before = await fetchRows(page, buildId);
    const last = before[before.length - 1];
    expectPopulated(last);

    await goto(page, `/builds/${token}?edit=1&checkpoint=${last.id}`);
    await expect(page.getByTestId('build-page')).toBeVisible({ timeout: 30_000 });
    await openManage(page);

    const copyId = await duplicateAndLand(page, last.id);

    const after = await fetchRows(page, buildId);
    expect(after.length).toBe(before.length + 1);
    expect(after.map((r) => r.position)).toEqual(after.map((_, i) => i));
    expect(after[after.length - 1].id, 'the copy is not last').toBe(copyId);
    expect(after[after.length - 2].id, 'the source is not right before the copy').toBe(last.id);
    expect(after[after.length - 1].name).toBe(`${last.name} (copy)`);
    expect(content({ ...after[after.length - 1], name: last.name })).toEqual(content(last));
    expect(content(after[after.length - 2])).toEqual(content(last));
  });

  test('name length edge: 80 chars truncates the base, 73 chars fits exactly', async ({ page }) => {
    const before = await fetchRows(page, buildId);
    const target = before[0];
    await goto(page, `/builds/${token}?edit=1&checkpoint=${target.id}`);
    await expect(page.getByTestId('build-page')).toBeVisible({ timeout: 30_000 });

    const rename = async (value: string) => {
      const manager = await openManage(page);
      const row = rowFor(page, target.id);
      await row.getByRole('button', { name: 'Rename', exact: true }).click();
      await row.getByLabel('New checkpoint name').fill(value);
      await row.getByRole('button', { name: 'Save name', exact: true }).click();
      await expect(manager.getByLabel('New checkpoint name')).toBeHidden({ timeout: 30_000 });
      await expect.poll(async () => (await fetchRows(page, buildId))[0].name, { timeout: 30_000 }).toBe(value);
    };

    // Distinct characters so a wrong cut point shows in the diff, and a
    // trailing-space-free base so trimEnd cannot hide an off-by-one.
    const eighty = 'A'.repeat(40) + 'B'.repeat(40);
    expect(eighty.length).toBe(80);
    await rename(eighty);
    await duplicateAndLand(page, target.id);
    let rows = await fetchRows(page, buildId);
    expect(rows.length).toBe(before.length + 1);
    expect(rows[1].name.length, 'copy name over the 80-char limit or cut too short').toBe(80);
    expect(rows[1].name.endsWith(' (copy)')).toBe(true);
    expect(rows[1].name).toBe(eighty.slice(0, 73) + ' (copy)');
    expect(rows[0].name, 'the source name changed').toBe(eighty);

    const seventyThree = 'C'.repeat(36) + 'D'.repeat(37);
    expect(seventyThree.length).toBe(73);
    await goto(page, `/builds/${token}?edit=1&checkpoint=${target.id}`);
    await expect(page.getByTestId('build-page')).toBeVisible({ timeout: 30_000 });
    await rename(seventyThree);
    await duplicateAndLand(page, target.id);
    rows = await fetchRows(page, buildId);
    expect(rows.length).toBe(before.length + 2);
    expect(rows[1].name, 'a name that fits must not be shortened').toBe(seventyThree + ' (copy)');
    expect(rows[1].name.length).toBe(80);
  });

  test('a double tap makes exactly one copy', async ({ page }) => {
    const before = await fetchRows(page, buildId);
    const target = before[1];
    await goto(page, `/builds/${token}?edit=1&checkpoint=${target.id}`);
    await expect(page.getByTestId('build-page')).toBeVisible({ timeout: 30_000 });
    await openManage(page);

    // Two click events in one task: both run before React can re-render with
    // pending=true, which is what a real fast double tap does on a slow device.
    const button = rowFor(page, target.id).getByRole('button', { name: /^Duplicate / });
    await button.evaluate((el) => {
      (el as HTMLButtonElement).click();
      (el as HTMLButtonElement).click();
    });
    await page.waitForURL((url) => {
      const c = url.searchParams.get('checkpoint');
      // The copy is the one id not present before the taps (the URL can first settle on an existing checkpoint).
      return c !== null && !before.some((r) => r.id === c);
    }, { timeout: 30_000 });

    // Check once as soon as it lands and again after a quiet period: a second
    // insert would arrive late.
    expect((await fetchRows(page, buildId)).length, 'double tap made more than one copy').toBe(before.length + 1);
    await page.waitForTimeout(3_000);
    const after = await fetchRows(page, buildId);
    expect(after.length, 'a second copy arrived late').toBe(before.length + 1);
    // Exactly one new row (not by name: earlier tests in this serial file renamed this checkpoint).
    expect(after.filter((r) => !before.some((b) => b.id === r.id)).length).toBe(1);
  });

  test('a reader never sees Duplicate', async ({ page }) => {
    // View mode (no ?edit=1): the switcher has no manage bundle at all.
    await goto(page, `/builds/${token}`);
    await expect(page.getByTestId('build-page')).toBeVisible({ timeout: 30_000 });
    await page.getByTestId('checkpoint-switcher').click();
    const menu = page.getByTestId('checkpoint-menu');
    await expect(menu).toBeVisible();
    // Paired with a populated check: the list IS there, the control is not.
    expect(await menu.getByTestId('checkpoint-option').count(), 'no checkpoints listed to the reader').toBeGreaterThan(1);
    await expect(menu.getByRole('button', { name: 'Manage', exact: true })).toHaveCount(0);
    await expect(menu.getByRole('button', { name: /Duplicate/ })).toHaveCount(0);
    await expect(page.getByTestId('checkpoint-manager')).toHaveCount(0);
  });
});
