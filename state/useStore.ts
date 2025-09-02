"use client";

import { create } from "zustand";
import type { QuerySpec, ChartConfig } from "@/types";

/**
 * Central UI state for the DI dashboard.
 * - Holds the current spec, dataset result, KPIs, profile for chart recommendations,
 *   and which chart kind the user picked.
 * - Exposes small, focused actions the UI can call.
 */
type Store = {
  // App mode & current parsed query
  mode: "off" | "assisted" | "auto";
  spec: QuerySpec | null;

  // Data & viz state
  rows: any[];
  charts: ChartConfig[];       // optional: primary + alternates from dataset route
  insights: any[];
  checks: any;
  kpis: { label: string; value: number; deltaPct?: number }[];
  profile: any | null;         // e.g., { hasTime, timeGrain, periods, categories, series, hasMultipleSeries }

  // UI selections & history
  selectedChartKey: string | null; // 'line' | 'bar' | 'stackedArea' | 'scatter' | 'pie'
  history: { q: string; ts: number }[];

  // Actions
  setMode: (m: Store["mode"]) => void;
  setSpec: (s: QuerySpec | null) => void;

  /**
   * IMPORTANT: Call this after /api/dataset returns.
   * It updates rows/charts/insights/checks and also kpis + profile.
   */
  setResult: (
    rows: any[],
    charts: ChartConfig[],
    insights: any[],
    checks: any,
    kpis: { label: string; value: number; deltaPct?: number }[],
    profile: any
  ) => void;

  setSelectedChartKey: (k: string | null) => void;
  pushHistory: (q: string) => void;
  resetResult: () => void; // clears current result (for "New analysis")
};

export const useStore = create<Store>((set) => ({
  // Defaults
  mode: "assisted",
  spec: null,

  rows: [],
  charts: [],
  insights: [],
  checks: {},
  kpis: [],
  profile: null,

  selectedChartKey: null,
  history: [],

  // Actions
  setMode: (mode) => set({ mode }),
  setSpec: (spec) => set({ spec }),

  setResult: (rows, charts, insights, checks, kpis, profile) =>
    set({ rows, charts, insights, checks, kpis, profile }),

  setSelectedChartKey: (k) => set({ selectedChartKey: k }),

  pushHistory: (q) =>
    set((s) => ({
      history: [{ q, ts: Date.now() }, ...s.history].slice(0, 10),
    })),

  resetResult: () =>
    set({
      rows: [],
      charts: [],
      insights: [],
      checks: {},
      kpis: [],
      profile: null,
      selectedChartKey: null,
    }),
}));
