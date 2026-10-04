import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

// Live-backend specs read TEST_* account credentials from the environment;
// a local, untracked .env.test can supply them (see .env.test.example).
// Values already set in the shell win.
if (existsSync('.env.test')) process.loadEnvFile('.env.test');

// PLAYWRIGHT_PORT runs the app on another port, so a test run never reuses a
// developer's dev server (whose /api proxy may point at a real backend).
const PORT = Number(process.env.PLAYWRIGHT_PORT || 5173);

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'html',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: `npm run dev -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
