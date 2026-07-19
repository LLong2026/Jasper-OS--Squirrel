import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Shield, Zap, Lock, Globe, Activity } from 'lucide-react';

const NODES = [
  { id: 1, lat: 30.27, lng: -97.74, city: 'Austin, TX', label: 'Genesis Node', color: '#f59e0b' },
  { id: 2, lat: 51.51, lng: -0.13, city: 'London, UK', label: 'Zenodo Mirror', color: '#3b82f6' },
  { id: 3, lat: 35.68, lng: 139.69, city: 'Tokyo, JP', label: 'Asia Relay', color: '#8b5cf6' },
  { id: 4, lat: 48.85, lng: 2.35, city: 'Paris, FR', label: 'EU Compliance', color: '#10b981' },
  { id: 5, lat: -33.87, lng: 151.21, city: 'Sydney, AU', label: 'Pacific Anchor', color: '#3b82f6' },
  { id: 6, lat: 1.35, lng: 103.82, city: 'Singapore', label: 'SE Asia Hub', color: '#8b5cf6' },
  { id: 7, lat: 25.20, lng: 55.27, city: 'Dubai, UAE', label: 'Gulf Reserve', color: '#10b981' },
  { id: 8, lat: 40.71, lng: -74.01, city: 'New York, US', label: 'Wall St Bridge', color: '#ef4444' },
  { id: 9, lat: 37.77, lng: -122.42, city: 'San Francisco', label: 'Tech Relay', color: '#3b82f6' },
  { id: 10, lat: -23.55, lng: -46.63, city: 'São Paulo, BR', label: 'LATAM Node', color: '#f59e0b' },
];

