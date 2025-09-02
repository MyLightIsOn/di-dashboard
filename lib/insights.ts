export function buildInsights(rows: any[], spec: any, checks: any) {
  if (!rows.length) return [];
  const timeKey =
    spec.grain === "year"
      ? "year"
      : spec.grain === "quarter"
        ? "quarter"
        : "month";

  // trend over period
  const ts = rows.map((r) => Number(r.value)).filter(Number.isFinite);
  const first = ts[0] ?? 0,
    last = ts[ts.length - 1] ?? 0;
  const pct = first ? ((last - first) / first) * 100 : 0;
  const trend = {
    type: "trend",
    headline:
      pct >= 0
        ? `Up ${pct.toFixed(1)}% over period`
        : `Down ${Math.abs(pct).toFixed(1)}% over period`,
    details: `From ${first.toLocaleString()} to ${last.toLocaleString()}`,
  };

  // latest vs previous period
  const latestKey = rows[rows.length - 1]?.[timeKey];
  const prevKey = rows[rows.length - 2]?.[timeKey];
  const sumFor = (key: any) =>
    rows
      .filter((r) => r[timeKey] === key)
      .reduce((a, b) => a + Number(b.value || 0), 0);
  const latest = sumFor(latestKey),
    prev = sumFor(prevKey);
  const accel = prev ? ((latest - prev) / prev) * 100 : undefined;
  const momentum = {
    type: "momentum",
    headline: `${accel?.toFixed(1)}% vs prior ${timeKey}`,
    details: `${latest.toLocaleString()} vs ${prev.toLocaleString()}`,
  };

  // top contributor if a dimension exists
  const dim = spec.dimensions?.[0];
  let top: any = null;
  if (dim) {
    const byDim = new Map<string, number>();
    rows.forEach((r) => {
      const k = String(r[dim] ?? "");
      if (!k) return;
      byDim.set(k, (byDim.get(k) || 0) + Number(r.value || 0));
    });
    const sorted = Array.from(byDim.entries()).sort((a, b) => b[1] - a[1]);
    if (sorted.length) {
      const [name, val] = sorted[0];
      const total = Array.from(byDim.values()).reduce((a, b) => a + b, 0);
      top = {
        type: "top",
        headline: `${name} leads (${((val / total) * 100).toFixed(1)}%)`,
        details: `${val.toLocaleString()} of ${total.toLocaleString()}`,
      };
    }
  }

  const cards = [trend, momentum];
  if (top) cards.push(top);
  return cards;
}
