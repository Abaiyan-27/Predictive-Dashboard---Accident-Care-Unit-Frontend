import axios from 'axios';

const TOKEN_KEY = 'ac_token';
const USER_KEY = 'ac_user';
export const SESSION_EXPIRED_EVENT = 'accident-care:session-expired';

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Attach JWT token to every request
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Redirect to login on 401
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const isLoginRequest = error.config?.url?.includes('/auth/login');
    const status = error.response?.status;
    const detail = error.response?.data?.detail;
    const isMissingBearer = status === 403 && detail === 'Not authenticated';
    if ((status === 401 || isMissingBearer) && !isLoginRequest) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
    }
    return Promise.reject(error);
  },
);

export default apiClient;

export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === 'string' && detail.trim()) return detail;
    if (!error.response) {
      return 'Cannot reach the backend. Make sure the FastAPI server is running.';
    }
  }
  return fallback;
}
