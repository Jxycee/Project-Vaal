import { test, expect, type Locator, type Page } from '@playwright/test';
import {
  allocateNodes,
  cleanupWithFreshPage,
  measureTapTargets,
  MIN_TAP_PX,
  nodesNearStart,
  openTree,
  pickGearItem,
  saveBuild,
  setVisibility,
  testBuildName,
  treeState,
  waitForDraft,
  waitForTreeApi,
} from './helpers';

// Slice 2 of the build-profile redesign (specs/2026-09-27-build-profile-
// redesign-design.md §6, §7.2): the owner edits a saved build in place on
// /builds/[shareToken]?edit=1, in the one BuildSession the plan lifts out of
// TreeBuildSession. Written FIRST — the app code lands in later tasks of
// docs/superpowers/plans/2026-09-27-build-page-slice2-edit-in-place.md, so
// every test below is expected to fail until then, starting at the first
// ?edit=1 interaction ("Edit gear" does not exist yet).
//
// Contract this spec pins (ids the later tasks must render — see the plan's
// Task 1 section and task-1-brief.md):
//   - Edit toggle: "Edit" (owner, read mode) sets ?edit=1; edit mode shows
//     "Done" and a `role=button` "Save".
//   - data-testid="save-status": "Saved HH:MM:SS" / "Unsaved changes".
//   - Header inputs #build-name, #build-level, #build-league; Overview
//     #build-notes (textarea) in edit mode.
//   - Discard choice (Done while dirty): data-testid="unsaved-choice" with
//     "Save" / "Discard" / "Keep editing".
//   - Draft notice: data-testid="draft-notice" with "Restore" / "Discard".
//   - Gear tab (edit): the paper doll (slice 4) — tap a slot's cell, then
//     "Choose item" in its detail panel; "Edit jewels" opens the jewels sheet.
//   - Skills tab (edit): tapping a skill row opens that group's sheet.
//   - Tree tab (edit): editable PassiveTree (window.__vaalTree).
//   - Checkpoint switcher (edit): a "Manage" toggle opens the manage view
//     (data-testid="checkpoint-manager") in the switcher's own menu — slice 3,
//     see build-page-checkpoints.spec.ts for its contract.
//
// CONTROLLER RULING for test 3 ("no bogus restore prompt"): drafts hold only
// tree, gear and gems — name/level/league/notes are NOT in drafts, same as
// the old editor (Global Constraints in the plan). So the unsaved change that
// proves the positive case is a TREE edit made on the Tree tab in edit mode
// (one node allocated through the dev hook), not a notes edit.

/** The level/league summary line, exactly as build-page.spec.ts locates it. */
function levelLine(page: Page): Locator {
  return page.locator('h1').locator('xpath=following-sibling::p[1]');
}

function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

/**
 * `page.goto`, tolerant of one `net::ERR_ABORTED`.
 *
 * Next's dev server compiles routes on demand and can fire an HMR full
 * reload of the page we are navigating away from at the exact moment we
 * call `goto` — Chromium then reports the navigation we asked for as
 * aborted, even though nothing about the app or the test is wrong. A human
 * clicking a link a beat later never hits this; a script issuing the
 * navigation immediately after a save can. Retrying once is the same shape
 * of fix `gotoBuilds` in helpers.ts already applies to its own ERR_ABORTED
 * case.
 */
async function goto(page: Page, url: string): Promise<void> {
  try {
    await page.goto(url);
  } catch (err) {
    if (!/ERR_ABORTED/.test(String(err))) throw err;
    await page.goto(url);
  }
}

