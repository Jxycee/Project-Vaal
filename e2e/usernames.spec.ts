import { randomBytes } from 'node:crypto';
import { test, expect, type Browser, type Page } from '@playwright/test';
import { DataSet, englishDataset } from 'obscenity';
import { ALLOWED_PROFANITY, isOffensive } from '../src/lib/profile/username';
import {
  accessToken,
  buildCard,
  cleanupWithFreshPage,
  createBuildViaApi,
  setVisibility,
  testBuildName,
} from './helpers';
import path from 'node:path';

// Usernames, end to end against the real app and the real (live) database.
//
// The account is shared with every other spec, so its username and weekly lock
// are reset to null BEFORE and AFTER this file with the service role (test-only
// code; the key comes from the environment and is never printed). What this
// proves, in order:
//   - no username: the dashboard shows the email; an owner's build page shows
//     the (i) hint; the public library card reads "Anonymous" (never the email)
//   - the word filter refuses a real blocked term, derived from the tuned
//     dataset so no slur is written in this repo, and nothing is saved
//   - format errors; a valid name goes through the confirm step
//   - a change to an allowed-profanity name is accepted (proves the whitelist)
//   - a stale page that tries a THIRD change hits the database's weekly rule
//     through the real Server Function, and shows the lock date
//   - the (i) is gone, and the public card shows the name

const STORAGE_STATE = path.join(__dirname, '.auth', 'user.json');

function serviceEnv(): { url: string; key: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  expect(url && key, 'NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be in .env.local').toBeTruthy();
  return { url: url!, key: key! };
}

/** The signed-in user's id: the `sub` of the session's access token (decoded, not validated; only used to scope the reset). */
async function userIdOf(page: Page): Promise<string> {
  const token = await accessToken(page);
  const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8')) as { sub: string };
  return payload.sub;
}

async function resetUsername(browser: Browser): Promise<void> {
  const context = await browser.newContext({ storageState: STORAGE_STATE });
  try {
    const page = await context.newPage();
    const id = await userIdOf(page);
    const { url, key } = serviceEnv();
    const res = await page.request.patch(`${url}/rest/v1/user_profiles?id=eq.${id}`, {
      data: { display_name: null, display_name_changed_at: null },
      headers: { apikey: key, authorization: `Bearer ${key}`, 'content-type': 'application/json', prefer: 'return=minimal' },
    });
    expect(res.status(), 'resetting the test account username').toBeLessThan(300);
  } finally {
    await context.close();
  }
}

/** A term the tuned filter must still block, taken from the dataset itself. */
function blockedTerm(): string {
  const words: string[] = [];
  new DataSet<{ originalWord: string }>().addAll(englishDataset).removePhrasesIf((p) => {
    if (p.metadata?.originalWord) words.push(p.metadata.originalWord);
    return false;
  });
  const term = words.find((w) => /^[a-z]{4,8}$/.test(w) && !ALLOWED_PROFANITY.has(w) && isOffensive(w));
  expect(term, 'no blocked term derivable from the dataset').toBeTruthy();
  return term!;
}

const rand = (bytes: number) => randomBytes(bytes).toString('hex');

async function openEditor(page: Page): Promise<void> {
  const edit = page.getByRole('button', { name: 'Edit username', exact: true });
  const input = page.getByRole('textbox', { name: 'Username', exact: true });
  // Clicking before hydration does nothing, so retry — but only while the
  // editor has not opened. A click that DID open it disables the ✎ (edit mode),
  // so blindly re-clicking would wait on a disabled button forever.
  await expect(async () => {
    if (await input.isVisible()) return;
    if (await edit.isEnabled()) await edit.click({ timeout: 3_000 });
    await expect(input).toBeVisible({ timeout: 5_000 });
  }).toPass({ timeout: 45_000 });
}

async function fillAndSave(page: Page, name: string): Promise<void> {
  await page.getByRole('textbox', { name: 'Username', exact: true }).fill(name);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
}

