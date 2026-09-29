import { test, expect, type Locator, type Page } from '@playwright/test';
import {
  cleanupWithFreshPage,
  importFixture,
  measureTapTargets,
  testBuildName,
} from './helpers';

// Slice 4 of the build-profile redesign
// (docs/superpowers/specs/2026-09-27-build-profile-redesign-design.md §3
// decision 9, §5.2, §5.4, §10 slice 4; plan
// docs/superpowers/plans/2026-09-28-build-page-slice4-paper-doll.md): the
// Gear tab's flat read list and full-screen GearSheet are replaced by a
// paper doll — 15 tappable cells (13 fixed slots + the active weapon set's
// main/off), a Set I / Set II toggle, a detail panel for the tapped slot,
// and a collapsed warnings chip. Written FIRST — the app code lands in
// task 3 of the plan, so every test below is expected to fail until then,
// starting at the very first `doll-slot-*` assertion, which does not exist
// yet (before slice 4 the Gear tab rendered a flat read list instead).
//
// Contract this spec pins (task-1-brief.md, plan Global Constraints):
//   - `doll-slot-<slot>` on each cell button, aria-label
//     "<label>: <name or Empty>", aria-pressed for the selected cell.
//   - Weapon cells are keyed by the active set: `doll-slot-weapon{1|2}_main`
//     / `doll-slot-weapon{1|2}_off` — never both sets' ids on screen at once.
//   - The Set I / Set II toggle: buttons named exactly "Set I" / "Set II".
//   - Tapping a cell opens `gear-slot-detail` below the doll. In edit mode
//     it adds buttons "Choose item", "Edit affixes" (item only) and "Clear"
//     (item only); in read mode none of the three render.
//   - "Choose item" opens the existing standalone ItemPickerSheet (`.z-50`,
//     "Search items…" placeholder, `ul li button` results) — same shape
//     sharing.spec.ts's and build-page-edit.spec.ts's pickFirstItem drive,
//     just opened from the detail panel instead of a GearSheet row.
//   - "Edit affixes" opens the existing item editor (`data-testid=
//     "item-editor"`, "Close item editor" button).
//   - `gear-warnings` is the collapsed warnings chip; expanding it renders
//     the full list, each item keeping `data-testid="build-warning"`.
//   - Existing per-slot ids survive by mechanism only: `gear-craft-<slot>`,
//     `gear-warning-<slot>`, `gear-note-<slot>`, `gear-occupied-<slot>`.
//
// Uses the 8-checkpoint PoB fixture pob-import.spec.ts already proves — its
// LAST checkpoint (level 94) is the one with real gear:
// gear-craft-weapon1_main reads "rare · 6 affixes · 2 runes" and
// gear-craft-body reads "unique · 0 affixes · 2 runes" there, which is also
// why the weapon set toggle's default (the build's headlineSet) is expected
// to show Set I / weapon1_* on this fixture.

/**
 * `page.goto`, tolerant of one `net::ERR_ABORTED`. Copied from
 * build-page-edit.spec.ts / build-page-checkpoints.spec.ts — Next's dev
 * server can fire an HMR full reload of the page being navigated away from
 * at the exact moment `goto` is called.
 */
async function goto(page: Page, url: string): Promise<void> {
  try {
    await page.goto(url);
  } catch (err) {
    if (!/ERR_ABORTED/.test(String(err))) throw err;
    await page.goto(url);
  }
}

function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

/**
 * Opens the item picker from `opener`, takes the first result, and returns
 * its name (minus the picker's " Unique" suffix), asserting `subject`
 * (a doll cell here, not a GearSheet row) picks it up. Copied from
 * sharing.spec.ts's / build-page-edit.spec.ts's private `pickFirstItem` —
 * the picker itself (ItemPickerSheet) is unchanged by this slice, only
 * where it is opened from.
 */
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

/** The item name out of a doll cell's `aria-label="<label>: <name or Empty>"` (Task 3's contract). */
async function cellItemName(cell: Locator): Promise<string> {
  const label = (await cell.getAttribute('aria-label')) ?? '';
  const match = label.match(/:\s*(.+)$/);
  return match?.[1]?.trim() ?? '';
}

