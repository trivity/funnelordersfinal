import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

let accessToken: string | null = null;
let activeStoreId: string | null = null;

export function setAccessToken(token: string) {
  accessToken = token;
}

export function setStoreId(id: string | null) {
  activeStoreId = id;
}

export function getStoreId(): string | null {
  return activeStoreId;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function clearAuth() {
  accessToken = null;
  if (typeof window !== 'undefined') {
    window.location.href = '/login';
  }
}

// Attach access token + active store to every request
api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  if (activeStoreId) {
    config.headers['X-Store-Id'] = activeStoreId;
  }
  return config;
});

// Auto-refresh on 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config as typeof error.config & { _retry?: boolean };
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const { data } = await axios.post(
          `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1'}/auth/refresh`,
          {},
          { withCredentials: true },
        );
        setAccessToken(data.data.accessToken as string);
        original.headers = {
          ...original.headers,
          Authorization: `Bearer ${data.data.accessToken}`,
        };
        return api(original);
      } catch {
        clearAuth();
      }
    }
    return Promise.reject(error);
  },
);

export default api;
