import { test, expect } from '@playwright/test';
import { closeGemEditor, openEditor, openTree } from './helpers';

declare global {
  interface Window {
    /**
     * Injected per page below. Reports how many controls it looked at as well
     * as which ones are smaller than `min` in EITHER dimension — the count is
     * what stops an empty root from reading as a clean pass.
     */
    __measureTapTargets?: (
      rootSelector: string,
      min: number,
    ) => { scanned: number; tooSmall: { text: string; width: number; height: number }[] };
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
//
// Every check here is a measurement over a set of elements, which is the shape
// of assertion that passes loudest when it is measuring nothing at all — a
// renamed class or a page that failed to render leaves an empty set, and an
// empty set has no violations in it. So each one first asserts that it found
// something to measure.

/** iOS/Android guidance both land on ~44px as the minimum comfortable target. */
const MIN_TAP_PX = 44;

test.describe('mobile layout', () => {
  // These assertions are about the 375px experience specifically, so they run
  // in the mobile project only rather than failing meaninglessly on desktop.
  // The desktop project is scoped away from this file in playwright.config.ts
  // as well; this guard keeps the intent readable from here.
  test.skip(() => test.info().project.name !== 'mobile', 'mobile project only');

  // One measurer, injected before any page script runs, so both checks below
  // apply identical rules. It fails a control that is too small in EITHER
  // dimension — measuring only height is what let a 44px-tall, 20px-wide
  // button through review.
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.__measureTapTargets = (rootSelector: string, min: number) => {
        const root = document.querySelector(rootSelector) ?? document.body;
        const controls = [...root.querySelectorAll<HTMLElement>('button, a[href]')]
          .map((el) => ({ el, r: el.getBoundingClientRect() }))
          // Ignore anything not actually rendered.
          .filter(({ r }) => r.width > 0 && r.height > 0);
        return {
          scanned: controls.length,
          tooSmall: controls
            .filter(({ r }) => r.height < min || r.width < min)
            .map(({ el, r }) => ({
              text: (el.innerText || el.getAttribute('aria-label') || '').trim().slice(0, 40),
              width: Math.round(r.width),
              height: Math.round(r.height),
            })),
        };
      };
    });
  });

  // /builds' tap targets (the whole of <main>, populated) and its horizontal
  // overflow are asserted by library.spec.ts "cards: one link each...".

  test('the build page editors meet the minimum tap target size', async ({ page }) => {
    // The /builds check above cannot see any of this: the jewels and gem-group
    // sheets render through a portal to document.body, well outside <main>,
    // and the Gear tab is on the scratch planner at /tree. That blind spot
    // shipped a ~20px-wide support-remove button that passed review precisely
    // because the old check measured only height, never width.
    await openTree(page);

    const measure = async (selector: string, label: string) => {
      const result = await page.evaluate(
        ({ sel, min }) => window.__measureTapTargets!(sel, min),
        { sel: selector, min: MIN_TAP_PX },
      );
      expect(result.scanned, `no controls found in the ${label}`).toBeGreaterThan(0);
      expect(result.tooSmall, `controls under ${MIN_TAP_PX}px in the ${label}`).toEqual([]);
    };

    // Gear tab: paper doll, slot detail, jewels section.
    await openEditor(page, 'gear');
    await measure('[data-testid="gear-tab"]', 'Gear tab');

    // Jewels sheet.
    await openEditor(page, 'jewels');
    const jewels = page.locator('.z-40');
    await expect(jewels).toBeVisible();
    await measure('.z-40', 'jewels sheet');
    await jewels.getByRole('button', { name: /^Close/ }).click();
    await expect(jewels).toBeHidden();

    // Gem group sheet, on a fresh group.
    await openEditor(page, 'gems');
    await page.getByRole('button', { name: '+ Add skill group' }).click();
    await expect(page.getByTestId('gem-group-sheet')).toBeVisible();
    await measure('[data-testid="gem-group-sheet"]', 'gem group sheet');
    await closeGemEditor(page);
  });

  test('tree overlays stay inside the canvas at 375px', async ({ page }) => {
    await openTree(page);

    // TreeControls (left-3 top-3) is an absolute overlay on the canvas. It has
    // to sit fully inside the tree tab's own box, or it is covering (or hanging
    // off) the page chrome around it. It used to be compared against
    // BuildSavePanel and the chip row, the other overlays of the old editor,
    // which no longer exist; the build page's controls are ordinary flow
    // content above the canvas.
    const { measured, outside } = await page.evaluate(() => {
      const canvas = document.querySelector<HTMLElement>('[data-testid="tree-tab"]')!.getBoundingClientRect();
      const rects = [...document.querySelectorAll<HTMLElement>('[data-testid="tree-tab"] .absolute.z-10')]
        .map((el) => ({ label: (el.innerText || '').trim().slice(0, 30), r: el.getBoundingClientRect() }))
        .filter((x) => x.r.width > 0 && x.r.height > 0);
      const bad = rects
        .filter(({ r }) => r.left < canvas.left - 1 || r.right > canvas.right + 1 || r.top < canvas.top - 1 || r.bottom > canvas.bottom + 1)
        .map((x) => x.label);
      return { measured: rects.length, outside: bad };
    });

    // Fewer than one means the `.absolute.z-10` convention moved and this test
    // is now comparing an empty list against an empty list.
    expect(measured, 'expected at least one z-10 overlay on the tree').toBeGreaterThanOrEqual(1);
    expect(outside, 'tree overlays outside the canvas').toEqual([]);

    // /tree must not scroll sideways either (waits on the canvas hook, not networkidle).
    await expectNoOverflow(page, '/tree');
  });
});

async function expectNoOverflow(page: import('@playwright/test').Page, label: string) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, `horizontal overflow on ${label}`).toBeLessThanOrEqual(0);
}
