import { test, expect, type Page } from '@playwright/test';

/** Long lists say how many rows exist and load the rest on request (X-Total-Count). */

function fakeToken(sub: string): string {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'HS256' })}.${encode({ sub, exp: Math.floor(Date.now() / 1000) + 3600 })}.sig`;
}

function accident(i: number) {
  return { accident_id: `acc-${i}`, patient_id: `p-${i}`, hospital_id: 'hosp-a', created_by: 'nurse-1',
    created_at: '2026-10-03T09:00:00Z', Patient: { patient_id: `p-${i}`, full_name: `Patient ${i}`, age: '30', gender: 'Male' },
    Injury_Description: [], doctor_workflow: { treatment_recorded: false, models: {} } };
}

async function setUp(page: Page, role: 'doctor' | 'nurse', total: number, pageSize: number) {
  const requests: string[] = [];
  await page.addInitScript(({ token, role }) => {
    localStorage.setItem('ac_token', token);
    localStorage.setItem('ac_user', JSON.stringify({ id: `${role}-1`, name: `${role} One`, email: `${role}@example.org`,
      role, hospital_id: 'hosp-a', hospital_name: 'DGH – Vavuniya' }));
  }, { token: fakeToken(`${role}-1`), role });
  await page.route((url) => url.pathname.startsWith('/api/'), (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const headers = { 'access-control-allow-origin': request.headers().origin ?? '*', 'access-control-allow-headers': 'authorization, content-type',
      'access-control-expose-headers': 'X-Total-Count' };
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    if (url.pathname === '/api/patients/hospital/hosp-a' || url.pathname === '/api/patients/my') {
      requests.push(url.search);
      const offset = Number(url.searchParams.get('offset') ?? 0);
      const rows = Array.from({ length: Math.min(pageSize, total - offset) }, (_, i) => accident(offset + i));
      return route.fulfill({ status: 200, json: rows, headers: { ...headers, 'x-total-count': String(total) } });
    }
    return route.fulfill({ status: 200, json: [], headers });
  });
  return requests;
}

test('the doctor list shows how many patients exist and loads the next page', async ({ page }) => {
  const requests = await setUp(page, 'doctor', 3, 2);
  await page.goto('/doctor');
  await expect(page.getByTestId('list-footer')).toContainText('Showing 2 of 3 patients');
  await expect(page.locator('main')).toContainText('3 patients');
  await page.getByRole('button', { name: 'Load more' }).click();
  await expect(page.getByTestId('list-footer')).toContainText('Showing 3 of 3 patients');
  await expect(page.getByRole('button', { name: 'Load more' })).toHaveCount(0);
  expect([...new Set(requests)]).toEqual(['?limit=50&offset=0', '?limit=50&offset=2']);
});

test('the nurse list says when more records exist than are shown', async ({ page }) => {
  await setUp(page, 'nurse', 120, 50);
  await page.goto('/nurse');
  await expect(page.getByTestId('list-footer')).toContainText('Showing 50 of 120 patient records');
  await expect(page.getByRole('button', { name: 'Load more' })).toBeVisible();
});
