import { create } from 'zustand';
import { setAccessToken, clearAuth } from '@/lib/api';
import api from '@/lib/api';
import { clearPersistedStore } from '@/stores/store.store';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  planTier: string;
  subscriptionStatus: string;
  onboardingCompleted: boolean;
  notifyOnFailure: boolean;
  alertEmail: string | null;
  slackWebhookUrl: string | null;
  trialEndsAt: string | null;
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, firstName: string, lastName: string) => Promise<void>;
  logout: () => Promise<void>;
  fetchMe: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true, // true on boot so layout waits for fetchMe before redirecting
  isAuthenticated: false,

  login: async (email, password) => {
    set({ isLoading: true });
    try {
      clearPersistedStore(); // wipe any stale storeId from a previous user
      const { data } = await api.post('/auth/login', { email, password });
      setAccessToken(data.data.accessToken as string);
      set({ user: data.data.user as User, isAuthenticated: true });
    } finally {
      set({ isLoading: false });
    }
  },

  register: async (email, password, firstName, lastName) => {
    set({ isLoading: true });
    try {
      clearPersistedStore(); // wipe any stale storeId from a previous user
      const { data } = await api.post('/auth/register', { email, password, firstName, lastName });
      setAccessToken(data.data.accessToken as string);
      set({ user: data.data.user as User, isAuthenticated: true });
    } finally {
      set({ isLoading: false });
    }
  },

  logout: async () => {
    await api.post('/auth/logout').catch(() => {});
    clearPersistedStore();
    clearAuth();
    set({ user: null, isAuthenticated: false });
  },

  fetchMe: async () => {
    set({ isLoading: true });
    try {
      // First try to refresh the token
      const { data: refreshData } = await api.post('/auth/refresh');
      setAccessToken(refreshData.data.accessToken as string);
      const { data } = await api.get('/auth/me');
      set({ user: data.data.user as User, isAuthenticated: true, isLoading: false });
    } catch {
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },
}));
