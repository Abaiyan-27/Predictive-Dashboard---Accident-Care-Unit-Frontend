import { test, expect, type Page, type Request } from '@playwright/test';

/**
 * Admin dashboard, transfer requests (admin → nurse), and first sign-in password
 * change, with the API mocked at the network layer. Each test checks the
 * requests actually sent, not just what is on screen.
 */

const ACCIDENT = '66666666-6666-6666-6666-666666666666';
const TRANSFER = '77777777-7777-7777-7777-777777777777';
const HOSP_A = 'hosp-a';
const HOSP_C = 'hosp-c';

function fakeToken(sub: string): string {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'HS256' })}.${encode({ sub, exp: Math.floor(Date.now() / 1000) + 3600 })}.sig`;
}

const prediction = (title: string, label: string) => ({
  title, state: 'PREDICTION_AVAILABLE',
  prediction: { prediction_id: `p-${label}`, prediction: label, status: 'OK', probability: 0.7,
    predicted_at: '2026-10-03T10:00:00Z', stale: false, stale_reason: null },
});

function transfer(status: string, overrides: Record<string, unknown> = {}) {
  return {
    transfer_id: TRANSFER, accident_id: ACCIDENT, from_hospital_id: HOSP_A, to_hospital_id: HOSP_C, status,
    request_message: 'Prepare Patient A for transfer.', requested_by: 'admin-1', requested_by_name: 'Admin One',
    requested_at: '2026-10-03T11:00:00Z', authorized_by_name: status === 'pending_authorization' ? null : 'Admin One',
    authorization_reason: null, authorized_at: status === 'pending_authorization' ? null : '2026-10-03T11:05:00Z',
    rejected_by_name: null, rejection_reason: null, processed_by: null, processed_by_name: null, processed_at: null,
    processing_note: null, decided_at: null, state_of_transfer: null, patient_name: 'Patient A',
    source_hospital: 'DGH – Vavuniya', destination_hospital: 'DGH – Kilinochchi', allowed_actions: [],
    ...overrides,
  };
}

interface Mock { posts: Request[]; gets: string[] }

async function setUp(page: Page, role: 'admin' | 'nurse', routes: Record<string, (req: Request) => unknown>) {
  const mock: Mock = { posts: [], gets: [] };
  await page.addInitScript(({ token, role }) => {
    localStorage.setItem('ac_token', token);
    localStorage.setItem('ac_user', JSON.stringify({ id: `${role}-1`, name: `${role} One`, email: `${role}@example.org`,
      role, hospital_id: 'hosp-a', hospital_name: 'DGH – Vavuniya' }));
  }, { token: fakeToken(`${role}-1`), role });
  // Only API calls: a '**/api/**' glob would also catch Vite's /src/api/*.ts modules.
  await page.route((url) => url.pathname.startsWith('/api/'), async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api/, '');
    const cors = {
      'access-control-allow-origin': request.headers().origin ?? '*',
      'access-control-allow-headers': 'authorization, content-type',
      'access-control-allow-methods': 'GET, POST, PATCH, OPTIONS',
    };
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    if (request.method() === 'GET') mock.gets.push(`${path}${url.search}`);
    else mock.posts.push(request);
    const handler = routes[`${request.method()} ${path}`];
    if (!handler) return route.fulfill({ status: 404, json: { detail: `unmocked ${request.method()} ${path}` }, headers: cors });
    const result = handler(request) as { __status?: number; body?: unknown } | unknown;
    const wrapped = result && typeof result === 'object' && '__status' in (result as object)
      ? result as { __status: number; body: unknown } : { __status: request.method() === 'POST' ? 200 : 200, body: result };
    return route.fulfill({ status: wrapped.__status, json: wrapped.body, headers: cors });
  });
  return mock;
}

const dialog = (page: Page) => page.getByRole('alertdialog');
const sent = (mock: Mock) => mock.posts.map((r) => `${r.method()} ${new URL(r.url()).pathname}`);

const PATIENT_ROW = {
  accident_id: ACCIDENT, created_at: '2026-10-03T09:00:00Z', status: 'intake',
  patient: { patient_id: 'pt-1', full_name: 'Patient A', age: '8', gender: 'Female' },
  stay_duration: prediction('Stay Duration', '2-3 days'), transfer: prediction('Transfer', 'Transfer'), open_transfer: null,
};

function episode(open: ReturnType<typeof transfer> | null) {
  return {
    accident_id: ACCIDENT, patient: PATIENT_ROW.patient,
    episode: { created_at: '2026-10-03T09:00:00Z', status: 'intake', hospital_id: HOSP_A, hospital_name: 'DGH – Vavuniya',
      incident_at: null, injuries: [{ site_of_injury: 'chest injury', type_of_injury: 'dislocation' }] },
    stays: [{ id: 's1', hospital_id: HOSP_A, hospital_name: 'DGH – Vavuniya', entered_at: '2026-10-03T09:00:00Z', exited_at: null }],
    predictions: { stay_duration: PATIENT_ROW.stay_duration, transfer: PATIENT_ROW.transfer },
    transfers: open ? [open] : [], open_transfer: open, can_request_transfer: !open,
  };
}

const NETWORK = [{ hospital_id: HOSP_C, name: 'DGH – Kilinochchi', district: 'Kilinochchi', type: 'DGH' },
  { hospital_id: 'hosp-b', name: 'DGH – Mannar', district: 'Mannar', type: 'DGH' }];

test.describe('Admin dashboard', () => {
  test('patient list shows basics with Stay and Transfer predictions only', async ({ page }) => {
    await setUp(page, 'admin', { 'GET /admin/patients': () => [PATIENT_ROW] });
    await page.goto('/admin');
    const table = page.getByTestId('admin-patients');
    await expect(table).toContainText('Patient A');
    await expect(table).toContainText('8 / Female');
    await expect(table).toContainText('2-3 days');
    await expect(table).toContainText('Transfer');
    for (const forbidden of ['Severity', 'Discharge', 'Accept', 'Priority', 'Moderate']) {
      await expect(page.locator('body')).not.toContainText(forbidden);
    }
    await table.getByText('Patient A').click();
    await expect(page).toHaveURL(new RegExp(`/admin/episodes/${ACCIDENT}$`));
  });

  test('episode view is read-only and requesting a transfer waits for confirmation', async ({ page }) => {
    let current: ReturnType<typeof transfer> | null = null;
    const mock = await setUp(page, 'admin', {
      [`GET /admin/episodes/${ACCIDENT}`]: () => episode(current),
      'GET /admin/network-hospitals': () => NETWORK,
      'POST /admin/transfers': () => { current = transfer('pending_authorization', { allowed_actions: ['authorize', 'reject'] }); return { __status: 201, body: current }; },
    });
    await page.goto(`/admin/episodes/${ACCIDENT}`);
    await expect(page.getByTestId('admin-stay')).toContainText('2-3 days');
    await expect(page.getByTestId('admin-transfer')).toContainText('Transfer');
    await expect(page.getByTestId('hospital-stays')).toContainText('DGH – Vavuniya');
    // No clinical controls of any kind.
    for (const forbidden of ['Do you want to accept', 'Reject / Make my own decision', 'Save treatment', 'Show AI explanation', 'Severity', 'Discharge']) {
      await expect(page.locator('body')).not.toContainText(forbidden);
    }

    await page.selectOption('#destination', HOSP_C);
    await page.fill('#transfer-message', 'Prepare Patient A for transfer.');
    await page.getByRole('button', { name: 'Send transfer request' }).click();
    await expect(dialog(page)).toContainText('DGH – Kilinochchi');
    expect(mock.posts).toHaveLength(0);
    await dialog(page).getByRole('button', { name: 'Cancel' }).click();
    expect(mock.posts).toHaveLength(0);

    await page.getByRole('button', { name: 'Send transfer request' }).click();
    await dialog(page).getByRole('button', { name: 'Yes, continue' }).click();
    await expect(page.getByRole('status')).toContainText('Transfer request sent');
    expect(sent(mock)).toEqual(['POST /api/admin/transfers']);
    expect(mock.posts[0].postDataJSON()).toEqual({ accident_id: ACCIDENT, to_hospital_id: HOSP_C, message: 'Prepare Patient A for transfer.' });
    await expect(page.getByTestId(`transfer-${TRANSFER}`)).toContainText('Requested — awaiting authorization');
    await expect(page.getByTestId(`transfer-${TRANSFER}`)).toContainText('Prepare Patient A for transfer.');
  });

  test('transfers tab: authorize and reject (with reason) after confirmation', async ({ page }) => {
    const mock = await setUp(page, 'admin', {
      'GET /admin/patients': () => [],
      'GET /admin/transfers': () => [transfer('pending_authorization', { allowed_actions: ['authorize', 'reject'] })],
      [`POST /admin/transfers/${TRANSFER}/authorize`]: () => transfer('authorized'),
      [`POST /admin/transfers/${TRANSFER}/reject`]: () => transfer('rejected'),
    });
    await page.goto('/admin');
    await page.getByRole('tab', { name: 'Transfers' }).click();
    await expect(page.getByTestId(`transfer-${TRANSFER}`)).toContainText('Requested by Admin One');

    await page.getByRole('button', { name: 'Authorize' }).click();
    await expect(dialog(page)).toBeVisible();
    expect(mock.posts).toHaveLength(0);
    await dialog(page).getByRole('button', { name: 'Yes, continue' }).click();
    await expect(dialog(page)).toBeHidden();
    expect(sent(mock)).toEqual([`POST /api/admin/transfers/${TRANSFER}/authorize`]);

    await page.getByRole('button', { name: 'Reject', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Reject with this reason' })).toBeDisabled();
    await page.getByLabel('Rejection reason').fill('Destination full');
    await page.getByRole('button', { name: 'Reject with this reason' }).click();
    expect(mock.posts).toHaveLength(1);
    await dialog(page).getByRole('button', { name: 'Yes, continue' }).click();
    await expect(dialog(page)).toBeHidden();
    expect(sent(mock)[1]).toBe(`POST /api/admin/transfers/${TRANSFER}/reject`);
    expect(mock.posts[1].postDataJSON()).toEqual({ reason: 'Destination full' });
  });

  test('users: own-hospital staff list, account creation after confirmation, temporary password shown', async ({ page }) => {
    const mock = await setUp(page, 'admin', {
      'GET /admin/patients': () => [],
      'GET /admin/users': () => [
        { user_id: 'u1', name: 'Nurse One', email: 'n1@example.org', role: 'nurse', hospital_id: HOSP_A, created_at: null },
        { user_id: 'u2', name: 'Doctor One', email: 'd1@example.org', role: 'doctor', hospital_id: HOSP_A, created_at: null },
      ],
      'POST /admin/users': () => ({ __status: 201, body: { user_id: 'u3', name: 'New Nurse', email: 'new@example.org', role: 'nurse',
        hospital_id: HOSP_A, created_at: null, temporary_password: 'Tmp-Once-123', must_change_password: true } }),
    });
    await page.goto('/admin');
    await page.getByRole('tab', { name: 'User management' }).click();
    await expect(page.getByTestId('staff-table')).toContainText('Nurse One');
    await expect(page.getByTestId('staff-table')).toContainText('Doctor One');
    await expect(page.locator('#user-role option')).toHaveText(['Nurse', 'Doctor', 'Administrator']);

    await page.fill('#user-name', 'New Nurse');
    await page.fill('#user-email', 'new@example.org');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(dialog(page)).toContainText('nurse account for New Nurse');
    expect(mock.posts).toHaveLength(0);
    await dialog(page).getByRole('button', { name: 'Yes, create' }).click();
    await expect(page.getByRole('status')).toContainText('Tmp-Once-123');
    const body = mock.posts[0].postDataJSON();
    expect(body).toEqual({ name: 'New Nurse', email: 'new@example.org', role: 'nurse' });   // no hospital_id, no password
  });

  test('audit log shows readable transfer and decision details, filters and pages', async ({ page }) => {
    const transferLog = { log_id: 'l1', actor_id: 'n-2', actor_name: 'Nurse Two', role: 'nurse', hospital_id: HOSP_A,
      hospital_name: 'DGH – Vavuniya', action_type: 'transfer_completed', accident_id: ACCIDENT, patient_name: 'Patient A',
      timestamp: '2026-10-03T12:00:00Z', details: { transfer_id: TRANSFER, from_hospital: 'DGH – Vavuniya',
        to_hospital: 'DGH – Kilinochchi', old_status: 'authorized', new_status: 'approved',
        requested_by_name: 'Admin One', authorized_by_name: 'Admin One', processed_by_name: 'Nurse Two',
        message: 'Prepare Patient A for transfer.' } };
    const decisionLog = { ...transferLog, log_id: 'l2', actor_name: 'Doctor One', role: 'doctor', action_type: 'transfer_prediction_overridden',
      details: { model: 'transfer', model_prediction: 'Transfer', final_decision: 'No transfer', decision_source: 'DOCTOR', reason: 'Stable' } };
    const many = Array.from({ length: 25 }, (_, i) => ({ ...transferLog, log_id: `x${i}` }));
    const mock = await setUp(page, 'admin', {
      'GET /admin/patients': () => [],
      'GET /admin/audit-logs': (req) => {
        const params = new URL(req.url()).searchParams;
        if (params.get('action') === 'transfer_*') return [transferLog];
        if (params.get('offset') === '25') return [decisionLog];
        return [transferLog, decisionLog, ...many.slice(2)];
      },
    });
    await page.goto('/admin');
    await page.getByRole('tab', { name: 'Audit log' }).click();
    const table = page.getByTestId('audit-log-table');
    for (const header of ['Time', 'Actor', 'Role', 'Action', 'Patient', 'Transfer', 'Details']) {
      await expect(table.locator('th', { hasText: header })).toHaveCount(1);
    }
    const first = table.locator('tbody tr').first();
    await expect(first).toContainText('Nurse Two');
    await expect(first).toContainText('Patient transferred');
    await expect(first).toContainText('From: DGH – Vavuniya · To: DGH – Kilinochchi');
    await expect(first).toContainText('Authorized by: Admin One');
    await expect(first).toContainText('Status: authorized → transferred');
    await expect(first).toContainText('Requested by: Admin One');
    await expect(first).toContainText('Processed by: Nurse Two');
    const decision = table.locator('tbody tr').nth(1);
    await expect(decision).toContainText('Transfer prediction overridden');
    await expect(decision).toContainText('Transfer — model prediction: Transfer');
    await expect(decision).toContainText('Final decision: No transfer');
    await expect(decision).toContainText('Source: doctor override');
    await expect(table).not.toContainText('{"');                    // no raw JSON

    await page.getByRole('button', { name: 'Load more' }).click();
    await expect(table.locator('tbody tr')).toHaveCount(26);
    expect(mock.gets.some((g) => g.includes('offset=25'))).toBe(true);
    await page.selectOption('#log-filter', 'transfer_*');
    await expect(table.locator('tbody tr')).toHaveCount(1);
    expect(mock.gets.some((g) => g.includes('action=transfer_*') || g.includes('action=transfer_%2A'))).toBe(true);
  });
});

test.describe('Nurse transfer requests', () => {
  function nurseRoutes(status: string, onProcess?: () => void) {
    return {
      'GET /patients/my': () => [],
      'GET /patients/transfer-states': () => ['tranfer without any support', 'cervical collar used during transfer'],
      'GET /patients/transfer-requests': () => [transfer(status, { allowed_actions: status === 'authorized' ? ['complete', 'not_transferred'] : [] })],
      [`POST /patients/transfer-requests/${TRANSFER}/process`]: () => { onProcess?.(); return transfer('approved'); },
    };
  }

  test('nurse sees a pending request with the admin message, but cannot process it yet', async ({ page }) => {
    await setUp(page, 'nurse', nurseRoutes('pending_authorization'));
    await page.goto('/nurse');
    const card = page.getByTestId('nurse-transfer-requests');
    await expect(card).toContainText('Prepare Patient A for transfer.');
    await expect(card).toContainText('Requested by Admin One');
    await expect(card).toContainText('Waiting for the administrator to authorize');
    await expect(card.getByRole('button', { name: 'Patient transferred' })).toHaveCount(0);
  });

  test('nurse records the physical transfer only after confirmation', async ({ page }) => {
    const mock = await setUp(page, 'nurse', nurseRoutes('authorized'));
    await page.goto('/nurse');
    const card = page.getByTestId('nurse-transfer-requests');
    await expect(card.getByRole('button', { name: 'Patient transferred' })).toBeDisabled();
    await expect(card.getByRole('button', { name: 'Not transferred' })).toBeDisabled();
    await card.locator(`#state-${TRANSFER}`).selectOption('cervical collar used during transfer');
    await card.getByRole('button', { name: 'Patient transferred' }).click();
    await expect(dialog(page)).toContainText('DGH – Kilinochchi');
    expect(mock.posts).toHaveLength(0);
    await dialog(page).getByRole('button', { name: 'Yes, record' }).click();
    await expect(dialog(page)).toBeHidden();
    expect(sent(mock)).toEqual([`POST /api/patients/transfer-requests/${TRANSFER}/process`]);
    expect(mock.posts[0].postDataJSON()).toEqual({ outcome: 'transferred', state_of_transfer: 'cervical collar used during transfer' });
  });

  test('not transferred needs a note and is confirmed first', async ({ page }) => {
    const mock = await setUp(page, 'nurse', nurseRoutes('authorized'));
    await page.goto('/nurse');
    const card = page.getByTestId('nurse-transfer-requests');
    await card.locator(`#note-${TRANSFER}`).fill('Patient refused');
    await card.getByRole('button', { name: 'Not transferred' }).click();
    expect(mock.posts).toHaveLength(0);
    await dialog(page).getByRole('button', { name: 'Yes, record' }).click();
    await expect(dialog(page)).toBeHidden();
    expect(mock.posts[0].postDataJSON()).toEqual({ outcome: 'not_transferred', note: 'Patient refused' });
  });
});

