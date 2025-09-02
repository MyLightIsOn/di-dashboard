'use client'
import { useEffect, useState } from 'react'
import { useStore } from '@/state/useStore'
import React from 'react'

export default function QueryPlan(){
    const spec = useStore(s=>s.spec)
    const mode = useStore(s=>s.mode)
    const [pending,setPending] = useState(false)

    useEffect(()=>{
        async function onSpec(){
            if(!spec) return
            if(mode==='assisted') setPending(true)
        }
        onSpec()
    },[spec,mode])

    async function run(){
        const res = await fetch('/api/dataset', { method:'POST', body: JSON.stringify({ spec }) })
        const js = await res.json()
        window.dispatchEvent(new CustomEvent('di:dataset', { detail: js }))
        setPending(false)
    }

    if(!spec) return null
    return (
        <div className="border rounded p-3 bg-gray-50">
            <div className="flex items-center justify-between">
                <h3 className="font-medium">Query plan</h3>
                {mode==='assisted' && pending && (
                    <button className="bg-blue-600 text-white px-3 py-1 rounded" onClick={run}>Confirm & Run</button>
                )}
            </div>
            <pre className="text-xs mt-2 whitespace-pre-wrap">{JSON.stringify(spec,null,2)}</pre>
        </div>
    )
}
