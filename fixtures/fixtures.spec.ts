import { expect, test } from '@playwright/test';

// Runs once per fixture app (see playwright.config.ts): the same checks must pass with theme.css
// in a Tailwind v4 app and with the prebuilt styles.css in an app without Tailwind.
// M0 checks that each app builds and renders without errors. M11 adds: a window opens, drags,
// snaps, and the taskbar works.

test('the app renders without console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('/');
  await expect(page.getByTestId('heading')).toBeVisible();
  expect(errors).toEqual([]);
});
