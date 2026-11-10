import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SafeUser } from '../../../shared/types';

interface AppState {
  user: SafeUser | null;
  setUser: (user: SafeUser | null) => void;
  darkMode: boolean;
  toggleDarkMode: () => void;
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  setSidebar: (open: boolean) => void;
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      user: null,
      setUser: (user) => set({ user }),
      darkMode: false,
      toggleDarkMode: () => {
        set((state) => {
          const next = !state.darkMode;
          if (typeof document !== 'undefined') {
            document.documentElement.classList.toggle('dark', next);
          }
          return { darkMode: next };
        });
      },
      sidebarOpen: true,
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      setSidebar: (open) => set({ sidebarOpen: open }),
    }),
    {
      name: 'eti-hub-store',
      partialize: (state) => ({ darkMode: state.darkMode }),
    },
  ),
);
