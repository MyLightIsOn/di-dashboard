'use client'
import { useStore } from '@/state/useStore'
import React from 'react'

export default function HistoryDrawer(){
    const history = useStore(s=>s.history)
    if(!history.length) return null
    return (
        <div className="border rounded p-3 bg-white">
            <div className="font-medium mb-2">History</div>
            <ul className="space-y-1 text-sm">
                {history.map((h,i)=> <li key={i}>{new Date(h.ts).toLocaleString()} — {h.q}</li>)}
            </ul>
        </div>
    )
}
