import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient"; // <- make sure this exists
import { computeChecks } from "@/lib/checks"; // uses your existing checks.ts
import { buildInsights } from "@/lib/insights"; // uses your existing insights.ts
import type { QuerySpec, ChartConfig } from "@/types";
import { COUNTRY_CODES, US_STATE_CODES } from "@/app/api/ask/route";

const TABLE = process.env.NEXT_PUBLIC_SUPABASE_TABLE || "sales_fact_rows";

function expandRegionShorthand(value: string): string[] {
  const v = String(value || "").toLowerCase();
  if (v === "asia" || v === "apac" || v === "asia pacific") {
    return ["Greater China", "Japan", "Rest of Asia Pacific"];
  }
  if (v === "europe" || v === "eu") {
    // tailor to your dataset
    return ["Europe"]; // or expand to country-level if you actually store countries as region—most likely keep as "Europe"
  }
  if (v === "americas" || v === "na" || v === "latam") {
    return ["Americas"]; // keep at your region granularity
  }
  return [value];
}

// reuse same constants as above (US_STATE_CODES, COUNTRY_CODES, expandRegionShorthand)
// add these near the top of the file or import from a shared util if you prefer

function normalizeDatasetFilters(filters: any[] = []) {
  return filters.flatMap((f) => {
    const op = f.op || "eq";
    const vals = Array.isArray(f.value) ? f.value : [f.value];

    if (f.field === "region") {
      const expanded = vals.flatMap(expandRegionShorthand);
      const looksLikeCountry = expanded.some((x) =>
        COUNTRY_CODES.has(String(x).toUpperCase()),
      );
      const looksLikeState = expanded.some((x) =>
        US_STATE_CODES.has(String(x).toUpperCase()),
      );
      if (looksLikeCountry)
        return [{ ...f, field: "country", op: "in", value: expanded }];
      if (looksLikeState)
        return [{ ...f, field: "market", op: "in", value: expanded }];
      return [{ ...f, op: "in", value: expanded }];
    }

    if (f.field === "country") {
      const regionTerms = vals.flatMap(expandRegionShorthand);
      const includedRegionWord = regionTerms.some((x) =>
        [
          "Europe",
          "Americas",
          "Greater China",
          "Japan",
          "Rest of Asia Pacific",
        ].includes(String(x)),
      );
      if (includedRegionWord)
        return [{ ...f, field: "region", op: "in", value: regionTerms }];
      return [{ ...f, op, value: vals }];
    }

    if (f.field === "state" || f.field === "market") {
      const looksLikeCountry = vals.some((x) =>
        COUNTRY_CODES.has(String(x).toUpperCase()),
      );
      if (looksLikeCountry)
        return [{ ...f, field: "country", op: "in", value: vals }];
      return [{ ...f, field: "market", op, value: vals }];
    }

    return [{ ...f, op, value: vals }];
  });
}

/**
 * Derive geo fields from your mixed "state" column:
 * - US state codes => country=US, market=<state>
 * - CC-City (e.g., CN-Shanghai) => country=CC, market=City
 * - CC (e.g., UK/JP/NL) => country=CC
 */
function deriveGeo(row: any) {
  const US = new Set([
    "AL",
    "AK",
    "AZ",
    "AR",
    "CA",
    "CO",
    "CT",
    "DE",
    "FL",
    "GA",
    "HI",
    "IA",
    "ID",
    "IL",
    "IN",
    "KS",
    "KY",
    "LA",
    "MA",
    "MD",
    "ME",
    "MI",
    "MN",
    "MO",
    "MS",
    "MT",
    "NC",
    "ND",
    "NE",
    "NH",
    "NJ",
    "NM",
    "NV",
    "NY",
    "OH",
    "OK",
    "OR",
    "PA",
    "RI",
    "SC",
    "SD",
    "TN",
    "TX",
    "UT",
    "VA",
    "VT",
    "WA",
    "WI",
    "WV",
    "WY",
    "DC",
  ]);
  const token = String(row.state || "").trim();
  let country = "";
  let market = "";

  if (!token) {
    // leave empty
  } else if (US.has(token)) {
    country = "US";
    market = token;
  } else if (/^[A-Z]{2}-.+/.test(token)) {
    const [cc, rest] = token.split("-", 2);
    country = cc;
    market = rest;
  } else if (/^[A-Z]{2}$/.test(token)) {
    country = token;
  } else {
    market = token;
  }
  return { country, market };
}

