"use client";

import React from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  ScatterChart,
  Scatter,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import type { ChartConfig } from "@/types";
import { CHART_CATALOG, type ChartKey } from "@/lib/chartCatalog";

// Re-export for convenience
export { CHART_CATALOG, type ChartKey };

/**
 * Render any chart supported by CHART_CATALOG.
 *
 * Expected config shape (minimally):
 *  - kind: ChartKey
 *  - x: string (x-axis key; for time this is 'year' | 'quarter' | 'month' or a formatted label)
 *  - y: string (y-axis key; often 'value')
 *  - series?: string (categorical field to split series, e.g. 'region' or 'country')
 *  - title?: string
 *  - extra?: object (for chart-specific params; e.g., scatter xMetric/yMetric)
 *
 * Expected rows: array of records that contain x/y (and series if applicable).
 */
export function renderChart(config: ChartConfig, rows: any[]) {
  const commonAxes = (
    <>
      <CartesianGrid strokeDasharray="3 3" />
      <XAxis dataKey={config.x} />
      <XAxis
        dataKey={config.x}
        tickFormatter={(v) => String(v)} // or map 2024*10+q -> "2024 Qq"
      />
      <Tooltip />
      <Legend />
    </>
  );

  switch (config.kind as ChartKey) {
    case "line": {
      if (config.series) {
        const { wide, seriesVals } = pivotLongToWide(rows, config.x, config.series, config.y);
        return (
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={wide}>
              {commonAxes}
              {seriesVals.map((s) => (
                <Line
                  key={String(s)}
                  type="monotone"
                  name={String(s)}
                  dataKey={String(s)}   // <- each series now a column
                  dot={true}
                  strokeWidth={2}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        );
      }
      // single series stays the same
      return (
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={rows}>
            {commonAxes}
            <Line type="monotone" dataKey={config.y} dot={true} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      );
    }

    case "stackedArea": {
      if (!config.series) {
        // fall back to single-area on config.y if no series
        return (
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart data={rows}>
              {commonAxes}
              <Area type="monotone" dataKey={config.y} stackId="1" />
            </AreaChart>
          </ResponsiveContainer>
        );
      }
      const { wide, seriesVals } = pivotLongToWide(rows, config.x, config.series, config.y);
      return (
        <ResponsiveContainer width="100%" height={320}>
          <AreaChart data={wide}>
            {commonAxes}
            {seriesVals.map((s) => (
              <Area
                key={String(s)}
                type="monotone"
                name={String(s)}
                dataKey={String(s)}   // <- stacked columns
                stackId="1"
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      );
    }

    case "scatter": {
      /**
       * For scatter, you need two numeric metrics per row:
       *   - config.x = xMetric key (e.g., 'units')
       *   - config.y = yMetric key (e.g., 'revenue')
       * Provide rows shaped like: { group?, [xMetric]: number, [yMetric]: number }
       * If you want grouped points (by series), filter and render multiple <Scatter>.
       */
      const seriesField = config.series;
      if (seriesField) {
        const seriesKeys = distinct(rows, seriesField);
        return (
          <ResponsiveContainer width="100%" height={320}>
            <ScatterChart>
              <CartesianGrid />
              <XAxis dataKey={config.x} name={config.x} />
              <YAxis dataKey={config.y} name={config.y} />
              <Tooltip cursor={{ strokeDasharray: "3 3" }} />
              <Legend />
              {seriesKeys.map((k) => (
                <Scatter
                  key={String(k)}
                  name={String(k)}
                  data={rows.filter((r) => r[seriesField] === k)}
                />
              ))}
            </ScatterChart>
          </ResponsiveContainer>
        );
      }
      return (
        <ResponsiveContainer width="100%" height={320}>
          <ScatterChart>
            <CartesianGrid />
            <XAxis dataKey={config.x} name={config.x} />
            <YAxis dataKey={config.y} name={config.y} />
            <Tooltip cursor={{ strokeDasharray: "3 3" }} />
            <Legend />
            <Scatter name={config.title || "Scatter"} data={rows} />
          </ScatterChart>
        </ResponsiveContainer>
      );
    }

    case "pie": {
      // Use when category count is small (≤ 6 ideally)
      return (
        <ResponsiveContainer width="100%" height={320}>
          <PieChart>
            <Tooltip />
            <Legend />
            <Pie data={rows} dataKey={config.y} nameKey={config.x} outerRadius={110}>
              {rows.map((_, i) => (
                <Cell key={i} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      );
    }
  }

  // Fallback
  return <div className="text-sm text-gray-500">Unsupported chart type.</div>;
}

/** Utility: unique values for a given field */
function distinct(arr: any[], key: string) {
  return Array.from(new Set(arr.map((r) => r?.[key]).filter((v) => v != null)));
}

function pivotLongToWide(
  rows: any[],
  xKey: string,        // e.g., 'quarter' or 'period'
  seriesKey: string,   // e.g., 'country'
  yKey: string         // usually 'value'
) {
  // unique X values in order
  const xVals = Array.from(new Set(rows.map(r => r?.[xKey])));

  // unique series
  const seriesVals = Array.from(new Set(rows.map(r => r?.[seriesKey])));

  // index rows by (x, series) -> sum value
  const cell = new Map<string, number>();
  for (const r of rows) {
    const x = r?.[xKey];
    const s = r?.[seriesKey];
    const v = Number(r?.[yKey] ?? 0);
    if (x == null || s == null) continue;
    const key = JSON.stringify([x, s]);
    cell.set(key, (cell.get(key) || 0) + v);
  }

  // build wide rows: { [xKey]: <x>, [series1]: val, [series2]: val, ... }
  const wide = xVals.map((x) => {
    const obj: any = { [xKey]: x };
    for (const s of seriesVals) {
      const key = JSON.stringify([x, s]);
      obj[s] = cell.get(key) || 0;
    }
    return obj;
  });

  return { wide, seriesVals };
}

