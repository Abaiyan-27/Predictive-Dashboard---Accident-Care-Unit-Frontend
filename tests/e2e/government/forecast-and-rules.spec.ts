import { test, expect, type Page, type Route } from '@playwright/test';

/**
 * Government pages with the API mocked at the network layer. Government
 * officers see only accident forecasting and association-rule mining:
 * read-only, and only those /government/* endpoints are called. Patient-model
 * statistics, decisions and operational transfer figures are not shown.
 */

function fakeToken(sub: string): string {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'HS256' })}.${encode({ sub, exp: Math.floor(Date.now() / 1000) + 3600 })}.sig`;
}

const PATIENT_MODEL_LABELS = ['HIGH', 'BORDERLINE', 'DEFER TO CLINICAL JUDGEMENT', '2-3 days', 'No transfer', 'Partial recovery'];
const TRENDS = [{ month: 'Aug 2026', count: 3 }, { month: 'Sep 2026', count: 9 }];
const FORECAST = {
  status: 'OK', model_name: 'accident_forecast', model_version: 'forecast-2026-01', message: null,
  risk_thresholds: { medium_min: 400, high_min: 500, method: 'quantiles' },
  points: [{ period: 'Nov 2026', predicted_accidents: 512, lower_bound: null, upper_bound: null, risk_level: 'High' }],
};
const RULE = { strength: 'mild', topic: 'Road', accidents: 120, confidence: 0.6, lift: 1.3 };
const RULES = {
  status: 'OK', total_rules: 3, matched_rules: 3, total_accidents: 6178, message: null,
  thresholds: { min_support: 0.02, min_confidence: 0.5, min_lift: 1.2 }, stability: { n_splits: 5, stability_floor: 0.6 },
  topics: { Helmet: 1, Road: 1, Speed: 1 }, strengths: { 'very strong': 1, strong: 0, moderate: 1, mild: 1 },
  disclaimer: 'These are associations found in past accidents, not proof of cause.',
  rules: [
    { ...RULE, rank: 1, strength: 'very strong', topic: 'Road', accidents: 128, confidence: 0.59, lift: 3.92,
      rule: 'When road signals were present: in 59% of these accidents, it happened on a highway.',
      interpretation: 'This is 3.9 times more likely than in accidents overall (about 128 accidents).',
      if_items: ['Road Signals Exist=yes'], then_items: ['Category of Road=highway'] },
    { ...RULE, rank: 2, strength: 'moderate', topic: 'Helmet', accidents: 754, confidence: 0.65, lift: 1.9,
      rule: 'When it happened on a highway: in 65% of these accidents, a helmet was worn.',
      interpretation: 'This is 1.9 times more likely than in accidents overall (about 754 accidents).',
      if_items: ['Category of Road=highway'], then_items: ['Helmet Worn=yes'] },
    { ...RULE, rank: 3, topic: 'Speed', accidents: 300,
      rule: 'When it happened at a bend: in 60% of these accidents, the speed was 40 - 80 km/h.',
      interpretation: 'This is 1.3 times more likely than in accidents overall (about 300 accidents).',
      if_items: ['Road Type=bend'], then_items: ['Approximate Speed=40 - 80 km/h'] },
  ],
};

type Handler = (route: Route, url: URL) => unknown;

async function setUp(page: Page, overrides: Record<string, Handler> = {}, role = 'government') {
  const gets: string[] = [];
  const others: string[] = [];
  await page.addInitScript(({ token, role }) => {
    localStorage.setItem('ac_token', token);
    localStorage.setItem('ac_user', JSON.stringify({ id: `${role}-1`, name: 'Officer One', email: 'officer@example.org', role,
      hospital_id: role === 'government' ? '' : 'hosp-a', hospital_name: role === 'government' ? 'Department of Health' : 'DGH – Vavuniya' }));
  }, { token: fakeToken(`${role}-1`), role });
  await page.route((url) => url.pathname.startsWith('/api/'), async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api/, '');
    const headers = { 'access-control-allow-origin': request.headers().origin ?? '*', 'access-control-allow-headers': 'authorization, content-type' };
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    if (request.method() !== 'GET') { others.push(`${request.method()} ${path}`); return route.fulfill({ status: 405, headers, json: {} }); }
    gets.push(`${path}${url.search}`);
    const override = overrides[path];
    if (override) return override(route, url);
    const body = path === '/government/accident-trends' || path === '/government/accident-historical-trends' ? TRENDS
      : path === '/government/accident-forecast' ? FORECAST
        : path === '/government/association-rules' ? RULES : undefined;
    if (body === undefined) return route.fulfill({ status: 404, headers, json: { detail: `unmocked ${path}` } });
    return route.fulfill({ status: 200, headers, json: body });
  });
  return { gets, others };
}

// React StrictMode runs effects twice in development, so compare the distinct calls.
const unique = (calls: string[]) => [...new Set(calls)].sort();

const ALLOWED = /^\/government\/(accident-trends|accident-historical-trends|accident-forecast|association-rules)(\?|$)/;
const onlyForecastAndRuleCalls = (mock: { gets: string[]; others: string[] }) => {
  expect(mock.others).toEqual([]);
  for (const call of mock.gets) expect(call).toMatch(ALLOWED);
};

/** The only buttons on a Government page: log out, and (for rules) filter/sort pills. */
async function expectReadOnly(page: Page, allowed: string[] = []) {
  const names = (await page.getByRole('button').allInnerTexts()).map((t) => t.trim());
  expect(names.filter((n) => n !== 'Log out' && !allowed.includes(n))).toEqual([]);
  await expect(page.locator('input:not([type="text"]), select, textarea')).toHaveCount(0);
  // (Authorize/Reject controls are covered by the button check; "Authorized" is also a request status.)
  for (const forbidden of ['Accept', 'Override', 'Run model', 'Make my own decision', 'Save treatment',
    'Send transfer request', 'Patient transferred', 'Create user', 'Audit log']) {
    await expect(page.locator('main')).not.toContainText(forbidden);
  }
}

test.describe('Government access', () => {
  test('signing in as government opens the forecast', async ({ page }) => {
    const gets: string[] = [];
    await page.route((url) => url.pathname.startsWith('/api/'), async (route) => {
      const request = route.request();
      const headers = { 'access-control-allow-origin': request.headers().origin ?? '*', 'access-control-allow-headers': 'authorization, content-type' };
      if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
      const path = new URL(request.url()).pathname.replace(/^\/api/, '');
      if (path === '/auth/login') {
        return route.fulfill({ status: 200, headers, json: { token: fakeToken('officer-1'),
          user: { user_id: 'officer-1', name: 'Officer One', email: 'gov@example.org', role: 'government', hospital_id: null } } });
      }
      gets.push(path);
      const body = path === '/government/accident-forecast' ? FORECAST : TRENDS;
      return route.fulfill({ status: 200, headers, json: body });
    });
    await page.goto('/login');
    await page.fill('input[type="email"]', 'gov@example.org');
    await page.fill('#password', 'Secret-123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/government\/forecast$/);
    await expect(page.getByRole('heading', { name: 'Accident forecast', exact: true })).toBeVisible();
    expect(unique(gets)).toEqual(['/government/accident-forecast', '/government/accident-historical-trends', '/government/accident-trends']);
  });

  test('navigation has only Forecast and Association Rules', async ({ page }) => {
    const mock = await setUp(page);
    await page.goto('/government/forecast');
    const nav = page.getByTestId('government-nav');
    await expect(nav.getByRole('link')).toHaveText(['Forecast', 'Association Rules']);
    for (const forbidden of ['Overview', 'Severity', 'Stay', 'Transfer', 'Discharge', 'Nurse', 'Doctor', 'Admin', 'Patients', 'Audit']) {
      await expect(nav).not.toContainText(forbidden);
    }
    await nav.getByRole('link', { name: 'Association Rules', exact: true }).click();
    await expect(page).toHaveURL(/\/government\/associations$/);
    await expect(page.locator('main h1')).toHaveText('Association rules');
    await nav.getByRole('link', { name: 'Forecast', exact: true }).click();
    await expect(page.locator('main h1')).toHaveText('Accident forecast');
    onlyForecastAndRuleCalls(mock);
  });

  test('the removed overview and patient-model pages lead to the forecast and load no model data', async ({ page }) => {
    const mock = await setUp(page);
    for (const path of ['/government', '/government/severity', '/government/stay', '/government/transfer', '/government/discharge']) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/government\/forecast$/);
    }
    for (const label of PATIENT_MODEL_LABELS) {
      await expect(page.locator('main')).not.toContainText(label);
    }
    onlyForecastAndRuleCalls(mock);
  });

  test('government cannot open staff dashboards', async ({ page }) => {
    const mock = await setUp(page);
    for (const path of ['/nurse', '/doctor', '/admin', `/admin/episodes/x`, `/doctor/episodes/x`]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/government\/forecast$/);
    }
    onlyForecastAndRuleCalls(mock);
  });

  test('staff cannot open the government pages', async ({ page }) => {
    await setUp(page, {}, 'nurse');
    await page.route((url) => url.pathname.startsWith('/api/patients') || url.pathname.startsWith('/api/severity'), (route) =>
      route.fulfill({ status: 200, json: [], headers: { 'access-control-allow-origin': '*' } }));
    await page.goto('/government/forecast');
    await expect(page).toHaveURL(/\/nurse$/);
  });
});

test.describe('Forecast and association rules', () => {
  test('Forecast page keeps the seasonal-naive forecast and accident trends', async ({ page }) => {
    const mock = await setUp(page);
    await page.goto('/government/forecast');
    await expect(page.getByRole('heading', { name: 'Accident forecast', exact: true })).toBeVisible();
    await expect(page.getByTestId('government-forecast')).toContainText('seasonal-naive');
    await expect(page.getByTestId('government-forecast')).toContainText('not one of the patient prediction models');
    await expect(page.getByText('Nov 2026')).toBeVisible();
    await expect(page.getByText('512')).toBeVisible();
    await expect(page.locator('.recharts-wrapper').first()).toBeVisible();
    for (const label of PATIENT_MODEL_LABELS) {
      await expect(page.locator('main')).not.toContainText(label);
    }
    await expectReadOnly(page);
    expect(unique(mock.gets)).toEqual(['/government/accident-forecast?horizon=6', '/government/accident-historical-trends', '/government/accident-trends']);
  });

  test('Association Rules page shows the notebook\'s plain-language rules read-only, with filters', async ({ page }) => {
    const mock = await setUp(page);
    await page.goto('/government/associations');
    await expect(page.getByRole('heading', { name: 'Association rules', exact: true })).toBeVisible();
    const cards = page.getByTestId('rule-card');
    await expect(cards).toHaveCount(3);
    await expect(cards.first()).toContainText('When road signals were present: in 59% of these accidents, it happened on a highway.');
    await expect(cards.first()).toContainText('Very strong link');
    await expect(cards.first()).toContainText('This is 3.9 times more likely');
    const panel = page.getByTestId('government-associations');
    await expect(panel).toContainText('3 patterns found in 6,178 past accident records');
    await expect(panel).toContainText('not proof of cause');
    await expect(panel).toContainText('not an output of the Severity model');

    await page.getByRole('button', { name: 'Helmet (1)' }).click();
    await expect(cards).toHaveCount(1);
    await expect(cards.first()).toContainText('a helmet was worn');
    await expect(cards.first()).toContainText('Clear link');
    await page.getByRole('button', { name: 'All topics' }).click();
    await page.getByRole('button', { name: 'Mild link' }).click();
    await expect(cards).toHaveCount(1);
    await page.getByRole('button', { name: 'Any strength' }).click();
    await page.getByRole('button', { name: 'Most accidents' }).click();
    await expect(cards.first()).toContainText('about 754');
    await page.getByLabel('Search patterns').fill('bend');
    await expect(cards).toHaveCount(1);
    await expect(page.getByTestId('rule-count')).toHaveText('Showing 1 of 3 patterns');

    // One request for the whole list; filtering happens on the page.
    expect(unique(mock.gets)).toEqual(['/government/association-rules?limit=1000']);
    await expectReadOnly(page, ['All topics', 'Helmet (1)', 'Road (1)', 'Speed (1)', 'Any strength', 'Very strong link',
      'Strong link', 'Clear link', 'Mild link', 'Strongest link', 'Most consistent', 'Most accidents']);
    onlyForecastAndRuleCalls(mock);
  });
});

test.describe('Error states', () => {
  test('a failed forecast is shown as an error, never as zeros', async ({ page }) => {
    await setUp(page, {
      '/government/accident-forecast': (route) => route.fulfill({ status: 503, json: { detail: 'Forecast artifact is not installed.' }, headers: { 'access-control-allow-origin': '*' } }),
    });
    await page.goto('/government/forecast');
    await expect(page.getByText('Forecast artifact is not installed.')).toBeVisible();
    await expect(page.getByText('512')).toHaveCount(0);
    await expect(page.getByText('Monthly accident trends — database records')).toBeVisible();
  });
});
