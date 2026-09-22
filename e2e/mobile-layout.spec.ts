import { test, expect } from '@playwright/test';
import { openTree } from './helpers';

declare global {
  interface Window {
    /** Injected per page below — returns controls smaller than `min` in EITHER dimension. */
    __measureTapTargets?: (
      rootSelector: string,
      min: number,
    ) => { text: string; width: number; height: number }[];
  }
}

// Layout checks measured numerically rather than eyeballed from screenshots.
//
// Two reasons this is not a visual-diff suite. First, an assertion like "every
// tap target is at least 44px" is exact, whereas a screenshot can only suggest
// it. Second, a screenshot of a WebGL canvas differs across machines and GPUs,
// so pixel comparison here would be noise.
//
// Mobile-first is a project rule, not a preference: this app's users are
// console players on phones, so a failure at 375px is a real failure.

/** iOS/Android guidance both land on ~44px as the minimum comfortable target. */
const MIN_TAP_PX = 44;

test.describe('mobile layout', () => {
  // These assertions are about the 375px experience specifically, so they run
  // in the mobile project only rather than failing meaninglessly on desktop.
  test.skip(() => test.info().project.name !== 'mobile', 'mobile project only');

  // One measurer, injected before any page script runs, so both checks below
  // apply identical rules. It fails a control that is too small in EITHER
  // dimension — measuring only height is what let a 44px-tall, 20px-wide
  // button through review.
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.__measureTapTargets = (rootSelector: string, min: number) => {
        const root = document.querySelector(rootSelector) ?? document.body;
        return [...root.querySelectorAll<HTMLElement>('button, a[href]')]
          .map((el) => ({ el, r: el.getBoundingClientRect() }))
          // Ignore anything not actually rendered.
          .filter(({ r }) => r.width > 0 && r.height > 0 && (r.height < min || r.width < min))
          .map(({ el, r }) => ({
            text: (el.innerText || el.getAttribute('aria-label') || '').trim().slice(0, 40),
            width: Math.round(r.width),
            height: Math.round(r.height),
          }));
      };
    });
  });

  test('interactive controls meet the minimum tap target size', async ({ page }) => {
    await page.goto('/builds');
    await page.waitForLoadState('networkidle');

    // Scoped to <main>: the shared app chrome (header, bottom nav) is not this
    // page's concern and is asserted separately, so a chrome regression does
    // not fail every page's test at once.
    const tooSmall = await page.evaluate(
      (min) => window.__measureTapTargets!('main', min),
      MIN_TAP_PX,
    );
    expect(tooSmall, `controls under ${MIN_TAP_PX}px on /builds`).toEqual([]);
  });

  test('the tree sheets meet the minimum tap target size', async ({ page }) => {
    // The /builds check above cannot see any of this: the gear, jewels and gem
    // sheets live on /tree and render through a portal to document.body, well
    // outside <main>. That blind spot shipped a ~20px-wide support-remove
    // button that passed review precisely because the old check measured only
    // height, never width.
    await openTree(page);

    for (const chip of ['Gear', 'Jewels', 'Gems'] as const) {
      // Prefix match, not exact: these chips carry a state suffix in their
      // accessible name (e.g. "Jewels — allocate a socket on the tree").
      await page.getByRole('button', { name: new RegExp(`^${chip}`) }).click();
      const sheet = page.locator('.z-40');
      await expect(sheet).toBeVisible();

      const tooSmall = await page.evaluate(
        (min) => window.__measureTapTargets!('.z-40', min),
        MIN_TAP_PX,
      );
      expect(tooSmall, `controls under ${MIN_TAP_PX}px in the ${chip} sheet`).toEqual([]);

      await sheet.getByRole('button', { name: /^Close/ }).click();
      await expect(sheet).toBeHidden();
    }
  });

  test('tree overlays do not overlap each other at 375px', async ({ page }) => {
    await openTree(page);

    // TreeControls (left-3 top-3), BuildSavePanel (right-3 top-3) and the draft
    // prompt all live as absolute overlays on the same canvas. Their resting
    // positions must not collide, or one silently covers another on a phone.
    const overlaps = await page.evaluate(() => {
      const rects = [...document.querySelectorAll<HTMLElement>('.absolute.z-10')]
        .map((el) => ({
          label: (el.innerText || '').trim().slice(0, 30),
          r: el.getBoundingClientRect(),
        }))
        .filter((x) => x.r.width > 0 && x.r.height > 0);

      const hits: string[] = [];
      for (let i = 0; i < rects.length; i += 1) {
        for (let j = i + 1; j < rects.length; j += 1) {
          const a = rects[i].r;
          const b = rects[j].r;
          const intersects =
            a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
          if (intersects) hits.push(`${rects[i].label} ↔ ${rects[j].label}`);
        }
      }
      return hits;
    });

    expect(overlaps, 'overlapping tree overlays').toEqual([]);
  });

  test('no horizontal page scroll', async ({ page }) => {
    for (const path of ['/builds', '/tree']) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `horizontal overflow on ${path}`).toBeLessThanOrEqual(0);
    }
  });
});
