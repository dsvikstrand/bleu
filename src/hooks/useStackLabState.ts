import { useState, useEffect, useCallback } from 'react';
import {
  StackLabState,
  InventoryItem,
  Goal,
  Settings,
  Recommendation,
  DEFAULT_STATE,
} from '@/types/stacklab';

const STORAGE_KEY = 'stacklab-state';

function loadState(): StackLabState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.warn('Failed to load StackLab state from localStorage', e);
  }
  return DEFAULT_STATE;
}

function saveState(state: StackLabState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('Failed to save StackLab state to localStorage', e);
  }
}

export function useStackLabState() {
  const [state, setState] = useState<StackLabState>(loadState);

  // Persist state changes
  useEffect(() => {
    saveState(state);
  }, [state]);

  // Inventory actions
  const addToInventory = useCallback((item: InventoryItem) => {
    setState((prev) => {
      if (prev.inventory.some((i) => i.id === item.id)) return prev;
      return { ...prev, inventory: [...prev.inventory, item] };
    });
  }, []);

  const removeFromInventory = useCallback((itemId: string) => {
    setState((prev) => ({
      ...prev,
      inventory: prev.inventory.filter((i) => i.id !== itemId),
    }));
  }, []);

  const clearInventory = useCallback(() => {
    setState((prev) => ({ ...prev, inventory: [] }));
  }, []);

  // Goal actions
  const toggleGoal = useCallback((goal: Goal) => {
    setState((prev) => {
      const isSelected = prev.selectedGoals.some((g) => g.id === goal.id);
      if (isSelected) {
        return {
          ...prev,
          selectedGoals: prev.selectedGoals.filter((g) => g.id !== goal.id),
        };
      }
      // Max 5 goals
      if (prev.selectedGoals.length >= 5) return prev;
      return {
        ...prev,
        selectedGoals: [...prev.selectedGoals, goal],
      };
    });
  }, []);

  const addCustomGoal = useCallback((label: string) => {
    setState((prev) => {
      if (prev.customGoals.length >= 5) return prev;
      const newGoal: Goal = {
        id: `custom-${Date.now()}`,
        label,
        isCustom: true,
      };
      return {
        ...prev,
        customGoals: [...prev.customGoals, newGoal],
      };
    });
  }, []);

  const removeCustomGoal = useCallback((goalId: string) => {
    setState((prev) => ({
      ...prev,
      customGoals: prev.customGoals.filter((g) => g.id !== goalId),
      selectedGoals: prev.selectedGoals.filter((g) => g.id !== goalId),
    }));
  }, []);

  // Settings actions
  const updateSettings = useCallback((updates: Partial<Settings>) => {
    setState((prev) => ({
      ...prev,
      settings: { ...prev.settings, ...updates },
    }));
  }, []);

  // Recommendation actions
  const addRecommendation = useCallback((recommendation: Recommendation) => {
    setState((prev) => ({
      ...prev,
      recommendations: [recommendation, ...prev.recommendations].slice(0, 10), // Keep last 10
    }));
  }, []);

  const clearRecommendations = useCallback(() => {
    setState((prev) => ({ ...prev, recommendations: [] }));
  }, []);

  // Reset all
  const resetAll = useCallback(() => {
    setState(DEFAULT_STATE);
  }, []);

  return {
    state,
    // Inventory
    addToInventory,
    removeFromInventory,
    clearInventory,
    // Goals
    toggleGoal,
    addCustomGoal,
    removeCustomGoal,
    // Settings
    updateSettings,
    // Recommendations
    addRecommendation,
    clearRecommendations,
    // Reset
    resetAll,
  };
}
