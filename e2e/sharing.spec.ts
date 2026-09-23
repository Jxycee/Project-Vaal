import { test, expect, type Locator, type Page } from '@playwright/test';
import { cleanupWithFreshPage, openTree, saveBuild, testBuildName } from './helpers';

// Task 4 — sharing, under the AMENDMENT (2026-09-22): the whole of /builds is
// now protected, so a signed-out visitor never reaches ANY of this — that
// half of the plan's original Task 8 (an anonymous context opening a share
// link, icons loading with no session) is void and covered instead by
// e2e/draft-and-auth.spec.ts's two redirect assertions. What is still real
// and still worth an end-to-end proof, with only one test account available
// to this suite, is the two blocking decisions from the Task 4 plan:
//   1. The shared page reads through get_build_by_share_token (not a plain
//      select) — an 'unlisted' build must render, not 404, for a signed-in
//      viewer who is not the RLS "public" policy's target.
//   2. Both counter RPCs are visibility-gated in their own bodies, so
//      flipping a build to 'private' revokes its link immediately, with no
//      client cooperation.
//
// Same shared account for "owner" and "viewer" here — this proves the read
// path is NOT ownership-gated (the shared page never checks `user_id`, only
// `get_build_by_share_token`'s own `visibility IN ('public','unlisted')`
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

  test('an unlisted build renders via its share link, and switching to private revokes it', async ({
    page,
  }) => {
    await openTree(page);

    // One gear item and one gem skill — enough for the shared page to have
    // real content beyond its header, without the extra cost of a jewel
    // socket too (loadout-persistence.spec.ts already proves that wiring).
    await page.getByRole('button', { name: 'Gear' }).click();
    const gearSheet = page.locator('.z-40');
    await expect(gearSheet).toBeVisible();
    const bootsRow = gearSheet.locator('ul li').filter({ hasText: 'Boots' }).first();
    const bootsName = await pickFirstItem(page, bootsRow.getByRole('button').first(), bootsRow);
    await gearSheet.getByRole('button', { name: 'Close gear sheet' }).click();
    await expect(gearSheet).toBeHidden();

    await page.getByRole('button', { name: /^Gems/ }).click();
    const gemsSheet = page.locator('.z-40').filter({ hasText: 'Gems' });
    await expect(gemsSheet).toBeVisible();
    await gemsSheet.getByRole('button', { name: '+ Add skill' }).click();
    const card = gemsSheet.locator('ul > li').first();
    const skillName = await pickFirstItem(page, card.getByRole('button', { name: /Empty/ }), card);
    await gemsSheet.getByRole('button', { name: 'Close gems sheet' }).click();
    await expect(gemsSheet).toBeHidden();

    const name = testBuildName('share');
    await saveBuild(page, { name, level: 20, league: 'Standard' });

    // ---- Set visibility to Unlisted, read the real share link off the page -
    await page.goto('/builds');
    const row = page.locator('ul > li').filter({ has: page.locator(`a:has-text("${name}")`) }).first();
    await expect(row).toBeVisible();

    await row.getByRole('combobox').click();
    await page.getByRole('option', { name: 'Unlisted' }).click();

    const shareLink = row.locator('a[href^="/builds/"]');
    await expect(shareLink).toBeVisible({ timeout: 30_000 });
    const href = await shareLink.getAttribute('href');
    expect(href, 'the row never rendered a share link after switching to Unlisted').toBeTruthy();

    // ---- The RLS trap this proves: get_build_by_share_token, not a plain
    // select. The "Public builds are readable by anyone" RLS policy only
    // covers visibility='public' — an 'unlisted' build like this one is
    // invisible to a bare select for anyone but its owner via the owner
    // policy. Loading it through a real navigation (not the same session's
    // in-memory state) is what makes this a proof of the RPC path rather
    // than of anything client-cached.
    await page.goto(href!);
    await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
    await expect(page.getByText(bootsName)).toBeVisible();
    // .first(): the skill name legitimately appears twice (the header's
    // "Main skill" field via deriveMainSkill, and the gem loadout card
    // itself) — either is proof enough that gem_state round-tripped.
    await expect(page.getByText(skillName).first()).toBeVisible();

    // mobile-layout.spec.ts's "no horizontal page scroll" test sweeps only
    // /builds and /tree (predates this route) — folded in here instead of
    // added there, since that file has no build-creation setup of its own
    // and this test already has a real token to visit.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, 'horizontal overflow on /builds/<shareToken>').toBeLessThanOrEqual(0);

    // ---- Switch to Private: both counter RPCs check visibility in their own
    // bodies, so this must revoke the link with no further code involved.
    await page.goto('/builds');
    const row2 = page.locator('ul > li').filter({ has: page.locator(`a:has-text("${name}")`) }).first();
    await expect(row2).toBeVisible();
    await row2.getByRole('combobox').click();
    await page.getByRole('option', { name: 'Private' }).click();
    await expect(row2.locator('a[href^="/builds/"]')).toBeHidden();

    await page.goto(href!);
    await expect(page.getByText('That build is private or does not exist.')).toBeVisible();
  });
});
