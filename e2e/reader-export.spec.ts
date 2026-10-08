import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { test, expect, type Page } from '@playwright/test';
import { e2eBaseUrl } from './baseUrl';
import { accessToken, callShareTokenRpc, cleanupWithFreshPage, importFixture, MIN_TAP_PX, readBuildId, setVisibility, testBuildName } from './helpers';

// Reader export: any viewer who can READ a build can export it as a Path of
// Building code and as the game's .build file, from an Export button on the
// build page (read mode), not only the owner from Build settings.
//
// How this can fail (decided before the code, per AGENTS.md):
//   1. The by-token actions are a new door onto build data. They must answer
//      exactly like the page: an unknown token, a malformed token and a build
//      the caller cannot read all get the SAME not-found text, so the action
//      is not an oracle for "this token exists but is owner-only".
//   2. Signed out: the action is reachable by a direct POST (a Server Function
//      is a public endpoint), so it must refuse by itself and leak nothing.
//   3. Vocabulary: `unlisted` is OWNER-ONLY and `private` is link-shareable
//      (visibility.ts; deliberate, do not "fix"). The reader branch must read
//      through the share-token RPCs, which filter visibility IN
//      ('public','private'): an unlisted build must come back empty from BOTH
//      the build RPC and the checkpoints RPC, and flipping it to private must
//      make both answer (the positive control that makes the empty answers
//      mean something).
//   4. A reader must not gain owner powers: the export sheet carries no
//      visibility, rename, tag or delete controls, and the Export entry does
//      not open Build settings.
//   5. The export must be the SAVED build named by the token, not whatever id
//      the client sends: the request carries the share token and the
//      checkpoint id only, never the build's uuid.
//   6. Tap targets under 44px, horizontal overflow at 375px, a sheet that cannot
//      be closed.
//   7. A replay harness that "passes" because every call errors: the replay
//      is first proven on the owner's own token (ok:true with a code) before
//      any refusal is believed.
//
// LIMIT, stated plainly: the suite has ONE account, and the owner always takes
// the page's owner path first (load.ts), so a genuine second-account reader
// cannot be driven end to end (same limit build-page-overview.spec.ts notes).
// What IS proven here: the UI and both actions through the real page as the
// owner (the action's owner branch); the refusals by replaying the captured
// Server Function call for an unknown token and signed out; and the reader
// branch's authorisation at the RPCs it calls, for an unlisted build (empty)
// and a private one (answers). The cross-account read itself is the RPCs'
// existing RLS contract, covered in sharing.spec.ts / build-settings.spec.ts.
//
// Artifact: <test output dir>/reader-export.json - the exported code length,
// the .build file's name and counts, and every refusal's response text, so a
// regression is a diff.
//
// Writes one E2E- build to the shared test account; deleted in afterAll.

const NOT_FOUND = "Couldn't find that build.";
const SIGN_IN = 'Sign in to export a build.';

interface Captured {
  url: string;
  actionId: string;
  args: unknown[];
}

/** POSTs a captured Server Function call again with `args` swapped in, from `page`'s own session. */
async function replay(page: Page, captured: Captured, args: unknown[]): Promise<{ status: number; body: string }> {
  const res = await page.request.post(captured.url, {
    headers: { 'next-action': captured.actionId, 'content-type': 'text/plain;charset=UTF-8', accept: 'text/x-component' },
    data: JSON.stringify(args),
    maxRedirects: 0,
  });
  return { status: res.status(), body: await res.text() };
}

