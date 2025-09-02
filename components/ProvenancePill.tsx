'use client'

import React from 'react';

export default function ProvenancePill({ source, tab, snapshotAt }:{ source:string; tab:string; snapshotAt:string }){
    return (
        <div className="inline-flex items-center gap-2 text-xs bg-gray-100 border rounded-full px-3 py-1">
            <span>Source: {source}</span>
            <span>• Tab: {tab}</span>
            <span>• Snapshot: {snapshotAt}</span>
        </div>
    )
}