test('a temporary password must be replaced at first sign-in', async ({ page }) => {
  const posts: Request[] = [];
  let changed = false;
  await page.route((url) => url.pathname.startsWith('/api/'), async (route) => {
    const request = route.request();
    const cors = { 'access-control-allow-origin': request.headers().origin ?? '*',
      'access-control-allow-headers': 'authorization, content-type', 'access-control-allow-methods': 'GET, POST, OPTIONS' };
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    const path = new URL(request.url()).pathname;
    if (request.method() === 'POST') posts.push(request);
    if (path === '/api/auth/login') {
      if (!changed) return route.fulfill({ status: 403, json: { detail: 'PASSWORD_CHANGE_REQUIRED' }, headers: cors });
      return route.fulfill({ status: 200, headers: cors, json: { token: fakeToken('nurse-9'),
        user: { user_id: 'nurse-9', name: 'New Nurse', email: 'new@example.org', role: 'nurse', hospital_id: HOSP_A } } });
    }
    if (path === '/api/auth/change-password') { changed = true; return route.fulfill({ status: 204, headers: cors }); }
    return route.fulfill({ status: 200, json: [], headers: cors });
  });
  await page.goto('/login');
  await page.fill('input[type="email"]', 'new@example.org');
  await page.fill('#password', 'Tmp-Once-123');
  await page.click('button[type="submit"]');
  await expect(page.getByRole('heading', { name: 'Set your password' })).toBeVisible();
  await page.fill('#new-password', 'MyOwnPass123');
  await page.fill('#confirm-password', 'MyOwnPass123');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/nurse/);
  const calls = posts.map((r) => new URL(r.url()).pathname);
  expect(calls).toEqual(['/api/auth/login', '/api/auth/change-password', '/api/auth/login']);
  expect(posts[1].postDataJSON()).toEqual({ email: 'new@example.org', current_password: 'Tmp-Once-123', new_password: 'MyOwnPass123' });
  expect(posts[2].postDataJSON()).toEqual({ email: 'new@example.org', password: 'MyOwnPass123' });
});

