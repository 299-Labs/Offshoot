'use client';

import React, { useEffect, useState } from 'react';
import { useSettingsStore } from '@/store/useSettingsStore';
import { Key, Eye, EyeOff, Save, Check } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const POPULAR_MODELS = [
  { id: 'openrouter/free', name: 'Auto Free Router (Zero Cost)' },
  { id: 'meta-llama/llama-3.1-8b-instruct:free', name: 'Llama 3.1 8B (Free)' },
  { id: 'google/gemma-2-9b-it:free', name: 'Google Gemma 2 9B (Free)' },
  { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet (Paid)' },
  { id: 'openai/gpt-4o', name: 'GPT-4o (Paid)' },
];

export function SettingsModal({ isOpen, onClose }: Props) {
  const { apiKey, defaultModel, setApiKey, setDefaultModel } = useSettingsStore();
  const [tempKey, setTempKey] = useState(apiKey);
  const [showKey, setShowKey] = useState(false);
  const [saved, setSaved] = useState(false);

  // Re-sync the draft key whenever the modal is (re)opened.
  useEffect(() => {
    if (isOpen) {
      setTempKey(apiKey);
      setSaved(false);
    }
  }, [isOpen, apiKey]);

  if (!isOpen) return null;

  const handleSave = () => {
    setApiKey(tempKey.trim());
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg-canvas/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-bg-surface border border-border-subtle rounded-xl p-6 shadow-2xl text-text-primary">
        <div className="flex items-center gap-2 mb-4">
          <Key className="w-5 h-5 text-brand-sage" />
          <h2 className="text-lg font-semibold text-brand-sage">Settings</h2>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-brand-sage mb-1.5">
              OpenRouter API Key
            </label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={tempKey}
                onChange={(e) => setTempKey(e.target.value)}
                placeholder="sk-or-v1-..."
                className="w-full bg-bg-surface border border-border-subtle rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:border-brand-sage font-mono"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2.5 top-2.5 text-text-muted hover:text-text-primary"
              >
                {showKey ? <EyeOff className="w-4 h-4 text-brand-sage" /> : <Eye className="w-4 h-4 text-brand-sage" />}
              </button>
            </div>
            <p className="text-[11px] text-brand-sage mt-1">
              Keys are stored strictly in your browser and sent directly to OpenRouter via proxy.
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-brand-sage mb-1.5">
              Default Model
            </label>
            <select
              value={defaultModel}
              onChange={(e) => setDefaultModel(e.target.value)}
              className="w-full bg-bg-surface border border-border-subtle rounded-lg px-3 py-2 text-sm text-[#ecebe6] outline-none focus:outline-none focus:border-brand-sage focus:ring-1 focus:ring-brand-sage transition cursor-pointer accent-brand-sage"
            >
              {POPULAR_MODELS.map((m) => (
                <option key={m.id} value={m.id} className="bg-bg-surface text-[#ecebe6]">
                  {m.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-text-muted hover:text-text-primary transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 bg-brand-sage text-bg-canvas font-medium px-4 py-2 rounded-lg text-sm hover:bg-brand-blush transition"
          >
            {saved ? <Check className="w-4 h-4 text-brand-blush" /> : <Save className="w-4 h-4" />}
            {saved ? 'Saved' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