/** Pull everything since 2024-01-01 in pages of 1000 and return a flat array */
async function fetchAllRows(fromDateISO = "2024-01-01") {
  const page = 1000;
  let offset = 0;
  const acc: any[] = [];

  while (true) {
    const { data, error } = await supabase
      .from(TABLE)
      .select(
        "order_date,year,quarter,month,region,state,channel,product_category,product_name,revenue,units,cogs",
      )
      .gte("order_date", fromDateISO)
      .order("order_date", { ascending: true })
      .range(offset, offset + page - 1);

    if (error) throw new Error(error.message);
    if (!data?.length) break;

    acc.push(...data);
    if (data.length < page) break;
    offset += page;
  }
  return acc;
}

/** Simple helper for distinct values */
const distinct = (arr: any[], key: string) =>
  Array.from(new Set(arr.map((r) => r?.[key]).filter((v) => v != null)));

export async function POST(req: NextRequest) {
  const { spec }: { spec: QuerySpec } = await req.json();

  // Ensure filters is an array
  if (!Array.isArray(spec.filters)) spec.filters = [];
  spec.filters = normalizeDatasetFilters(spec.filters);

  // Expand shorthand values for region filters so "Asia" works
  spec.filters = spec.filters.map((f: any) => {
    if (f.field === "region") {
      if (f.op === "eq" && typeof f.value === "string") {
        return { ...f, op: "in", value: expandRegionShorthand(f.value) };
      }
      if (f.op === "in") {
        const arr = Array.isArray(f.value) ? f.value : [f.value];
        return { ...f, value: arr.flatMap(expandRegionShorthand) };
      }
    }
    return f;
  });

  try {
    // 1) Fetch raw rows (paginated) and derive geo
    const raw = await fetchAllRows("2024-01-01"); // your current dataset scope
    console.log(
      "REGIONS:",
      Array.from(new Set(raw.map((r) => r.region))).sort(),
    );

    for (const r of raw) {
      const { country, market } = deriveGeo(r);
      (r as any).country = country;
      (r as any).market = market;
    }

    // 2) Aggregate according to spec
    //    Supported: grain = year|quarter|month
    //    Dimension(s): region | country | market | channel | product_category | sales_rep (if present in your table)
    const timeKey =
      spec.grain === "year"
        ? "year"
        : spec.grain === "quarter"
          ? "quarter"
          : "month";

    // Apply basic filters from spec (optional; make sure your QuerySpec supports these)
    const passesFilter = (row: any) => {
      if (!spec.filters?.length) return true;
      return spec.filters.every((f) => {
        const v = row[f.field as keyof typeof row];
        switch (f.op) {
          case "eq":
            return v === f.value;
          case "in":
            return Array.isArray(f.value) ? f.value.includes(v) : v === f.value;
          case "gte":
            return Number(v) >= Number(f.value);
          case "lte":
            return Number(v) <= Number(f.value);
          case "between":
            return Array.isArray(f.value) && f.value.length === 2
              ? Number(v) >= Number(f.value[0]) &&
                  Number(v) <= Number(f.value[1])
              : true;
          default:
            return true;
        }
      });
    };

    const filtered = raw.filter(passesFilter);

    // Group/aggregate
    const groups = new Map<string, any>();
    for (const r of filtered) {
      const bucket: any = {
        year: r.year,
        quarter: r.quarter,
        month: r.month,
        region: r.region,
        country: r.country,
        market: r.market,
        channel: r.channel,
        product_category: r.product_category,
        sales_rep: r.sales_rep, // present in your example rows earlier
      };

      const parts: any[] = [];
      if (spec.grain === "year") parts.push(bucket.year);
      if (spec.grain === "quarter") parts.push(bucket.year, bucket.quarter);
      if (spec.grain === "month") parts.push(bucket.year, bucket.month);

      for (const d of spec.dimensions || [])
        parts.push(bucket[d as keyof typeof bucket]);

      const key = JSON.stringify(parts);
      const cur = groups.get(key) || {
        year: bucket.year,
        quarter: bucket.quarter,
        month: bucket.month,
      };
      for (const d of spec.dimensions || []) {
        (cur as any)[d] = bucket[d as keyof typeof bucket];
      }

      // Metric aggregation (sum)
      const add =
        spec.metric === "units"
          ? Number(r.units || 0)
          : spec.metric === "gross_margin_pct"
            ? // simple GM% proxy: (revenue - cogs) / revenue aggregated (guard div-by-zero)
              Number(r.revenue || 0) > 0
              ? (Number(r.revenue) - Number(r.cogs || 0)) / Number(r.revenue)
              : 0
            : Number(r.revenue || 0);

      // For GM%, better is to sum revenue/cogs and compute ratio post-aggregation.
      // To keep this file focused, we sum a 'value' that equals your chosen metric.
      (cur as any).value = Number((cur as any).value || 0) + add;

      groups.set(key, cur);
    }

    const rows = Array.from(groups.values()).sort(
      (a, b) =>
        a.year - b.year ||
        (a.quarter || 0) - (b.quarter || 0) ||
        (a.month || 0) - (b.month || 0),
    );

    // 3) Primary chart config (you can return alternates if you want)
    //    We set a reasonable default; user can switch kind via ChartPicker.
    const primary: ChartConfig = {
      kind: "line", // default; user can swap to bar/stackedArea/etc.
      x: timeKey,
      y: "value",
      series: spec.dimensions?.[0], // if present, makes a multi-series line
      title: `${spec.metric} by ${spec.dimensions?.[0] || timeKey} (${spec.grain})`,
      data: rows,
    };
    const charts: ChartConfig[] = [primary];

    // 4) Checks & Insights using your existing helpers
    const checks = computeChecks(rows, ["year", "quarter", "month"]);
    const insights = buildInsights(rows, spec, checks);

    // 5) Build a profile for chart recommendations (sent to /api/recommend)
    const catDim = spec.dimensions?.[0];
    const periods = distinct(rows, timeKey).length;
    const categories = catDim ? distinct(rows, catDim).length : 0;
    const profile = {
      hasTime: true,
      timeGrain: spec.grain,
      periods,
      categories,
      series: categories || 1,
      hasMultipleSeries: Boolean(catDim),
    };

    // 6) KPI strip (total + last period vs previous)
    const total = rows.reduce((a, b) => a + Number(b.value || 0), 0);
    const latestKey = rows.at(-1)?.[timeKey];
    const prevKey = rows.at(-2)?.[timeKey];
    const sumFor = (k: any) =>
      rows
        .filter((r) => r[timeKey] === k)
        .reduce((a, b) => a + Number(b.value || 0), 0);
    const last = sumFor(latestKey);
    const prev = sumFor(prevKey);
    const kpis = [
      { label: spec.metric.toUpperCase(), value: total },
      {
        label: `${String(timeKey).toUpperCase()} Latest`,
        value: last,
        deltaPct: prev ? ((last - prev) / prev) * 100 : undefined,
      },
    ];

    return NextResponse.json({
      rows,
      charts: [primary],
      insights,
      checks,
      kpis,
      profile,
      spec,
      provenance: {
        source: "Supabase",
        table: TABLE,
        snapshotAt: new Date().toISOString(),
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
