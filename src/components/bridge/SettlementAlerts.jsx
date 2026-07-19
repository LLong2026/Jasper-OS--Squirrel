import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import {
  AlertTriangle, AlertOctagon, Bell, X, RefreshCw, Loader2,
} from 'lucide-react';

const POLL_MS = 30000;

const SEVERITY_STYLES = {
  critical: {
    bg: 'bg-red-500/10', border: 'border-red-500/40',
    icon: AlertOctagon, text: 'text-red-300', glow: 'shadow-[0_0_12px_rgba(239,68,68,0.25)]',
  },
  warning: {
    bg: 'bg-amber-500/10', border: 'border-amber-500/40',
    icon: AlertTriangle, text: 'text-amber-300', glow: '',
  },
};

export default function SettlementAlerts() {
  const [alerts, setAlerts] = useState([]);
  const [scanning, setScanning] = useState(false);
  const [errored, setErrored] = useState(false);

  const runSentinel = useCallback(async () => {
    setScanning(true);
    setErrored(false);
    try {
      const res = await base44.functions.invoke('settlementSentinel', { window_minutes: 15 });
      setAlerts(res?.active_alerts || []);
    } catch (e) {
      setErrored(true);
    } finally {
      setScanning(false);
    }
  }, []);

  useEffect(() => {
    runSentinel();
    const interval = setInterval(runSentinel, POLL_MS);
    return () => clearInterval(interval);
  }, [runSentinel]);

  const acknowledge = async (id) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
    try {
      await base44.entities.SettlementAlert.update(id, { status: 'acknowledged' });
    } catch (e) {
      // silent
    }
  };

  if (alerts.length === 0) {
    return (
      <div className="flex items-center gap-2 text-xs text-white/40">
        {scanning ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : errored ? (
          <AlertTriangle className="h-3.5 w-3.5 text-amber-400/60" />
        ) : (
          <Bell className="h-3.5 w-3.5 text-emerald-400/60" />
        )}
        <span>
          {errored
            ? 'Sentinel unavailable — will retry.'
            : 'Settlement mesh healthy — no bottlenecks or failures detected.'}
        </span>
        <span className="font-mono text-white/25">· auto-scan 30s</span>
        <button onClick={runSentinel} className="ml-2 hover:text-white/70">
          <RefreshCw className={`h-3.5 w-3.5 ${scanning ? 'animate-spin' : ''}`} />
        </button>
      </div>
    );
  }

  const criticalCount = alerts.filter((a) => a.severity === 'critical').length;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Bell className="h-4 w-4 text-red-400" />
        <span className="text-sm font-medium text-white/80">Settlement Alerts</span>
        <span className="text-xs font-mono text-white/40">
          {alerts.length} active{criticalCount > 0 ? ` · ${criticalCount} critical` : ''} · auto-scan 30s
        </span>
        <button onClick={runSentinel} className="ml-auto text-white/40 hover:text-white/70">
          <RefreshCw className={`h-3.5 w-3.5 ${scanning ? 'animate-spin' : ''}`} />
        </button>
      </div>
      {alerts.map((alert) => {
        const style = SEVERITY_STYLES[alert.severity] || SEVERITY_STYLES.warning;
        const Icon = style.icon;
        return (
          <div
            key={alert.id}
            className={`flex items-start gap-3 rounded-xl border ${style.border} ${style.bg} ${style.glow} px-4 py-3`}
          >
            <Icon className={`h-4 w-4 ${style.text} mt-0.5 shrink-0`} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-[10px] font-mono uppercase ${style.text}`}>{alert.alert_type}</span>
                <span className="text-sm font-medium text-white/90">{alert.title}</span>
              </div>
              <p className="text-xs text-white/50 mt-0.5">{alert.description}</p>
              {alert.c_stack && (
                <span className="text-[10px] font-mono text-white/30">
                  C_stack: {alert.c_stack.slice(0, 20)}…
                </span>
              )}
            </div>
            <button
              onClick={() => acknowledge(alert.id)}
              className="text-white/30 hover:text-white/70 shrink-0"
              title="Acknowledge"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}