test.describe('build page gear paper doll', () => {
  test.skip(() => test.info().project.name !== 'mobile', 'mobile project only');
  test.describe.configure({ mode: 'serial' });
  test.use({ viewport: { width: 375, height: 812 } });
  test.setTimeout(300_000);

  const name = testBuildName('gear-doll');
  let token = '';
  let lastCheckpointId = '';
  /** Set I's weapon cell text, captured in test 2 — the pairing test 6 checks against. */
  let weapon1MainSnapshot = '';

  test.afterAll(async ({ browser }) => {
    await cleanupWithFreshPage(browser);
  });

  test('the doll fits a phone', async ({ page }) => {
    token = await importFixture(page, name);

    await goto(page, `/builds/${token}`);
    await expect(page.getByTestId('build-page')).toBeVisible({ timeout: 30_000 });

    await page.getByTestId('checkpoint-switcher').click();
    const options = page.getByTestId('checkpoint-option');
    await expect(options).toHaveCount(8);
    lastCheckpointId = (await options.last().getAttribute('data-checkpoint-id'))!;
    expect(lastCheckpointId, 'no last checkpoint id read from the switcher').toBeTruthy();

    await goto(page, `/builds/${token}?checkpoint=${lastCheckpointId}&tab=gear`);
    await expect(page.getByTestId('gear-tab')).toBeVisible({ timeout: 30_000 });

    const cells = page.locator('[data-testid^="doll-slot-"]');
    await expect(cells).toHaveCount(15);

    let sawImg = false;
    const count = await cells.count();
    for (let i = 0; i < count; i++) {
      const cell = cells.nth(i);
      const box = await cell.boundingBox();
      expect(box, `doll cell ${i} has no bounding box`).not.toBeNull();
      expect(box!.width, `doll cell ${i} narrower than 44px`).toBeGreaterThanOrEqual(44);
      expect(box!.height, `doll cell ${i} shorter than 44px`).toBeGreaterThanOrEqual(44);
      expect(box!.x, `doll cell ${i} left edge off-screen`).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width, `doll cell ${i} right edge off-screen`).toBeLessThanOrEqual(375);
      if ((await cell.locator('img').count()) > 0) sawImg = true;
    }
    // Positive pairing: at least one cell actually renders an icon, so the
    // 15-count above cannot be quietly satisfied by 15 empty placeholders.
    expect(sawImg, 'no doll cell rendered an <img> — expected at least one filled slot').toBe(true);

    expect(await horizontalOverflow(page), 'horizontal overflow on the Gear tab doll').toBeLessThanOrEqual(0);
  });

  test('the weapon set toggle swaps the weapon cells, not just their contents', async ({ page }) => {
    await goto(page, `/builds/${token}?checkpoint=${lastCheckpointId}&tab=gear`);
    await expect(page.getByTestId('gear-tab')).toBeVisible({ timeout: 30_000 });

    // Ensure Set I is the one showing before reading it — the fixture's
    // crafted weapon lives in weapon1_main (pob-import.spec.ts pins this on
    // the same last checkpoint), so this is also the positive half of this
    // test: a real, non-empty cell.
    await page.getByRole('button', { name: 'Set I', exact: true }).click();
    const setIWeapon = page.getByTestId('doll-slot-weapon1_main');
    await expect(setIWeapon).toBeVisible();
    weapon1MainSnapshot = ((await setIWeapon.textContent()) ?? '').trim();
    expect(weapon1MainSnapshot.length, 'Set I weapon cell has no text').toBeGreaterThan(0);

    await page.getByRole('button', { name: 'Set II', exact: true }).click();
    await expect(page.getByTestId('doll-slot-weapon2_main')).toBeVisible();
    await expect(page.getByTestId('doll-slot-weapon2_off')).toBeVisible();
    // Negative, paired with the positive above: the Set I ids are gone
    // entirely, not just hidden — a real id swap, not a CSS toggle.
    await expect(page.getByTestId('doll-slot-weapon1_main')).toHaveCount(0);
    await expect(page.getByTestId('doll-slot-weapon1_off')).toHaveCount(0);

    // The fixture may have nothing in Set II — don't invent data, just
    // assert the cell reads something sane (a name, or "Empty").
    const setIIMainText = ((await page.getByTestId('doll-slot-weapon2_main').textContent()) ?? '').trim();
    expect(setIIMainText.length, 'Set II weapon cell has no text at all').toBeGreaterThan(0);
  });

  test('tapping a cell in read mode shows the detail panel only', async ({ page }) => {
    await goto(page, `/builds/${token}?checkpoint=${lastCheckpointId}&tab=gear`);
    await expect(page.getByTestId('gear-tab')).toBeVisible({ timeout: 30_000 });

    const bodyCell = page.getByTestId('doll-slot-body');
    const itemName = await cellItemName(bodyCell);
    // The last checkpoint's body armour is known non-empty (pob-import.spec.ts:
    // gear-craft-body reads "unique · 0 affixes · 2 runes" there).
    expect(itemName, 'body cell aria-label carried no item name').toBeTruthy();
    expect(itemName).not.toBe('Empty');

    await bodyCell.click();
    const detail = page.getByTestId('gear-slot-detail');
    await expect(detail).toBeVisible();
    await expect(detail).toContainText(itemName);

    // Negative: none of the edit-only controls render for a reader.
    await expect(detail.getByRole('button', { name: 'Choose item', exact: true })).toHaveCount(0);
    await expect(detail.getByRole('button', { name: 'Edit affixes', exact: true })).toHaveCount(0);
    await expect(detail.getByRole('button', { name: 'Clear', exact: true })).toHaveCount(0);
  });

  test('tapping the lowest cell brings the detail panel fully into view', async ({ page }) => {
    await goto(page, `/builds/${token}?checkpoint=${lastCheckpointId}&tab=gear`);
    await expect(page.getByTestId('gear-tab')).toBeVisible({ timeout: 30_000 });
    await page.evaluate(() => window.scrollTo(0, 0));

    // charm3 sits on the doll's last row, so the detail panel opens below it.
    // Park the cell just above the fixed bottom nav, as a thumb reaching for
    // the last row would find it: the tap needs no scroll of its own, so only
    // the app can bring the detail panel into view.
    const charm = page.getByTestId('doll-slot-charm3');
    await charm.scrollIntoViewIfNeeded();
    await page.evaluate(() => {
      const r = document.querySelector('[data-testid="doll-slot-charm3"]')!.getBoundingClientRect();
      window.scrollBy(0, r.bottom - (window.innerHeight - 80));
    });
    const charmBox = await charm.boundingBox();
    expect(charmBox, 'charm3 has no bounding box').not.toBeNull();
    expect(charmBox!.y + charmBox!.height, 'charm3 is not near the screen bottom, so this proves nothing').toBeGreaterThanOrEqual(812 - 100);
    // A raw mouse tap at the cell's centre: locator.click() would scroll the
    // cell into view first, and mask the very thing under test.
    await page.mouse.click(charmBox!.x + charmBox!.width / 2, charmBox!.y + charmBox!.height / 2);
    const detail = page.getByTestId('gear-slot-detail');
    await expect(detail).toBeVisible();
    // Fully inside the viewport AND not hidden behind the fixed bottom nav:
    // the panel's own bottom edge must be what is drawn there.
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const el = document.querySelector('[data-testid="gear-slot-detail"]')!;
            const r = el.getBoundingClientRect();
            if (r.top < 0 || r.bottom > window.innerHeight) return false;
            const hit = document.elementFromPoint(r.left + r.width / 2, r.bottom - 2);
            return hit !== null && el.contains(hit);
          }),
        { message: 'detail panel never came fully into view (inside 375x812 and clear of the bottom nav)', timeout: 10_000 },
      )
      .toBe(true);
  });

  test('the warnings chip count matches the expanded list', async ({ page }) => {
    await goto(page, `/builds/${token}?checkpoint=${lastCheckpointId}&tab=gear`);
    await expect(page.getByTestId('gear-tab')).toBeVisible({ timeout: 30_000 });

    const chip = page.getByTestId('gear-warnings');
    await expect(chip).toBeVisible();
    const chipText = ((await chip.textContent()) ?? '').trim();
    const match = chipText.match(/(\d+)/);
    expect(match, `warnings chip carried no count ("${chipText}")`).not.toBeNull();
    const n = Number(match![1]);
    // This fixture is known to carry structural warnings (plan Review Focus
    // §5) — a 0 here means the chip itself is broken, not that the build is
    // clean.
    expect(n, 'expected the imported fixture to have at least one warning').toBeGreaterThan(0);

    await chip.click();
    await expect(page.getByTestId('build-warning')).toHaveCount(n);
  });

  test('choose an item, edit its affixes, save, and it survives a reload', async ({ page }) => {
    await goto(page, `/builds/${token}?edit=1&tab=gear&checkpoint=${lastCheckpointId}`);
    await expect(page.getByTestId('build-page')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('gear-tab')).toBeVisible();

    await page.getByTestId('doll-slot-boots').click();
    const detail = page.getByTestId('gear-slot-detail');
    await expect(detail).toBeVisible();

    const chooseButton = detail.getByRole('button', { name: 'Choose item', exact: true });
    const bootsName = await pickFirstItem(page, chooseButton, page.getByTestId('doll-slot-boots'));

    // With an item in the slot the owner has all three controls (Choose item,
    // Edit affixes, Clear); each must be a >= 44px tap target.
    const taps = await measureTapTargets(page, '[data-testid="gear-slot-detail"]');
    expect(taps.scanned, 'detail panel controls were not measured').toBeGreaterThanOrEqual(3);
    expect(taps.tooSmall, 'detail panel controls under 44px').toEqual([]);

    await detail.getByRole('button', { name: 'Edit affixes', exact: true }).click();
    const editor = page.getByTestId('item-editor');
    await expect(editor).toBeVisible();
    await editor.getByRole('button', { name: 'Close item editor' }).click();
    await expect(editor).toBeHidden();

    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByTestId('save-status')).toHaveText(/^Saved /, { timeout: 30_000 });

    await goto(page, `/builds/${token}?tab=gear&checkpoint=${lastCheckpointId}`);
    await expect(page.getByTestId('gear-tab')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('doll-slot-boots')).toContainText(bootsName);
  });

  test('choosing into Set II writes weapon2, and leaves Set I untouched', async ({ page }) => {
    expect(weapon1MainSnapshot, 'no Set I snapshot carried over from the set-toggle test').toBeTruthy();

    await goto(page, `/builds/${token}?edit=1&tab=gear&checkpoint=${lastCheckpointId}`);
    await expect(page.getByTestId('gear-tab')).toBeVisible({ timeout: 30_000 });

    await page.getByRole('button', { name: 'Set II', exact: true }).click();
    await expect(page.getByTestId('doll-slot-weapon2_main')).toBeVisible();

    await page.getByTestId('doll-slot-weapon2_main').click();
    const detail = page.getByTestId('gear-slot-detail');
    await expect(detail).toBeVisible();
    const chooseButton = detail.getByRole('button', { name: 'Choose item', exact: true });
    const weapon2Name = await pickFirstItem(page, chooseButton, page.getByTestId('doll-slot-weapon2_main'));

    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByTestId('save-status')).toHaveText(/^Saved /, { timeout: 30_000 });

    await goto(page, `/builds/${token}?tab=gear&checkpoint=${lastCheckpointId}`);
    await expect(page.getByTestId('gear-tab')).toBeVisible({ timeout: 30_000 });

    await page.getByRole('button', { name: 'Set II', exact: true }).click();
    await expect(page.getByTestId('doll-slot-weapon2_main')).toContainText(weapon2Name);

    // Pair it: Set I's weapon cell — never touched this test — reads exactly
    // what test 2 captured before any of this ran.
    await page.getByRole('button', { name: 'Set I', exact: true }).click();
    const setIWeaponText = ((await page.getByTestId('doll-slot-weapon1_main').textContent()) ?? '').trim();
    expect(setIWeaponText).toBe(weapon1MainSnapshot);
  });

  test('clear empties the slot, and it stays empty after a reload', async ({ page }) => {
    await goto(page, `/builds/${token}?edit=1&tab=gear&checkpoint=${lastCheckpointId}`);
    await expect(page.getByTestId('gear-tab')).toBeVisible({ timeout: 30_000 });

    // Positive precondition: the boots slot is non-empty going in (test 4 put
    // a real item there and saved it), so "reads Empty" below is a real
    // clear, not a vacuous check of an already-empty cell.
    const bootsCell = page.getByTestId('doll-slot-boots');
    const beforeName = await cellItemName(bootsCell);
    expect(beforeName, 'boots cell was already empty going into the clear test').not.toBe('');
    expect(beforeName).not.toBe('Empty');

    await bootsCell.click();
    const detail = page.getByTestId('gear-slot-detail');
    await expect(detail).toBeVisible();
    await detail.getByRole('button', { name: 'Clear', exact: true }).click();
    await expect(bootsCell).toContainText('Empty');

    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByTestId('save-status')).toHaveText(/^Saved /, { timeout: 30_000 });

    await goto(page, `/builds/${token}?tab=gear&checkpoint=${lastCheckpointId}`);
    await expect(page.getByTestId('gear-tab')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('doll-slot-boots')).toContainText('Empty');
  });
});
