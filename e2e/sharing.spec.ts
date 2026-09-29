import { test, expect, type Locator, type Page } from '@playwright/test';
import {
  callShareTokenRpc,
  cleanupWithFreshPage,
  closeGemEditor,
  openEditor,
  openTree,
  pickGearItem,
  readShareToken,
  saveBuild,
  setVisibility,
  testBuildName,
} from './helpers';

// Task 4 — sharing, under the AMENDMENT (2026-09-22): the whole of /builds is
// now protected, so a signed-out visitor never reaches ANY of this — that
// half of the plan's original Task 8 (an anonymous context opening a share
// link, icons loading with no session) is void and covered instead by
// e2e/draft-and-auth.spec.ts's two redirect assertions. What is still real
// and still worth an end-to-end proof, with only one test account available
// to this suite, is the two blocking decisions from the Task 4 plan:
//   1. The shared page reads through get_build_by_share_token (not a plain
//      select) — a link-shared ('private') build must render, not 404, for a signed-in
//      viewer who is not the RLS "public" policy's target.
//   2. Both counter RPCs are visibility-gated in their own bodies, so
//      flipping a build to 'unlisted' revokes its link immediately, with no
//      client cooperation.
//
// Same shared account for "owner" and "viewer" here — this proves the read
// path is NOT ownership-gated (the shared page never checks `user_id`, only
// `get_build_by_share_token`'s own `visibility IN ('public','private')`
// filter), even though it can't independently prove a DIFFERENT account can
// read it. That would need a second seeded test account, which this suite
// does not have.

/** Opens the item picker from `opener`, takes the first result, and returns its name (minus the picker's " Unique" suffix). Copied from loadout-persistence.spec.ts's private helper — not shared via helpers.ts since it is itself test-local there. */
async function pickFirstItem(page: Page, opener: Locator, subject: Locator): Promise<string> {
  await opener.click();
  const picker = page.locator('.z-50');
  await expect(picker.getByPlaceholder('Search items…')).toBeVisible();
  const firstResult = picker.locator('ul li button').first();
  await expect(firstResult).toBeVisible({ timeout: 15_000 });

  const raw = (await firstResult.locator('span.truncate').first().textContent()) ?? '';
  const name = raw.replace(/\s*Unique\s*$/, '').trim();
  expect(name.length, 'the picker returned a result with no name').toBeGreaterThan(0);

  await firstResult.click();
  await expect(picker.getByPlaceholder('Search items…')).toBeHidden();
  await expect(subject).toContainText(name);
  return name;
}

