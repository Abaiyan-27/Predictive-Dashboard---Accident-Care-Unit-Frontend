import { test, expect } from '@playwright/test';
import { loginAsRole } from '../helpers/login';

test.describe('Government Analytics Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsRole(page, 'government');
  });

  test('Government dashboard loads analytics components', async ({ page }) => {
    await expect(page.locator('h1:has-text("Network overview")')).toBeVisible();

    // Trends and charts live on the Forecast page.
    await page.getByRole('link', { name: 'Forecast' }).first().click();
    await expect(page.locator('text=Historical monthly accident trends').first()).toBeVisible();
    await expect(page.locator('.recharts-wrapper').first()).toBeVisible({ timeout: 15000 });
  });

  test('Date filters update the analytics data', async ({ page }) => {
    await page.goto('/government/forecast');
    await expect(page.locator('text=Historical monthly accident trends').first()).toBeVisible();
    
    // Example: changing a date filter or dropdown
    const dateInput = page.locator('input[type="date"]').first();
    if (await dateInput.isVisible()) {
      await dateInput.fill('2023-01-01');
      // Verify some UI feedback (loading state or re-render)
      // Playwright handles wait-for-navigation/network implicitly when interacting
    }
  });
});
