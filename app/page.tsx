"use client";
import AutonomySlider from "@/components/AutonomySlider";
import ChatComposer from "@/components/ChatComposer";
import QueryPlan from "@/components/QueryPlan";
import InsightCards from "@/components/InsightCards";
import HistoryDrawer from "@/components/HistoryDrawer";
import VizSection from "@/components/VizSection";

const test = async () => {
  const userText = "Show revenue in Asia by quarter for last 2 years";

  /*const spec = {
    metric: "revenue",
    grain: "quarter",
    dimensions: ["region"], // or "region"
    filters: [],
    time_range: { preset: "last_2_years" }, // ignored by our dataset date clamp
  };*/

  /*const { spec } = await fetch("/api/ask", {
    method: "POST",
    body: JSON.stringify({ q: userText }),
  }).then((r) => r.json());*/

  const spec = {
    metric: "revenue",
    grain: "quarter",
    dimensions: ["region"],
    filters: [
      {
        field: "region",
        op: "in",
        value: [
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
        ],
      },
    ],
    time_range: {
      preset: "last_2_years",
    },
    assumptions: [],
  };

  const data = await fetch("/api/dataset", {
    method: "POST",
    body: JSON.stringify({ spec }),
  }).then((r) => r.json());

  window.dispatchEvent(new CustomEvent("di:dataset", { detail: data }));
};

export default function Page() {
  return (
    <main className="max-w-6xl mx-auto p-6 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">
          Decision Intelligence Dashboard
        </h1>
        <AutonomySlider />
      </header>
      <button onClick={test} type="button">
        Test
      </button>
      <ChatComposer />
      <QueryPlan />
      <VizSection />
      <InsightCards />
      <HistoryDrawer />
    </main>
  );
}
