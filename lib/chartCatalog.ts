/**
 * Server-safe chart catalog - contains only metadata, no React/Recharts imports
 * Used by API routes and other server-side code
 */
export type ChartKey = "line" | "bar" | "stackedArea" | "scatter" | "pie";

export const CHART_CATALOG: Record<
  ChartKey,
  { label: string; description: string }
> = {
  line: {
    label: "Line",
    description: "Trends over time; supports multiple series",
  },
  bar: {
    label: "Bar",
    description: "Compare categories or periods",
  },
  stackedArea: {
    label: "Stacked Area",
    description: "Part-to-whole composition over time",
  },
  scatter: {
    label: "Scatter",
    description: "Relationship between two metrics",
  },
  pie: {
    label: "Pie",
    description: "Part-to-whole with few categories (≤6)",
  },
};
