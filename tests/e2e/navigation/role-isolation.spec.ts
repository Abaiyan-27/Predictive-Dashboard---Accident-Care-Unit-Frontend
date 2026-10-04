import { test, expect, type Page } from '@playwright/test';

/**
 * Each role only reaches its own pages in the browser, and never sees another
 * role's navigation. (The backend enforces access; this checks the UI.)
 */

function fakeToken(sub: string): string {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'HS256' })}.${encode({ sub, exp: Math.floor(Date.now() / 1000) + 3600 })}.sig`;
}

const HOMES = { nurse: '/nurse', doctor: '/doctor', admin: '/admin', government: '/government' } as const;
type Role = keyof typeof HOMES;
const PAGES = ['/nurse', '/doctor', '/doctor/episodes/x', '/admin', '/admin/episodes/x', '/government', '/government/severity', '/government/forecast'];

async function signIn(page: Page, role: Role) {
  await page.addInitScript(({ token, role }) => {
    localStorage.setItem('ac_token', token);
    localStorage.setItem('ac_user', JSON.stringify({ id: `${role}-1`, name: `${role} One`, email: `${role}@example.org`, role,
      hospital_id: role === 'government' ? '' : 'hosp-a', hospital_name: role === 'government' ? 'Department of Health' : 'DGH – Vavuniya' }));
  }, { token: fakeToken(`${role}-1`), role });
  await page.route((url) => url.pathname.startsWith('/api/'), (route) => {
    const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, content-type' };
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    return route.fulfill({ status: 200, headers, json: [] });
  });
}

for (const role of Object.keys(HOMES) as Role[]) {
  test(`${role} is kept on their own pages`, async ({ page }) => {
    await signIn(page, role);
    for (const path of PAGES) {
      await page.goto(path);
      const own = path.startsWith(HOMES[role]);
      if (own) await expect(page).toHaveURL(new RegExp(`${path}$`));
      else await expect(page).toHaveURL(new RegExp(`${HOMES[role]}$`));
    }
  });

  test(`${role} sees only their own navigation`, async ({ page }) => {
    await signIn(page, role);
    await page.goto(HOMES[role]);
    await expect(page.getByRole('button', { name: 'Log out' })).toBeVisible();
    const governmentNav = page.getByTestId('government-nav');
    const adminTabs = page.getByRole('tablist', { name: 'Administration' });
    await expect(governmentNav).toHaveCount(role === 'government' ? 1 : 0);
    await expect(adminTabs).toHaveCount(role === 'admin' ? 1 : 0);
    if (role !== 'admin') await expect(page.getByRole('tab', { name: 'User management' })).toHaveCount(0);
  });
}
