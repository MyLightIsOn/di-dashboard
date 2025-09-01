// lib/supabaseClient.ts
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export const TABLE = process.env.NEXT_PUBLIC_SUPABASE_TABLE || 'sales_fact_rows'
