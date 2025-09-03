import { NextRequest, NextResponse } from "next/server";
import type { QuerySpec } from "@/types";

// Provider switch via env
const PROVIDER = process.env.LLM_PROVIDER || "openai"; // 'openai' | 'anthropic'
const MODEL =
  process.env.LLM_MODEL ||
  (PROVIDER === "openai" ? "gpt-4o-mini" : "claude-3-5-sonnet-20240620");

// Put these near the top of the file (module scope)
export const US_STATE_CODES = new Set([
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
export const COUNTRY_CODES = new Set([
  "US",
  "UK",
  "NL",
  "SE",
  "DE",
  "FR",
  "IT",
  "ES",
  "JP",
  "CN",
  "KR",
  "IN",
  "SG",
  "CA",
  "MX",
  "BR",
  "AR",
  "CL",
]); // tailor to your data
const ASIA_ALIASES = new Set(["asia", "apac", "asia pacific"]);

// Expand “Asia” etc. to your dataset’s region names
function expandRegionShorthand(v: string): string[] {
  const s = v.toLowerCase();
  if (ASIA_ALIASES.has(s))
    return ["Greater China", "Japan", "Rest of Asia Pacific"];
  if (s === "europe" || s === "eu") return ["Europe"];
  if (s === "americas" || s === "na" || s === "latam") return ["Americas"];
  return [v];
}

// If a filter is on the wrong field, retarget it (region → country / market)
function normalizeFilters(filters: any[] = []) {
  return filters.flatMap((f) => {
    // Normalize shape
    const op = f.op || "eq";
    const vals = Array.isArray(f.value) ? f.value : [f.value];

    // 1) Region shorthands: "Asia" → real region names
    if (f.field === "region") {
      const expanded = vals.flatMap(expandRegionShorthand);
      // BUT if user actually supplied country codes under "region", retarget to country
      const looksLikeCountry = expanded.some((x) =>
        COUNTRY_CODES.has(String(x).toUpperCase()),
      );
      const looksLikeState = expanded.some((x) =>
        US_STATE_CODES.has(String(x).toUpperCase()),
      );
      if (looksLikeCountry) {
        return [
          { ...f, field: "country", op: "in", value: expanded.map(String) },
        ];
      }
      if (looksLikeState) {
        // They meant US states → retarget to market (derived from state)
        return [
          { ...f, field: "market", op: "in", value: expanded.map(String) },
        ];
      }
      return [{ ...f, op: "in", value: expanded }];
    }

    // 2) Country filter accidentally using region terms like "Europe" → retarget to region
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
      if (includedRegionWord) {
        return [{ ...f, field: "region", op: "in", value: regionTerms }];
      }
      return [{ ...f, op, value: vals }];
    }

    // 3) State/market anomalies: if they put states into "country", fix it
    if (f.field === "state" || f.field === "market") {
      const looksLikeCountry = vals.some((x) =>
        COUNTRY_CODES.has(String(x).toUpperCase()),
      );
      if (looksLikeCountry) {
        return [{ ...f, field: "country", op: "in", value: vals.map(String) }];
      }
      return [{ ...f, field: "market", op, value: vals }];
    }

    // Default passthrough
    return [{ ...f, op, value: vals }];
  });
}

// JSON schema we expect from the LLM
const querySpecSchema = {
  type: "object",
  properties: {
    metric: { enum: ["revenue", "units", "gross_margin_pct"] },
    time_range: {
      type: "object",
      properties: {
        preset: { enum: ["last_2_years"] },
        from: { type: "string" },
        to: { type: "string" },
      },
      additionalProperties: false,
    },
    grain: { enum: ["month", "quarter", "year"] },
    dimensions: {
      type: "array",
      items: { enum: ["region", "channel", "product_category", "sales_rep"] },
    },
    filters: {
      type: "array",
      items: {
        type: "object",
        properties: {
          field: {
            enum: [
              "region",
              "channel",
              "product_category",
              "sales_rep",
              "year",
              "quarter",
              "month",
            ],
          },
          op: { enum: ["eq", "in", "gte", "lte", "between"] },
          value: {},
        },
        required: ["field", "op", "value"],
        additionalProperties: false,
      },
    },
    assumptions: { type: "array", items: { type: "string" } },
  },
  required: ["metric", "grain", "dimensions", "filters", "time_range"],
} as const;

function ruleFallback(q: string): QuerySpec {
  return {
    metric: q.toLowerCase().includes("unit") ? "units" : "revenue",
    time_range: { preset: "last_2_years" },
    grain: q.toLowerCase().includes("year") ? "year" : "quarter",
    dimensions: q.toLowerCase().includes("region") ? ["region"] : [],
    filters: [],
    assumptions: ["Parsed with rule‑based fallback"],
  };
}

async function callOpenAI(q: string): Promise<QuerySpec> {
  const OpenAI = (await import("openai")).default;
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  // System instructions to strongly bias valid JSON output following our schema
  const system = `You are an intent parser for a sales DI dashboard. Output ONLY valid JSON that matches the provided JSON Schema.

JSON Schema: ${JSON.stringify(querySpecSchema)}

Mapping rules:
- "sales", "revenue", "gmv" => metric: revenue
- "units" => metric: units
- If time grain mentioned: year/quarter/month. Default quarter.
- If regions mentioned (west/east/north/south), set dimensions:['region'] and add a filter with op:'in'.
- Use time_range.preset:'last_2_years' unless explicit dates provided.`;

  // Wrap the OpenAI call in a timeout to avoid hanging
  const withTimeout = async <T>(p: Promise<T>, ms: number): Promise<T> => {
    return await Promise.race([
      p,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`OpenAI timeout after ${ms}ms`)), ms),
      ),
    ]);
  };

  try {
    console.time("openai-call");
    // Use Chat Completions API for broader compatibility
    const resp = await withTimeout(
      client.chat.completions.create({
        model: MODEL,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: q },
        ],
        temperature: 0,
      }) as Promise<any>,
      15000,
    );
    console.timeEnd("openai-call");

    console.log("OpenAI raw resp received");
    console.log(q);

    const content = resp?.choices?.[0]?.message?.content ?? "{}";
    console.log(content);

    try {
      return JSON.parse(content);
    } catch (e) {
      console.warn("Failed to parse OpenAI JSON, using fallback", e);
      return ruleFallback(q);
    }
  } catch (e) {
    console.error("OpenAI call failed:", e);
    return ruleFallback(q);
  }
}

