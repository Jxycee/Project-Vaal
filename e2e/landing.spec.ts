import { test, expect } from '@playwright/test';

// The public landing page with the gilded frame (C5 · Gilded glow, from the
// Vaal landing options canvas). Signed out, because the page is public.
// Guards the ways a decorative frame can break a page: it makes the page
// scroll sideways on a phone (the halo once did, 404px in a 375px viewport),
// it eats taps meant for the buttons, or it keeps animating for people who
// asked for less motion.
//
// Artifact: <test output dir>/landing-375.png and landing-1280.png.

test.use({ storageState: { cookies: [], origins: [] } });

test.describe('landing page, gilded frame', () => {
  test.skip(() => test.info().project.name !== 'mobile', 'mobile project only');

  test('375px: no horizontal scroll, buttons tappable through the frame, controls are 44px', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: 'Project Vaal' })).toBeVisible();

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, 'the page scrolls sideways').toBe(0);

    for (const name of ['Check prices', 'Sign in']) {
      const box = await page.getByRole('link', { name, exact: true }).boundingBox();
      expect(box!.height, `${name} tap target`).toBeGreaterThanOrEqual(44);
    }

    // The frame is decorative: hidden from assistive tech and never the hit target.
    const frame = page.locator('div.fixed.inset-0.z-0[aria-hidden="true"]');
    await expect(frame).toHaveCount(1);
    await expect(frame).toHaveCSS('pointer-events', 'none');
    await page.getByRole('link', { name: 'Check prices', exact: true }).click();
    await expect(page).toHaveURL(/\/prices/);

    await page.goto('/');
    await page.screenshot({ path: testInfo.outputPath('landing-375.png') });
  });

  test('1280px: frame and halo are drawn, title is gradient text, page does not scroll sideways', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: 'Project Vaal' })).toBeVisible();
    await expect(page.locator('.landing-frame-line')).toBeVisible();
    await expect(page.locator('.landing-halo')).toBeVisible();
    await expect(page.locator('.landing-title')).toHaveCSS('color', 'rgba(0, 0, 0, 0)');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBe(0);
    await page.screenshot({ path: testInfo.outputPath('landing-1280.png') });
  });

  test('reduced motion: nothing animates', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    for (const selector of ['.landing-frame-line', '.landing-halo', '.landing-title']) {
      await expect(page.locator(selector)).toHaveCSS('animation-name', 'none');
    }
  });
});
