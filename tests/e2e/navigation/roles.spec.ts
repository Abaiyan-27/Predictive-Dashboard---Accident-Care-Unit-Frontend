import { test, expect } from '@playwright/test';
import { loginAsRole } from '../helpers/login';

test.describe('Role-Based Navigation & Access', () => {
  test('Nurse cannot access doctor dashboard', async ({ page }) => {
    await loginAsRole(page, 'nurse');

    // Attempt direct navigation
    await page.goto('/doctor');
    
    // Should be redirected back — app's ProtectedRoute redirects to /login which then redirects to /nurse
    await expect(page).toHaveURL(/\/nurse/, { timeout: 10000 });
  });

  test('Doctor cannot access admin dashboard', async ({ page }) => {
    await loginAsRole(page, 'doctor');

    // Attempt direct navigation
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/doctor/, { timeout: 10000 });
  });

  test('Unauthenticated user cannot access protected routes', async ({ page }) => {
    await page.goto('/nurse');
    await expect(page).toHaveURL(/\/login/);

    await page.goto('/doctor');
    await expect(page).toHaveURL(/\/login/);

    await page.goto('/admin');
    await expect(page).toHaveURL(/\/login/);
    
    await page.goto('/government');
    await expect(page).toHaveURL(/\/login/);
  });
});
