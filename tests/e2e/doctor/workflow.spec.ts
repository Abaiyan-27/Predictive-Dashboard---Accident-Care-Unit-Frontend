import { test, expect } from '@playwright/test';
import { loginAs } from '../helpers/login';

test.describe('Doctor Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'doctor@accidentcare.org', 'DemoPass123!', /\/doctor/);
  });

  test('Doctor dashboard loads and displays patients', async ({ page }) => {
    await expect(page.locator('h1:has-text("Admitted patients")')).toBeVisible();
    
    // Wait for loading to complete: the spinner disappears and content appears.
    // The dashboard renders one of three states:
    //   1. Patient list items (div with role="button")
    //   2. "No patients found." text
    //   3. An error message (dynamic text from the API)
    // We also check for "0 patients" badge which appears when loading finishes with empty results.
    const patientItem = page.locator('[role="button"]').first();
    const noPatients = page.locator('text=No patients found.');
    const zeroBadge = page.locator('text=0 patients');
    
    await expect(patientItem.or(noPatients).or(zeroBadge)).toBeVisible({ timeout: 30000 });
    
    if (await patientItem.isVisible()) {
      await patientItem.click();
      await expect(page).toHaveURL(/\/doctor\/patient\//);
    }
  });

  test('Doctor can view patient details and predictions', async ({ page }) => {
    // Wait for patients to load
    const patientItem = page.locator('[role="button"]').first();
    const noPatients = page.locator('text=No patients found.');
    const zeroBadge = page.locator('text=0 patients');
    
    await expect(patientItem.or(noPatients).or(zeroBadge)).toBeVisible({ timeout: 30000 });
    
    if (await patientItem.isVisible()) {
      await patientItem.click();
      
      // Patient detail page - wait for prognosis panel to load
      await expect(page.locator('text=Patient record')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('text=Prognosis panel')).toBeVisible({ timeout: 10000 });
    }
  });
});

