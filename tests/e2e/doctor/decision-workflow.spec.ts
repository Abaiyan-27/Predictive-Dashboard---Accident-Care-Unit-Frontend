import { test, expect, type Page, type Request } from '@playwright/test';

/**
 * Doctor workflow in the browser with the API mocked at the network layer:
 * Severity is read-only, each doctor model has its own Accept / override, every
 * submission waits for "Are you sure?", decisions go to the displayed
 * prediction_id, and a 409 reloads the current state. No backend needed.
 */

const ACCIDENT = '44444444-4444-4444-4444-444444444444';
const PATIENT = '55555555-5555-5555-5555-555555555555';
const IDS = { stay_duration: 'p-stay-1', transfer: 'p-transfer-1', discharge: 'p-discharge-1' };

function fakeToken(): string {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'HS256' })}.${encode({ sub: 'doctor-1', exp: Math.floor(Date.now() / 1000) + 3600 })}.sig`;
}

function model(key: 'stay_duration' | 'transfer' | 'discharge', title: string, labels: string[], label: string, id: string) {
  return {
    model_key: key, title, labels, state: 'PREDICTION_AVAILABLE',
    readiness: { ready: true, missing_required: [], missing_features: [], completeness: 0.9, minimum_completeness: 0.6,
      model_available: true, message: null },
    prediction: { prediction_id: id, status: 'OK', prediction: label, probability: 0.71, probabilities: {},
      completeness: 0.9, message: null, predicted_at: '2026-10-03T10:00:00Z', stale: false, stale_reason: null },
    decision: null, final_decision: null, can_run: true, can_accept: true, can_override: true,
  };
}

function episode(overrides: Record<string, unknown> = {}) {
  return {
    patient: { patient_id: PATIENT, full_name: 'Treated Patient', age: '8', gender: 'Male' },
    accident: { accident_id: ACCIDENT, patient_id: PATIENT, created_at: '2026-10-03T09:00:00Z', status: 'intake',
      incident_at: null, collision_with: 'heavy vehicle', vehicle_type: 'motor cyclist',
      mode_of_travel_during_accident: 'motor cyclist', mode_of_transport: 'ambulance',
      time_to_hospital: '30 minutes - 1 hour', injuries: [{ injury_order: 1, site_of_injury: 'chest injury', type_of_injury: 'dislocation' }] },
    severity: {
      accident_id: ACCIDENT, state: 'OVERRIDDEN', basic_complete: true,
      inputs: { recorded: 11, total: 12, minimum: 2, complete: false, ready: true, missing: [], model_available: true, model_message: null },
      prediction: { prediction_id: 'p-sev', prediction: 'HIGH', status: 'OK', probability: 0.4, completeness: 0.9,
        message: null, predicted_at: null, is_defer: false, stale: false, stale_reason: null },
      decision: { decision_id: 'd-sev', prediction_id: 'p-sev', final_decision: 'LOW', decision_source: 'NURSE',
        decided_by: 'nurse-1', decided_at: null, reason: null, model_prediction: 'HIGH' },
      final_severity: 'LOW',
      locks: { severity_inputs: true, later_model_inputs: true, fields: [] },
      can_run: false, can_accept: false, can_override: false,
    },
    treatment: { records: [{ treatment_id: 't1', number_of_days_stay: 1, investigation_done: 'mri scan',
      management_name_1: 'only medicine and discharge', management_name_2: 'strict bed rest', created_at: '2026-10-03T09:30:00Z' }],
      recorded: true, locked: false, lock_reason: null, can_record: false },
    models: {
      stay_duration: model('stay_duration', 'Stay Duration', ['0-1 days', '2-3 days', '4+ days'], '2-3 days', IDS.stay_duration),
      transfer: model('transfer', 'Transfer', ['Transfer', 'No transfer'], 'Transfer', IDS.transfer),
      discharge: model('discharge', 'Discharge Outcome', ['Complete recovery', 'Partial recovery', 'Further interventions'],
        'Partial recovery', IDS.discharge),
    },
    history: { episodes: [], transfers: [], predictions: [] },
    ...overrides,
  };
}

/** A SHAP explanation as the backend returns it (shape of app/services/shap_explainer.py). */
const SHAP_STAY = {
  model: 'stay_duration', title: 'Expected hospital stay', available: true, prediction: '2-3 days',
  headline: '2-3 days (53% probability)', outcome: '2-3 days',
  probabilities: { '0-1 days': 0.21, '2-3 days': 0.53, '4+ days': 0.26 },
  points_towards: [
    { factor: 'Second treatment', value: 'wound cleaning and dressing', effect: 'moderate', shap: 0.41 },
    { factor: 'Main injury type', value: 'fracture', effect: 'slight', shap: 0.12 },
  ],
  points_away: [{ factor: 'Investigation done', value: 'mri scan', effect: 'moderate', shap: -0.3 }],
  not_recorded: ['Second injury type'], note: null,
  disclaimer: 'Decision support only. The final clinical decision rests with the doctor.',
  method: 'SHAP (LinearExplainer): exact attributions for this logistic-regression model',
  doctor_text: '…', prediction_id: 'p-stay',
};

interface Mock { requests: Request[]; episode: ReturnType<typeof episode>; gets: number; decisionStatus: number }

/** Opens one page of the episode: '' (overview), 'severity', 'stay', 'transfer' or 'discharge'. */
async function setUp(page: Page, initial = episode(), section = ''): Promise<Mock> {
  const mock: Mock = { requests: [], episode: initial, gets: 0, decisionStatus: 201 };
  await page.addInitScript((token) => {
    localStorage.setItem('ac_token', token);
    localStorage.setItem('ac_user', JSON.stringify({ id: 'doctor-1', name: 'Doctor One', email: 'd1@example.org',
      role: 'doctor', hospital_id: 'hosp-a', hospital_name: 'DGH – Vavuniya' }));
  }, fakeToken());

  // Only API calls: a '**/api/**' glob would also catch Vite's /src/api/*.ts modules.
  await page.route((url) => url.pathname.startsWith('/api/'), async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace(/^\/api/, '');
    const method = request.method();
    const cors = {
      'access-control-allow-origin': request.headers().origin ?? '*',
      'access-control-allow-headers': 'authorization, content-type',
      'access-control-allow-methods': 'GET, POST, PATCH, OPTIONS',
    };
    if (method === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    if (method !== 'GET') mock.requests.push(request);
    const json = (body: unknown, status = 200) => route.fulfill({ status, json: body, headers: cors });

    if (method === 'GET' && path === `/doctor/accidents/${ACCIDENT}`) {
      mock.gets += 1;
      return json(mock.episode);
    }
    if (method === 'GET' && path === '/patients/hospital/hosp-a') {
      return json([{ accident_id: ACCIDENT, patient_id: PATIENT, hospital_id: 'hosp-a', created_by: 'nurse-1',
        created_at: '2026-10-03T09:00:00Z', collision_with: 'heavy vehicle', vehicle_type: 'motor cyclist',
        Patient: mock.episode.patient, Injury_Description: [],
        severity_workflow: mock.episode.severity,
        doctor_workflow: { treatment_recorded: true, models: {
          stay_duration: { state: 'PREDICTION_AVAILABLE', prediction: '2-3 days', final_decision: null },
          transfer: { state: 'OVERRIDDEN', prediction: 'Transfer', final_decision: 'No transfer' },
          discharge: { state: 'PREDICTION_AVAILABLE', prediction: 'Partial recovery', final_decision: null } } } }]);
    }
    if (method === 'POST' && path.startsWith(`/doctor/accidents/${ACCIDENT}/predictions/`)) {
      if (mock.decisionStatus === 409) {
        // Another screen moved on: a newer Stay prediction now exists.
        const newer = episode();
        newer.models.stay_duration = model('stay_duration', 'Stay Duration', ['0-1 days', '2-3 days', '4+ days'], '4+ days', 'p-stay-2');
        mock.episode = newer;
        return json({ detail: 'A newer Stay Duration prediction exists. Review it before deciding.' }, 409);
      }
      return json(mock.episode, 201);
    }
    if (method === 'POST' && path === '/xai/explain') return json(SHAP_STAY);
    return json({ detail: `unmocked ${method} ${path}` }, 404);
  });
  await page.goto(`/doctor/episodes/${ACCIDENT}${section ? `/${section}` : ''}`);
  await expect(page.getByTestId('episode-nav')).toBeVisible();
  return mock;
}

const dialog = (page: Page) => page.getByRole('alertdialog');
const panel = (page: Page, key: string) => page.getByTestId(`model-${key}`);
const posted = (mock: Mock) => mock.requests.map((r) => `${r.method()} ${new URL(r.url()).pathname}`);

test.describe('Doctor model decisions', () => {
  test('severity is shown read-only with the nurse decision and its source', async ({ page }) => {
    await setUp(page, episode(), 'severity');
    const severity = page.getByTestId('doctor-severity');
    await expect(severity).toContainText('Read-only');
    await expect(severity).toContainText('Model prediction:HIGH');
    await expect(severity).toContainText('Final nurse decision:LOW');
    await expect(severity.getByTestId('severity-source')).toHaveText('NURSE · Nurse override');
    await expect(severity.getByRole('button')).toHaveCount(0);
    await expect(severity.locator('input, select')).toHaveCount(0);
  });

  test('each doctor model has its own page with its prediction', async ({ page }) => {
    await setUp(page);
    const overview = page.getByTestId('model-overview');
    await expect(overview).toContainText('2-3 days');
    await expect(overview).toContainText('Partial recovery');
    for (const [link, key, label] of [['Stay Duration', 'stay_duration', '2-3 days'], ['Transfer', 'transfer', 'Transfer'],
      ['Discharge', 'discharge', 'Partial recovery']] as const) {
      await page.getByTestId('episode-nav').getByRole('link', { name: link, exact: true }).click();
      await expect(page.getByTestId(`prediction-${key}`)).toHaveText(label);
      await expect(panel(page, key)).toContainText('Do you want to accept this decision?');
      // Only this model is on its page.
      for (const other of ['stay_duration', 'transfer', 'discharge'].filter((k) => k !== key)) {
        await expect(panel(page, other)).toHaveCount(0);
      }
    }
  });

  test('accept waits for confirmation and targets the displayed prediction', async ({ page }) => {
    const mock = await setUp(page, episode(), 'stay');
    await panel(page, 'stay_duration').getByRole('button', { name: 'Accept', exact: true }).click();
    await expect(dialog(page)).toContainText('Are you sure?');
    await expect(dialog(page)).toContainText('2-3 days');
    expect(mock.requests).toHaveLength(0);

    await dialog(page).getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog(page)).toBeHidden();
    expect(mock.requests).toHaveLength(0);

    await panel(page, 'stay_duration').getByRole('button', { name: 'Accept', exact: true }).click();
    await dialog(page).getByRole('button', { name: 'Yes, record decision' }).click();
    await expect(dialog(page)).toBeHidden();
    expect(posted(mock)).toEqual([`POST /api/doctor/accidents/${ACCIDENT}/predictions/${IDS.stay_duration}/decision`]);
    expect(mock.requests[0].postDataJSON()).toEqual({ action: 'accept' });
  });

  test('override offers only valid labels other than the model\'s, then confirms', async ({ page }) => {
    const mock = await setUp(page, episode(), 'transfer');
    const transfer = panel(page, 'transfer');
    await transfer.getByRole('button', { name: 'Reject / Make my own decision' }).click();
    const options = transfer.locator('input[type="radio"]');
    expect(await options.evaluateAll((nodes) => nodes.map((n) => (n as HTMLInputElement).value))).toEqual(['No transfer']);

    await transfer.locator('input[value="No transfer"]').check();
    await transfer.getByLabel('Reason (optional)').fill('Family request');
    await transfer.getByRole('button', { name: 'Save my decision' }).click();
    await expect(dialog(page)).toContainText('No transfer');
    expect(mock.requests).toHaveLength(0);
    await dialog(page).getByRole('button', { name: 'Yes, record decision' }).click();
    await expect(dialog(page)).toBeHidden();
    expect(posted(mock)).toEqual([`POST /api/doctor/accidents/${ACCIDENT}/predictions/${IDS.transfer}/decision`]);
    expect(mock.requests[0].postDataJSON()).toEqual({ action: 'override', final_decision: 'No transfer', reason: 'Family request' });
  });

  test('stay and discharge override options exclude the model prediction', async ({ page }) => {
    await setUp(page);
    for (const [key, expected] of [
      ['stay_duration', ['0-1 days', '4+ days']],
      ['discharge', ['Complete recovery', 'Further interventions']],
    ] as const) {
      await page.goto(`/doctor/episodes/${ACCIDENT}/${key === 'stay_duration' ? 'stay' : key}`);
      await panel(page, key).getByRole('button', { name: 'Reject / Make my own decision' }).click();
      const values = await panel(page, key).locator('input[type="radio"]')
        .evaluateAll((nodes) => nodes.map((n) => (n as HTMLInputElement).value));
      expect(values).toEqual([...expected]);
    }
  });

  test('a stale-prediction conflict shows the error and reloads the current prediction', async ({ page }) => {
    const mock = await setUp(page, episode(), 'stay');
    mock.decisionStatus = 409;
    const before = mock.gets;
    await panel(page, 'stay_duration').getByRole('button', { name: 'Accept', exact: true }).click();
    await dialog(page).getByRole('button', { name: 'Yes, record decision' }).click();
    await expect(page.getByRole('alert')).toContainText('newer Stay Duration prediction');
    expect(mock.gets).toBeGreaterThan(before);
    await expect(page.getByTestId('prediction-stay_duration')).toHaveText('4+ days');
  });

  test('treatment is shown read-only: the doctor enters no model input', async ({ page }) => {
    const mock = await setUp(page);
    const treatment = page.getByTestId('doctor-treatment');
    await expect(treatment).toContainText('Read-only');
    await expect(treatment).toContainText('mri scan');
    await expect(treatment.locator('input, select, textarea, button')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Save treatment' })).toHaveCount(0);
    expect(mock.requests).toHaveLength(0);
  });

  test('decided and locked states show the final decision and no actions', async ({ page }) => {
    const decided = episode();
    decided.models.transfer = { ...decided.models.transfer, state: 'OVERRIDDEN', can_accept: false, can_override: false,
      can_run: false, final_decision: 'No transfer',
      decision: { decision_id: 'd1', prediction_id: IDS.transfer, final_decision: 'No transfer', decision_source: 'DOCTOR',
        decided_by: 'doctor-1', decided_at: null, reason: null, model_prediction: 'Transfer' } } as never;
    decided.treatment = { ...decided.treatment, locked: true, can_record: false,
      lock_reason: 'A doctor-model decision has been recorded; new treatment would change the inputs it was based on.' };
    await setUp(page, decided, 'transfer');
    await expect(page.getByTestId('final-transfer')).toHaveText('No transfer');
    await expect(panel(page, 'transfer').getByRole('button', { name: /Accept|Reject/ })).toHaveCount(0);
    await page.getByTestId('episode-nav').getByRole('link', { name: 'Overview' }).click();
    await expect(page.getByRole('button', { name: 'Save treatment' })).toHaveCount(0);
    await expect(page.getByText(/Locked — A doctor-model decision/)).toBeVisible();
  });

  test('the doctor list shows severity and each model, and no retired terminology anywhere', async ({ page }) => {
    await setUp(page);
    for (const section of ['', '/severity', '/stay', '/transfer', '/discharge']) {
      await page.goto(`/doctor/episodes/${ACCIDENT}${section}`);
      await expect(page.getByTestId('episode-nav')).toBeVisible();
      for (const retired of ['Priority', 'Moderate', 'Medium', 'Severity not classified']) {
        expect(await page.locator('body').innerText()).not.toContain(retired);
      }
    }
    await page.goto('/doctor');
    const row = page.getByRole('button', { name: /Treated Patient/ });
    await expect(row).toContainText('Nurse decision');
    await expect(row).toContainText('Stay: 2-3 days (to review)');
    await expect(row).toContainText('Transfer: No transfer (decided)');
    for (const retired of ['Priority', 'Moderate', 'Medium', 'Severity not classified']) {
      expect(await page.locator('body').innerText()).not.toContain(retired);
    }
    await row.click();
    await expect(page).toHaveURL(new RegExp(`/doctor/episodes/${ACCIDENT}$`));
  });
});

test.describe('Doctor episode layout', () => {
  test('one page per model: Overview, Severity, Stay Duration, Transfer, Discharge', async ({ page }) => {
    await setUp(page);
    const nav = page.getByTestId('episode-nav');
    await expect(nav.getByRole('link')).toHaveText(['Overview', 'Severity', 'Stay Duration', 'Transfer', 'Discharge']);
    await expect(page.locator('main h2')).toHaveText(['Patient', 'Treatment', 'Models']);
    const pages: [string, RegExp, string[]][] = [
      ['Severity', /\/severity$/, ['Severity', 'Severity history']],
      ['Stay Duration', /\/stay$/, ['Stay Duration', 'Stay Duration history']],
      ['Transfer', /\/transfer$/, ['Transfer', 'Transfer history']],
      ['Discharge', /\/discharge$/, ['Discharge Outcome', 'Discharge Outcome history']],
    ];
    for (const [link, url, headings] of pages) {
      await nav.getByRole('link', { name: link, exact: true }).click();
      await expect(page).toHaveURL(url);
      await expect(page.locator('main h2')).toHaveText(headings);
    }
    await nav.getByRole('link', { name: 'Overview' }).click();
    await expect(page).toHaveURL(new RegExp(`/doctor/episodes/${ACCIDENT}$`));
    // Accident details are one click away, not on the first screen.
    await expect(page.getByText('Collision with')).toBeHidden();
    await page.getByText('Accident details').click();
    await expect(page.getByText('Collision with')).toBeVisible();
  });

  test('history keeps the model prediction apart from the doctor decision and its source', async ({ page }) => {
    await setUp(page, episode({ history: { episodes: [], transfers: [{ transfer_id: 't-1', status: 'authorized', requested_at: '2026-10-03T11:00:00Z', to_hospital_id: 'h' }],
      predictions: [
        { prediction_id: 'h1', model_key: 'stay_duration', status: 'OK', prediction: '2-3 days', trigger_event: 'treatment_recorded',
          predicted_at: '2026-10-03T10:00:00Z', decisions: [{ decision_id: 'd1', final_decision: '4+ days', decision_source: 'DOCTOR', decided_at: null }] },
        { prediction_id: 'h2', model_key: 'severity', status: 'OK', prediction: 'HIGH', trigger_event: 'intake_updated',
          predicted_at: '2026-10-03T09:10:00Z', decisions: [{ decision_id: 'd2', final_decision: 'LOW', decision_source: 'NURSE', decided_at: null }] },
        { prediction_id: 'h3', model_key: 'discharge', status: 'ERROR', prediction: null, trigger_event: 'treatment_recorded',
          predicted_at: '2026-10-03T10:00:00Z', decisions: [] },
      ] } }));
    // Transfer requests are on the overview.
    await expect(page.getByText('Authorized — awaiting transfer')).toBeVisible();
    await expect(page.locator('main')).not.toContainText('pending_authorization');

    // Each model page lists only its own predictions.
    const nav = page.getByTestId('episode-nav');
    await nav.getByRole('link', { name: 'Stay Duration' }).click();
    const history = page.getByTestId('prediction-history');
    await expect(history.locator('th')).toHaveText(['Model prediction', 'Date / time', 'Decision', 'Decision source']);
    await expect(history.locator('tbody tr')).toHaveCount(1);
    const stay = history.locator('tbody tr').nth(0).locator('td');
    await expect(stay.nth(0)).toHaveText('2-3 days');
    await expect(stay.nth(2)).toHaveText('4+ days');
    await expect(stay.nth(3)).toHaveText('Doctor override');
    await expect(history.locator('input, select, button')).toHaveCount(0);
    await nav.getByRole('link', { name: 'Severity' }).click();
    await expect(page.getByTestId('prediction-history').locator('tbody tr')).toHaveCount(1);
    await expect(page.getByTestId('prediction-history')).toContainText('Nurse override');
    await nav.getByRole('link', { name: 'Discharge' }).click();
    await expect(page.getByTestId('prediction-history')).toContainText('No prediction (ERROR)');
  });

  test('an out-of-date prediction is labelled and cannot be accepted', async ({ page }) => {
    const stale = episode();
    stale.models.transfer = { ...stale.models.transfer, state: 'NOT_RUN', can_accept: false, can_override: false,
      prediction: { ...stale.models.transfer.prediction, stale: true, stale_reason: 'A transfer request is open for this patient.' } };
    await setUp(page, stale, 'transfer');
    const transfer = panel(page, 'transfer');
    await expect(transfer.getByTestId('stale-notice')).toContainText('Out of date — new prediction required');
    await expect(transfer.getByTestId('stale-notice')).toContainText('A transfer request is open for this patient.');
    await expect(transfer.getByRole('button', { name: 'Accept', exact: true })).toHaveCount(0);
    await expect(transfer.getByRole('button', { name: 'Run model' })).toBeVisible();
  });

  test('a decided model shows the model prediction, the doctor decision and the source', async ({ page }) => {
    const decided = episode();
    decided.models.stay_duration = { ...decided.models.stay_duration, state: 'OVERRIDDEN', can_accept: false, can_override: false,
      decision: { decision_id: 'd', prediction_id: IDS.stay_duration, final_decision: '4+ days', decision_source: 'DOCTOR',
        decided_by: 'doctor-1', decided_at: null, reason: 'Long rehab', model_prediction: '2-3 days' } as never,
      final_decision: '4+ days' as never };
    await setUp(page, decided, 'stay');
    const box = page.getByTestId('decided-stay_duration');
    await expect(box).toContainText('Model prediction:2-3 days');
    await expect(box).toContainText('Doctor decision:4+ days');
    await expect(box).toContainText('Source: doctor override');
  });
});

test('the doctor list shows an error instead of a fake zero count', async ({ page }) => {
  await page.addInitScript((token) => {
    localStorage.setItem('ac_token', token);
    localStorage.setItem('ac_user', JSON.stringify({ id: 'doctor-1', name: 'Doctor One', email: 'd1@example.org',
      role: 'doctor', hospital_id: 'hosp-a', hospital_name: 'DGH – Vavuniya' }));
  }, fakeToken());
  await page.route((url) => url.pathname.startsWith('/api/'), (route) => route.fulfill({
    status: route.request().method() === 'OPTIONS' ? 204 : 500, json: { detail: 'Database unavailable' },
    headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, content-type' } }));
  await page.goto('/doctor');
  await expect(page.getByRole('alert')).toContainText('Database unavailable');
  await expect(page.locator('main')).not.toContainText('0 patients');
  await expect(page.locator('main')).not.toContainText('No patients found');
});

test('the SHAP explanation shows the factors for and against the prediction', async ({ page }) => {
  const mock = await setUp(page, episode(), 'stay');
  await page.getByRole('button', { name: 'Explain this prediction (SHAP)' }).click();
  const panel = page.getByTestId('shap-explanation');
  await expect(panel.getByTestId('shap-headline')).toHaveText('2-3 days (53% probability)');
  await expect(panel.getByTestId('shap-towards')).toContainText('Points towards 2-3 days');
  await expect(panel.getByTestId('shap-towards')).toContainText('Second treatment: wound cleaning and dressing');
  await expect(panel.getByTestId('shap-away')).toContainText('Investigation done: mri scan');
  await expect(panel).toContainText('Not yet recorded: Second injury type');
  await expect(panel).toContainText('The final clinical decision rests with the doctor.');
  const sent = mock.requests.find((r) => new URL(r.url()).pathname === '/api/xai/explain');
  expect(sent?.postDataJSON()).toEqual({ model_name: 'stay_duration', accident_id: ACCIDENT });
});

test('an explanation that cannot be computed yet says why', async ({ page }) => {
  await setUp(page, episode(), 'stay');
  await page.route((url) => url.pathname === '/api/xai/explain', (route) => route.fulfill({
    status: 200, headers: { 'access-control-allow-origin': '*' },
    json: { model: 'stay_duration', title: 'Expected hospital stay', available: false,
      message: 'Waiting for post-treatment inputs: Investigation Done.',
      disclaimer: 'Decision support only. The final clinical decision rests with the doctor.', method: 'SHAP' } }));
  await page.getByRole('button', { name: 'Explain this prediction (SHAP)' }).click();
  await expect(page.getByTestId('shap-explanation')).toContainText('Waiting for post-treatment inputs');
  await expect(page.getByTestId('shap-towards')).toHaveCount(0);
});
