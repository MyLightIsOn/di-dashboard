"use client";
import AutonomySlider from "@/components/AutonomySlider";
import ChatComposer from "@/components/ChatComposer";
import QueryPlan from "@/components/QueryPlan";
import InsightCards from "@/components/InsightCards";
import HistoryDrawer from "@/components/HistoryDrawer";
import VizSection from "@/components/VizSection";

export default function Page() {
  return (
    <main className="max-w-6xl mx-auto p-6 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">
          Decision Intelligence Dashboard
        </h1>
        <AutonomySlider />
      </header>
      <ChatComposer />
      <QueryPlan />
      <VizSection />
      <InsightCards />
      <HistoryDrawer />
    </main>
  );
}
