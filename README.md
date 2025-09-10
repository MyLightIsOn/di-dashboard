# AI Sales Analytics Dashboard

A portfolio prototype that demonstrates how generative AI can power decision intelligence for sales teams. Business users ask questions in natural language (e.g., “Show quarterly revenue in Asia over the last two years”) and the app returns AI-recommended charts, KPIs, and narrative insights.

## Highlights
- Natural language to analytics: LLM turns questions into a structured query spec (metric, dimensions, filters, grain).
- Multiple chart recommendations: The system proposes several visualization options with justifications.
- Transparent insights: KPI strip and narrative callouts summarize trends, deltas, and top contributors.
- Flexible chart registry: New visualizations can be added via a central registry and typed props.
- Guardrails and normalization: User intent is normalized (e.g., “Asia” → Greater China, Japan, Rest of Asia Pacific) and validated to reduce LLM drift.

## Tech Stack
- Next.js 15 (App Router) + React 19 + TypeScript
- Tailwind CSS 4 for utility-first styling
- Recharts for data visualization
- Supabase (JS SDK) as data backend; CSV-like tables to simulate spreadsheet/BI sources
- Zustand for lightweight client state

## Architecture Overview
1. Chat input sends the user’s prompt to an API route.
2. LLM produces a JSON QuerySpec (metric, time range, grain, dimensions, filters, assumptions).
3. Spec is normalized and validated (region/country/market shorthands, enums, granularities).
4. Dataset route aggregates the underlying data and builds a simple profile (totals, continuity, top-N).
5. A recommendation step proposes several charts (line, stacked area, pie, bar) with short rationales.
6. UI renders the chosen chart(s), a KPI strip, and a brief narrative insight.

Key files to explore:
- app/api/ask/route.ts – Prompting, schema, and spec normalization; vendor model calls.
- app/api/dataset/route.ts – Data fetch/aggregation and profile building.
- components/ChatComposer.tsx – Chat-like input UX for asking questions.
- components/VizSection.tsx + lib/chartRegistry.tsx – Chart registry and renderer.
- lib/semantics.ts – Metric/dimension definitions and domain semantics.

## Notable AI/LLM Challenges Solved
- Schema-first prompting: Constrains the model to emit a strict JSON spec with enums to reduce hallucinations.
- Input normalization: Expands ambiguous geography terms and retargets filters (e.g., country vs state vs region) so queries “just work.”
- Validation and guardrails: Rejects or reshapes invalid specs; ensures stable chart dimensions and grains.
- Timeouts and fallbacks: Vendor calls are wrapped with timeouts and pragmatic fallbacks to keep the UI responsive.
- UX for trust: Shows assumptions alongside results; KPIs cross-check totals and highlight outliers to reduce misinterpretation.

## Running Locally
Prerequisites:
- Node 20+
- pnpm (recommended) or npm/yarn
- Supabase project (or mock data). Environment variables are required; see .env template below.

Install and start:
- pnpm install
- pnpm dev
- Visit http://localhost:3000

Environment variables (.env):
- NEXT_PUBLIC_SUPABASE_URL=
- NEXT_PUBLIC_SUPABASE_ANON_KEY=
- OPENAI_API_KEY= (if using OpenAI)
- ANTHROPIC_API_KEY= (if using Anthropic)

Data:
- The app expects seeded sales data for the last 2 years across regions, channels, and product categories. You can adapt the dataset route to your own tables or mock service.

## Usage Tips
- Try queries like:
  - “Show monthly revenue by region for the last 2 years.”
  - “Compare units by channel in Europe, quarterly.”
  - “Top product categories in the Americas last year.”
- Use the chart picker to switch between AI-recommended views.

## Why This Project
This prototype showcases the intersection of AI, data visualization, and product design:
- Framing ambiguous natural language into reliable analytical structures.
- Designing UX patterns that keep humans in the loop (recommendations instead of one-shot answers).
- Building extensible, typed abstractions for charts and metrics so the system grows gracefully.
