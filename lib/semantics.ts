import type { QuerySpec } from '@/types'

export const metrics = {
    revenue: { expr: 'SUM(revenue)', fmt: 'currency' },
    units: { expr: 'SUM(units)', fmt: 'integer' },
    gross_margin_pct: { expr: '(SUM(revenue)-SUM(cogs))/SUM(revenue)', fmt: 'percent' },
} as const

export const defaults = {
    time_range: 'last_2_years',
    grain: 'quarter' as const,
}

// Very small helper to assemble a safe SQL statement for Supabase RPC / query
export function compileSql(spec: QuerySpec) {
    const selectParts: string[] = []
    const groupParts: string[] = []

    // time grain
    if (spec.grain === 'year') {
        selectParts.push('year')
        groupParts.push('year')
    } else if (spec.grain === 'quarter') {
        selectParts.push('year, quarter')
        groupParts.push('year', 'quarter')
    } else {
        selectParts.push('year, month')
        groupParts.push('year', 'month')
    }

    // dimensions
    for (const d of spec.dimensions) {
        selectParts.push(d)
        groupParts.push(d)
    }

    // metric
    const met = metrics[spec.metric]
    selectParts.push(`${met.expr} AS value`)

    // filters → WHERE
    const where: string[] = []
    // last 2 fiscal/calendar years
    if (spec.time_range?.preset === 'last_2_years') {
        where.push('year >= EXTRACT(YEAR FROM CURRENT_DATE) - 1')
    }
    for (const f of spec.filters || []) {
        if (f.op === 'eq') where.push(`${f.field} = '${f.value}'`)
        if (f.op === 'in') where.push(`${f.field} IN (${(f.value as string[]).map(v=>`'${v}'`).join(',')})`)
        if (f.op === 'between' && Array.isArray(f.value)) where.push(`${f.field} BETWEEN ${f.value[0]} AND ${f.value[1]}`)
    }

    const sql = `SELECT ${selectParts.join(', ')}\nFROM ${process.env.NEXT_PUBLIC_SUPABASE_TABLE}\n${where.length ? 'WHERE ' + where.join(' AND ') : ''}\nGROUP BY ${groupParts.join(', ')}\nORDER BY ${groupParts.join(', ')};`

    return sql
}
