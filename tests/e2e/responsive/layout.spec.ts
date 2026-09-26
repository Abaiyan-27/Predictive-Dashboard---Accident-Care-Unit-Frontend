import { test, expect } from '@playwright/test';

test.describe('Responsive Layout', () => {
  const viewports = [
    { width: 1920, height: 1080, name: 'Desktop' },
    { width: 1366, height: 768, name: 'Laptop' },
    { width: 768, height: 1024, name: 'Tablet' },
    { width: 390, height: 844, name: 'Mobile' }
  ];

  for (const vp of viewports) {
    test(`Login page renders correctly on ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/login');
      
      // Ensure main elements are visible and not overlapping offscreen
      const loginCard = page.locator('.glass-card');
      await expect(loginCard).toBeVisible();
      
      const emailInput = page.locator('input[type="email"]');
      await expect(emailInput).toBeVisible();
      
      // Quick check for horizontal scroll (should not be necessary)
      const isScrollable = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });
      expect(isScrollable).toBe(false);
    });
  }
});