test.describe('Admin consistency', () => {
  test('transfer buttons follow the backend\'s allowed actions only', async ({ page }) => {
    const rows = [
      transfer('rejected', { transfer_id: 't-rejected', rejected_by_name: 'Admin One', rejection_reason: 'No bed', allowed_actions: [] }),
      transfer('authorized', { transfer_id: 't-auth', allowed_actions: ['reject'] }),
      transfer('rejected', { transfer_id: 't-not', processed_by: 'n-1', processed_by_name: 'Nurse Two', processed_at: '2026-10-03T12:00:00Z', processing_note: 'Family refused', allowed_actions: [] }),
    ];
    await setUp(page, 'admin', { 'GET /admin/patients': () => [], 'GET /admin/transfers': () => rows });
    await page.goto('/admin');
    await page.getByRole('tab', { name: 'Transfers' }).click();
    const rejected = page.getByTestId('transfer-t-rejected').locator('..');
    await expect(page.getByTestId('transfer-t-rejected')).toContainText('Rejected by administrator');
    await expect(rejected.getByRole('button')).toHaveCount(0);
    const authorized = page.getByTestId('transfer-t-auth').locator('..');
    await expect(page.getByTestId('transfer-t-auth')).toContainText('Authorized — awaiting transfer');
    await expect(authorized.getByRole('button', { name: 'Authorize' })).toHaveCount(0);
    await expect(authorized.getByRole('button', { name: 'Reject' })).toBeVisible();
    await expect(page.getByTestId('transfer-t-not')).toContainText('Not transferred');
    await expect(page.getByTestId('transfer-t-not')).toContainText('Recorded as not transferred by Nurse Two');
  });

  test('an out-of-date prediction is labelled on the patient list, and admin pages have no clinical controls', async ({ page }) => {
    const staleRow = { ...PATIENT_ROW, stay_duration: { ...PATIENT_ROW.stay_duration,
      prediction: { ...PATIENT_ROW.stay_duration.prediction, stale: true, stale_reason: 'Treatment changed' } } };
    await setUp(page, 'admin', { 'GET /admin/patients': () => [staleRow] });
    await page.goto('/admin');
    await expect(page.getByTestId('admin-patients').getByTestId('stale-notice')).toHaveText('Out of date — new prediction required');
    for (const forbidden of ['Severity', 'Discharge', 'Accept', 'Make my own decision', 'Save treatment', 'AI explanation']) {
      await expect(page.locator('main')).not.toContainText(forbidden);
    }
    // Keyboard users can open the patient from its name.
    await page.getByRole('button', { name: 'Patient A' }).focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(new RegExp(`/admin/episodes/${ACCIDENT}$`));
  });
});
