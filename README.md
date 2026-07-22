# Accident Care — Predictive Hospital Dashboard

A modern, responsive React frontend for the Accident Care Unit management system. This application provides role-based dashboards tailored for Nurses, Doctors, Administrators, and Government officials to manage patient intake, monitor hospital capacity, track transfers, and view predictive insights.

## Features

- **Role-Based Access Control (RBAC):** Distinct dashboards and capabilities depending on the user's role.
  - **Nurse:** Patient intake forms with immediate ML severity assessment (Critical/Moderate/Minor) and personal record tracking.
  - **Doctor:** Overview of all admitted patients, prioritized by severity. Detailed patient views include a predictive prognosis panel (expected recovery level, partial recovery probability, and transfer recommendations).
  - **Administrator:** Comprehensive 4-tab operational dashboard for monitoring hospital bed capacity, managing system users, approving/rejecting hospital transfer requests, and viewing system audit logs.
  - **Government:** High-level data mining insights, including monthly accident trends and predictive regional risk models (no individual patient data exposed).
- **Mock API Layer:** A fully functional mock API (`src/api/mock.ts`) with realistic latency and in-memory session mutations, allowing frontend development and demonstration without a live backend.
- **Modern UI/UX:** Built with Tailwind CSS v4 featuring a clean, institutional design (white/off-white backgrounds, light purple primary accents, neutral text).
- **Data Visualization:** Interactive charts using Recharts for trend analysis.

## Tech Stack

- **Framework:** React 19 + TypeScript
- **Build Tool:** Vite
- **Styling:** Tailwind CSS v4
- **Routing:** React Router v7
- **HTTP Client:** Axios
- **Charts:** Recharts

## Getting Started

### Prerequisites

- Node.js (v18 or higher recommended)
- npm

### Installation

1. Clone the repository and navigate to the project directory:
   ```bash
   git clone https://github.com/Abaiyan-27/Predictive-Dashboard---Accident-Care-Unit-Frontend.git
   cd Predictive-Dashboard---Accident-Care-Unit-Frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open your browser and navigate to the local URL provided by Vite (usually `http://localhost:5173`).

## Demo Accounts

The application is currently configured with a mock authentication system. You can use the quick-select buttons on the login page or manually enter the following credentials:

| Role | Email | Password |
| :--- | :--- | :--- |
| **Nurse** | `nurse@accidentcare.org` | `demo` |
| **Doctor** | `doctor@accidentcare.org` | `demo` |
| **Admin** | `admin@accidentcare.org` | `demo` |
| **Government** | `gov@accidentcare.org` | `demo` |

## Project Structure

```text
src/
├── api/             # API client setup and mock data layer
│   ├── client.ts    # Axios instance with JWT interceptors
│   ├── mock.ts      # Mock data and latency simulation
│   └── index.ts     # Exported API functions (Facade)
├── auth/            # JWT authentication context and protected routes
├── components/      # Reusable UI components (Cards, Badges, Shell)
├── pages/           # Page components organized by role
│   ├── admin/
│   ├── doctor/
│   ├── government/
│   └── nurse/
├── types/           # Shared TypeScript interfaces and types
├── App.tsx          # Application routing
├── main.tsx         # React entry point
└── index.css        # Global styles and Tailwind v4 theme configuration
```

## Connecting to a Real Backend

The application is designed to easily swap out the mock API for a real REST API (e.g., FastAPI). 

1. Ensure your backend is running and define the API base URL in a `.env` file:
   ```env
   VITE_API_URL=http://localhost:8000/api
   ```
2. Modify `src/api/index.ts`. Currently, functions delegate to `./mock.ts`. To connect to the real backend, replace the mock calls with standard Axios requests using the pre-configured `apiClient` from `./client.ts`. 

Example:
```typescript
import apiClient from './client';

export function login(credentials: LoginCredentials): Promise<AuthResponse> {
  return apiClient.post('/auth/login', credentials).then(res => res.data);
}
```

Because all React components import from `src/api/index.ts`, **no component code needs to change** when migrating to the production API.