import React from 'react';

const RAIL_META = {
  ISO: { label: 'ISO 20022', color: '#3b82f6', desc: 'pacs.008' },
  BTC: { label: 'Bitcoin', color: '#f59e0b', desc: 'Taproot' },
  XRP: { label: 'Ripple', color: '#10b981', desc: 'Payment' },
  CBDC: { label: 'CBDC', color: '#a855f7', desc: 'Wholesale' },
};

export default function RailMesh({ railStates, crossRailPass }) {
  const rails = railStates ? Object.keys(railStates) : Object.keys(RAIL_META);

  return (
    <div className="relative">
      {/* Central hub */}
      <div className="flex flex-col items-center">
        <div
          className={`rounded-full px-6 py-3 border-2 transition-all ${
            crossRailPass === false
              ? 'border-red-500 bg-red-500/10'
              : crossRailPass
              ? 'border-emerald-500 bg-emerald-500/10 shadow-[0_0_20px_rgba(16,185,129,0.4)]'
              : 'border-white/20 bg-white/5'
          }`}
        >
          <div className="text-center">
            <div className="text-xs font-mono text-white/50">URIB CORE</div>
            <div className="text-sm font-bold text-white">
              {crossRailPass === false ? 'INVARIANT FAIL' : crossRailPass ? 'VALUE EQUIV.' : 'STANDBY'}
            </div>
          </div>
        </div>
      </div>

      {/* Rail nodes */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
        {rails.map((railId) => {
          const meta = RAIL_META[railId] || { label: railId, color: '#64748b', desc: '' };
          const state = railStates?.[railId];
          const active = !!state;
          return (
            <div
              key={railId}
              className={`rounded-xl border p-3 transition-all ${
                active ? 'bg-white/[0.05]' : 'bg-white/[0.01] border-white/5'
              }`}
              style={{ borderColor: active ? meta.color + '60' : undefined }}
            >
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{
                    backgroundColor: meta.color,
                    boxShadow: active ? `0 0 8px ${meta.color}` : 'none',
                  }}
                />
                <span className="text-sm font-semibold text-white/90">{meta.label}</span>
              </div>
              <div className="text-[10px] font-mono text-white/40">{meta.desc}</div>
              {state && (
                <>
                  <div className="text-xs text-white/70 mt-1.5">
                    {state.value?.toLocaleString()} {state.currency}
                  </div>
                  <div className="text-[9px] font-mono text-white/30 truncate mt-0.5">
                    {state.stack_commitment?.slice(0, 16)}…
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}