import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsState {
  apiKey: string;
  defaultModel: string;
  setApiKey: (key: string) => void;
  setDefaultModel: (model: string) => void;
  clearApiKey: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      apiKey: '',
      defaultModel: 'openrouter/free', // Defaults to zero-cost router
      setApiKey: (apiKey) => set({ apiKey }),
      setDefaultModel: (defaultModel) => set({ defaultModel }),
      clearApiKey: () => set({ apiKey: '' }),
    }),
    {
      name: 'offshoot-settings',
    }
  )
);