test.describe('sharing', () => {
  test.skip(() => test.info().project.name !== 'mobile', 'mobile project only');
  test.setTimeout(300_000);

  test.afterAll(async ({ browser }) => {
    await cleanupWithFreshPage(browser);
  });

  test('a link-shared build renders via its share link, and switching to owner-only revokes it', async ({
    page,
  }) => {
    await openTree(page);

    // One gear item and one gem skill — enough for the shared page to have
    // real content beyond its header, without the extra cost of a jewel
    // socket too (loadout-persistence.spec.ts already proves that wiring).
    await openEditor(page, 'gear');
    const bootsName = await pickGearItem(page, 'boots');

    await openEditor(page, 'gems');
    await page.getByRole('button', { name: '+ Add skill group' }).click();
    const gemsSheet = page.getByTestId('gem-group-sheet');
    await expect(gemsSheet).toBeVisible();
    const card = gemsSheet.locator('ul > li').first();
    const skillName = await pickFirstItem(page, card.getByRole('button', { name: /Empty/ }), card);
    await closeGemEditor(page);

    const name = testBuildName('share');
    await saveBuild(page, { name, level: 20, league: 'Standard' });

    // Slice 5: the owner's own Life for this level-20 build, to compare with
    // what a share-link reader sees below. The save landed on the new build's
    // page, where Stats is its own tab.
    await openEditor(page, 'stats');
    const ownerLife = page.getByTestId('stats-panel').getByTestId('stat-life');
    await expect(ownerLife).toHaveText(/^\d+$/, { timeout: 30_000 });
    const lifeOnTree = await ownerLife.textContent();

    // ---- Set visibility to Private (this app's link-shareable state — see
    // src/lib/build/visibility.ts, the vocabulary inverts the usual web
    // meaning on purpose) and read the real share link off the page.
    const shareToken = await readShareToken(page, name);
    const href = `/builds/${shareToken}`;
    await setVisibility(page, shareToken, 'private');

    // ---- Positive control for the revocation proof at the end of this test.
    // Same PostgREST call, made now while the build is Private (link-shared),
    // so the empty array asserted later actually means "revoked by the RPC's
    // own visibility filter" rather than "this call always returns nothing".
    const whilePrivate = await callShareTokenRpc(page, shareToken);
    expect(whilePrivate.status()).toBe(200);
    const privateRows = (await whilePrivate.json()) as Array<{ name: string }>;
    expect(privateRows).toHaveLength(1);
    expect(privateRows[0].name).toBe(name);

    // ---- The RLS trap this proves: get_build_by_share_token, not a plain
    // select. The "Public builds are readable by anyone" RLS policy only
    // covers visibility='public' — a 'private' build like this one is
    // invisible to a bare select for anyone but its owner via the owner
    // policy. Loading it through a real navigation (not the same session's
    // in-memory state) is what makes this a proof of the RPC path rather
    // than of anything client-cached.
    await page.goto(href);
    await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
    await page.getByRole('tab', { name: 'Gear', exact: true }).click();
    await expect(page.getByTestId('gear-tab').getByText(bootsName)).toBeVisible();
    await page.getByRole('tab', { name: 'Skills', exact: true }).click();
    await expect(page.getByTestId('skills-tab').getByText(skillName).first()).toBeVisible();

    // Slice 5: the shared page's stats match the owner's. Now a tab, not a tap-to-open sheet.
    await page.getByRole('tab', { name: 'Stats', exact: true }).click();
    const sharedStats = page.getByTestId('stats-panel');
    await expect(sharedStats.getByTestId('stat-life')).toHaveText(lifeOnTree!, { timeout: 60_000 });
    await expect(sharedStats.getByTestId('stat-act')).toContainText('Act 2');

    // mobile-layout.spec.ts's "no horizontal page scroll" test sweeps only
    // /builds and /tree (predates this route) — folded in here instead of
    // added there, since that file has no build-creation setup of its own
    // and this test already has a real token to visit.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, 'horizontal overflow on /builds/<shareToken>').toBeLessThanOrEqual(0);

    // ---- Switch to Unlisted (owner only): the share-token RPC checks
    // visibility in its own body, so this must revoke the link with no
    // further code involved.
    await setVisibility(page, shareToken, 'unlisted');

    // ---- Revocation now needs two proofs, not one page load. The build page
    // has grown an OWNER path (src/app/(dashboard)/builds/[shareToken]/load.ts)
    // that lets an owner open their own unlisted build by design (see
    // docs/superpowers/specs/2026-09-27-build-profile-redesign-design.md §7.1),
    // and this suite has only one seeded test account, which owns this build —
    // so page.goto(href) alone would still succeed and prove nothing about
    // revocation. Instead: (1) the owner still sees their own build, via the
    // owner path, which is expected; (2) the share-token RPC itself, called
    // exactly as a signed-in non-owner reader would reach it, returns nothing
    // — that RPC's own visibility filter is what actually revokes the link.
    await page.goto(href);
    await expect(page.getByTestId('build-page')).toBeVisible();
    await expect(page.getByTestId('build-visibility')).toContainText('Unlisted');

    const whileUnlisted = await callShareTokenRpc(page, shareToken);
    expect(whileUnlisted.status()).toBe(200);
    expect(await whileUnlisted.json()).toEqual([]);
  });
});
