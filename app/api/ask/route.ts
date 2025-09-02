import { NextRequest, NextResponse } from "next/server";
import type { QuerySpec } from "@/types";

// Provider switch via env
const PROVIDER = process.env.LLM_PROVIDER || "openai"; // 'openai' | 'anthropic'
const MODEL =
  process.env.LLM_MODEL ||
  (PROVIDER === "openai" ? "gpt-4o-mini" : "claude-3-5-sonnet-20240620");

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
    /*spec =
      PROVIDER === "anthropic" ? await callAnthropic(q) : await callOpenAI(q);*/

    spec = {
      metric: "revenue",
      grain: "quarter",
      dimensions: ["region"],
      filters: [
        {
          field: "region",
          op: "in",
          value: ["Asia"],
        },
      ],
      time_range: {
        preset: "last_2_years",
      },
      assumptions: [],
    };
  } catch (e) {
    spec = ruleFallback(q);
  }

  // Minimal validation: ensure enums are respected, else fallback
  const validMetric = ["revenue", "units", "gross_margin_pct"].includes(
    spec.metric as any,
  );
  if (!validMetric) spec = ruleFallback(q);
  return NextResponse.json({ spec, mode });
}
