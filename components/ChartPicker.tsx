"use client";
import { useEffect, useState } from "react";
import { CHART_CATALOG } from "@/lib/chartRegistry";

export default function ChartPicker({
  spec,
  profile,
  onPick,
}: {
  spec: any;
  profile: any;
  onPick: (key: string) => void;
}) {
  const [opts, setOpts] = useState<any[]>([]);

  useEffect(() => {
    async function run() {
      if (!spec) return;
      const res = await fetch("/api/recommend", {
        method: "POST",
        body: JSON.stringify({ spec, profile }),
      });
      const js = await res.json();
      setOpts(js);
    }
    run();
  }, [spec, profile]);

  if (!opts?.length) return null;
  return (
    <div className="border rounded p-3 bg-gray-50">
      <div className="text-sm font-medium mb-2">Recommended charts</div>
      <div className="flex flex-wrap gap-2">
        {opts.map((o, i) => (
          <button
            key={i}
            className="border rounded px-3 py-2 bg-white hover:bg-gray-100 text-left"
            onClick={() => onPick(o.key)}
          >
            <div className="font-medium">
              {CHART_CATALOG[o.key]?.label || o.key}
            </div>
            <div className="text-xs text-gray-500 max-w-[260px]">
              {o.reason || ""}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
