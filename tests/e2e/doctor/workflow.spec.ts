import { test, expect } from '@playwright/test';
import { loginAsRole } from '../helpers/login';

/**
 * Doctor workflow against a live backend with the demo accounts (no mocks).
 * The hospital may or may not have patients; both outcomes are checked.
 */
test.describe('Doctor Workflow (live backend)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsRole(page, 'doctor');
  });

  test('the dashboard lists the hospital\'s patients or says there are none', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Admitted patients' })).toBeVisible();
    const patient = page.locator('[role="button"]').first();
    const empty = page.getByText('No patients found.');
    await expect(patient.or(empty)).toBeVisible({ timeout: 30000 });
    await expect(page.getByRole('alert')).toHaveCount(0);
  });

  test('a patient episode has one page per model, with Severity read-only', async ({ page }) => {
    const patient = page.locator('[role="button"]').first();
    const empty = page.getByText('No patients found.');
    await expect(patient.or(empty)).toBeVisible({ timeout: 30000 });
    test.skip(await empty.isVisible(), 'this hospital has no patients in the demo database');

    await patient.click();
    await expect(page).toHaveURL(/\/doctor\/episodes\//);
    await expect(page.locator('main h2').first()).toHaveText('Patient', { timeout: 15000 });
    const nav = page.getByTestId('episode-nav');
    await expect(nav.getByRole('link')).toHaveText(['Overview', 'Severity', 'Stay Duration', 'Transfer', 'Discharge']);
    for (const [link, heading] of [['Stay Duration', 'Stay Duration'], ['Transfer', 'Transfer'], ['Discharge', 'Discharge Outcome']]) {
      await nav.getByRole('link', { name: link, exact: true }).click();
      await expect(page.locator('main h2').first()).toHaveText(heading);
    }
    await nav.getByRole('link', { name: 'Severity', exact: true }).click();
    const severity = page.getByTestId('doctor-severity');
    await expect(severity).toContainText('Read-only');
    await expect(severity.locator('button, input, select')).toHaveCount(0);
  });
});