async function callAnthropic(q: string): Promise<QuerySpec> {
  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const system = `You are an intent parser for a sales DI dashboard. Respond with ONLY JSON that matches the provided JSON Schema.`;

  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 500,
    system,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `JSON Schema: ${JSON.stringify(querySpecSchema)}

User: ${q}`,
          },
        ],
      },
    ],
  });
  const txt = (msg.content?.[0] as any)?.text || "{}";
  try {
    return JSON.parse(txt);
  } catch {
    return ruleFallback(q);
  }
}

export async function POST(req: NextRequest) {
  const { q, mode } = await req.json();

  let spec: QuerySpec;
  try {
    spec =
      PROVIDER === "anthropic" ? await callAnthropic(q) : await callOpenAI(q);
  } catch (e) {
    spec = ruleFallback(q);
  }

  // --- Validation & normalization ---
  // 1. Ensure filters is always an array
  if (!Array.isArray(spec.filters)) {
    spec.filters = [];
    spec.filters = normalizeFilters(spec.filters);
  }

  // 2. Expand shorthand region names
  // --- Region expansion helper ---
  function expandRegion(value: string): string[] {
    const v = value.toLowerCase();

    // Asia-Pacific variants
    if (v === "asia" || v === "apac" || v === "asia pacific") {
      return ["Greater China", "Japan", "Rest of Asia Pacific"];
    }

    // Europe shorthand
    if (v === "europe" || v === "eu") {
      return ["UK", "NL", "SE", "DE", "FR", "IT", "ES"];
      // ↑ list the country codes you actually use in your dataset
    }

    // Americas shorthand
    if (v === "americas" || v === "na" || v === "latam") {
      return ["US", "CA", "MX", "BR", "AR", "CL"];
      // ↑ again, tailor this list to match the values in your data
    }

    // US as a country → all 50 states
    if (v === "us" || v === "usa" || v === "united states") {
      return [
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
      ];
    }

    // Catch-all → return the literal value unchanged
    return [value];
  }

  if (spec.filters) {
    spec.filters = spec.filters.map((f) => {
      if (f.field === "region" && f.op === "in") {
        const arr = Array.isArray(f.value) ? f.value : [f.value];
        return { ...f, value: arr.flatMap(expandRegion) };
      }
      if (
        f.field === "region" &&
        f.op === "eq" &&
        typeof f.value === "string"
      ) {
        return { ...f, op: "in", value: expandRegion(f.value) };
      }
      return f;
    });
  }

  // 3. Validate enums
  const validMetric = ["revenue", "units", "gross_margin_pct"].includes(
    spec.metric as any,
  );
  if (!validMetric) {
    spec = ruleFallback(q);
  }

  return NextResponse.json({ spec, mode });
}
