export type Grain = 'month' | 'quarter' | 'year'
export type Metric = 'revenue' | 'units' | 'gross_margin_pct'
export type Dim = 'region' | 'channel' | 'product_category' | 'sales_rep'

export type Filter = { field: Dim | 'year' | 'quarter' | 'month'; op: 'eq'|'in'|'gte'|'lte'|'between'; value: any }

export type QuerySpec = {
    metric: Metric
    time_range: { preset?: 'last_4_years'; from?: string; to?: string }
    grain: Grain
    dimensions: Dim[]
    filters: Filter[]
    assumptions?: string[]
}

export type DataRow = Record<string, any>

export type ChartKind = 'line'|'bar'|'stackedBar'|'heatmap'

export type ChartConfig = {
    kind: ChartKind
    x: string
    y: string
    series?: string // e.g. region for multi-series line
    data: DataRow[]
    title: string
}
