import type { QuerySpec } from "@/types";

/**
 * Metrics available to the LLM + compiler.
 * Keep exprs simple aggregates so pushdown works in SQL.
 */
export const metrics = {
  revenue: { expr: "SUM(revenue)", fmt: "currency" },
  units: { expr: "SUM(units)", fmt: "integer" },
  gross_margin_pct: {
    expr: "(SUM(revenue)-SUM(cogs)) / NULLIF(SUM(revenue),0)",
    fmt: "percent",
  },
} as const;

/**
 * Canonical semantic dimensions.
 * country/market are derived from "state" using Postgres regex + split_part.
 *
 * - US state two-letter codes  → country='US', market=<state>
 * - CC-City (e.g., CN-Shanghai)→ country='CN', market='Shanghai'
 * - CC only (e.g., UK/JP/NL)   → country='UK'
 */
export const dims = {
  region: "region",
  channel: "channel",
  product_category: "product_category",
  sales_rep: "sales_rep",

  country: `
    CASE
      WHEN state ~ '^[A-Z]{2}$' AND state IN ('AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','IA','ID','IL','IN','KS','KY','LA','MA','MD','ME','MI','MN','MO','MS','MT','NC','ND','NE','NH','NJ','NM','NV','NY','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VA','VT','WA','WI','WV','WY','DC') THEN 'US'
      WHEN state ~ '^[A-Z]{2}-' THEN split_part(state,'-',1)
      WHEN state ~ '^[A-Z]{2}$' THEN state
      ELSE NULL
    END
  `,

  market: `
    CASE
      WHEN state ~ '^[A-Z]{2}$' AND state IN ('AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','IA','ID','IL','IN','KS','KY','LA','MA','MD','ME','MI','MN','MO','MS','MT','NC','ND','NE','NH','NJ','NM','NV','NY','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VA','VT','WA','WI','WV','WY','DC') THEN state
      WHEN state ~ '^[A-Z]{2}-' THEN split_part(state,'-',2)
      ELSE NULL
    END
  `,
} as const;

export const defaults = {
  time_range: "last_2_years",
  grain: "quarter" as const,
};

/** Small helper to escape string literals safely (very basic) */
function sqlLiteral(val: unknown): string {
  if (val == null) return "NULL";
  if (typeof val === "number") return String(val);
  if (typeof val === "boolean") return val ? "TRUE" : "FALSE";
  // simple quote escape for strings
  return `'${String(val).replace(/'/g, "''")}'`;
}

/** Map a spec field to a SQL expression (handles derived dims) */
function fieldExpr(field: string): string {
  // time grain fields are physical columns
  if (field === "year" || field === "quarter" || field === "month")
    return field;

  // semantic dims
  const d = (dims as Record<string, string>)[field];
  if (d) return `(${d})`;

  // fall back to raw identifier (last resort)
  return field;
}

/**
 * Compile a compact SQL statement matching the QuerySpec.
 * Uses positional GROUP BY for expressions (1,2,3...) to avoid repeating CASEs.
 */
export function compileSql(spec: QuerySpec) {
  const selectParts: string[] = [];
  const aliases: string[] = []; // tracks the alias order for positional GROUP BY

  // 1) time grain
  if (spec.grain === "year") {
    selectParts.push("year AS year");
    aliases.push("year");
  } else if (spec.grain === "quarter") {
    selectParts.push("year AS year", "quarter AS quarter");
    aliases.push("year", "quarter");
  } else {
    selectParts.push("year AS year", "month AS month");
    aliases.push("year", "month");
  }

  // 2) dimensions (alias each expression to its dim name)
  for (const d of spec.dimensions || []) {
    const expr = fieldExpr(d);
    selectParts.push(`${expr} AS ${d}`);
    aliases.push(d);
  }

  // 3) metric (always last)
  const met = (metrics as Record<string, { expr: string }>)[spec.metric];
  if (!met) throw new Error(`Unknown metric: ${spec.metric}`);
  selectParts.push(`${met.expr} AS value`);

  // 4) filters → WHERE
  const where: string[] = [];

  // preset time range (calendar years)
  if (
    spec.time_range?.preset === "last_2_years" ||
    defaults.time_range === "last_2_years"
  ) {
    // include current and prior year
    where.push("year >= EXTRACT(YEAR FROM CURRENT_DATE) - 1");
  } else if (spec.time_range?.from || spec.time_range?.to) {
    // optional explicit dates if you add them to QuerySpec
    if (spec.time_range?.from)
      where.push(`order_date >= ${sqlLiteral(spec.time_range.from)}`);
    if (spec.time_range?.to)
      where.push(`order_date <= ${sqlLiteral(spec.time_range.to)}`);
  }

  for (const f of spec.filters || []) {
    const lhs = fieldExpr(String(f.field));
    if (f.op === "eq") {
      where.push(`${lhs} = ${sqlLiteral(f.value)}`);
    }
    if (f.op === "in") {
      const arr = Array.isArray(f.value) ? f.value : [f.value];
      const list = arr.map(sqlLiteral).join(",");
      where.push(`${lhs} IN (${list})`);
    }
    if (f.op === "gte") {
      where.push(`${lhs} >= ${sqlLiteral(f.value)}`);
    }
    if (f.op === "lte") {
      where.push(`${lhs} <= ${sqlLiteral(f.value)}`);
    }
    if (f.op === "between" && Array.isArray(f.value) && f.value.length === 2) {
      const [a, b] = f.value;
      where.push(`${lhs} BETWEEN ${sqlLiteral(a)} AND ${sqlLiteral(b)}`);
    }
  }

  // 5) GROUP BY positions (exclude the metric which is last)
  // positions are 1..N where N = number of select items prior to metric
  const groupCount = selectParts.length - 1;
  const groupBy = Array.from({ length: groupCount }, (_, i) =>
    String(i + 1),
  ).join(", ");

  const sql =
    `SELECT ${selectParts.join(", ")}\n` +
    `FROM ${process.env.NEXT_PUBLIC_SUPABASE_TABLE}\n` +
    (where.length ? `WHERE ${where.join(" AND ")}\n` : "") +
    `GROUP BY ${groupBy}\n` +
    `ORDER BY ${groupBy};`;

  return sql;
}
