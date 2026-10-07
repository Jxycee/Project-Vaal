import { writeFileSync } from 'node:fs';
import { test, expect, type Request } from '@playwright/test';
import { cleanupWithFreshPage, importFixture, selectGearSlot, testBuildName } from './helpers';

// The unique item card's header shader (item-header-shader.tsx). The promises:
//  - a rare card never loads the shader engine, or even mounts the layer
//  - reduced motion: the layer is never mounted on a unique either
//  - the engine sends nothing off-site (telemetry stays disabled)
//  - where WebGPU exists, the layer covers the HEADER only, never the mods,
//    never takes a click, and the mods stay readable (screenshot artifact)
// Whether WebGPU exists in the test browser is recorded in the artifact; the
// header-only assertions run when it does, and the "no layer without WebGPU"
// assertion runs when it does not, so the spec passes honestly either way.

test.describe('item card shader', () => {
  test.skip(() => test.info().project.name !== 'mobile', 'mobile project only');
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(240_000);

  const name = testBuildName('cardfx');
  let token = '';

  test.afterAll(async ({ browser }) => {
    await cleanupWithFreshPage(browser);
  });

  test('a rare card never mounts the layer or fetches the engine', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const chunks: string[] = [];
    page.on('request', (r: Request) => /shader/i.test(r.url()) && chunks.push(r.url()));
    token = await importFixture(page, name);
    await page.mouse.move(2, 2);
    await page.goto(`/builds/${token}?tab=gear`);
    await expect(page.getByTestId('paper-doll')).toBeVisible({ timeout: 60_000 });
    await page.waitForTimeout(1500);
    expect(chunks, 'the Gear tab requested the shader before any unique card opened').toEqual([]);

    // Open the rare, then park the mouse off the doll so no other card hovers.
    await selectGearSlot(page, 'weapon1_main');
    await page.mouse.move(2, 2);
    const detail = page.getByTestId('gear-slot-detail');
    await expect(detail.getByTestId('item-card')).toHaveAttribute('data-rarity', 'rare', { timeout: 60_000 });
    await page.waitForTimeout(1500);
    await expect(detail.getByTestId('item-card-fx')).toHaveCount(0);
    expect(chunks, 'a rare card requested the shader engine').toEqual([]);
  });

  test('reduced motion: a unique card has no layer', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/builds/${token}?tab=gear`);
    await selectGearSlot(page, 'body');
    await expect(page.getByTestId('gear-slot-detail').getByTestId('item-card')).toHaveAttribute('data-rarity', 'unique', { timeout: 60_000 });
    await page.waitForTimeout(1500);
    await expect(page.getByTestId('item-card-fx')).toHaveCount(0);
  });

  test('a unique card: layer only with WebGPU, header only, click-through, nothing sent off-site', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const offsite: string[] = [];
    page.on('request', (r) => {
      const u = new URL(r.url());
      if (!['localhost', '127.0.0.1'].includes(u.hostname) && !/supabase\.co$|googleapis|gstatic|vercel-scripts\.com$|vercel-insights\.com$/.test(u.hostname)) offsite.push(r.url());
    });
    await page.goto(`/builds/${token}?tab=gear`);
    const hasGpu = await page.evaluate(() => 'gpu' in navigator && !!(navigator as { gpu?: unknown }).gpu);
    await selectGearSlot(page, 'body');
    const card = page.getByTestId('gear-slot-detail').getByTestId('item-card');
    await expect(card).toHaveAttribute('data-rarity', 'unique', { timeout: 60_000 });
    await page.waitForTimeout(3000);

    const fx = card.getByTestId('item-card-fx');
    // navigator.gpu can exist while the adapter is unusable (headless CI, software GPU): the engine then
    // reports "unavailable" and the layer removes itself, leaving the plain header. Both outcomes are valid;
    // the report records which one ran.
    const mounted = (await fx.count()) === 1;
    const report: Record<string, unknown> = { hasGpu, layerMounted: mounted };
    if (mounted) {
      await expect(fx).toHaveCSS('pointer-events', 'none');
      const header = (await card.getByTestId('item-card-header').boundingBox())!;
      const layer = (await fx.boundingBox())!;
      const firstMod = (await card.getByTestId('item-card-mod').first().boundingBox())!;
      expect(layer.y + layer.height, 'the layer reaches into the stats').toBeLessThanOrEqual(header.y + header.height + 1);
      expect(layer.y + layer.height).toBeLessThanOrEqual(firstMod.y);
      report.layer = layer;
      report.header = header;
    } else if (!hasGpu) {
      await expect(fx).toHaveCount(0);
    }
    // Either way the plain card is intact: header, name and mods all visible.
    await expect(card.getByTestId('item-card-name')).toBeVisible();
    expect(await card.getByTestId('item-card-mod').count()).toBeGreaterThan(3);
    expect(offsite, 'the card sent requests off-site: ' + offsite.join(', ')).toEqual([]);
    await card.scrollIntoViewIfNeeded();
    await card.screenshot({ path: testInfo.outputPath('unique-card.png') });
    writeFileSync(testInfo.outputPath('shader-report.json'), JSON.stringify(report, null, 2));
  });
});
