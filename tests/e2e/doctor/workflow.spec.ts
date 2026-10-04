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

  test('a patient episode shows the sections in order, with Severity read-only', async ({ page }) => {
    const patient = page.locator('[role="button"]').first();
    const empty = page.getByText('No patients found.');
    await expect(patient.or(empty)).toBeVisible({ timeout: 30000 });
    test.skip(await empty.isVisible(), 'this hospital has no patients in the demo database');

    await patient.click();
    await expect(page).toHaveURL(/\/doctor\/episodes\//);
    await expect(page.locator('main h2').first()).toHaveText('Patient', { timeout: 15000 });
    const headings = await page.locator('main h2').allInnerTexts();
    expect(headings.slice(0, 3)).toEqual(['Patient', 'Severity', 'Treatment']);
    expect(headings).toEqual(expect.arrayContaining(['Stay Duration', 'Transfer', 'Discharge Outcome', 'History']));
    const severity = page.getByTestId('doctor-severity');
    await expect(severity).toContainText('Read-only');
    await expect(severity.locator('button, input, select')).toHaveCount(0);
  });
});
