import { NextRequest, NextResponse } from "next/server";
import { CHART_CATALOG } from "@/lib/chartRegistry";

const PROVIDER = process.env.LLM_PROVIDER || "openai";
const MODEL =
  process.env.LLM_MODEL ||
  (PROVIDER === "openai" ? "gpt-4o-mini" : "claude-3-5-sonnet-20240620");

export async function POST(req: NextRequest) {
  const { spec, profile } = await req.json();
  const allowed = Object.entries(CHART_CATALOG).map(([key, meta]) => ({
    key,
    label: meta.label,
  }));

  const system = `You suggest visualization options for sales data. Return JSON array of up to 3 items like {key, title, reason}. Use only keys from the provided list.`;
  const user = JSON.stringify({
    allowed,
    spec,
    profile, // e.g., { timeGrain:'quarter', categories: 5, series: 2, hasTime:true, hasMultipleSeries:true }
  });

  try {
    if (PROVIDER === "openai") {
      const OpenAI = (await import("openai")).default;
      const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const resp = await client.responses.create({
        model: MODEL,
        input: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        // @ts-ignore
        response_format: { type: "json_object" },
      });
      const txt = resp.output_text || "[]";
      return NextResponse.json(JSON.parse(txt));
    } else {
      const Anthropic = (await import("@anthropic-ai/sdk")).default;
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const msg = await client.messages.create({
        model: MODEL,
        max_tokens: 400,
        system,
        messages: [{ role: "user", content: [{ type: "text", text: user }] }],
      });
      const txt = (msg.content?.[0] as any)?.text || "[]";
      return NextResponse.json(JSON.parse(txt));
    }
  } catch {
    // Heuristic fallback
    const options: any[] = [];
    if (profile?.hasTime && profile?.hasMultipleSeries)
      options.push(
        {
          key: "line",
          title: "Multi‑series line",
          reason: "Compare series over time",
        },
        {
          key: "stackedArea",
          title: "Stacked area",
          reason: "Show composition over time",
        },
      );
    else if (profile?.hasTime)
      options.push({ key: "line", title: "Line", reason: "Trend over time" });
    if (profile?.categories && profile.categories <= 6)
      options.push({
        key: "pie",
        title: "Pie",
        reason: "Small part‑to‑whole comparison",
      });
    if (!options.length)
      options.push({ key: "bar", title: "Bar", reason: "Category comparison" });
    return NextResponse.json(options.slice(0, 3));
  }
}
