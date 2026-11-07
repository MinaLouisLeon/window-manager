import { defineConfig, devices } from '@playwright/test';

// Checks the fixture apps built from the packed package (`npm run fixtures` builds them).
const APPS = [
  { name: 'tailwind-app', port: 61_201 },
  { name: 'plain-app', port: 61_202 },
  { name: 'shadcn-app', port: 61_203 },
] as const;

export default defineConfig({
  testDir: '.',
  testMatch: 'fixtures.spec.ts',
  forbidOnly: Boolean(process.env.CI),
  reporter: 'list',
  projects: APPS.map((app) => ({
    name: app.name,
    use: { ...devices['Desktop Chrome'], baseURL: `http://localhost:${app.port}` },
  })),
  webServer: APPS.map((app) => ({
    command: `npm run preview -- --port ${app.port} --strictPort`,
    cwd: `./${app.name}`,
    url: `http://localhost:${app.port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  })),
});