/** The date `days` from now as the browser under test formats it (its own locale and timezone). */
function localDateIn(page: Page, days: number): Promise<string> {
  return page.evaluate(
    (d) =>
      new Date(Date.now() + d * 86_400_000).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
    days,
  );
}

test.describe('usernames', () => {
  test.skip(() => test.info().project.name !== 'mobile', 'mobile project only');
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(180_000);
  // Reduced motion: the dashboard's VaalOrb is WebGL, which headless Chromium
  // renders in software; its continuous spin starved the page (blank frames,
  // clicks timing out) under load. The orb stops spinning under this setting.
  test.use({ viewport: { width: 375, height: 812 }, contextOptions: { reducedMotion: 'reduce' } });

  let buildName = '';
  let token = '';
  let firstName = '';
  let secondName = '';

  // The dashboard's VaalOrb (WebGL, software-rendered in headless Chromium)
  // can freeze the page's main thread under load: blank frames, clicks hanging
  // at "scrolling into view". This spec is about the username control, not
  // the orb, so its model file is not served here. The orb itself is untouched.
  test.beforeEach(async ({ context }) => {
    await context.route('**/models/vaal-orb.glb', (route) => route.abort());
  });

  test.beforeAll(async ({ browser }) => {
    await resetUsername(browser);
  });

  test.afterAll(async ({ browser }) => {
    await resetUsername(browser);
    await cleanupWithFreshPage(browser);
  });

  test('with no username: email on the dashboard, (i) hint on the owner page, Anonymous on the public card', async ({
    page,
  }) => {
    await page.goto('/dashboard');
    const control = page.getByTestId('username-control');
    await expect(control.getByTestId('signed-in-as')).toContainText('@');
    const edit = page.getByRole('button', { name: 'Edit username', exact: true });
    await expect(edit).toBeVisible();
    const box = await edit.boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);

    buildName = testBuildName('username');
    ({ token } = await createBuildViaApi(page, buildName));
    await setVisibility(page, token, 'public');

    // Owner page: "by You" plus the hint; tapping it opens a visible popover.
    await page.goto(`/builds/${token}`);
    await expect(page.getByTestId('build-page')).toBeVisible({ timeout: 30_000 });
    const hint = page.getByTestId('username-hint');
    await expect(hint).toBeVisible();
    await expect(page.getByTestId('username-hint-popover')).toHaveCount(0);
    await expect(async () => {
      await hint.click({ timeout: 3_000 });
      await expect(page.getByTestId('username-hint-popover')).toHaveText(
        'Set a username on the Dashboard, or stay Anonymous.',
        { timeout: 1_500 },
      );
    }).toPass({ timeout: 30_000 });
    const popover = await page.getByTestId('username-hint-popover').boundingBox();
    expect(popover!.x).toBeGreaterThanOrEqual(0);
    expect(popover!.x + popover!.width).toBeLessThanOrEqual(375);

    // Public tab: never the email.
    await page.goto('/builds?tab=public');
    const card = buildCard(page, buildName);
    await expect(card).toBeVisible({ timeout: 30_000 });
    await expect(card.getByTestId('build-card-badge')).toHaveText('by Anonymous');
    await expect(card).not.toContainText('@');
    await expect(card).toContainText('views');
  });

  test('a blocked term and a bad format are refused, and nothing is saved', async ({ page }) => {
    await page.goto('/dashboard');
    await openEditor(page);

    await fillAndSave(page, `${blockedTerm()}_${rand(2)}`);
    await expect(page.getByTestId('username-control').getByRole('alert')).toContainText("isn't allowed");
    await expect(page.getByTestId('username-confirm')).toHaveCount(0);

    await fillAndSave(page, 'ab');
    await expect(page.getByTestId('username-control').getByRole('alert')).toContainText('3–20 characters');
    await expect(page.getByTestId('username-confirm')).toHaveCount(0);

    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.reload();
    await expect(page.getByTestId('signed-in-as')).toContainText('@');
  });

  test('first name: confirm step, then it shows on the dashboard and survives a reload', async ({ page }) => {
    firstName = `E2E_${rand(3)}`;
    await page.goto('/dashboard');
    await openEditor(page);
    await fillAndSave(page, firstName);

    const confirm = page.getByTestId('username-confirm');
    await expect(confirm).toBeVisible();
    await expect(confirm).toContainText(`Set your username to ${firstName}?`);
    await expect(confirm).toContainText('once more right away');
    const box = await confirm.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(375);

    // Cancel leaves it unset.
    await confirm.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(page.getByTestId('signed-in-as')).toContainText('@');

    await fillAndSave(page, firstName);
    await page.getByTestId('username-confirm').getByRole('button', { name: 'Confirm', exact: true }).click();
    await expect(page.getByTestId('signed-in-as')).toHaveText(firstName, { timeout: 30_000 });
    await expect(page.getByTestId('username-locked')).toHaveCount(0);

    await page.reload();
    await expect(page.getByTestId('signed-in-as')).toHaveText(firstName);
  });

  test('a change to an allowed-profanity name locks the next change, and a stale page hits the weekly rule', async ({
    page,
    context,
  }) => {
    secondName = `Bitch_${rand(2)}`;
    await page.goto('/dashboard');
    await expect(page.getByTestId('signed-in-as')).toHaveText(firstName);
    // This page goes stale: it opens its confirm step BEFORE the other tab
    // changes the name, so a background refresh of this page (Next may refetch
    // it) cannot pre-empt the attempt. Its Confirm then reaches the real
    // Server Function after the lock exists, and the database refuses.
    const staleName = `E2E_${rand(3)}`;
    await openEditor(page);
    await fillAndSave(page, staleName);
    await expect(page.getByTestId('username-confirm')).toBeVisible();

    const other = await context.newPage();
    await other.goto('/dashboard');
    await openEditor(other);
    await fillAndSave(other, secondName);
    await expect(other.getByTestId('username-confirm')).toContainText("won't be able to change it again for 7 days");
    await other.getByTestId('username-confirm').getByRole('button', { name: 'Confirm', exact: true }).click();
    await expect(other.getByTestId('signed-in-as')).toHaveText(secondName, { timeout: 30_000 });

    // The whitelist proof is that the name was accepted at all. Now locked.
    const expected = await localDateIn(other, 7);
    await expect(other.getByRole('button', { name: 'Edit username', exact: true })).toBeDisabled();
    await expect(other.getByTestId('username-locked')).toHaveText(`You can change your username again on ${expected}.`);
    await other.reload();
    await expect(other.getByTestId('username-locked')).toHaveText(`You can change your username again on ${expected}.`);
    await other.close();

    // Stale page: its confirm step is still open; the server function refuses.
    await page.getByTestId('username-confirm').getByRole('button', { name: 'Confirm', exact: true }).click();
    await expect(page.getByTestId('username-control').getByRole('alert')).toContainText('You can change your username again on', { timeout: 30_000 });
    await expect(page.getByTestId('username-locked')).toContainText(expected);
    await expect(page.getByRole('button', { name: 'Edit username', exact: true })).toBeDisabled();

    // Nothing was overwritten.
    await page.reload();
    await expect(page.getByTestId('signed-in-as')).toHaveText(secondName);
  });

  test('with a username: no (i) on the owner page, and the public card shows the name', async ({ page }) => {
    await page.goto(`/builds/${token}`);
    await expect(page.getByTestId('build-page')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('build-author')).toHaveText('You');
    await expect(page.getByTestId('username-hint')).toHaveCount(0);

    await page.goto('/builds?tab=public');
    const card = buildCard(page, buildName);
    await expect(card).toBeVisible({ timeout: 30_000 });
    await expect(card.getByTestId('build-card-badge')).toHaveText(`by ${secondName}`);
  });
});
