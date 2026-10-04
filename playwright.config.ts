import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

// Live-backend specs read TEST_* account credentials from the environment;
// a local, untracked .env.test can supply them (see .env.test.example).
// Values already set in the shell win.
if (existsSync('.env.test')) process.loadEnvFile('.env.test');

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
