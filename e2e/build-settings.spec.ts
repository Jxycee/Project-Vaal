import { test, expect, type Locator, type Page } from '@playwright/test';
import { callShareTokenRpc, cleanupWithFreshPage, createBuildViaApi, testBuildName } from './helpers';

// Slice 7a of the build-profile redesign (docs/superpowers/specs/2026-09-27-
// build-profile-redesign-design.md §5.1 actions; plan docs/superpowers/plans/
// 2026-09-28-build-page-slice7a-library-settings.md): a build's settings
// (visibility, tags, rename, delete) live in a settings menu on the build
// page, owner only. Written FIRST, so it fails at the very first
// `build-settings` assertion until the menu lands.
//
// Contract this spec pins:
//   - a button `aria-label="Build settings"` in the owner's header opens
//     `data-testid="build-settings"` (a sheet); `aria-label="Close build
//     settings"` closes it.
//   - Visibility: `role="radio"` buttons whose names start Unlisted / Private /
//     Public, `aria-checked` on the current one; the line "Switching to
//     Unlisted disables this link immediately." sits next to them.
//   - Tags: a chip per tag with a button `aria-label="Remove tag <tag>"`; an
//     input `aria-label="New tag"` and a button "Add tag".
//   - Rename: an input `aria-label="Build name"` and a button "Save name".
//   - Delete: "Delete build", then (second tap) "Confirm delete"; success
//     navigates to /builds.
//   - Errors render in `role="alert"`.
//
// Seeded through POST /api/builds (unlisted, owner only) — this spec's
// subject is the menu, not creation, and it never mounts the tree.

const NEW_TAG = 'e2etag';

function settingsButton(page: Page): Locator {
  return page.getByRole('button', { name: 'Build settings', exact: true });
}

async function openSettings(page: Page): Promise<Locator> {
  await settingsButton(page).click();
  const menu = page.getByTestId('build-settings');
  await expect(menu).toBeVisible();
  return menu;
}

async function closeSettings(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Close build settings', exact: true }).click();
  await expect(page.getByTestId('build-settings')).toBeHidden();
}

/** `page.goto`, tolerant of one `net::ERR_ABORTED` (Next dev HMR reload race). */
async function goto(page: Page, url: string): Promise<void> {
  try {
    await page.goto(url);
  } catch (err) {
    if (!/ERR_ABORTED/.test(String(err))) throw err;
    await page.goto(url);
  }
}

async function shareRows(page: Page, token: string): Promise<Array<{ name: string }>> {
  const res = await callShareTokenRpc(page, token);
  expect(res.status()).toBe(200);
  return (await res.json()) as Array<{ name: string }>;
}

