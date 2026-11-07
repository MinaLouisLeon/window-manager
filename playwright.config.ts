import { defineConfig, devices } from '@playwright/test';

const PORT = 61_200;

// Smoke test for the built Ladle playground (npm run playground:smoke builds it first).
export default defineConfig({
  testDir: 'playground',
  testMatch: '*.spec.ts',
  forbidOnly: Boolean(process.env.CI),
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npx --no ladle preview --config playground --outDir playground/dist --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
