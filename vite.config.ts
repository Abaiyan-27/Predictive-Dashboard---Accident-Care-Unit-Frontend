import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/** Names that must never be VITE_ variables: every VITE_ value is shipped to browsers. */
const SECRET_NAME = /SECRET|SERVICE_ROLE|PASSWORD|PRIVATE|TOKEN|SUPABASE_KEY|HF_/i;
const LOOPBACK = /^(https?:\/\/)?(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(:|\/|$)/i;

export default defineConfig(({ command, mode }) => {
  // Only VITE_ variables reach the browser bundle; the rest configure the dev server.
  const publicEnv = loadEnv(mode, process.cwd(), 'VITE_');
  const devEnv = loadEnv(mode, process.cwd(), '');

  const leaked = Object.keys(publicEnv).filter((name) => SECRET_NAME.test(name));
  if (leaked.length) {
    throw new Error(`Refusing to build: ${leaked.join(', ')} would be exposed to browsers. `
      + 'Server secrets belong in the backend environment, never in VITE_ variables.');
  }

  if (command === 'build' && mode === 'production') {
    const apiUrl = publicEnv.VITE_API_URL ?? '';
    if (LOOPBACK.test(apiUrl) && devEnv.ALLOW_LOCAL_API_IN_BUILD !== '1') {
      throw new Error('Refusing to build for production: VITE_API_URL points to this machine. '
        + 'Set it to the deployed backend (https://<backend-host>/api), or set '
        + 'ALLOW_LOCAL_API_IN_BUILD=1 for a local preview build.');
    }
    if (!apiUrl) {
      console.warn('[config] VITE_API_URL is not set: the build calls /api on its own origin. '
        + 'That is right only when a reverse proxy serves the backend under /api on the frontend host.');
    } else if (apiUrl.startsWith('http://') && !LOOPBACK.test(apiUrl)) {
      console.warn('[config] VITE_API_URL uses http; use https for a deployed backend.');
    }
  }

  return {
    plugins: [
      react(),
      tailwindcss(),
    ],
    server: {
      proxy: {
        // Development only: the dev server forwards /api to the local backend.
        '/api': {
          target: devEnv.DEV_API_PROXY_TARGET || 'http://localhost:8000',
          changeOrigin: true,
        },
      },
      // Extra hostnames (e.g. a tunnel) the dev server may answer, comma-separated.
      allowedHosts: (devEnv.DEV_ALLOWED_HOSTS || '').split(',').map((host) => host.trim()).filter(Boolean),
    },
  };
});
