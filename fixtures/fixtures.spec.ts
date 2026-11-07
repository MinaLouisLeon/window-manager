import { expect, type Page, test } from '@playwright/test';

// Runs once per fixture app (see playwright.config.ts): the same checks must pass with theme.css
// in a Tailwind v4 app, with the prebuilt styles.css in an app without Tailwind, and with the
// registry items installed by `npx shadcn add`.

function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

async function openNotes(page: Page) {
  await page.goto('/');
  await page.getByRole('option', { name: 'Notes' }).dblclick();
  const win = page.getByRole('dialog', { name: 'Notes' });
  await expect(win).toBeVisible();
  return win;
}

test('the desktop renders without console errors', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/');
  await expect(page.getByRole('toolbar', { name: 'Taskbar' })).toBeVisible();
  await expect(page.getByRole('listbox', { name: 'Desktop icons' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('a window opens from a desktop icon', async ({ page }) => {
  const errors = watchErrors(page);
  const win = await openNotes(page);
  await expect(win.getByRole('textbox', { name: 'Note' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('a window drags by its title bar', async ({ page }) => {
  const win = await openNotes(page);
  const before = await win.boundingBox();
  if (before === null) throw new Error('The window has no box.');
  const grabX = before.x + before.width / 2;
  const grabY = before.y + 18;
  await page.mouse.move(grabX, grabY);
  await page.mouse.down();
  await page.mouse.move(grabX + 120, grabY + 80, { steps: 8 });
  await page.mouse.up();
  const after = await win.boundingBox();
  expect(after?.x).toBeGreaterThan(before.x + 100);
  expect(after?.y).toBeGreaterThan(before.y + 60);
});

test('dragging to the left edge snaps the window to the left half', async ({ page }) => {
  const win = await openNotes(page);
  const box = await win.boundingBox();
  const viewport = page.viewportSize();
  if (box === null || viewport === null) throw new Error('No box or viewport.');
  await page.mouse.move(box.x + box.width / 2, box.y + 18);
  await page.mouse.down();
  await page.mouse.move(box.x + 100, box.y + 100, { steps: 6 });
  await page.mouse.move(2, viewport.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect(win).toHaveAttribute('data-snap', 'left');
  const snapped = await win.boundingBox();
  expect(snapped?.x).toBeLessThan(2);
  expect(Math.abs((snapped?.width ?? 0) - viewport.width / 2)).toBeLessThan(2);
});

test('the taskbar minimizes and restores a window, and the controls work', async ({ page }) => {
  const win = await openNotes(page);
  const button = page.getByRole('toolbar', { name: 'Taskbar' }).getByRole('button', {
    name: 'Notes',
  });
  await button.click();
  await expect(win).toBeHidden();
  await button.click();
  await expect(win).toBeVisible();

  await win.getByRole('button', { name: 'Maximize' }).click();
  await expect(win).toHaveAttribute('data-status', 'maximized');
  await win.getByRole('button', { name: 'Close' }).click();
  await expect(page.getByRole('dialog', { name: 'Notes' })).toHaveCount(0);
});

test('the start menu launches an app', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start' }).click();
  await page.getByPlaceholder('Search apps').fill('term');
  await page.locator('[data-wm-start-menu]').getByRole('option', { name: 'Terminal' }).click();
  await expect(page.getByRole('dialog', { name: 'Terminal' })).toBeVisible();
});
