import { test, expect, type Page } from '@playwright/test';
import { cleanupWithFreshPage, importFixture, testBuildName } from './helpers';

// Reader gem card (Skills tab). Written BEFORE the code. Convergence gap: the
// competitor shows what a gem and each support DO; ours showed names only.
//
// How this can fail (decided first, per AGENTS.md):
//   1. A skill/support wiki file is missing or errors: the name must still
//      show, the card must not crash, and the other supports keep their text.
//   2. A gem level beyond the scaling table: the cost line must not show
//      "undefined"/NaN; it falls back to the nearest level or hides.
//   3. A support with no description: no empty paragraph, no "undefined".
//   4. Raw wiki markup ("@80%" markers) must never reach the reader.
//   5. The card must not overflow a 375px phone, and loading must not
//      blank the list (rows stay tappable while it loads).
//   6. The old contract holds: one `skill-support` per support, one detail at a time.
//
// Artifact: a screenshot of the open card, attached to the test report.

const goto = async (page: Page, url: string) => {
  try {
    await page.goto(url);
  } catch (err) {
    if (!/ERR_ABORTED/.test(String(err))) throw err;
    await page.goto(url);
  }
};

const overflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test.describe('reader gem card', () => {
  test.skip(() => test.info().project.name !== 'mobile', 'mobile project only');
  test.describe.configure({ mode: 'serial' });
  test.use({ viewport: { width: 375, height: 812 } });
  test.setTimeout(300_000);

  const name = testBuildName('gem-card');
  let token = '';
  let lastCheckpointId = '';
  const url = () => `/builds/${token}?checkpoint=${lastCheckpointId}&tab=skills`;

  test.afterAll(async ({ browser }) => {
    await cleanupWithFreshPage(browser);
  });

  test('tapping a row shows the skill and every support with what they do', async ({ page }, info) => {
    token = await importFixture(page, name);
    await goto(page, `/builds/${token}`);
    await expect(page.getByTestId('build-page')).toBeVisible({ timeout: 30_000 });
    await page.getByTestId('checkpoint-switcher').click();
    const options = page.getByTestId('checkpoint-option');
    await expect(options).toHaveCount(8);
    lastCheckpointId = (await options.last().getAttribute('data-checkpoint-id'))!;

    await goto(page, url());
    await expect(page.getByTestId('skills-tab')).toBeVisible({ timeout: 30_000 });
    const rows = page.getByTestId('skill-row');
    await expect(rows).toHaveCount(5);
    await rows.first().click();

    const card = page.getByTestId('gem-card');
    await expect(card).toBeVisible({ timeout: 30_000 });
    await expect(card.getByTestId('gem-card-name')).not.toHaveText('');
    await expect(card.getByTestId('gem-card-desc')).toHaveText(/\w{4,}/, { timeout: 30_000 });

    const supports = card.getByTestId('skill-support');
    const count = await supports.count();
    expect(count, 'the main skill row has no supports in the fixture').toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const s = supports.nth(i);
      await expect(s.getByTestId('gem-card-support-desc'), `support ${i} has no description`).toHaveText(/\w{4,}/, { timeout: 30_000 });
    }

    const text = (await card.textContent()) ?? '';
    expect(text, 'raw wiki marker leaked').not.toContain('@');
    expect(text).not.toMatch(/undefined|NaN|\[object/);
    expect(await overflow(page), 'horizontal overflow with the card open').toBeLessThanOrEqual(0);

    // Written to a fixed path as well: a passing test's attachment is not kept by the json reporter.
    const shot = await card.screenshot({ path: 'playwright-report/gem-card.png' });
    await info.attach('gem-card.png', { body: shot, contentType: 'image/png' });
  });

  test('a support whose wiki file fails still lists by name; the rest of the card survives', async ({ page }) => {
    await goto(page, url());
    await expect(page.getByTestId('skills-tab')).toBeVisible({ timeout: 30_000 });
    await page.getByTestId('skill-row').first().click();
    const firstSlug = await page.getByTestId('skill-support').first().getAttribute('data-slug');
    expect(firstSlug, 'support row exposes no slug').toBeTruthy();

    await page.route(new RegExp(`/skills/${firstSlug}\\.json`), (route) => route.fulfill({ status: 500, body: 'boom' }));
    await goto(page, url());
    await expect(page.getByTestId('skills-tab')).toBeVisible({ timeout: 30_000 });
    await page.getByTestId('skill-row').first().click();

    const card = page.getByTestId('gem-card');
    await expect(card).toBeVisible({ timeout: 30_000 });
    const broken = card.locator(`[data-testid="skill-support"][data-slug="${firstSlug}"]`).first();
    await expect(broken).toBeVisible();
    expect(((await broken.textContent()) ?? '').trim().length, 'broken support lost its name').toBeGreaterThan(0);
    await expect(broken.getByTestId('gem-card-support-desc')).toHaveCount(0);
    await expect(card.getByTestId('gem-card-desc')).toHaveText(/\w{4,}/, { timeout: 30_000 });
  });

  test('one card at a time; a second tap closes it', async ({ page }) => {
    await goto(page, url());
    await expect(page.getByTestId('skills-tab')).toBeVisible({ timeout: 30_000 });
    const rows = page.getByTestId('skill-row');
    await rows.nth(1).click();
    await expect(page.getByTestId('gem-card')).toHaveCount(1);
    await rows.nth(2).click();
    await expect(page.getByTestId('gem-card')).toHaveCount(1);
    await rows.nth(2).click();
    await expect(page.getByTestId('gem-card')).toHaveCount(0);
  });
});
