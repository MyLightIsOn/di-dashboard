'use client'
import { useStore } from '@/state/useStore'
import React from 'react'

export default function InsightCards(){
    const insights = useStore(s=>s.insights)
    const checks = useStore(s=>s.checks)
    if(!insights?.length) return null
    return (
        <div className="grid md:grid-cols-3 gap-3">
            {insights.map((it:any, idx:number)=> (
                <div key={idx} className="border rounded p-3 bg-white">
                    <div className="text-sm text-gray-500">{it.type}</div>
                    <div className="font-medium">{it.headline}</div>
                    <div className="text-sm text-gray-600">{it.details}</div>
                    <div className="text-xs text-gray-400 mt-2">confidence: {(checks.confidence*100).toFixed(0)}%</div>
                    <div className="mt-3 flex gap-2">
                        <button className="text-xs border rounded px-2 py-1">👍</button>
                        <button className="text-xs border rounded px-2 py-1">👎</button>
                        <button className="text-xs border rounded px-2 py-1">Mark incorrect</button>
                    </div>
                </div>
            ))}
        </div>
    )
}
