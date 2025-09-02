import { NextRequest, NextResponse } from "next/server";

// ---- Allowed vocab the LLM must target ----
const METRICS = ["revenue", "units", "gross_margin_pct"] as const;
const GRAINS = ["year", "quarter", "month"] as const;
/**
 * Semantic dimensions (must match your dataset route + semantics.ts):
 * - region, channel, product_category, sales_rep (physical columns)
 * - country, market (derived from `state`)
 */
const DIMS = [
  "region",
  "channel",
  "product_category",
  "sales_rep",
  "country",
  "market",
] as const;

type Metric = (typeof METRICS)[number];
type Grain = (typeof GRAINS)[number];
type Dim = (typeof DIMS)[number];

type Filter =
  | {
      field: Dim | "year" | "quarter" | "month";
      op: "eq";
      value: string | number;
    }
  | {
      field: Dim | "year" | "quarter" | "month";
      op: "in";
      value: (string | number)[];
    }
  | {
      field: Dim | "year" | "quarter" | "month";
      op: "between";
      value: [number | string, number | string];
    }
  | {
      field: Dim | "year" | "quarter" | "month";
      op: "gte";
      value: number | string;
    }
  | {
      field: Dim | "year" | "quarter" | "month";
      op: "lte";
      value: number | string;
    };

export type QuerySpec = {
  metric: Metric;
  grain: Grain;
  dimensions: Dim[]; // up to 2 for now
  filters?: Filter[];
  time_range?: { preset?: "last_2_years"; from?: string; to?: string };
};

// ---- Model plumbing (OpenAI shown; swap to Anthropic if you prefer) ----
const PROVIDER = process.env.LLM_PROVIDER || "openai";
const MODEL =
  process.env.LLM_MODEL ||
  (PROVIDER === "openai" ? "gpt-4o-mini" : "claude-3-5-sonnet-20240620");

export async function POST(req: NextRequest) {
  const { q } = await req.json(); // natural language question

  const system = [
    "You convert a business question into a structured query spec for an internal sales dashboard.",
    "You MUST output valid JSON only.",
    "Choose from the provided metric, grain, and dimensions. Do not invent new fields.",
    "Prefer at most one dimension; two is OK when the user clearly compares categories.",
    "If the question mentions specific countries or markets (e.g., 'US', 'UK', 'CN-Shanghai'), map them to filters on 'country' or 'market'.",
    "If the question is time-based (quarters or months), set an appropriate grain.",
    "Default time_range.preset to 'last_2_years' unless the question specifies dates.",
  ].join(" ");

  const schemaHint = {
    metric: METRICS,
    grain: GRAINS,
    dimensions: DIMS,
    filters_examples: [
      { field: "country", op: "in", value: ["US", "UK", "JP"] },
      { field: "market", op: "eq", value: "CN-Shanghai" }, // (you can also match just 'Shanghai' via market if your pre-processing supports it)
      { field: "region", op: "eq", value: "Europe" },
      { field: "product_category", op: "eq", value: "iPhone" },
    ],
  };

  const examples = [
    {
      user: "Show revenue by country in 2024 by quarter",
      spec: {
        metric: "revenue",
        grain: "quarter",
        dimensions: ["country"],
        filters: [{ field: "year", op: "eq", value: 2024 }],
        time_range: { preset: "last_2_years" },
      },
    },
    {
      user: "Compare US vs UK vs JP revenue this year",
      spec: {
        metric: "revenue",
        grain: "quarter",
        dimensions: ["country"],
        filters: [
          { field: "country", op: "in", value: ["US", "UK", "JP"] },
          { field: "year", op: "eq", value: 2024 },
        ],
        time_range: { preset: "last_2_years" },
      },
    },
    {
      user: "Composition of revenue by product category in Europe by quarter",
      spec: {
        metric: "revenue",
        grain: "quarter",
        dimensions: ["product_category"],
        filters: [{ field: "region", op: "eq", value: "Europe" }],
        time_range: { preset: "last_2_years" },
      },
    },
    {
      user: "Top 5 markets by units for iPhone in Q2 2024",
      spec: {
        metric: "units",
        grain: "quarter",
        dimensions: ["market"],
        filters: [
          { field: "product_category", op: "eq", value: "iPhone" },
          { field: "year", op: "eq", value: 2024 },
          { field: "quarter", op: "eq", value: 2 },
        ],
        time_range: { preset: "last_2_years" },
      },
    },
  ];

  const prompt = JSON.stringify({
    allowed: schemaHint,
    examples,
    instruction: "Return ONLY a JSON object matching QuerySpec.",
    question: q,
  });

  try {
    if (PROVIDER === "openai") {
      const OpenAI = (await import("openai")).default;
      const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const resp = await client.responses.create({
        model: MODEL,
        input: [
          { role: "system", content: system },
          { role: "user", content: prompt },
        ],
        //@ts-ignore
        response_format: { type: "json_object" },
      });
      const text = resp.output_text || "{}";
      const spec = JSON.parse(text) as QuerySpec;

      // (Option A) Just return the spec; let the client call /api/dataset
      return NextResponse.json({ spec });

      // (Option B) If you want to chain the dataset call server-side:
      // const agg = await fetch(new URL("/api/dataset", req.url), {
      //   method: "POST",
      //   headers: { "content-type": "application/json" },
      //   body: JSON.stringify({ spec }),
      // }).then(r => r.json());
      // return NextResponse.json(agg);
    } else {
      const Anthropic = (await import("@anthropic-ai/sdk")).default;
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const msg = await client.messages.create({
        model: MODEL,
        max_tokens: 400,
        system,
        messages: [{ role: "user", content: [{ type: "text", text: prompt }] }],
      });
      const text = (msg.content?.[0] as any)?.text || "{}";
      const spec = JSON.parse(text) as QuerySpec;
      return NextResponse.json({ spec });
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
