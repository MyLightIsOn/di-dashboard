"use client";
export default function KpiStrip({
  items,
}: {
  items: { label: string; value: number; deltaPct?: number }[];
}) {
  if (!items?.length) return null;
  return (
    <div className="grid sm:grid-cols-3 gap-3">
      {items.map((k, i) => (
        <div key={i} className="rounded border bg-white p-3">
          <div className="text-xs text-gray-500">{k.label}</div>
          <div className="text-2xl font-semibold">
            {Intl.NumberFormat().format(k.value)}
          </div>
          {typeof k.deltaPct === "number" && (
            <div
              className={`text-xs mt-1 ${k.deltaPct >= 0 ? "text-emerald-600" : "text-rose-600"}`}
            >
              {k.deltaPct >= 0 ? "+" : ""}
              {k.deltaPct.toFixed(1)}%
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