test.describe('reader export', () => {
  test.skip(() => test.info().project.name !== 'mobile', 'mobile project only');
  test.describe.configure({ mode: 'serial' });
  test.use({ viewport: { width: 375, height: 812 } });
  test.setTimeout(300_000);

  const name = testBuildName('reader-export');
  let token = '';
  let buildId = '';
  let captured: Captured | null = null;
  const artifact: Record<string, unknown> = { name, refusals: {} as Record<string, unknown> };

  test.afterAll(async ({ browser }) => {
    await cleanupWithFreshPage(browser);
  });

  test('the Export button opens a sheet that makes a PoB code and a .build file, with 44px targets', async ({ page }) => {
    token = await importFixture(page, name);
    await page.goto(`/builds/${token}`);
    await expect(page.getByTestId('build-page')).toBeVisible({ timeout: 30_000 });
    // Starts owner-only; the later tests depend on it.
    await expect(page.getByTestId('build-visibility')).toContainText('Unlisted');

    // The build's uuid, to prove below that it never travels in the call.
    buildId = await readBuildId(page, name);
    await page.goto(`/builds/${token}`);
    await expect(page.getByTestId('build-page')).toBeVisible({ timeout: 30_000 });

    const open = page.getByRole('button', { name: 'Export build', exact: true });
    await expect(open).toBeVisible();
    const openBox = await open.boundingBox();
    expect(openBox!.height, 'Export button height').toBeGreaterThanOrEqual(MIN_TAP_PX);
    expect(openBox!.width, 'Export button width').toBeGreaterThanOrEqual(MIN_TAP_PX);

    // Not in edit mode: the owner has Build settings there, and unsaved edits are not exported.
    await page.goto(`/builds/${token}?edit=1`);
    await expect(page.getByTestId('build-page')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('button', { name: 'Export build', exact: true })).toHaveCount(0);
    await page.goto(`/builds/${token}`);
    await expect(page.getByTestId('build-page')).toBeVisible({ timeout: 30_000 });

    await page.getByRole('button', { name: 'Export build', exact: true }).click();
    const sheet = page.getByTestId('reader-export');
    await expect(sheet).toBeVisible();
    await expect(sheet).toHaveAttribute('role', 'dialog');
    // It is the export sheet and only that: none of Build settings' owner controls.
    await expect(page.getByTestId('build-settings')).toHaveCount(0);
    await expect(sheet.getByRole('radio')).toHaveCount(0);
    for (const owned of ['Delete build', 'Save name', 'Confirm delete']) {
      await expect(sheet.getByRole('button', { name: owned, exact: true })).toHaveCount(0);
    }

    // PoB code. Capture the Server Function call it makes.
    const codeButton = sheet.getByRole('button', { name: 'Export to Path of Building', exact: true });
    const request = page.waitForRequest((r) => r.method() === 'POST' && r.headers()['next-action'] !== undefined, { timeout: 60_000 });
    await codeButton.click();
    const sent = await request;
    const postData = sent.postData() ?? '';
    let args: unknown;
    try {
      args = JSON.parse(postData);
    } catch {
      throw new Error(`Server Function body is not a JSON array (multipart?), replay would need rewriting: ${postData.slice(0, 200)}`);
    }
    expect(Array.isArray(args), 'Server Function args').toBe(true);
    captured = { url: sent.url(), actionId: sent.headers()['next-action'], args: args as unknown[] };
    // Failure mode 5: the share token names the build; the uuid never travels.
    expect(captured.args[0]).toBe(token);
    expect(postData).not.toContain(buildId);

    const code = sheet.getByTestId('export-code');
    await expect(code).toBeVisible({ timeout: 60_000 });
    const text = await code.inputValue();
    expect(text.length, 'the exported code is empty or tiny').toBeGreaterThan(2_000);
    expect(text).toMatch(/^[A-Za-z0-9_-]+=*$/);
    artifact.codeLength = text.length;

    // The same result UI as Build settings: Copy, and the "things to know" report when there is one.
    const copy = sheet.getByRole('button', { name: 'Copy code', exact: true });
    await expect(copy).toBeVisible();
    const report = sheet.getByTestId('export-report');
    if ((await report.count()) > 0) {
      await report.locator('summary').click();
      artifact.report = await report.locator('li').allInnerTexts();
    }

    // .build file.
    await sheet.getByRole('button', { name: "Export for the game's Build Planner", exact: true }).click();
    const json = sheet.getByTestId('build-file-json');
    await expect(json).toBeVisible({ timeout: 60_000 });
    const file = JSON.parse(await json.inputValue()) as { name: string; passives: unknown[]; skills: unknown[] };
    expect(file.name).toBe(name);
    expect(Array.isArray(file.passives) && file.passives.length, 'the .build file has no passives').toBeGreaterThan(0);
    expect(Array.isArray(file.skills), 'the .build file has no skills array').toBe(true);
    artifact.buildFile = { name: file.name, passives: file.passives.length, skills: file.skills.length };

    const downloadButton = sheet.getByRole('button', { name: 'Download .build', exact: true });
    const [download] = await Promise.all([page.waitForEvent('download'), downloadButton.click()]);
    expect(download.suggestedFilename()).toMatch(/\.build$/);
    await expect(sheet.getByRole('button', { name: 'Copy JSON', exact: true })).toBeVisible();

    // 44px targets for every control in the sheet, and no sideways scroll at 375px.
    for (const control of [
      sheet.getByRole('button', { name: 'Close export', exact: true }),
      codeButton,
      copy,
      sheet.getByRole('button', { name: "Export for the game's Build Planner", exact: true }),
      downloadButton,
      sheet.getByRole('button', { name: 'Copy JSON', exact: true }),
    ]) {
      const b = await control.boundingBox();
      expect(b!.height, 'tap target height').toBeGreaterThanOrEqual(MIN_TAP_PX);
    }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, 'horizontal overflow with the export sheet open').toBeLessThanOrEqual(0);

    // Closes by button and by Escape.
    await sheet.getByRole('button', { name: 'Close export', exact: true }).click();
    await expect(sheet).toBeHidden();
    await page.getByRole('button', { name: 'Export build', exact: true }).click();
    await expect(sheet).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();

    // The owner still has the settings entry, with its own export section untouched.
    await page.getByRole('button', { name: 'Build settings', exact: true }).click();
    const settings = page.getByTestId('build-settings');
    await expect(settings.getByTestId('export-section')).toBeVisible();
    await expect(settings.getByRole('button', { name: 'Export to Path of Building', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Close build settings', exact: true }).click();

  });

  test('replay positive control, then an unknown or malformed token gets one identical not-found answer', async ({ page }) => {
    expect(captured, 'the first test captures the Server Function call').not.toBeNull();
    await page.goto('/builds');

    // Control: the replay of the owner's own token works, so a refusal below is the action's, not the harness's.
    const good = await replay(page, captured!, [token, null]);
    expect(good.status).toBe(200);
    expect(good.body).toContain('"ok":true');
    expect(good.body).toContain('"code":"');

    // Same shape as a real token (21 chars of the alphabet) but not a build; and junk that fails the shape check.
    const unknown = await replay(page, captured!, ['A'.repeat(21), null]);
    const junk = await replay(page, captured!, ['not-a-token', null]);
    const wrongType = await replay(page, captured!, [{ evil: true }, null]);
    for (const [label, r] of [['unknown', unknown], ['junk', junk], ['wrongType', wrongType]] as const) {
      expect(r.body, `${label} token must not export`).not.toContain('"ok":true');
      expect(r.body, `${label} token must not carry a code`).not.toContain('"code"');
      expect(r.body, `${label} token answer`).toContain(NOT_FOUND);
    }
    // Existence is not an oracle: the answers are indistinguishable.
    const verdict = (b: string) => b.slice(b.indexOf('"ok":false'));
    expect(verdict(unknown.body)).toBe(verdict(junk.body));
    expect(verdict(unknown.body)).toBe(verdict(wrongType.body));

    // A real token with a malformed checkpoint id is refused before any load, and exports nothing.
    const badCheckpoint = await replay(page, captured!, [token, 'not-a-uuid']);
    expect(badCheckpoint.body).not.toContain('"code":"');
    expect(badCheckpoint.body).toContain('"ok":false');

    (artifact.refusals as Record<string, unknown>).unknownToken = verdict(unknown.body);
    (artifact.refusals as Record<string, unknown>).junkToken = verdict(junk.body);
    (artifact.refusals as Record<string, unknown>).wrongType = verdict(wrongType.body);
  });

  test('signed out: the page redirects to login with no Export button, and a direct call exports nothing', async ({ browser }) => {
    expect(captured, 'the first test captures the Server Function call').not.toBeNull();
    const context = await browser.newContext({ baseURL: e2eBaseUrl(), storageState: { cookies: [], origins: [] }, viewport: { width: 375, height: 812 } });
    try {
      const page = await context.newPage();
      await page.goto(`/builds/${token}`);
      await expect.poll(() => new URL(page.url()).pathname).toBe('/login');
      await expect(page.getByRole('button', { name: 'Export build', exact: true })).toHaveCount(0);

      // The page being unreachable is not the guard: a Server Function is a public POST. It must refuse by itself.
      const res = await context.request.post(`${e2eBaseUrl()}${new URL(captured!.url).pathname}`, {
        headers: { 'next-action': captured!.actionId, 'content-type': 'text/plain;charset=UTF-8', accept: 'text/x-component' },
        data: JSON.stringify([token, null]),
        maxRedirects: 0,
      });
      const body = await res.text();
      expect(body, 'a signed-out call must not return a code').not.toContain('"code"');
      expect(body, 'a signed-out call must not return the build').not.toContain(name);
      expect(body).not.toContain('"ok":true');
      // Either the action's own refusal, or the proxy turned the request away before it ran; both are refusals.
      const refused = body.includes(SIGN_IN) || res.status() >= 300;
      expect(refused, `signed-out call was neither refused by the action nor redirected (status ${res.status()})`).toBe(true);
      (artifact.refusals as Record<string, unknown>).signedOut = { status: res.status(), signIn: body.includes(SIGN_IN) };
    } finally {
      await context.close();
    }
  });

  test('an unlisted build is empty at both share-token RPCs the reader branch uses, and a private one answers', async ({ page }) => {
    // The suite has one account, so "someone else's unlisted build" is proven at the reader's own door: the
    // two RPCs load.ts's reader path (and so the export action) goes through. Unlisted = owner only here.
    await page.goto('/builds');
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    expect(supabaseUrl && anon, 'Supabase env must be in .env.local').toBeTruthy();
    const checkpointRows = async (): Promise<unknown[]> => {
      const res = await page.request.post(`${supabaseUrl}/rest/v1/rpc/get_build_checkpoints_by_share_token`, {
        data: { p_token: token },
        headers: { apikey: anon, authorization: `Bearer ${await accessToken(page)}`, 'content-type': 'application/json' },
      });
      expect(res.status()).toBe(200);
      return (await res.json()) as unknown[];
    };

    // Positive control first would need private; do the empty (unlisted) answers, then flip and see both answer.
    const buildWhileUnlisted = await callShareTokenRpc(page, token);
    expect(buildWhileUnlisted.status()).toBe(200);
    expect(await buildWhileUnlisted.json()).toEqual([]);
    expect(await checkpointRows(), 'unlisted checkpoints must not leak through the RPC').toEqual([]);

    await setVisibility(page, token, 'private');
    await page.goto('/builds');
    const buildWhilePrivate = (await (await callShareTokenRpc(page, token)).json()) as { name: string }[];
    expect(buildWhilePrivate.map((r) => r.name)).toEqual([name]);
    expect((await checkpointRows()).length, 'a link-shared build exposes its checkpoints to a reader').toBeGreaterThan(0);

    // The owner's export still works on a link-shared build (owner branch first), unchanged by the visibility.
    await page.goto(`/builds/${token}`);
    await expect(page.getByTestId('build-page')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('build-visibility')).toContainText('Private');
    await page.getByRole('button', { name: 'Export build', exact: true }).click();
    await page.getByTestId('reader-export').getByRole('button', { name: 'Export to Path of Building', exact: true }).click();
    await expect(page.getByTestId('reader-export').getByTestId('export-code')).toBeVisible({ timeout: 60_000 });

    // And revoking again returns the RPCs to empty: the export follows visibility, nothing cached.
    await page.getByRole('button', { name: 'Close export', exact: true }).click();
    await setVisibility(page, token, 'unlisted');
    await page.goto('/builds');
    expect(await (await callShareTokenRpc(page, token)).json()).toEqual([]);
    expect(await checkpointRows()).toEqual([]);
  });

  test('write the artifact', async ({}, testInfo) => {
    const file = path.join(testInfo.outputDir, 'reader-export.json');
    mkdirSync(testInfo.outputDir, { recursive: true });
    writeFileSync(file, JSON.stringify(artifact, null, 2));
    await testInfo.attach('reader-export', { path: file, contentType: 'application/json' });
  });
});
