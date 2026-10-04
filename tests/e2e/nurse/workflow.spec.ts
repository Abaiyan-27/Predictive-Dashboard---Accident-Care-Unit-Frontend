import { test, expect } from '@playwright/test';
import { loginAsRole } from '../helpers/login';

/**
 * Nurse workflow against a live backend with the demo accounts (no mocks):
 * Box 1 basic details → Box 2 Severity inputs → Save & Run Severity, each save
 * confirmed first. The Severity outcome depends on the real model, so the test
 * checks for one of the defined workflow states rather than a specific label.
 */
test.describe('Nurse Workflow (live backend)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsRole(page, 'nurse');
  });

  test('a new patient is registered, Severity is run, and the patient joins the hospital list', async ({ page }) => {
    const name = `Live Test ${Date.now()}`;
    await page.fill('input[name="name"]', name);
    await page.fill('input[name="age"]', '30');
    await page.selectOption('select[name="gender"]', 'Male');
    await page.getByRole('button', { name: 'Save Basic Details' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Yes, save' }).click();
    await expect(page.getByRole('status')).toContainText('Basic details saved', { timeout: 15000 });

    await page.fill('input[name="incident_at"]', '2026-09-01T19:00');
    await page.selectOption('select[name="collision_type"]', 'car or van');
    await page.selectOption('select[name="mode_of_travel_during_accident"]', 'motor cyclist');
    await page.selectOption('select[name="passenger_type"]', 'driver');
    await page.selectOption('select[name="mode_of_transport"]', 'ambulance');
    await page.selectOption('select[name="time_to_hospital"]', '15 minutes - 30 minutes');
    await page.selectOption('select[name="vehicle_type"]', 'motor cyclist');
    await page.selectOption('select[name="helmet_worn"]', 'no');
    await page.selectOption('select[name="site_of_injury"]', 'head injury');
    await page.selectOption('select[name="other_injury"]', 'no other injury');
    await page.getByRole('button', { name: 'Save & Run Severity' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Yes, save' }).click();

    const panel = page.getByTestId('severity-panel');
    await expect(panel.locator('h3')).toHaveText(
      /Severity — (Prediction available — awaiting nurse decision|Model deferred — clinical decision required|Prediction failed — clinical decision required)/,
      { timeout: 20000 },
    );
    await expect(page.locator('body')).not.toContainText('Severity assessment complete');
    await expect(page.getByRole('heading', { name: 'Hospital patient records' })).toBeVisible();
    await expect(page.getByRole('button', { name: new RegExp(name) })).toBeVisible();
  });

  test('basic details without a name are not sent', async ({ page }) => {
    await page.getByRole('button', { name: 'Save Basic Details' }).click();
    // The browser blocks the empty required field: no confirmation, no request.
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await expect(page.locator('input[name="name"]:invalid')).toHaveCount(1);
  });
});
