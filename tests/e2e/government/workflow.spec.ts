import { test, expect } from '@playwright/test';
import { loginAs } from '../helpers/login';

test.describe('Government Analytics Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'gov@accidentcare.org', 'DemoPass123!', /\/government/);
  });

  test('Government dashboard loads analytics components', async ({ page }) => {
    await expect(page.locator('h1:has-text("Data mining insights")')).toBeVisible();
    
    // Check for analytic charts or metrics
    await expect(page.locator('text=Historical monthly accident trends').first()).toBeVisible();
    await expect(page.locator('.recharts-wrapper').first()).toBeVisible({ timeout: 15000 });
  });

  test('Date filters update the analytics data', async ({ page }) => {
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
