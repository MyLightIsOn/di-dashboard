"use client";
import { useState } from "react";
import { useStore } from "@/state/useStore";
import React from "react";

export default function ChatComposer() {
  const [q, setQ] = useState(
    "Show revenue in Asia by quarter for last 2 years",
  );
  const mode = useStore((s) => s.mode);
  const setSpec = useStore((s) => s.setSpec);
  const pushHistory = useStore((s) => s.pushHistory);

  async function onAsk() {
    pushHistory(q);
    const res = await fetch("/api/ask", {
      method: "POST",
      body: JSON.stringify({ q, mode }),
    });
    const js = await res.json();
    setSpec(js.spec);
    if (mode === "auto") await runDataset(js.spec);
  }

  async function runDataset(spec: any) {
    const res = await fetch("/api/dataset", {
      method: "POST",
      body: JSON.stringify({ spec }),
    });
    const js = await res.json();
    // set result in store handled in page after fetch, but for simplicity we can dispatch a custom event
    window.dispatchEvent(new CustomEvent("di:dataset", { detail: js }));
  }

  return (
    <div className="flex items-start gap-3">
      <textarea
        className="flex-1 border rounded p-2 min-h-[72px]"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        aria-label="Ask a question"
      />
      <button className="bg-black text-white px-4 py-2 rounded" onClick={onAsk}>
        Ask
      </button>
    </div>
  );
}
