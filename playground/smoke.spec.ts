import { expect, test } from '@playwright/test';

// Opens every story in each theme and fails on console errors or uncaught exceptions.
// The theme comes from the `integr8Theme` query parameter (see playground/components.tsx).
const THEMES = ['light', 'dark', 'integr8', 'integr8-light'] as const;

interface LadleMeta {
  stories: Record<string, unknown>;
}

for (const theme of THEMES) {
  test(`every story renders without errors in the ${theme} theme`, async ({ page, request }) => {
    const response = await request.get('/meta.json');
    expect(response.ok()).toBe(true);
    const storyIds = Object.keys(((await response.json()) as LadleMeta).stories);
    expect(storyIds.length).toBeGreaterThan(0);

    const errors: string[] = [];
    let currentStory = '';
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(`${currentStory}: ${message.text()}`);
    });
    page.on('pageerror', (error) => {
      errors.push(`${currentStory}: ${error.message}`);
    });

    for (const storyId of storyIds) {
      currentStory = storyId;
      await page.goto(`/?story=${encodeURIComponent(storyId)}&mode=preview&integr8Theme=${theme}`);
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    }

    expect(errors).toEqual([]);
  });
}
