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

For a separately hosted backend, create `.env.local`:

```env
VITE_API_URL=https://your-api.example.com/api
```

## Checks

```bash
npm run build
npm run lint
```

The dashboards support nurse intake and model assessments, doctor patient,
treatment, and outcome views, administrator hospital/users/transfers/audit
workflows, and real government trends plus artifact-backed forecasting.
