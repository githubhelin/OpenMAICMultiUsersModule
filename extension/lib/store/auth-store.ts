import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SafeUser } from '@/lib/server/auth/types';

interface AuthState {
  user: SafeUser | null;
  loading: boolean;
  initialized: boolean;
  
  authModalOpen: boolean;
  authModalTab: 'login' | 'register';
  profileModalOpen: boolean;
  adminModalOpen: boolean;

  setAuthModalOpen: (open: boolean, tab?: 'login' | 'register') => void;
  setProfileModalOpen: (open: boolean) => void;
  setAdminModalOpen: (open: boolean) => void;

  checkAuth: () => Promise<SafeUser | null>;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (data: { username: string; password: string; email?: string; nickname?: string; avatar?: string }) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  updateProfile: (data: { nickname?: string; avatar?: string; bio?: string; currentPassword?: string; newPassword?: string }) => Promise<{ success: boolean; error?: string }>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      loading: false,
      initialized: false,
      
      authModalOpen: false,
      authModalTab: 'login',
      profileModalOpen: false,
      adminModalOpen: false,

      setAuthModalOpen: (open, tab) => set({
        authModalOpen: open,
        ...(tab ? { authModalTab: tab } : {}),
      }),
      setProfileModalOpen: (open) => set({ profileModalOpen: open }),
      setAdminModalOpen: (open) => set({ adminModalOpen: open }),

      checkAuth: async () => {
        try {
          const res = await fetch('/api/auth/me', { cache: 'no-store' });
          if (!res.ok) {
            set({ user: null, loading: false, initialized: true });
            return null;
          }
          const data = await res.json();
          if (data.success && data.user) {
            set({ user: data.user, loading: false, initialized: true });
            return data.user;
          }
          set({ user: null, loading: false, initialized: true });
          return null;
        } catch {
          set({ user: null, loading: false, initialized: true });
          return null;
        }
      },

      login: async (username, password) => {
        try {
          set({ loading: true });
          const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
          });
          const data = await res.json();
          if (!res.ok || !data.success) {
            set({ loading: false });
            return { success: false, error: data.error || '登录失败' };
          }
          set({ user: data.user, loading: false, authModalOpen: false, initialized: true });
          // Hard reload to sync Next.js SSR and client stages
          window.location.reload();
          return { success: true };
        } catch (err: unknown) {
          set({ loading: false });
          const message = err instanceof Error ? err.message : '网络异常';
          return { success: false, error: message };
        }
      },

      register: async (registerData) => {
        try {
          set({ loading: true });
          const res = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(registerData),
          });
          const data = await res.json();
          if (!res.ok || !data.success) {
            set({ loading: false });
            return { success: false, error: data.error || '注册失败' };
          }
          set({ user: data.user, loading: false, authModalOpen: false, initialized: true });
          window.location.reload();
          return { success: true };
        } catch (err: unknown) {
          set({ loading: false });
          const message = err instanceof Error ? err.message : '网络异常';
          return { success: false, error: message };
        }
      },

      logout: async () => {
        try {
          set({ loading: true });
          await fetch('/api/auth/logout', { method: 'POST' });
          set({ user: null, loading: false, initialized: true });
          window.location.reload();
        } catch {
          set({ user: null, loading: false, initialized: true });
          window.location.reload();
        }
      },

      updateProfile: async (profileData) => {
        try {
          set({ loading: true });
          const res = await fetch('/api/auth/profile', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(profileData),
          });
          const data = await res.json();
          if (!res.ok || !data.success) {
            set({ loading: false });
            return { success: false, error: data.error || '更新失败' };
          }
          set({ user: data.user, loading: false, profileModalOpen: false });
          return { success: true };
        } catch (err: unknown) {
          set({ loading: false });
          const message = err instanceof Error ? err.message : '网络异常';
          return { success: false, error: message };
        }
      },
    }),
    {
      name: 'openmaic-user-session',
      partialize: (state) => ({ user: state.user }),
    }
  )
);
