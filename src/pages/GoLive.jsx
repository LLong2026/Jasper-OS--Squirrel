import React from 'react';
import PreFlightChecklist from '@/components/preflight/PreFlightChecklist';
import LegalFooter from '@/components/legal/LegalFooter';
import { Rocket } from 'lucide-react';

export default function GoLive() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <div className="p-4 lg:p-6 space-y-4 flex-1">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500/20 to-emerald-500/20 border border-blue-500/30">
            <Rocket className="h-6 w-6 text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">Go-Live Pre-Flight</h1>
            <p className="text-xs text-slate-400">Production readiness verification — every system checked in real-time</p>
          </div>
        </div>

        <PreFlightChecklist />
      </div>
      <LegalFooter />
    </div>
  );
}