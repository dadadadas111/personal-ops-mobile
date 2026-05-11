import { create } from 'zustand';

interface AppState {
  dbReady: boolean;
  revision: number;
  error: string | null;
  setDbReady: (value: boolean) => void;
  bumpRevision: () => void;
  setError: (value: string | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  dbReady: false,
  revision: 0,
  error: null,
  setDbReady: (value) => set({ dbReady: value }),
  bumpRevision: () => set((state) => ({ revision: state.revision + 1 })),
  setError: (value) => set({ error: value }),
}));
