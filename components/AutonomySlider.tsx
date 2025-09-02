'use client'
import { useStore } from '@/state/useStore'
import React from 'react'

export default function AutonomySlider(){
    const mode = useStore(s=>s.mode)
    const setMode = useStore(s=>s.setMode)
    return (
        <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">Autonomy</span>
            <select
                className="border rounded px-2 py-1"
                value={mode}
                onChange={e=>setMode(e.target.value as any)}
                aria-label="Autonomy level"
            >
                <option value="off">Off</option>
                <option value="assisted">Assisted</option>
                <option value="auto">Auto</option>
            </select>
        </div>
    )
}
