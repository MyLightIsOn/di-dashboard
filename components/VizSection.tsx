"use client";

import { useEffect } from "react";
import { useStore } from "@/state/useStore";
import KpiStrip from "@/components/KpiStrip";
import ChartPicker from "@/components/ChartPicker";
import { renderChart } from "@/lib/chartRegistry";

/**
 * VizSection
 * - Listens for the dataset event (or you can call setResult after a direct fetch)
 * - Shows KPI cards
 * - Asks the LLM for recommended chart types (ChartPicker)
 * - Renders the chosen chart
 * - Lists insight cards
 */
export default function VizSection() {
  const setResult = useStore((s) => s.setResult);

  const spec = useStore((s) => s.spec);
  const rows = useStore((s) => s.rows);
  const charts = useStore((s) => s.charts);
  const insights = useStore((s) => s.insights);
  const kpis = useStore((s) => s.kpis);
  const profile = useStore((s) => s.profile);

  const selectedChartKey = useStore((s) => s.selectedChartKey);
  const setSelectedChartKey = useStore((s) => s.setSelectedChartKey);

  // If your composer/plan dispatches the "di:dataset" custom event, capture it here.
  useEffect(() => {
    function onDataset(e: Event) {
      const detail = (e as CustomEvent).detail || {};
      const { rows, charts, insights, checks, kpis, profile } = detail;
      if (!rows || !charts) return;
      setResult(rows, charts, insights, checks, kpis, profile);
    }
    window.addEventListener("di:dataset", onDataset as any);
    return () => window.removeEventListener("di:dataset", onDataset as any);
  }, [setResult]);

  // Determine which chart to render:
  // - If user picked a chart key via ChartPicker, swap kind on the primary config
  // - Else render the primary returned by /api/dataset
  const primary = charts?.[0] || null;
  const chosen =
    selectedChartKey && primary
      ? { ...primary, kind: selectedChartKey as any }
      : primary;

  return (
    <section className="space-y-4">
      {/* KPIs */}
      <KpiStrip items={kpis} />

      {/* Chart recommendations (LLM-backed) */}
      {spec && profile && (
        <ChartPicker
          spec={spec}
          profile={profile}
          onPick={(key) => setSelectedChartKey(key)}
        />
      )}

      {/* Chart canvas */}
      <div className="w-full border rounded bg-white p-3">
        <h3 className="font-medium mb-2">
          {chosen?.title || "No chart yet"}
        </h3>
        {chosen && rows?.length ? (
          renderChart(chosen, rows)
        ) : (
          <div className="text-sm text-gray-500">Run a query to see a chart.</div>
        )}
      </div>

      {/* Insight cards */}
      {insights?.length > 0 && (
        <div className="grid md:grid-cols-3 gap-3">
          {insights.map((it: any, idx: number) => (
            <div key={idx} className="border rounded p-3 bg-white">
              <div className="text-xs uppercase tracking-wide text-gray-500">
                {it.type || "insight"}
              </div>
              <div className="font-medium">{it.headline}</div>
              {it.details && (
                <div className="text-sm text-gray-600">{it.details}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