test.describe('build settings menu', () => {
  test.skip(() => test.info().project.name !== 'mobile', 'mobile project only');
  test.describe.configure({ mode: 'serial' });
  test.use({ viewport: { width: 375, height: 812 } });
  test.setTimeout(300_000);

  test.afterAll(async ({ browser }) => {
    await cleanupWithFreshPage(browser);
  });

  const name = testBuildName('settings');
  const renamed = `${name}-renamed`;
  let token = '';

  test('visibility: all three states, revoked at the RPC, owner still opens the page', async ({ page }) => {
    ({ token } = await createBuildViaApi(page, name));
    await goto(page, `/builds/${token}`);
    await expect(page.getByTestId('build-page')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('build-visibility')).toContainText('Unlisted');

    const menu = await openSettings(page);
    const unlisted = menu.getByRole('radio', { name: /^Unlisted/ });
    const privateRadio = menu.getByRole('radio', { name: /^Private/ });
    const publicRadio = menu.getByRole('radio', { name: /^Public/ });
    await expect(unlisted).toHaveAttribute('aria-checked', 'true');
    await expect(privateRadio).toHaveAttribute('aria-checked', 'false');
    await expect(publicRadio).toHaveAttribute('aria-checked', 'false');
    await expect(menu.getByText('Switching to Unlisted disables this link immediately.')).toBeVisible();

    // Positive control first, at the RPC a reader goes through: while the
    // build is owner-only the RPC returns nothing, so a later non-empty answer
    // means the menu's change reached the database.
    expect(await shareRows(page, token)).toEqual([]);

    // Private = anyone with the link (this app's vocabulary; visibility.ts).
    await privateRadio.click();
    await expect(privateRadio).toHaveAttribute('aria-checked', 'true', { timeout: 30_000 });
    await expect.poll(async () => (await shareRows(page, token)).map((r) => r.name), { timeout: 30_000 }).toEqual([name]);

    await publicRadio.click();
    await expect(publicRadio).toHaveAttribute('aria-checked', 'true', { timeout: 30_000 });
    await expect.poll(async () => (await shareRows(page, token)).map((r) => r.name), { timeout: 30_000 }).toEqual([name]);

    await closeSettings(page);
    await expect(page.getByTestId('build-visibility')).toContainText('Public', { timeout: 30_000 });
    await expect(page.getByRole('button', { name: 'Copy link', exact: true })).toBeVisible();

    // Back to Unlisted: the RPC must return nothing again (the reader's link
    // is revoked), while the owner still opens the page by the owner path.
    const again = await openSettings(page);
    await again.getByRole('radio', { name: /^Unlisted/ }).click();
    await expect(again.getByRole('radio', { name: /^Unlisted/ })).toHaveAttribute('aria-checked', 'true', {
      timeout: 30_000,
    });
    await expect.poll(async () => (await shareRows(page, token)).length, { timeout: 30_000 }).toBe(0);
    await closeSettings(page);

    await goto(page, `/builds/${token}`);
    await expect(page.getByTestId('build-page')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('build-visibility')).toContainText('Unlisted');
    await expect(page.getByRole('button', { name: 'Copy link', exact: true })).toBeHidden();
  });

  test('tags: add and remove, visible after a reload', async ({ page }) => {
    await goto(page, `/builds/${token}`);
    await expect(page.getByTestId('build-page')).toBeVisible({ timeout: 30_000 });

    const menu = await openSettings(page);
    await menu.getByLabel('New tag').fill(NEW_TAG);
    await menu.getByRole('button', { name: 'Add tag', exact: true }).click();
    await expect(menu.getByRole('button', { name: `Remove tag ${NEW_TAG}` })).toBeVisible({ timeout: 30_000 });
    await closeSettings(page);

    await page.reload();
    await expect(page.getByTestId('build-page')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('build-page').getByText(`#${NEW_TAG}`)).toBeVisible();

    const again = await openSettings(page);
    await again.getByRole('button', { name: `Remove tag ${NEW_TAG}` }).click();
    await expect(again.getByRole('button', { name: `Remove tag ${NEW_TAG}` })).toBeHidden({ timeout: 30_000 });
    await closeSettings(page);

    await page.reload();
    await expect(page.getByTestId('build-page')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('build-page').getByText(`#${NEW_TAG}`)).toBeHidden();
  });

  test('rename from view mode', async ({ page }) => {
    await goto(page, `/builds/${token}`);
    await expect(page.getByRole('heading', { level: 1, name })).toBeVisible({ timeout: 30_000 });

    const menu = await openSettings(page);
    await menu.getByLabel('Build name').fill(renamed);
    await menu.getByRole('button', { name: 'Save name', exact: true }).click();
    await closeSettings(page);

    // The header itself changes (no reload needed), and so does the server's.
    await expect(page.getByRole('heading', { level: 1, name: renamed })).toBeVisible({ timeout: 30_000 });
    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: renamed })).toBeVisible({ timeout: 30_000 });
  });

  test('rename while edit mode is dirty edits the session, and Save persists it', async ({ page }) => {
    // Server Functions are POSTs carrying a Next-Action header. While the
    // session is dirty the menu must not call one for the rename.
    let serverFunctionCalls = 0;
    page.on('request', (r) => {
      if (r.method() === 'POST' && r.headers()['next-action'] !== undefined) serverFunctionCalls += 1;
    });

    await goto(page, `/builds/${token}?edit=1`);
    await expect(page.getByTestId('build-page')).toBeVisible({ timeout: 30_000 });
    await page.locator('#build-league').fill('E2E Dirty League');
    await page.locator('#build-league').blur();

    const dirtyName = `${name}-dirty`;
    const menu = await openSettings(page);
    await menu.getByLabel('Build name').fill(dirtyName);
    await menu.getByRole('button', { name: 'Save name', exact: true }).click();
    await closeSettings(page);

    // One source of truth: the header's own name field now holds it, unsaved.
    await expect(page.locator('#build-name')).toHaveValue(dirtyName);
    expect(serverFunctionCalls, 'the menu called a Server Function for a rename while dirty').toBe(0);

    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByTestId('save-status')).toHaveText(/^Saved /, { timeout: 30_000 });

    await goto(page, `/builds/${token}`);
    await expect(page.getByRole('heading', { level: 1, name: dirtyName })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('build-page')).toContainText('E2E Dirty League');
  });

  test('delete: two taps, lands on /builds, the old link is gone', async ({ page }) => {
    const doomed = testBuildName('settings-delete');
    const { token: doomedToken } = await createBuildViaApi(page, doomed);
    await goto(page, `/builds/${doomedToken}`);
    await expect(page.getByTestId('build-page')).toBeVisible({ timeout: 30_000 });

    const menu = await openSettings(page);
    await expect(menu.getByRole('button', { name: 'Confirm delete' })).toBeHidden();
    await menu.getByRole('button', { name: 'Delete build', exact: true }).click();
    // The first tap only arms it: the build is still there.
    await expect(menu.getByRole('button', { name: 'Confirm delete', exact: true })).toBeVisible();
    await menu.getByRole('button', { name: 'Confirm delete', exact: true }).click();

    await page.waitForURL((url) => url.pathname === '/builds', { timeout: 30_000 });

    await goto(page, `/builds/${doomedToken}`);
    await expect(page.getByText('Build not found')).toBeVisible({ timeout: 30_000 });
  });

  test('no horizontal scroll with the menu open at 375px, and 44px targets', async ({ page }) => {
    await goto(page, `/builds/${token}`);
    const menu = await openSettings(page);
    await menu.getByLabel('New tag').fill(NEW_TAG);
    await menu.getByRole('button', { name: 'Add tag', exact: true }).click();
    await expect(menu.getByRole('button', { name: `Remove tag ${NEW_TAG}` })).toBeVisible({ timeout: 30_000 });

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, 'horizontal overflow with the settings menu open').toBeLessThanOrEqual(0);

    const small = await menu.evaluate((root, min) => {
      return [...root.querySelectorAll<HTMLElement>('button')]
        .map((el) => ({ el, r: el.getBoundingClientRect() }))
        .filter(({ r }) => r.width > 0 && r.height > 0 && (r.height < min || r.width < min))
        .map(({ el, r }) => `${(el.innerText || el.getAttribute('aria-label') || '').trim().slice(0, 30)} ${Math.round(r.width)}x${Math.round(r.height)}`);
    }, 44);
    expect(small, 'settings controls under 44px').toEqual([]);
  });
});
