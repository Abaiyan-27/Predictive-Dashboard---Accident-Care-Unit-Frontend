import { test, expect } from '@playwright/test';
import { loginAs } from '../helpers/login';

test.describe('Admin Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'admin@accidentcare.org', 'DemoPass123!', /\/admin/);
  });

  test('Admin dashboard loads and displays management options', async ({ page }) => {
    await expect(page.locator('h1:has-text("Administration")')).toBeVisible();
    
    // Verify user management or hospital management sections
    await expect(page.locator('text=User management').first()).toBeVisible();
  });
});