test.describe('build page edit in place', () => {
  test.skip(() => test.info().project.name !== 'mobile', 'mobile project only');
  test.describe.configure({ mode: 'serial' });
  test.use({ viewport: { width: 375, height: 812 } });
  test.setTimeout(300_000);

  const name = testBuildName('edit');
  let buildId = '';
  let token = '';
  let seededAllocated = 0;

  test.afterAll(async ({ browser }) => {
    await cleanupWithFreshPage(browser);
  });

  test('seeds a build through the scratch editor', async ({ page }) => {
    await openTree(page);
    await allocateNodes(page, await nodesNearStart(page, 5));
    seededAllocated = (await treeState(page)).allocated.length;
    expect(seededAllocated, 'seeding never allocated anything').toBeGreaterThanOrEqual(5);

    const [response] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith('/api/builds') && r.request().method() === 'POST'),
      saveBuild(page, { name, level: 20, league: 'Standard' }),
    ]);
    const body = (await response.json()) as { build: { id: string; share_token: string } };
    buildId = body.build.id;
    token = body.build.share_token;
    expect(buildId, 'save response carried no build id').toBeTruthy();
    expect(token, 'save response carried no share token').toBeTruthy();

    // The build page itself must already render (slice 1), independent of
    // whatever slice 2 does with the ?edit=1 it does not yet understand.
    await goto(page, `/builds/${token}?edit=1`);
    await expect(page.getByTestId('build-page')).toBeVisible({ timeout: 30_000 });
  });

  test('gear edit without opening the tree', async ({ page }) => {
    await goto(page, `/builds/${token}?edit=1&tab=gear`);
    await expect(page.getByTestId('build-page')).toBeVisible({ timeout: 30_000 });

    // Slice 4: gear is the Gear tab's paper doll — tap the boots cell, Choose
    // item — not a full-screen sheet behind an "Edit gear" button.
    await expect(page.getByTestId('paper-doll')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Edit gear' })).toHaveCount(0);
    const bootsName = await pickGearItem(page, 'boots');

    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByTestId('save-status')).toHaveText(/^Saved /, { timeout: 30_000 });

    // Read mode, fresh load: the boots persisted.
    await goto(page, `/builds/${token}?tab=gear`);
    await expect(page.getByTestId('gear-tab')).toContainText(bootsName);

    // And the tree — never opened this whole test — is untouched. If save
    // ever wrote an empty tree (today's `TreeBuildSession` early-return bug,
    // relocated), this is where it would show up.
    await page.getByRole('tab', { name: 'Tree', exact: true }).click();
    await waitForTreeApi(page);
    expect((await treeState(page)).allocated.length).toBe(seededAllocated);
  });

  test('tree survives tab switches', async ({ page }) => {
    await goto(page, `/builds/${token}?edit=1&tab=tree`);
    await waitForTreeApi(page);
    const before = (await treeState(page)).allocated.length;

    // nodesNearStart is a pure BFS with no knowledge of what is already
    // allocated, and allocateNodes drives a real toggle — re-offering an
    // already-allocated id deallocates it instead of adding it. Request extra
    // candidates and filter out anything already taken (the pattern
    // draft-and-auth.spec.ts:65 uses), and assert we actually got 3 before
    // allocating so this can't go vacuous.
    const taken = new Set((await treeState(page)).allocated);
    const toAllocate = (await nodesNearStart(page, 12)).filter((id) => !taken.has(id)).slice(0, 3);
    expect(toAllocate.length, 'no unallocated nodes near the start to add').toBe(3);
    await allocateNodes(page, toAllocate);
    const afterAllocate = (await treeState(page)).allocated.length;
    expect(afterAllocate, 'allocating 3 nodes did not change the allocated count').toBe(before + 3);

    await page.getByRole('tab', { name: 'Gear', exact: true }).click();
    await expect(page.getByTestId('gear-tab')).toBeVisible();
    await page.getByRole('tab', { name: 'Tree', exact: true }).click();
    await waitForTreeApi(page);
    expect((await treeState(page)).allocated.length, 'allocation did not survive a tab switch').toBe(afterAllocate);

    await page.locator('#build-league').fill('Hardcore');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByTestId('save-status')).toHaveText(/^Saved /, { timeout: 30_000 });

    await goto(page, `/builds/${token}?tab=tree`);
    await waitForTreeApi(page);
    expect((await treeState(page)).allocated.length, 'allocation did not survive a reload').toBe(afterAllocate);
    await expect(levelLine(page)).toContainText('Hardcore');
  });

  test("no bogus restore prompt, and an unsaved draft survives an owner's visit in view mode", async ({ page, context }) => {
    const editUrl = `/builds/${token}?edit=1`;

    // ---- Negative: a clean revisit shows no draft notice at all.
    await goto(page, editUrl);
    await expect(page.getByTestId('build-page')).toBeVisible({ timeout: 30_000 });
    const checkpointId = new URL(page.url()).searchParams.get('checkpoint') ?? undefined;

    // The mount-time echo draft (BuildSession's draft-write effect firing
    // once on load) must actually have landed before checking that revisiting
    // shows no bogus prompt — a fixed sleep here would let this half pass
    // vacuously if that write effect were slow or entirely broken.
    await waitForDraft(page, buildId, checkpointId);
    const second = await context.newPage();
    await second.goto(editUrl);
    await expect(second.getByTestId('draft-notice')).toBeHidden();
    await second.close();

    // ---- Positive: an actual unsaved change is a real draft. Per the
    // controller ruling, drafts hold only tree/gear/gems, so the edit that
    // proves this is a tree allocation, not a notes edit.
    await page.getByRole('tab', { name: 'Tree', exact: true }).click();
    await waitForTreeApi(page);
    const savedCount = (await treeState(page)).allocated.length;
    // Same toggle hazard as "tree survives tab switches" above: filter out
    // anything already allocated before picking the node to add.
    const alreadyAllocated = new Set((await treeState(page)).allocated);
    const [nodeId] = (await nodesNearStart(page, 12)).filter((id) => !alreadyAllocated.has(id));
    expect(nodeId, 'no unallocated node near the start to add').toBeTruthy();
    await allocateNodes(page, [nodeId]);
    await expect
      .poll(async () => (await treeState(page)).allocated.length, { message: 'unsaved allocation never landed' })
      .toBe(savedCount + 1);

    await waitForDraft(page, buildId, checkpointId);

    // Regression for a data-loss bug: BuildSession used to read/write the
    // localStorage draft whenever `canEdit` was true, regardless of edit mode.
    // An owner with an unsaved edit who opened the SAME build in VIEW mode (no
    // ?edit=1 -- e.g. following their own share link) had the draft read
    // effect load it and the draft-write effect immediately overwrite it with
    // the freshly-seeded saved state, destroying the unsaved work with no
    // notice (view mode never renders draft-notice). So visit the build in
    // view mode first -- Tree tab so PassiveTree and the session fully mount,
    // then Overview -- and require the draft to still be offered afterwards.
    await goto(page, `/builds/${token}?tab=tree`);
    await waitForTreeApi(page);
    await goto(page, `/builds/${token}`);
    await expect(page.getByTestId('header-stats')).toBeVisible({ timeout: 30_000 });

    // A draft exists in localStorage going into this load, which is
    // exactly the condition that used to trip a React hydration mismatch
    // (BuildSession read the draft in a lazy useState initialiser — the
    // server render always saw no localStorage, the client's hydration
    // render saw the real draft, and the two disagreed). Registered before
    // the reload so it actually observes it.
    const hydrationMessages: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error' && /hydrat/i.test(msg.text())) hydrationMessages.push(msg.text());
    });
    page.on('pageerror', (err) => {
      if (/hydrat/i.test(err.message)) hydrationMessages.push(err.message);
    });

    await goto(page, editUrl);
    await expect(page.getByTestId('draft-notice'), 'the view-mode visit destroyed the unsaved draft').toBeVisible({ timeout: 30_000 });
    expect(hydrationMessages, 'hydration mismatch while loading with an existing draft').toEqual([]);
    await page.getByTestId('draft-notice').getByRole('button', { name: 'Restore' }).click();

    await page.getByRole('tab', { name: 'Tree', exact: true }).click();
    await waitForTreeApi(page);
    const restored = await treeState(page);
    expect(restored.allocated, 'Restore did not bring back the drafted node').toContain(nodeId);
    expect(restored.allocated.length).toBe(savedCount + 1);

    // ---- Done -> Discard clears the draft and resets the tree.
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(page.getByTestId('unsaved-choice')).toBeVisible();
    await page.getByTestId('unsaved-choice').getByRole('button', { name: 'Discard' }).click();

    await page.reload();
    await expect(page.getByTestId('draft-notice')).toBeHidden();
    await page.getByRole('tab', { name: 'Tree', exact: true }).click();
    await waitForTreeApi(page);
    expect((await treeState(page)).allocated.length, 'Discard did not roll the tree back to the saved state').toBe(
      savedCount,
    );
  });

  test('non-owner cannot edit (URL tampering)', async ({ page }) => {
    // Positive: the owner still gets edit controls after switching the build
    // to Public — Public/Private/Unlisted is a link-sharing setting, not an
    // ownership one, and edit=1 must still work for the owner regardless.
    await setVisibility(page, token, 'public');

    await goto(page, `/builds/${token}?edit=1`);
    await expect(page.getByTestId('build-page')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('button', { name: 'Done' })).toBeVisible();

    // Negative: the reader path's refusal is the API's existing ownership
    // rule. Reused verbatim from api-contracts.spec.ts's "a well-formed id
    // that is not ours" case (validBody() there), which asserts 404.
    const res = await page.request.post('/api/builds', {
      data: {
        id: crypto.randomUUID(),
        name: 'x',
        class: 'Witch',
        level: 10,
        passive_state: { set1: [], set2: [], ascendancyNodes: [] },
      },
    });
    expect(res.status()).toBe(404);
  });

  test('/tree?build= redirects', async ({ page }) => {
    await goto(page, `/tree?build=${buildId}`);
    await expect(page).toHaveURL(new RegExp(`/builds/${token}\\?`));
    const url = new URL(page.url());
    expect(url.pathname).toBe(`/builds/${token}`);
    expect(url.searchParams.get('tab')).toBe('tree');
    expect(url.searchParams.get('edit')).toBe('1');
    expect(url.searchParams.get('checkpoint'), 'the redirect dropped the checkpoint').toBeTruthy();

    await goto(page, '/tree?build=00000000-0000-0000-0000-000000000000');
    await expect(page).toHaveURL(/\/tree(\?|$)/);
    await expect(page.getByText('That build could not be found.')).toBeVisible({ timeout: 30_000 });
  });

  test('375px while editing', async ({ page }) => {
    await goto(page, `/builds/${token}?edit=1`);
    await expect(page.getByTestId('build-page')).toBeVisible({ timeout: 30_000 });

    // Slice 3 task 4: the edit-mode header (name, level+league sharing one
    // row, ascendancy line, author/visibility, checkpoint switcher,
    // HeaderStats) must stay compact — most of a 375x812 screen is the tab
    // content, not the header. Measured once: the header's own size does not
    // change as the tabs below it switch.
    const headerBox = await page.getByTestId('build-page').locator('header').boundingBox();
    expect(headerBox, 'the edit header has no bounding box').not.toBeNull();
    expect(headerBox!.height, 'edit header exceeds 60% of the 812px viewport').toBeLessThanOrEqual(0.6 * 812);

    for (const tab of ['Overview', 'Gear', 'Skills', 'Stats'] as const) {
      await page.getByRole('tab', { name: tab, exact: true }).click();
      await expect(page.getByRole('tab', { name: tab, exact: true })).toHaveAttribute('aria-selected', 'true');

      expect(await horizontalOverflow(page), `horizontal overflow on the ${tab} tab while editing`).toBeLessThanOrEqual(0);

      const { scanned, tooSmall } = await measureTapTargets(page, '[data-testid="build-page"]');
      expect(scanned, `nothing measured on the ${tab} tab while editing`).toBeGreaterThan(0);
      expect(tooSmall, `controls under ${MIN_TAP_PX}px on the ${tab} tab while editing`).toEqual([]);
    }
  });

  test('edits during an in-flight save survive on the build page', async ({ page }) => {
    // Mirrors draft-and-auth.spec.ts's in-flight coverage for the old
    // scratch editor ("edits made while a save is in flight keep their
    // draft", ~lines 44-79) on the new build page: BuildSession.save() has
    // the same latestSession identity check (review 2026-09-26) — a save
    // only carries the tree state at the moment it was sent, so allocations
    // made while that request is in flight must survive as a draft rather
    // than getting cleared out from under the user once the response lands.
    // Last in this serial describe and self-contained (own reload/discard
    // cycle) so it can't disturb the other tests' build-state assumptions.
    await goto(page, `/builds/${token}?edit=1&tab=tree`);
    await waitForTreeApi(page);
    const checkpointId = new URL(page.url()).searchParams.get('checkpoint') ?? undefined;

    // EditBar disables Save while the tree isn't dirty, so allocate one node
    // first just to make Save clickable at all.
    const takenForDirty = new Set((await treeState(page)).allocated);
    const [dirtyNode] = (await nodesNearStart(page, 12)).filter((id) => !takenForDirty.has(id));
    expect(dirtyNode, 'no unallocated node near the start to make the tree dirty').toBeTruthy();
    await allocateNodes(page, [dirtyNode]);
    const savedCount = (await treeState(page)).allocated.length;

    // Hold POST /api/builds exactly as draft-and-auth.spec.ts does for its
    // old-editor equivalent of this test.
    await page.route('**/api/builds', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 3_000));
      await route.continue();
    });
    const savePromise = page.waitForResponse(
      (r) => r.url().includes('/api/builds') && r.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Save', exact: true }).click();

    // While the save is held back, allocate more. Filter against whatever is
    // allocated right now — the same toggle hazard the other tests in this
    // file guard against: re-offering an id already allocated would
    // deallocate it instead of adding to the count.
    const takenInFlight = new Set((await treeState(page)).allocated);
    const inFlightNodes = (await nodesNearStart(page, 12)).filter((id) => !takenInFlight.has(id)).slice(0, 2);
    expect(inFlightNodes.length, 'no unallocated nodes near the start to add in flight').toBe(2);
    const beforeInFlight = (await treeState(page)).allocated.length;
    await allocateNodes(page, inFlightNodes);
    const afterInFlight = (await treeState(page)).allocated.length;
    expect(afterInFlight, 'the in-flight allocation did not change the tree').toBeGreaterThan(beforeInFlight);

    // The response landing is the save completing server-side. The visible
    // status afterwards is "Unsaved changes", not "Saved …" — the new
    // baseline is what was SENT (savedCount), and the live tree
    // (afterInFlight) still differs from it, so `dirty` is correctly true
    // again. That is the scenario in miniature: the save succeeded, but the
    // in-flight edits are not in it.
    const saveResponse = await savePromise;
    await expect(page.getByTestId('save-status')).toHaveText('Unsaved changes', { timeout: 30_000 });
    // Let the draft-write effect (which reacts to `dirty`) actually land
    // before navigating away unmounts it.
    await waitForDraft(page, buildId, checkpointId);
    await page.unroute('**/api/builds');

    // Positive: what actually reached the server is the pre-in-flight
    // state. Asserted straight off the save response body rather than by
    // navigating to a read-mode reload — `canEdit` on the build page is
    // ownership-based, not `?edit=`-based, so a plain `?tab=tree` visit as
    // the owner would mount the very same draft-writing session and
    // overwrite (and, worse, transiently corrupt with a not-yet-loaded
    // classId of -1) the in-flight draft we are about to check next.
    const savePayload = (await saveResponse.json()) as {
      checkpoint?: { passive_state: { set1: number[] } } | null;
      build: { passive_state: { set1: number[] } };
    };
    const savedIds = new Set((savePayload.checkpoint ?? savePayload.build).passive_state.set1);
    expect(savedIds.size, 'the save carried edits made after it was sent').toBe(savedCount);
    for (const id of inFlightNodes) {
      expect(savedIds.has(id), 'the saved tree should not contain an in-flight node').toBe(false);
    }

    // The in-flight edits must still be sitting in the draft, offered back.
    await goto(page, `/builds/${token}?edit=1&tab=tree`);
    await expect(page.getByTestId('draft-notice')).toBeVisible({ timeout: 30_000 });
    await page.getByTestId('draft-notice').getByRole('button', { name: 'Restore' }).click();

    await page.getByRole('tab', { name: 'Tree', exact: true }).click();
    await waitForTreeApi(page);
    const restored = await treeState(page);
    for (const id of inFlightNodes) {
      expect(restored.allocated, 'Restore did not bring back an in-flight node').toContain(id);
    }
    expect(restored.allocated.length).toBe(afterInFlight);

    // Leave the build clean: discard the restored draft rather than saving
    // it, so this test doesn't change what any later run finds.
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(page.getByTestId('unsaved-choice')).toBeVisible();
    await page.getByTestId('unsaved-choice').getByRole('button', { name: 'Discard' }).click();
  });
});
