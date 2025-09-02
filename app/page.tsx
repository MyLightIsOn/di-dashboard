"use client";
import AutonomySlider from "@/components/AutonomySlider";
import ChatComposer from "@/components/ChatComposer";
import QueryPlan from "@/components/QueryPlan";
import InsightCards from "@/components/InsightCards";
import HistoryDrawer from "@/components/HistoryDrawer";
import VizSection from "@/components/VizSection";

const test = async ()  => {
  const res = await fetch("/api/dataset", {
    method: "POST",
    body: JSON.stringify({
      spec: {
        metric: "revenue",
        grain: "quarter",
        dimensions: ["country"], // or "region"
        filters: [],
        time_range: { preset: "last_4_years" } // ignored by our dataset date clamp
      }
    }),
  });
  const data = await res.json();
  console.log("DATASET:", data);
  window.dispatchEvent(new CustomEvent("di:dataset", { detail: data }));

}

export default function Page() {
  return (
    <main className="max-w-6xl mx-auto p-6 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">
          Decision Intelligence Dashboard
        </h1>
        <AutonomySlider />
      </header>
      <button onClick={test}>Test</button>
      <ChatComposer />
      <QueryPlan />
      <VizSection />
      <InsightCards />
      <HistoryDrawer />
    </main>
  );
}
