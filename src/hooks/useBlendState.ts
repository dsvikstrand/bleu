import { useState, useEffect, useCallback } from 'react';
import {
  BlendState,
  BlendRecipe,
  BlendItem,
  BlendAnalysis,
  DEFAULT_BLEND_STATE,
} from '@/types/stacklab';

const STORAGE_KEY = 'stacklab-blends';

function loadState(): BlendState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.warn('Failed to load Blend state from localStorage', e);
  }
  return DEFAULT_BLEND_STATE;
}

function saveState(state: BlendState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('Failed to save Blend state to localStorage', e);
  }
}

function generateBlendName(): string {
  const adjectives = ['Energizing', 'Calming', 'Power', 'Focus', 'Recovery', 'Vital', 'Peak', 'Zen'];
  const nouns = ['Blend', 'Mix', 'Formula', 'Stack', 'Elixir', 'Potion', 'Tonic'];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  return `${adj} ${noun}`;
}

export function useBlendState() {
  const [state, setState] = useState<BlendState>(loadState);

  // Persist state changes
  useEffect(() => {
    saveState(state);
  }, [state]);

  // Create a new blend
  const createBlend = useCallback(() => {
    const newBlend: BlendRecipe = {
      id: `blend-${Date.now()}`,
      name: generateBlendName(),
      items: [],
      createdAt: new Date().toISOString(),
    };
    setState((prev) => ({
      ...prev,
      currentBlend: newBlend,
    }));
    return newBlend;
  }, []);

  // Add item to current blend
  const addItem = useCallback((item: BlendItem) => {
    setState((prev) => {
      if (!prev.currentBlend) return prev;
      // Check if supplement already exists
      if (prev.currentBlend.items.some((i) => i.supplementId === item.supplementId)) {
        return prev;
      }
      return {
        ...prev,
        currentBlend: {
          ...prev.currentBlend,
          items: [...prev.currentBlend.items, item],
        },
      };
    });
  }, []);

  // Update item in current blend
  const updateItem = useCallback((itemId: string, updates: Partial<BlendItem>) => {
    setState((prev) => {
      if (!prev.currentBlend) return prev;
      return {
        ...prev,
        currentBlend: {
          ...prev.currentBlend,
          items: prev.currentBlend.items.map((item) =>
            item.id === itemId ? { ...item, ...updates } : item
          ),
        },
      };
    });
  }, []);

  // Remove item from current blend
  const removeItem = useCallback((itemId: string) => {
    setState((prev) => {
      if (!prev.currentBlend) return prev;
      return {
        ...prev,
        currentBlend: {
          ...prev.currentBlend,
          items: prev.currentBlend.items.filter((item) => item.id !== itemId),
        },
      };
    });
  }, []);

  // Update blend name
  const updateBlendName = useCallback((name: string) => {
    setState((prev) => {
      if (!prev.currentBlend) return prev;
      return {
        ...prev,
        currentBlend: {
          ...prev.currentBlend,
          name,
        },
      };
    });
  }, []);

  // Save analysis to current blend and move to history
  const saveAnalysis = useCallback((analysis: BlendAnalysis) => {
    setState((prev) => {
      if (!prev.currentBlend) return prev;
      const analyzedBlend: BlendRecipe = {
        ...prev.currentBlend,
        analysis,
      };
      return {
        ...prev,
        currentBlend: analyzedBlend,
        history: [analyzedBlend, ...prev.history.filter(b => b.id !== analyzedBlend.id)].slice(0, 20),
      };
    });
  }, []);

  // Clear current blend
  const clearCurrentBlend = useCallback(() => {
    setState((prev) => ({
      ...prev,
      currentBlend: null,
    }));
  }, []);

  // Load blend from history
  const loadFromHistory = useCallback((blendId: string) => {
    setState((prev) => {
      const blend = prev.history.find((b) => b.id === blendId);
      if (!blend) return prev;
      return {
        ...prev,
        currentBlend: { ...blend, id: `blend-${Date.now()}`, createdAt: new Date().toISOString() },
      };
    });
  }, []);

  // Delete from history
  const deleteFromHistory = useCallback((blendId: string) => {
    setState((prev) => ({
      ...prev,
      history: prev.history.filter((b) => b.id !== blendId),
    }));
  }, []);

  // Reset all
  const resetAll = useCallback(() => {
    setState(DEFAULT_BLEND_STATE);
  }, []);

  return {
    state,
    currentBlend: state.currentBlend,
    history: state.history,
    createBlend,
    addItem,
    updateItem,
    removeItem,
    updateBlendName,
    saveAnalysis,
    clearCurrentBlend,
    loadFromHistory,
    deleteFromHistory,
    resetAll,
  };
}
