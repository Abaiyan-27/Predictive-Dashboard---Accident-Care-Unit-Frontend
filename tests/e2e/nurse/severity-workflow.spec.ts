import { test, expect, type Page, type Request } from '@playwright/test';

/**
 * Nurse Severity workflow in the browser, with the API mocked at the network
 * layer: every save must wait for "Are you sure?", and decisions must be sent
 * for the exact prediction shown. No backend or Supabase is needed.
 */

const ACCIDENT = '11111111-1111-1111-1111-111111111111';
const PATIENT = '22222222-2222-2222-2222-222222222222';
const PREDICTION = '33333333-3333-3333-3333-333333333333';

function fakeToken(): string {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'HS256' })}.${encode({ sub: 'nurse-1', exp: Math.floor(Date.now() / 1000) + 3600 })}.sig`;
}

function workflow(overrides: Record<string, unknown> = {}) {
  return {
    accident_id: ACCIDENT,
    state: 'PREDICTION_AVAILABLE',
    basic_complete: true,
    inputs: { recorded: 11, total: 12, minimum: 2, complete: false, ready: true,
      missing: ['secondary_site_of_injury'], model_available: true, model_message: null },
    prediction: { prediction_id: PREDICTION, prediction: 'HIGH', status: 'OK', probability: 0.38,
      completeness: 0.917, message: null, predicted_at: '2026-10-03T10:00:00Z', is_defer: false,
      stale: false, stale_reason: null },
    decision: null,
    final_severity: null,
    locks: { severity_inputs: false, later_model_inputs: false, fields: [] },
    can_run: true,
    can_accept: true,
    can_override: true,
    ...overrides,
  };
}

const ACCEPTED = workflow({
  state: 'ACCEPTED',
  decision: { decision_id: 'd1', prediction_id: PREDICTION, final_decision: 'HIGH', decision_source: 'MODEL',
    decided_by: 'nurse-1', decided_at: '2026-10-03T10:05:00Z', reason: null, model_prediction: 'HIGH' },
  final_severity: 'HIGH',
  locks: { severity_inputs: true, later_model_inputs: false,
    fields: ['incident_at', 'age', 'mode_of_travel_during_accident', 'collision_with', 'vehicle_type', 'helmet_worn',
      'passenger_type', 'mode_of_transport', 'time_to_hospital', 'site_of_injury', 'secondary_site_of_injury',
      'other_injury'] },
  can_run: false, can_accept: false, can_override: false,
});

const ACCIDENT_ROW = {
  accident_id: ACCIDENT, patient_id: PATIENT, hospital_id: 'hosp-a', created_by: 'nurse-2',
  created_at: '2026-10-03T09:00:00Z', collision_with: 'motorbike', vehicle_type: 'motor cyclist',
  incident_at: '2026-09-01T19:00:00+00:00', helmet_worn: 'no', passenger_type: 'driver',
  mode_of_transport: 'other vehicle', time_to_hospital: '30 minutes - 1 hour',
  mode_of_travel_during_accident: 'three wheeler passenger', other_injury: 'no other injury',
  Patient: { patient_id: PATIENT, full_name: 'Registered By Nurse Two', age: '25', gender: 'Female' },
  Injury_Description: [{ injury_order: 1, site_of_injury: 'chest injury', type_of_injury: 'contusion' }],
};

interface Mock {
  requests: Request[];
  status: Record<string, unknown>;
  treatment: Record<string, unknown>;
}

const NO_TREATMENT = { records: [], recorded: false, locked: false, lock_reason: null, can_record: true };

async function setUp(page: Page, initialStatus: Record<string, unknown> = workflow()): Promise<Mock> {
  const mock: Mock = { requests: [], status: initialStatus, treatment: NO_TREATMENT };
  await page.addInitScript((token) => {
    localStorage.setItem('ac_token', token);
    localStorage.setItem('ac_user', JSON.stringify({
      id: 'nurse-1', name: 'Nurse One', email: 'n1@example.org', role: 'nurse',
      hospital_id: 'hosp-a', hospital_name: 'DGH – Vavuniya',
    }));
  }, fakeToken());

  // Only API calls: a '**/api/**' glob would also catch Vite's /src/api/*.ts modules.
  await page.route((url) => url.pathname.startsWith('/api/'), async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api/, '');
    const method = request.method();
    // The app may call the API on another origin (VITE_API_URL), so answer like a CORS server.
    const cors = {
      'access-control-allow-origin': request.headers().origin ?? '*',
      'access-control-allow-headers': 'authorization, content-type',
      'access-control-allow-methods': 'GET, POST, PATCH, OPTIONS',
    };
    if (method === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    if (method !== 'GET') mock.requests.push(request);
    const json = (body: unknown, status = 200) => route.fulfill({ status, json: body, headers: cors });

    if (method === 'GET' && path === '/patients/my') return json([{ ...ACCIDENT_ROW, severity_workflow: mock.status }]);
    if (method === 'GET' && path === `/patients/${PATIENT}`) {
      return json({ ...ACCIDENT_ROW.Patient, accident_records: [ACCIDENT_ROW] });
    }
    if (method === 'GET' && path === `/severity/accidents/${ACCIDENT}`) return json(mock.status);
    if (method === 'POST' && path === '/patients/intake') {
      return json({ patient: { patient_id: PATIENT, full_name: 'New Patient', age: null, gender: null },
        accident_record: { accident_id: ACCIDENT, patient_id: PATIENT },
        injuries: [], severity: workflow({ state: 'WAITING_FOR_INPUTS', prediction: null, can_accept: false,
          can_override: false, can_run: false }) }, 201);
    }
    if (method === 'PATCH' && path === `/patients/intake/${ACCIDENT}`) {
      return json({ patient: ACCIDENT_ROW.Patient, accident_record: ACCIDENT_ROW, injuries: [], severity: mock.status });
    }
    if (method === 'POST' && path === `/severity/accidents/${ACCIDENT}/run`) return json(mock.status);
    if (method === 'GET' && path === `/accidents/${ACCIDENT}/treatment`) return json(mock.treatment);
    if (method === 'POST' && path === '/treatments') {
      mock.treatment = { records: [{ treatment_id: 't1', number_of_days_stay: 3, investigation_done: 'x-ray',
        management_name_1: 'surgery', management_name_2: null, created_at: '2026-10-03T11:00:00Z' }],
      recorded: true, locked: false, lock_reason: null, can_record: true };
      mock.status = { ...mock.status, locks: { ...(mock.status.locks as object), later_model_inputs: true } };
      return json({ treatment_id: 't1' }, 201);
    }
    if (method === 'POST' && path === `/severity/predictions/${PREDICTION}/decision`) {
      mock.status = ACCEPTED;
      return json(ACCEPTED, 201);
    }
    return json({ detail: `unmocked ${method} ${path}` }, 404);
  });
  await page.goto('/nurse');
  return mock;
}

async function openPatient(page: Page) {
  await page.getByRole('button', { name: /Registered By Nurse Two/ }).click();
  await expect(page.getByTestId('severity-panel')).toBeVisible();
}

const dialog = (page: Page) => page.getByRole('alertdialog');

test.describe('Nurse confirmation and Severity decision', () => {
  test('basic details are not saved until the nurse confirms', async ({ page }) => {
    const mock = await setUp(page);
    await page.fill('input[name="name"]', 'New Patient');
    await page.getByRole('button', { name: 'Save Basic Details' }).click();

    await expect(dialog(page)).toContainText('Are you sure?');
    expect(mock.requests).toHaveLength(0);

    await dialog(page).getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog(page)).toBeHidden();
    expect(mock.requests).toHaveLength(0);

    await page.getByRole('button', { name: 'Save Basic Details' }).click();
    await dialog(page).getByRole('button', { name: 'Yes, save' }).click();
    await expect(page.getByRole('status')).toContainText('Basic details saved');
    expect(mock.requests.map((r) => `${r.method()} ${new URL(r.url()).pathname}`)).toEqual(['POST /api/patients/intake']);
  });

  test('updating details of another nurse\'s patient also asks first', async ({ page }) => {
    const mock = await setUp(page);
    await openPatient(page);
    await page.fill('input[name="name"]', 'Corrected Name');
    await page.getByRole('button', { name: 'Save Basic Details' }).click();
    await expect(dialog(page)).toBeVisible();
    expect(mock.requests).toHaveLength(0);
    await dialog(page).getByRole('button', { name: 'Yes, save' }).click();
    await expect(dialog(page)).toBeHidden();
    expect(mock.requests).toHaveLength(1);
    expect(mock.requests[0].method()).toBe('PATCH');
    expect(mock.requests[0].postDataJSON()).toMatchObject({ full_name: 'Corrected Name' });
    expect(mock.requests[0].postDataJSON()).not.toHaveProperty('hospital_id');
  });

  test('save & run Severity waits for confirmation, then saves and runs', async ({ page }) => {
    const mock = await setUp(page, workflow({ state: 'NOT_RUN', prediction: null, can_accept: false, can_override: false }));
    await openPatient(page);
    await page.getByRole('button', { name: 'Save & Run Severity' }).click();
    await expect(dialog(page)).toBeVisible();
    expect(mock.requests).toHaveLength(0);
    await dialog(page).getByRole('button', { name: 'Yes, save' }).click();
    await expect(dialog(page)).toBeHidden();
    expect(mock.requests.map((r) => `${r.method()} ${new URL(r.url()).pathname}`)).toEqual([
      `PATCH /api/patients/intake/${ACCIDENT}`,
      `POST /api/severity/accidents/${ACCIDENT}/run`,
    ]);
  });

  test('accepting the model prediction is confirmed and sent for the shown prediction', async ({ page }) => {
    const mock = await setUp(page);
    await openPatient(page);
    await expect(page.getByText('Do you want to accept this decision?')).toBeVisible();
    await page.getByRole('button', { name: 'Accept', exact: true }).click();
    await expect(dialog(page)).toContainText('Are you sure?');
    expect(mock.requests).toHaveLength(0);

    await dialog(page).getByRole('button', { name: 'Yes, record decision' }).click();
    await expect(page.getByTestId('severity-decision')).toContainText('Final nurse decision:HIGH');
    await expect(page.getByTestId('severity-decision')).toContainText('Source: model prediction accepted');
    expect(mock.requests).toHaveLength(1);
    expect(new URL(mock.requests[0].url()).pathname).toBe(`/api/severity/predictions/${PREDICTION}/decision`);
    expect(mock.requests[0].postDataJSON()).toEqual({ action: 'accept' });
  });

  test('rejecting lets the nurse choose an actionable label other than the model\'s', async ({ page }) => {
    const mock = await setUp(page);
    await openPatient(page);
    await page.getByRole('button', { name: 'Reject / Make my own decision' }).click();

    const options = page.locator('input[name="override_decision"]');
    await expect(options).toHaveCount(2);
    expect(await options.evaluateAll((nodes) => nodes.map((n) => (n as HTMLInputElement).value))).toEqual(['BORDERLINE', 'LOW']);

    await page.locator('input[value="LOW"]').check();
    await page.fill('#override_reason', 'Stable on review');
    await page.getByRole('button', { name: 'Save my decision' }).click();
    await expect(dialog(page)).toBeVisible();
    expect(mock.requests).toHaveLength(0);
    await dialog(page).getByRole('button', { name: 'Yes, record decision' }).click();
    await expect(dialog(page)).toBeHidden();
    expect(mock.requests[0].postDataJSON()).toEqual({ action: 'override', final_decision: 'LOW', reason: 'Stable on review' });
  });

  test('a DEFER prediction offers a clinical decision among all three labels', async ({ page }) => {
    await setUp(page, workflow({
      state: 'PREDICTION_FAILED', can_accept: false,
      prediction: { ...workflow().prediction as object, prediction: 'DEFER TO CLINICAL JUDGEMENT', status: 'ERROR',
        probability: null, is_defer: true, message: 'Severity inference failed' },
    }));
    await openPatient(page);
    await expect(page.getByRole('button', { name: 'Accept', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Make my clinical decision' }).click();
    await expect(page.locator('input[name="override_decision"]')).toHaveCount(3);
  });

  test('after the decision the Severity inputs are locked and basic details stay editable', async ({ page }) => {
    await setUp(page, ACCEPTED);
    await openPatient(page);
    await expect(page.locator('select[name="collision_type"]')).toBeDisabled();
    await expect(page.locator('input[name="incident_at"]')).toBeDisabled();
    await expect(page.locator('input[name="age"]')).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Save & Run Severity' })).toBeDisabled();
    await expect(page.locator('input[name="name"]')).toBeEnabled();
    await expect(page.locator('select[name="gender"]')).toBeEnabled();
    await expect(page.locator('select[name="road_type"]')).toBeEnabled();
    await expect(page.getByText(/Locked — the final Severity decision has been recorded/)).toBeVisible();
    // Each locked control points at the explanation.
    await expect(page.locator('select[name="collision_type"]')).toHaveAttribute('aria-describedby', 'lock-severity');
    await expect(page.locator('input[name="age"]')).toHaveAttribute('aria-describedby', 'lock-age');
  });

  test('the page shows only the four contract labels', async ({ page }) => {
    await setUp(page);
    await openPatient(page);
    const text = await page.locator('body').innerText();
    for (const retired of ['Priority', 'Moderate', 'Medium', 'Severity not classified']) {
      expect(text).not.toContain(retired);
    }
  });
});

test.describe('Nurse dashboard consistency', () => {
  test('the list is hospital-wide and another nurse\'s patient can be continued', async ({ page }) => {
    await setUp(page);
    await expect(page.getByRole('heading', { name: 'Hospital patient records' })).toBeVisible();
    await expect(page.getByText('Every patient at your hospital, whichever nurse registered them.')).toBeVisible();
    await expect(page.locator('body')).not.toContainText(/My patient/i);
    // Registered by nurse-2, opened by nurse-1.
    await openPatient(page);
    await expect(page.locator('input[name="name"]')).toHaveValue('Registered By Nurse Two');
  });

  const DEFER_PREDICTION = { ...workflow().prediction as object, prediction: 'DEFER TO CLINICAL JUDGEMENT', probability: null, is_defer: true };
  const STATES: [string, Record<string, unknown>, string][] = [
    ['NOT_RUN', { state: 'NOT_RUN', prediction: null, can_accept: false, can_override: false }, 'Severity — Not yet run'],
    ['WAITING_FOR_INPUTS', { state: 'WAITING_FOR_INPUTS', prediction: null, can_accept: false, can_override: false, can_run: false,
      inputs: { ...workflow().inputs, recorded: 1, ready: false, missing: ['helmet_worn'] } }, 'Severity — Waiting for inputs'],
    ['PREDICTION_AVAILABLE', {}, 'Severity — Prediction available — awaiting nurse decision'],
    ['MODEL_DEFERRED', { state: 'MODEL_DEFERRED', can_accept: false, prediction: { ...DEFER_PREDICTION, status: 'REFUSED' } },
      'Severity — Model deferred — clinical decision required'],
    ['PREDICTION_FAILED', { state: 'PREDICTION_FAILED', can_accept: false, prediction: { ...DEFER_PREDICTION, status: 'ERROR', message: 'inference failed' } },
      'Severity — Prediction failed — clinical decision required'],
    ['ACCEPTED', ACCEPTED, 'Severity — Nurse accepted the model prediction'],
  ];
  for (const [name, overrides, heading] of STATES) {
    test(`Severity state ${name} has its own wording`, async ({ page }) => {
      await setUp(page, name === 'ACCEPTED' ? ACCEPTED : workflow(overrides));
      await openPatient(page);
      const panel = page.getByTestId('severity-panel');
      await expect(panel.locator('h3')).toHaveText(heading);
      await expect(panel).not.toContainText('Severity assessment complete');
      await expect(panel).not.toContainText(/unavailable/i);
      if (name === 'MODEL_DEFERRED') {
        await expect(panel).toContainText('The model did not classify this patient');
        await expect(page.getByRole('button', { name: 'Accept', exact: true })).toHaveCount(0);
        await expect(page.getByRole('button', { name: 'Make my clinical decision' })).toBeVisible();
      }
    });
  }

  test('an out-of-date prediction is marked in the panel and the list, and cannot be decided', async ({ page }) => {
    const stale = workflow({ state: 'NOT_RUN', can_accept: false, can_override: false,
      prediction: { ...workflow().prediction as object, stale: true, stale_reason: 'The Severity inputs changed after this prediction.' } });
    await setUp(page, stale);
    await expect(page.getByTestId('stale-notice').first()).toHaveText('Out of date — new prediction required');
    await openPatient(page);
    const notice = page.getByTestId('severity-panel').getByTestId('stale-notice');
    await expect(notice).toContainText('Out of date — new prediction required');
    await expect(notice).toContainText('The Severity inputs changed after this prediction.');
    await expect(page.getByRole('button', { name: 'Accept', exact: true })).toHaveCount(0);
  });

  test('Escape and Cancel close a confirmation without sending anything', async ({ page }) => {
    const mock = await setUp(page);
    await openPatient(page);
    await page.getByRole('button', { name: 'Accept', exact: true }).click();
    await expect(dialog(page)).toBeVisible();
    await expect(dialog(page).getByRole('button', { name: 'Cancel' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(dialog(page).getByRole('button', { name: 'Yes, record decision' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(dialog(page).getByRole('button', { name: 'Cancel' })).toBeFocused();   // focus stays in the dialog
    await page.keyboard.press('Escape');
    await expect(dialog(page)).toBeHidden();
    await page.getByRole('button', { name: 'Save & Run Severity' }).click();
    await dialog(page).getByRole('button', { name: 'Cancel' }).click();
    expect(mock.requests).toHaveLength(0);
  });
});

test.describe('Nurse enters treatment', () => {
  test('treatment is a nurse input: saved only after confirmation, without a hospital id, then Box 3 locks', async ({ page }) => {
    const mock = await setUp(page);
    await openPatient(page);
    const box = page.getByTestId('nurse-treatment');
    await expect(box).toContainText('No treatment recorded yet.');
    await box.locator('#days').fill('3');
    await box.locator('#investigation').selectOption('x-ray');
    await box.locator('#management1').selectOption('surgery');
    await box.getByRole('button', { name: 'Save treatment' }).click();
    await expect(dialog(page)).toContainText('Are you sure?');
    expect(mock.requests).toHaveLength(0);
    await dialog(page).getByRole('button', { name: 'Yes, save' }).click();
    await expect(box.getByRole('status')).toContainText('Treatment saved');
    await expect(box).toContainText('x-ray · surgery');
    const posted = mock.requests.map((r) => `${r.method()} ${new URL(r.url()).pathname}`);
    expect(posted).toEqual(['POST /api/treatments']);
    const body = mock.requests[0].postDataJSON();
    expect(body).toMatchObject({ accident_id: ACCIDENT, number_of_days_stay: 3, investigation_done: 'x-ray', management_name_1: 'surgery' });
    expect(body).not.toHaveProperty('hospital_id');
    await expect(page.getByRole('button', { name: 'Save Other Inputs' })).toBeDisabled();
  });

  test('locked treatment shows the reason and no form', async ({ page }) => {
    const mock = await setUp(page);
    mock.treatment = { ...NO_TREATMENT, records: [{ treatment_id: 't1', number_of_days_stay: 1, investigation_done: 'mri scan',
      management_name_1: 'surgery', management_name_2: null, created_at: null }], recorded: true, locked: true, can_record: false,
      lock_reason: 'A doctor-model decision has been recorded; new treatment would change the inputs it was based on.' };
    await openPatient(page);
    const box = page.getByTestId('nurse-treatment');
    await expect(box).toContainText('Locked — A doctor-model decision');
    await expect(box.getByRole('button', { name: 'Save treatment' })).toHaveCount(0);
  });
});
