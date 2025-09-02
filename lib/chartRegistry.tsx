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
      <YAxis />
      <Tooltip />
      <Legend />
    </>
  );

  switch (config.kind as ChartKey) {
    case "line": {
      // Multi-series line: render one <Line> per series value
      if (config.series) {
        const keys = distinct(rows, config.series);
        return (
          <ResponsiveContainer width="100%" height={320}>
            <LineChart>
              {commonAxes}
              {keys.map((k) => (
                <Line
                  key={String(k)}
                  type="monotone"
                  name={String(k)}
                  dataKey={config.y}
                  data={rows.filter((r) => r[config.series!] === k)}
                  dot={false}
                  strokeWidth={2}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        );
      }
      // Single series
      return (
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={rows}>
            {commonAxes}
            <Line type="monotone" dataKey={config.y} dot={false} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      );
    }

    case "bar": {
      return (
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={rows}>
            {commonAxes}
            <Bar dataKey={config.y} />
          </BarChart>
        </ResponsiveContainer>
      );
    }

    case "stackedArea": {
      // Expect a series dimension; each series stacked as part of total over time
      const seriesField = config.series;
      const seriesKeys = seriesField ? distinct(rows, seriesField) : [];
      return (
        <ResponsiveContainer width="100%" height={320}>
          <AreaChart>
            {commonAxes}
            {seriesKeys.map((k) => (
              <Area
                key={String(k)}
                type="monotone"
                name={String(k)}
                dataKey={config.y}
                data={rows.filter((r) => r[seriesField!] === k)}
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
