import { test, expect, type Page, type Route } from '@playwright/test';

/**
 * Government pages with the API mocked at the network layer: one page per
 * patient model, forecast and association rules kept separate, read-only, and
 * only /government/* endpoints called.
 */

function fakeToken(sub: string): string {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'HS256' })}.${encode({ sub, exp: Math.floor(Date.now() / 1000) + 3600 })}.sig`;
}

const LABELS: Record<string, string[]> = {
  severity: ['HIGH', 'BORDERLINE', 'LOW', 'DEFER TO CLINICAL JUDGEMENT'],
  stay_duration: ['0-1 days', '2-3 days', '4+ days'],
  transfer: ['Transfer', 'No transfer'],
  discharge: ['Complete recovery', 'Partial recovery', 'Further interventions'],
};
const TITLES: Record<string, string> = { severity: 'Severity', stay_duration: 'Stay Duration', transfer: 'Transfer', discharge: 'Discharge Outcome' };
const RETIRED = ['Priority', 'Moderate', 'Medium', 'Severity not classified'];

function summary(model: string, counts: number[], options: { decisions?: number[]; accepted?: number; unavailable?: number } = {}) {
  const labels = LABELS[model];
  const decisionLabels = model === 'severity' ? labels.slice(0, 3) : labels;
  const total = counts.reduce((a, b) => a + b, 0);
  const decided = options.decisions ?? decisionLabels.map(() => 0);
  const decisionTotal = decided.reduce((a, b) => a + b, 0);
  const pct = (n: number, d: number) => (d ? Math.round((1000 * n) / d) / 10 : null);
  const accepted = options.accepted ?? 0;
  return {
    model_key: model, title: TITLES[model], labels, decision_labels: decisionLabels,
    decision_role: model === 'severity' ? 'nurse' : 'doctor',
    total_predictions: total + 1, episodes_with_prediction: total + (options.unavailable ?? 0),
    current: labels.map((label, i) => ({ label, count: counts[i], percentage: pct(counts[i], total) })),
    unavailable: options.unavailable ?? 0,
    decisions: {
      total: decisionTotal, accepted, overridden: decisionTotal - accepted, acceptance_rate: pct(accepted, decisionTotal),
      distribution: decisionLabels.map((label, i) => ({ label, count: decided[i], percentage: pct(decided[i], decisionTotal) })),
    },
    monthly: ['Aug 2026', 'Sep 2026', 'Oct 2026'].map((month, m) => ({
      month, total: m === 1 ? total : 0, counts: Object.fromEntries(labels.map((label, i) => [label, m === 1 ? counts[i] : 0])),
    })),
    by_hospital: total ? [{ hospital: 'DGH – Vavuniya', total, counts: Object.fromEntries(labels.map((label, i) => [label, counts[i]])) }] : [],
    versions: [{ contract_version: '2026-09', artifact_name: `${model}.joblib`, first_seen_at: '2026-09-01T00:00:00Z', predictions: total + 1 }],
    generated_at: '2026-10-04T10:00:00Z',
  };
}

const SUMMARIES: Record<string, unknown> = {
  severity: summary('severity', [6, 3, 0, 1], { decisions: [5, 3, 0], accepted: 7 }),
  stay_duration: summary('stay_duration', [1, 5, 4], { decisions: [0, 2, 1], accepted: 2, unavailable: 2 }),
  transfer: summary('transfer', [3, 7], { decisions: [2, 1], accepted: 1 }),
  discharge: summary('discharge', [4, 4, 2]),
};
const STATISTICS = {
  total_accidents: 42, total_patients: 40, total_hospitals: 9, total_transfers: 5, pending_transfers: 2,
  transfers_by_status: { pending_authorization: 2, authorized: 1, approved: 1, rejected: 1 },
};
const TRENDS = [{ month: 'Aug 2026', count: 3 }, { month: 'Sep 2026', count: 9 }];
const FORECAST = {
  status: 'OK', model_name: 'accident_forecast', model_version: 'forecast-2026-01', message: null,
  risk_thresholds: { medium_min: 400, high_min: 500, method: 'quantiles' },
  points: [{ period: 'Nov 2026', predicted_accidents: 512, lower_bound: null, upper_bound: null, risk_level: 'High' }],
};
const RULES = {
  status: 'OK', total_rules: 2, thresholds: { min_support: 0.02, min_confidence: 0.5, min_lift: 1.2 }, message: '2 validated rules available',
  rules: [
    { antecedents: ['Helmet Worn=no'], consequents: ['severity_label=high'], support: 0.1, confidence: 0.8, lift: 1.9 },
    { antecedents: ['Road Type=bend'], consequents: ['Speed=40 - 80 km/h'], support: 0.05, confidence: 0.6, lift: 1.3 },
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
    const model = path.match(/^\/government\/models\/(\w+)$/)?.[1];
    const body = model ? SUMMARIES[model]
      : path === '/government/statistics' ? STATISTICS
        : path === '/government/accident-trends' || path === '/government/accident-historical-trends' ? TRENDS
          : path === '/government/accident-forecast' ? FORECAST
            : path === '/government/association-rules' ? RULES : undefined;
    if (body === undefined) return route.fulfill({ status: 404, headers, json: { detail: `unmocked ${path}` } });
    return route.fulfill({ status: 200, headers, json: body });
  });
  return { gets, others };
}

// React StrictMode runs effects twice in development, so compare the distinct calls.
const unique = (calls: string[]) => [...new Set(calls)].sort();

const onlyGovernmentCalls = (mock: { gets: string[]; others: string[] }) => {
  expect(mock.others).toEqual([]);
  for (const call of mock.gets) expect(call).toMatch(/^\/government\//);
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

test.describe('Government dashboard', () => {
  test('signing in as government opens the overview with network totals', async ({ page }) => {
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
      return route.fulfill({ status: 200, headers, json: STATISTICS });
    });
    await page.goto('/login');
    await page.fill('input[type="email"]', 'gov@example.org');
    await page.fill('#password', 'Secret-123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/government$/);
    await expect(page.getByRole('heading', { name: 'Network overview' })).toBeVisible();
    await expect(page.getByTestId('stat-accidents')).toContainText('42');
    await expect(page.getByTestId('stat-transfers')).toContainText('2 awaiting authorization');
    expect(unique(gets)).toEqual(['/government/statistics']);
  });

  test('navigation has one page per model plus forecast and rules, and nothing for staff', async ({ page }) => {
    const mock = await setUp(page);
    await page.goto('/government');
    const nav = page.getByTestId('government-nav');
    await expect(nav.getByRole('link')).toHaveText(['Overview', 'Severity', 'Stay Duration', 'Transfer', 'Discharge', 'Forecast', 'Association Rules']);
    for (const forbidden of ['Nurse', 'Doctor', 'Admin', 'Patients', 'User management', 'Audit']) {
      await expect(nav).not.toContainText(forbidden);
    }
    const pages: [string, RegExp, string][] = [
      ['Severity', /\/government\/severity$/, 'Severity model'],
      ['Stay Duration', /\/government\/stay$/, 'Stay Duration model'],
      ['Transfer', /\/government\/transfer$/, 'Transfer model'],
      ['Discharge', /\/government\/discharge$/, 'Discharge model'],
      ['Forecast', /\/government\/forecast$/, 'Accident forecast'],
      ['Association Rules', /\/government\/associations$/, 'Association rules'],
    ];
    for (const [link, url, heading] of pages) {
      await nav.getByRole('link', { name: link, exact: true }).click();
      await expect(page).toHaveURL(url);
      await expect(page.locator('main h1')).toHaveText(heading);
    }
    onlyGovernmentCalls(mock);
    expect(unique(mock.gets.filter((g) => g.startsWith('/government/models/')))).toEqual([
      '/government/models/discharge', '/government/models/severity', '/government/models/stay_duration', '/government/models/transfer']);
  });

  test('government cannot open staff dashboards', async ({ page }) => {
    const mock = await setUp(page);
    for (const path of ['/nurse', '/doctor', '/admin', `/admin/episodes/x`, `/doctor/episodes/x`]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/government$/);
    }
    onlyGovernmentCalls(mock);
  });

  test('staff cannot open the government pages', async ({ page }) => {
    await setUp(page, {}, 'nurse');
    await page.route((url) => url.pathname.startsWith('/api/patients') || url.pathname.startsWith('/api/severity'), (route) =>
      route.fulfill({ status: 200, json: [], headers: { 'access-control-allow-origin': '*' } }));
    await page.goto('/government/severity');
    await expect(page).toHaveURL(/\/nurse$/);
  });
});

test.describe('Model pages', () => {
  test('Severity page shows the four official labels with counts, decisions and history', async ({ page }) => {
    const mock = await setUp(page);
    await page.goto('/government/severity');
    await expect(page.getByRole('heading', { name: 'Severity model' })).toBeVisible();
    await expect(page.getByTestId('aggregate-note')).toHaveText('Aggregate statistics across the hospital network. No individual patient records are shown.');
    const table = page.getByTestId('current-distribution');
    await expect(table.locator('tbody tr td:first-child')).toHaveText(LABELS.severity);
    await expect(table.locator('tbody tr').nth(0)).toContainText('6');
    await expect(table.locator('tbody tr').nth(0)).toContainText('60.0%');
    await expect(table.locator('tbody tr').nth(3)).toContainText('DEFER TO CLINICAL JUDGEMENT');
    await expect(table.locator('tbody tr').nth(3)).toContainText('10.0%');
    await expect(page.getByTestId('decision-distribution').locator('tbody tr td:first-child')).toHaveText(['HIGH', 'BORDERLINE', 'LOW']);
    await expect(page.getByTestId('stat-episodes')).toContainText('10');
    await expect(page.getByTestId('stat-acceptance')).toContainText('87.5%');
    await expect(page.getByTestId('stat-decisions')).toContainText('Made by the nurse');
    await expect(page.getByTestId('monthly-table')).toContainText('Sep 2026');
    await expect(page.getByTestId('hospital-table')).toContainText('DGH – Vavuniya');
    for (const retired of RETIRED) await expect(page.locator('main')).not.toContainText(retired);
    // Only Severity information on the Severity page.
    for (const other of ['2-3 days', 'No transfer', 'Partial recovery', 'Forecast unavailable', 'Apriori']) {
      await expect(page.getByTestId('government-severity')).not.toContainText(other);
    }
    await expectReadOnly(page);
    expect(unique(mock.gets)).toEqual(['/government/models/severity']);
    onlyGovernmentCalls(mock);
  });

  test('Stay Duration page shows its three outputs and model failures separately', async ({ page }) => {
    const mock = await setUp(page);
    await page.goto('/government/stay');
    await expect(page.getByRole('heading', { name: 'Stay Duration model' })).toBeVisible();
    await expect(page.getByTestId('current-distribution').locator('tbody tr td:first-child')).toHaveText(LABELS.stay_duration);
    await expect(page.getByTestId('current-distribution')).toContainText('50.0%');
    await expect(page.getByTestId('stat-unavailable')).toContainText('2 patient episodes: the model could not produce a prediction');
    await expect(page.getByTestId('stat-decisions')).toContainText('Made by the doctor');
    for (const retired of RETIRED) await expect(page.locator('main')).not.toContainText(retired);
    await expectReadOnly(page);
    expect(unique(mock.gets)).toEqual(['/government/models/stay_duration']);
  });

  test('Transfer page keeps model predictions apart from operational transfer requests', async ({ page }) => {
    const mock = await setUp(page);
    await page.goto('/government/transfer');
    await expect(page.getByRole('heading', { name: 'Transfer model' })).toBeVisible();
    await expect(page.getByTestId('current-distribution').locator('tbody tr td:first-child')).toHaveText(['Transfer', 'No transfer']);
    await expect(page.getByTestId('current-distribution')).toContainText('70.0%');
    const operational = page.getByTestId('operational-transfers');
    await expect(page.getByRole('heading', { name: 'Operational transfer requests (not model output)' })).toBeVisible();
    await expect(operational).toContainText('Requested — awaiting authorization');
    await expect(operational.locator('tbody tr').nth(2)).toContainText('Transferred');
    await expectReadOnly(page);
    expect(unique(mock.gets)).toEqual(['/government/models/transfer', '/government/statistics']);
    onlyGovernmentCalls(mock);
  });

  test('Discharge page uses exactly the three discharge outcomes', async ({ page }) => {
    const mock = await setUp(page);
    await page.goto('/government/discharge');
    await expect(page.getByRole('heading', { name: 'Discharge model' })).toBeVisible();
    await expect(page.getByTestId('current-distribution').locator('tbody tr td:first-child')).toHaveText(LABELS.discharge);
    await expect(page.getByText('No final decisions have been recorded yet.')).toBeVisible();
    await expect(page.getByTestId('stat-acceptance')).toContainText('—');
    await expectReadOnly(page);
    expect(unique(mock.gets)).toEqual(['/government/models/discharge']);
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
    for (const model of ['HIGH', 'BORDERLINE', 'DEFER TO CLINICAL JUDGEMENT', '2-3 days', 'No transfer']) {
      await expect(page.locator('main')).not.toContainText(model);
    }
    await expectReadOnly(page);
    expect(unique(mock.gets)).toEqual(['/government/accident-forecast?horizon=6', '/government/accident-historical-trends', '/government/accident-trends']);
  });

  test('Association Rules page shows the precomputed rules read-only, with filters', async ({ page }) => {
    const mock = await setUp(page);
    await page.goto('/government/associations');
    await expect(page.getByRole('heading', { name: 'Association rules' })).toBeVisible();
    await expect(page.getByText('Helmet Worn: no')).toBeVisible();
    await expect(page.getByTestId('government-associations')).toContainText('not outputs of the Severity model');
    await page.getByRole('button', { name: '→ severity_label: high (dataset)' }).click();
    await expect.poll(() => mock.gets.at(-1)).toBe('/government/association-rules?consequent=severity_label%3Dhigh&limit=100&sort_by=lift');
    await expectReadOnly(page, ['All rules', '→ severity_label: high (dataset)', '→ severity_label: low (dataset)', 'By lift', 'By confidence', 'By support']);
    onlyGovernmentCalls(mock);
  });
});

test.describe('Loading, empty and error states', () => {
  test('nothing is shown as a number while loading', async ({ page }) => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => { release = resolve; });
    await setUp(page, {
      '/government/models/severity': async (route) => {
        await gate;
        return route.fulfill({ status: 200, json: SUMMARIES.severity, headers: { 'access-control-allow-origin': '*' } });
      },
    });
    await page.goto('/government/severity');
    await expect(page.getByRole('heading', { name: 'Severity model' })).toBeVisible();
    await expect(page.getByTestId('key-statistics')).toHaveCount(0);
    await expect(page.getByTestId('current-distribution')).toHaveCount(0);
    release();
    await expect(page.getByTestId('stat-episodes')).toContainText('10');
  });

  test('an API failure is shown as an error, never as zeros', async ({ page }) => {
    await setUp(page, {
      '/government/models/discharge': (route) => route.fulfill({ status: 500, json: { detail: 'Database unavailable' }, headers: { 'access-control-allow-origin': '*' } }),
    });
    await page.goto('/government/discharge');
    await expect(page.getByRole('alert')).toContainText('Database unavailable');
    await expect(page.getByTestId('key-statistics')).toHaveCount(0);
    await expect(page.getByTestId('current-distribution')).toHaveCount(0);
  });

  test('a refused request says the user is not authorized', async ({ page }) => {
    await setUp(page, {
      '/government/models/severity': (route) => route.fulfill({ status: 403, json: { detail: "Access denied. Required roles: ['government']" }, headers: { 'access-control-allow-origin': '*' } }),
    });
    await page.goto('/government/severity');
    await expect(page.getByRole('alert')).toContainText('You are not authorized to view this information.');
  });

  test('empty data shows explicit empty messages', async ({ page }) => {
    await setUp(page, {
      '/government/models/transfer': (route) => route.fulfill({ status: 200, json: summary('transfer', [0, 0]), headers: { 'access-control-allow-origin': '*' } }),
    });
    await page.goto('/government/transfer');
    await expect(page.getByText('No predictions have been recorded yet.')).toBeVisible();
    await expect(page.getByText('No final decisions have been recorded yet.')).toBeVisible();
    await expect(page.getByText('No hospital has recorded a prediction yet.')).toBeVisible();
  });

  test('partially available statistics: one section fails, the rest still shows', async ({ page }) => {
    await setUp(page, {
      '/government/statistics': (route) => route.fulfill({ status: 503, json: { detail: 'Statistics are temporarily unavailable.' }, headers: { 'access-control-allow-origin': '*' } }),
    });
    await page.goto('/government/transfer');
    await expect(page.getByTestId('current-distribution')).toContainText('No transfer');
    await expect(page.getByRole('alert')).toContainText('Statistics are temporarily unavailable.');
    await expect(page.getByTestId('operational-transfers')).toHaveCount(0);
  });
});
