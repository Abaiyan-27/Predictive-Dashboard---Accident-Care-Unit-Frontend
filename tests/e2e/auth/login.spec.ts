import { test, expect } from '@playwright/test';
import { loginAs } from '../helpers/login';

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('Valid login as nurse redirects to nurse dashboard', async ({ page }) => {
    await loginAs(page, 'nurse@accidentcare.org', 'DemoPass123!', /\/nurse/);
    await expect(page.locator('h1', { hasText: 'Patient intake' })).toBeVisible();
  });

  test('Valid login as doctor redirects to doctor dashboard', async ({ page }) => {
    await loginAs(page, 'doctor@accidentcare.org', 'DemoPass123!', /\/doctor/);
    await expect(page.locator('h1', { hasText: 'Admitted patients' })).toBeVisible();
  });

  test('Valid login as admin redirects to admin dashboard', async ({ page }) => {
    await loginAs(page, 'admin@accidentcare.org', 'DemoPass123!', /\/admin/);
    await expect(page.locator('h1', { hasText: 'Administration' })).toBeVisible();
  });

  test('Valid login as government redirects to government dashboard', async ({ page }) => {
    await loginAs(page, 'gov@accidentcare.org', 'DemoPass123!', /\/government/);
    await expect(page.locator('h1', { hasText: 'Data mining insights' })).toBeVisible();
  });

  test('Invalid password displays error', async ({ page }) => {
    await page.fill('input[type="email"]', 'nurse@accidentcare.org');
    await page.fill('input[type="password"]', 'wrongpassword');

    // Click submit and wait for the error API response
    await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes('/api/auth/login') && res.status() >= 400,
        { timeout: 30000 },
      ),
      page.click('button[type="submit"]'),
    ]);

    // The error message is rendered by the frontend from the API response
    await expect(page.locator('text=Incorrect email or password.')).toBeVisible({ timeout: 5000 });
  });

  test('Missing required fields prevents submission', async ({ page }) => {
    await page.fill('input[type="email"]', 'nurse@accidentcare.org');
    // Password missing
    await page.click('button[type="submit"]');
    
    // HTML5 validation should kick in, form won't navigate
    await expect(page).toHaveURL(/\/login/);
  });
});
