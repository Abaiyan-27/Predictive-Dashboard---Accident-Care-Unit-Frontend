# Accident Care Dashboard — Frontend

React 19 + TypeScript frontend for the FastAPI/Supabase Accident Care backend.
The application uses the live REST API in `src/api/index.ts`. The obsolete mock
API has been removed; unavailable models are shown explicitly in the screens.

## Run locally

Start the backend on port `8000`, then run:

```bash
npm install
npm run dev
```

Open <http://localhost:5173>. During development, Vite proxies `/api` to
`http://localhost:8000`, so no frontend environment file is required.

For a separately hosted backend, set the API URL at build time (see
[.env.example](.env.example)):

```env
VITE_API_URL=https://<backend-host>/api
```

Every `VITE_` variable is compiled into the code sent to browsers, so never put
a secret in one; the build refuses names that look like secrets, and a
production build refuses a localhost `VITE_API_URL`. Without `VITE_API_URL` the
app calls `/api` on its own origin (right only behind a reverse proxy).

## Checks

```bash
npx tsc -b
npm run lint
npm run build
npx playwright test
```

Most Playwright specs mock the API and run offline. The live-backend specs
(login, roles, admin, government, nurse and doctor workflows) need the local
backend stack and the `TEST_*` credentials from [.env.test.example](.env.test.example);
without them they fail immediately with an explanation. The backend's
DEPLOYMENT.md describes the local stack.

The dashboards support nurse intake and model assessments, doctor patient,
treatment, and outcome views, administrator hospital/users/transfers/audit
workflows, and real government trends plus artifact-backed forecasting.
