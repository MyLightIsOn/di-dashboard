import type { QuerySpec, ChartConfig } from '@/types'

export function chooseCharts(spec: QuerySpec, rows: any[]): ChartConfig[] {
    // Heuristic policy
    const hasTime = true // spec.grain implies time on X
    const hasSeries = spec.dimensions.length > 0
    const primary: ChartConfig = hasTime
        ? {
            kind: 'line',
            x: spec.grain === 'year' ? 'year' : spec.grain === 'quarter' ? 'quarter' : 'month',
            y: 'value',
            series: spec.dimensions[0],
            data: rows,
            title: `${spec.metric} over time${spec.dimensions[0] ? ' by ' + spec.dimensions[0] : ''}`,
        }
        : {
            kind: spec.dimensions.length > 0 ? 'bar' : 'bar',
            x: spec.dimensions[0] || 'category',
            y: 'value',
            data: rows,
            title: `${spec.metric} by ${spec.dimensions[0]}`,
        }

    const alternates: ChartConfig[] = []
    if (hasTime && spec.dimensions.length) {
        alternates.push({ ...primary, kind: 'stackedBar' })
    } else if (!hasTime && spec.dimensions.length >= 2) {
        alternates.push({ kind: 'heatmap', x: spec.dimensions[0], y: spec.dimensions[1], data: rows, title: 'Heatmap' })
    }

    return [primary, ...alternates]
}
