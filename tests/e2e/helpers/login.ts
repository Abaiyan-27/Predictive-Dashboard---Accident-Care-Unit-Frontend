import { Page, expect } from '@playwright/test';
import { ROLE_HOME, testAccount, type TestRole } from './accounts';

/**
 * Shared login helper that properly waits for the Supabase auth API
 * response before asserting navigation. The Supabase free tier can be
 * slow to respond, so we:
 * 1. Wait for the /api/auth/login response
 * 2. Wait for navigation with a generous timeout
 */
export async function loginAs(
  page: Page,
  email: string,
  password: string,
  expectedUrlPattern: RegExp,
) {
  await page.goto('/login');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);

  // Click submit and wait for the API response concurrently
  await Promise.all([
    page.waitForResponse(
      (res) => res.url().includes('/api/auth/login') && res.status() === 200,
      { timeout: 30000 },
    ),
    page.click('button[type="submit"]'),
  ]);

  // Wait for client-side navigation after the token is stored
  await expect(page).toHaveURL(expectedUrlPattern, { timeout: 10000 });
}

/** Log in with the configured test account for a role (see accounts.ts). */
export async function loginAsRole(page: Page, role: TestRole) {
  const { email, password } = testAccount(role);
  await loginAs(page, email, password, ROLE_HOME[role]);
}
