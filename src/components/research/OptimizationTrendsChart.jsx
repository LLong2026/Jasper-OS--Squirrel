import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, RefreshCw, ExternalLink } from 'lucide-react';

// Standalone dashboard widget: pulls optimization trends from the connected
// Google Sheet (via readOptimizationTrends backend function) and renders an
// impact-score-over-time line chart, one line per optimization type.
// Drop this into ResearchWorkbench (or any page) once the page file is editable.

const TYPE_COLORS = {
  hyperparameter_tuning: '#60a5fa',
  data_augmentation: '#34d399',
  feature_engineering: '#fbbf24',
  architecture_search: '#f472b6',
  prompt_refinement: '#a78bfa',
};

const fmtTime = (ts) => {
  try {
    return new Date(ts).toLocaleString(undefined, {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return '';
  }
};

export default function OptimizationTrendsChart() {
  const [data, setData] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await base44.functions.invoke('readOptimizationTrends', {});
      const points = res.points || [];

      // Build a unified time series: one entry per timestamp with impact_score
      // keyed by optimization_type. If multiple proposals share a timestamp,
      // average their impact scores per type.
      const byTime = new Map();
      const typeSet = new Set();
      points.forEach((p) => {
        typeSet.add(p.optimization_type);
        const key = p.created_at;
        if (!byTime.has(key)) byTime.set(key, { ts: key, buckets: {} });
        const bucket = byTime.get(key).buckets;
        const t = p.optimization_type;
        if (!bucket[t]) bucket[t] = { sum: 0, n: 0 };
        bucket[t].sum += p.impact_score;
        bucket[t].n += 1;
      });

      const series = Array.from(byTime.values())
        .sort((a, b) => a.ts - b.ts)
        .map((entry) => {
          const row = { time: fmtTime(entry.ts), _ts: entry.ts };
          Object.entries(entry.buckets).forEach(([t, v]) => {
            row[t] = Number((v.sum / v.n).toFixed(3));
          });
          return row;
        });

      setChartData(series);
      setTypes(Array.from(typeSet));
      setData(res);
    } catch (e) {
      setError(e.message || 'Failed to load optimization trends');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <Card className="bg-slate-900/60 border-slate-800 text-slate-100">
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-white">
            <TrendingUp className="h-5 w-5 text-emerald-400" />
            Optimization Trends
          </CardTitle>
          <CardDescription className="text-slate-400">
            Impact score over time by optimization type — sourced from your connected Google Sheet.
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          {data?.spreadsheet_url && (
            <Button
              variant="ghost"
              size="sm"
              className="text-slate-400 hover:text-white"
              onClick={() => window.open(data.spreadsheet_url, '_blank')}
            >
              <ExternalLink className="h-4 w-4 mr-1" /> Sheet
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="border-slate-700 text-slate-300 hover:bg-slate-800"
            onClick={load}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-72 w-full bg-slate-800" />
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-72 text-center">
            <p className="text-rose-400 mb-2">Unable to load trends</p>
            <p className="text-sm text-slate-500 max-w-md">{error}</p>
            <p className="text-xs text-slate-600 mt-2">
              Tip: run a stabilitySheetsExport cycle first to populate the OptimizationEvents tab.
            </p>
          </div>
        ) : chartData.length === 0 ? (
          <div className="flex items-center justify-center h-72 text-slate-500 text-sm">
            No optimization proposals exported yet.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 4, left: -8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis
                dataKey="time"
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                stroke="#334155"
                minTickGap={24}
              />
              <YAxis
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                stroke="#334155"
                label={{
                  value: 'Impact Score', angle: -90, position: 'insideLeft',
                  fill: '#64748b', fontSize: 11,
                }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a', border: '1px solid #1e293b',
                  borderRadius: 8, color: '#e2e8f0', fontSize: 12,
                }}
                labelStyle={{ color: '#94a3b8' }}
              />
              <Legend wrapperStyle={{ fontSize: 12, color: '#cbd5e1' }} />
              {types.map((t) => (
                <Line
                  key={t}
                  type="monotone"
                  dataKey={t}
                  stroke={TYPE_COLORS[t] || '#94a3b8'}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
        {data && !loading && !error && (
          <p className="mt-3 text-xs text-slate-500">
            Showing {data.count} proposals across {types.length} optimization type(s).
          </p>
        )}
      </CardContent>
    </Card>
  );
}