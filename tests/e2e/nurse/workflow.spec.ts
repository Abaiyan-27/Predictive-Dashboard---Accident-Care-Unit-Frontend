import { test, expect } from '@playwright/test';

test.describe('Nurse Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', 'nurse@accidentcare.org');
    await page.fill('input[type="password"]', 'DemoPass123!');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/nurse/);
  });

  test('Submitting a new patient intake form successfully', async ({ page }) => {
    const uniquePatientName = `John Doe ${Date.now()}`;
    
    // Fill out the patient intake form
    await page.fill('input[name="name"]', uniquePatientName);
    await page.fill('input[name="age"]', '30');
    await page.selectOption('select[name="gender"]', 'Male');
    
    // Incident time
    await page.fill('input[name="incident_at"]', '2023-10-10T10:30');
    
    await page.selectOption('select[name="collision_type"]', 'car or van');
    await page.selectOption('select[name="mode_of_transport"]', 'ambulance');
    await page.selectOption('select[name="time_to_hospital"]', '15 minutes - 30 minutes');
    await page.selectOption('select[name="vehicle_type"]', 'car');
    await page.selectOption('select[name="road_type"]', 'straight');
    await page.selectOption('select[name="speed"]', '40 - 80 km/h');
    await page.selectOption('select[name="collision_force_from"]', 'front');
    await page.selectOption('select[name="visibility"]', 'adequate');
    
    await page.fill('input[name="road_condition"]', 'dry');
    
    await page.selectOption('select[name="helmet_worn"]', 'no');
    await page.selectOption('select[name="road_signals_exist"]', 'yes');
    await page.selectOption('select[name="alcohol_consumption"]', 'no');
    await page.selectOption('select[name="illicit_drugs"]', 'no');
    
    await page.selectOption('select[name="site_of_injury"]', 'head injury');
    await page.fill('textarea[name="injury_description"]', 'Severe concussion');
    
    // Submit form
    await page.click('button[type="submit"]');
    
    // Verify success banner and result
    await expect(page.locator('text=Severity assessment complete')).toBeVisible({ timeout: 10000 });
    await expect(page.locator(`text=${uniquePatientName}`)).toBeVisible();
    await expect(page.locator('text=Dismiss')).toBeVisible();
    
    // Verify patient is in "My patient records" list
    await expect(page.locator('div', { hasText: uniquePatientName }).first()).toBeVisible();
  });

  test('Form validation prevents submission on empty required fields', async ({ page }) => {
    // Attempt to submit without filling the required fields
    await page.click('button[type="submit"]');
    
    // Severity assessment banner shouldn't appear
    await expect(page.locator('text=Severity assessment complete')).not.toBeVisible();
  });
});
