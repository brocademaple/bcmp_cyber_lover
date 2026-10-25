import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DebugTurnTrace } from '../types';

const DEBUG_TRACE_STORAGE_KEY = '@bcmp_debug_turn_traces_v1';
const MAX_DEBUG_TRACES = 50;

interface DebugStore {
  traces: DebugTurnTrace[];
  tracesLoaded: boolean;
  loadTraces: () => Promise<void>;
  addTrace: (trace: DebugTurnTrace) => Promise<void>;
  clearTraces: () => Promise<void>;
}

function normalizeTraces(value: unknown): DebugTurnTrace[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is DebugTurnTrace =>
      !!item &&
      typeof item === 'object' &&
      typeof (item as DebugTurnTrace).id === 'string' &&
      typeof (item as DebugTurnTrace).timestamp === 'number' &&
      typeof (item as DebugTurnTrace).characterId === 'string' &&
      typeof (item as DebugTurnTrace).userText === 'string'
    )
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, MAX_DEBUG_TRACES);
}

async function persistTraces(traces: DebugTurnTrace[]) {
  await AsyncStorage.setItem(DEBUG_TRACE_STORAGE_KEY, JSON.stringify(traces));
}

export const useDebugStore = create<DebugStore>((set) => ({
  traces: [],
  tracesLoaded: false,
  loadTraces: async () => {
    try {
      const raw = await AsyncStorage.getItem(DEBUG_TRACE_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      set({ traces: normalizeTraces(parsed), tracesLoaded: true });
    } catch {
      set({ tracesLoaded: true });
    }
  },
  addTrace: async (trace) => {
    let nextTraces: DebugTurnTrace[] = [];
    set((state) => {
      nextTraces = normalizeTraces([trace, ...state.traces]);
      return { traces: nextTraces, tracesLoaded: true };
    });
    try {
      await persistTraces(nextTraces);
    } catch {}
  },
  clearTraces: async () => {
    set({ traces: [], tracesLoaded: true });
    try {
      await AsyncStorage.removeItem(DEBUG_TRACE_STORAGE_KEY);
    } catch {}
  },
}));