function generateSig() {
  const chars = '0123456789abcdef';
  return Array.from({ length: 64 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function generateLog() {
  const actions = [
    'ANCHOR', 'COMMIT', 'TWEAK', 'VERIFY', 'CLOAK', 'MINT', 'BURN', 'RELAY'
  ];
  const nodes = NODES.map(n => n.city);
  const action = actions[Math.floor(Math.random() * actions.length)];
  const node = nodes[Math.floor(Math.random() * nodes.length)];
  const sig = generateSig().substring(0, 16);
  const colors = {
    ANCHOR: 'text-amber-400', COMMIT: 'text-blue-400', TWEAK: 'text-purple-400',
    VERIFY: 'text-green-400', CLOAK: 'text-red-400', MINT: 'text-emerald-400',
    BURN: 'text-orange-400', RELAY: 'text-cyan-400'
  };
  return { action, node, sig, color: colors[action], ts: new Date().toISOString().split('T')[1].split('.')[0] };
}

export default function CinematicDashboard() {
  const [logs, setLogs] = useState([]);
  const [activeNodes, setActiveNodes] = useState(new Set([1]));
  const [pulseNode, setPulseNode] = useState(null);
  const [blockHeight, setBlockHeight] = useState(842391);
  const [anchorCount, setAnchorCount] = useState(0);
  const [cloaked, setCloaked] = useState(false);
  const logRef = useRef(null);

  // Animate logs streaming in
  useEffect(() => {
    const initial = Array.from({ length: 12 }, generateLog);
    setLogs(initial);

    const interval = setInterval(() => {
      const newLog = generateLog();
      setLogs(prev => [newLog, ...prev.slice(0, 49)]);
      setAnchorCount(prev => prev + 1);

      // Light up a random node
      const nodeId = NODES[Math.floor(Math.random() * NODES.length)].id;
      setPulseNode(nodeId);
      setActiveNodes(prev => new Set([...prev, nodeId]));
      setTimeout(() => setPulseNode(null), 800);

      // Increment block height occasionally
      if (Math.random() > 0.85) setBlockHeight(prev => prev + 1);
    }, 900);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-black text-green-400 font-mono overflow-hidden relative">
      {/* Scanline overlay */}
      <div className="pointer-events-none fixed inset-0 z-50"
        style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.08) 2px, rgba(0,0,0,0.08) 4px)' }}
      />

      {/* Patent overlay */}
      <div className="fixed top-4 right-4 z-40 border border-amber-500/60 bg-black/80 px-4 py-2 rounded text-right">
        <div className="text-amber-400 text-xs font-bold tracking-widest">⚖ PATENT PENDING</div>
        <div className="text-amber-300/70 text-xs">US Prov. · July 3, 2025</div>
        <div className="text-blue-400/70 text-xs">Zenodo DOI · April 2026</div>
      </div>

      {/* Header */}
      <header className="border-b border-green-900 px-6 py-3 flex items-center justify-between bg-black/90 relative z-30">
        <div className="flex items-center gap-3">
          <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-green-300 text-sm tracking-widest font-bold">HYPERCHAIN TREASURY X∞</span>
          <span className="text-green-700 text-xs">// SCRIBE PROTOCOL ACTIVE</span>
        </div>
        <div className="flex items-center gap-6 text-xs">
          <div className="flex items-center gap-1.5">
            <Activity className="h-3 w-3 text-green-400" />
            <span className="text-green-400">BTC Block <span className="text-white font-bold">#{blockHeight.toLocaleString()}</span></span>
          </div>
          <div className="flex items-center gap-1.5">
            <Zap className="h-3 w-3 text-amber-400" />
            <span className="text-amber-400">Anchors <span className="text-white font-bold">{anchorCount.toLocaleString()}</span></span>
          </div>
          <div className="flex items-center gap-1.5">
            <Globe className="h-3 w-3 text-blue-400" />
            <span className="text-blue-400">Nodes <span className="text-white font-bold">{activeNodes.size}</span></span>
          </div>
          <button
            onClick={() => setCloaked(c => !c)}
            className={`flex items-center gap-1.5 px-3 py-1 rounded border text-xs transition-all ${cloaked ? 'border-red-500 text-red-400 bg-red-900/30 animate-pulse' : 'border-slate-600 text-slate-400 hover:border-red-500 hover:text-red-400'}`}
          >
            <Lock className="h-3 w-3" />
            {cloaked ? 'CLOAKED' : 'CLOAK'}
          </button>
        </div>
      </header>

      <div className="flex h-[calc(100vh-56px)]">

        {/* Left: Signature Log */}
        <div className="w-80 border-r border-green-900 flex flex-col bg-black/95">
          <div className="px-4 py-2 border-b border-green-900 flex items-center gap-2">
            <Shield className="h-3 w-3 text-green-400" />
            <span className="text-green-400 text-xs tracking-widest">SCHNORR LOG</span>
          </div>
          <div ref={logRef} className="flex-1 overflow-y-auto p-2 space-y-1">
            {logs.map((log, i) => (
              <div key={i} className={`text-xs border-l-2 pl-2 py-0.5 transition-all ${i === 0 ? 'border-green-400 bg-green-400/5' : 'border-green-900'}`}>
                <div className="flex items-center gap-2">
                  <span className="text-green-700">{log.ts}</span>
                  <span className={`font-bold ${log.color}`}>{log.action}</span>
                </div>
                <div className="text-slate-500 text-[10px]">{log.node}</div>
                <div className="text-green-800 text-[10px] font-mono truncate">sig:{log.sig}...</div>
              </div>
            ))}
          </div>
        </div>

        {/* Center: World Map */}
        <div className="flex-1 relative">
          {cloaked && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/90 backdrop-blur-sm">
              <div className="text-center">
                <div className="text-red-400 text-4xl font-bold tracking-widest animate-pulse mb-2">⬛ CLOAKED</div>
                <div className="text-red-600 text-sm">Topological Shift Active</div>
                <div className="text-slate-600 text-xs mt-1">State hidden in Taproot keyspace</div>
              </div>
            </div>
          )}

          <MapContainer
            center={[20, 10]}
            zoom={2}
            style={{ height: '100%', width: '100%', background: '#000' }}
            zoomControl={false}
            attributionControl={false}
          >
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            />
            {NODES.map(node => (
              <CircleMarker
                key={node.id}
                center={[node.lat, node.lng]}
                radius={activeNodes.has(node.id) ? (pulseNode === node.id ? 16 : 8) : 4}
                pathOptions={{
                  color: activeNodes.has(node.id) ? node.color : '#1a1a1a',
                  fillColor: activeNodes.has(node.id) ? node.color : '#0a0a0a',
                  fillOpacity: pulseNode === node.id ? 0.9 : 0.6,
                  weight: pulseNode === node.id ? 3 : 1,
                }}
              >
                <Popup className="bg-black text-green-400">
                  <div className="text-xs font-mono">
                    <div className="font-bold" style={{ color: node.color }}>{node.label}</div>
                    <div className="text-slate-400">{node.city}</div>
                  </div>
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>

          {/* Overlay stats */}
          <div className="absolute bottom-4 left-4 right-4 z-10 flex gap-3 pointer-events-none">
            {[
              { label: 'TGC Manifold', value: 'STABLE', color: 'text-green-400' },
              { label: 'Euler χ', value: '2', color: 'text-blue-400' },
              { label: 'Reserve Ratio', value: '103.7%', color: 'text-amber-400' },
              { label: 'Math is Law', value: 'ENFORCED', color: 'text-purple-400' },
            ].map(stat => (
              <div key={stat.label} className="flex-1 bg-black/80 border border-green-900 rounded px-3 py-2 text-center">
                <div className="text-green-800 text-[10px]">{stat.label}</div>
                <div className={`text-xs font-bold ${stat.color}`}>{stat.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: System Status */}
        <div className="w-64 border-l border-green-900 flex flex-col bg-black/95">
          <div className="px-4 py-2 border-b border-green-900">
            <span className="text-green-400 text-xs tracking-widest">AGENT FLEET</span>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {[
              { name: 'Jasper', role: 'High Court', status: 'ACTIVE', color: 'text-amber-400' },
              { name: 'Arete', role: 'Self-Learning', status: 'EVOLVING', color: 'text-purple-400' },
              { name: 'CodeForge', role: 'Rust Rails', status: 'COMPILING', color: 'text-blue-400' },
              { name: 'QuantumGuard', role: 'Compliance', status: 'SCANNING', color: 'text-green-400' },
              { name: 'SovereignOS', role: 'Ledger', status: 'ANCHORED', color: 'text-amber-400' },
              { name: 'GuardianLayer', role: 'Safety', status: 'SHIELDED', color: 'text-emerald-400' },
              { name: 'HiveMind', role: 'Consensus', status: 'SYNCING', color: 'text-cyan-400' },
              { name: 'AreteMonitor', role: 'Fitness', status: 'OPTIMAL', color: 'text-green-400' },
            ].map((agent, i) => (
              <div key={i} className="border border-green-900 rounded px-2 py-1.5 bg-green-400/[0.02]">
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-bold ${agent.color}`}>{agent.name}</span>
                  <span className="text-[10px] text-green-700 animate-pulse">{agent.status}</span>
                </div>
                <div className="text-[10px] text-slate-600">{agent.role}</div>
              </div>
            ))}
          </div>

          <div className="border-t border-green-900 p-3 text-center">
            <div className="text-green-800 text-[10px] mb-1">INVENTOR</div>
            <div className="text-amber-400 text-xs font-bold">Leon Calvin Long II</div>
            <div className="text-green-800 text-[10px] mt-1">The Leon Era · 2026</div>
          </div>
        </div>
      </div>
    </div>
  );
}