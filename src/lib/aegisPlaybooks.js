// Aegis Playbook Registry — 15 core+advanced playbooks + 2 quantum remediation playbooks.
// Mirror of the backend registry in aegisActuator; used by the UI for display.

export const PLAYBOOKS = [
  { id: 'PB-001', name: 'Service Restart', category: 'core', icon: 'RotateCw', trigger: 'resource exhaustion, crash loop', actions: ['backup_state', 'restart_service', 'verify_health'], safety: 'state backup first', fallback: 'PB-010' },
  { id: 'PB-002', name: 'Scale Up', category: 'core', icon: 'TrendingUp', trigger: 'sustained high load', actions: ['analyze_load', 'scale_up', 'verify_health'], safety: 'max 5 replicas', fallback: 'PB-003' },
  { id: 'PB-003', name: 'Traffic Reroute', category: 'core', icon: 'Shuffle', trigger: 'regional degradation', actions: ['detect_healthy_region', 'reroute_traffic', 'verify_latency'], safety: 'health-gate target region', fallback: 'PB-010' },
  { id: 'PB-004', name: 'Deploy Revert', category: 'core', icon: 'Undo2', trigger: 'post-deploy error spike', actions: ['identify_bad_deploy', 'revert_deploy', 'verify_health'], safety: 'revert to last green build', fallback: 'PB-008' },
  { id: 'PB-005', name: 'Cache Warming', category: 'core', icon: 'Flame', trigger: 'high latency, cold cache', actions: ['analyze_cache', 'warm_cache', 'verify_latency'], safety: 'read-only operation', fallback: 'PB-006' },
  { id: 'PB-006', name: 'CDN Flush', category: 'core', icon: 'CloudOff', trigger: 'stale content served', actions: ['detect_stale', 'flush_cdn', 'verify'], safety: 'incremental purge', fallback: 'PB-010' },
  { id: 'PB-007', name: 'Disk Cleanup', category: 'core', icon: 'Trash2', trigger: 'disk > 85%', actions: ['scan_disk', 'cleanup_disk', 'verify_space'], safety: 'whitelist temp dirs', fallback: 'PB-008' },
  { id: 'PB-008', name: 'Snapshot Restore', category: 'core', icon: 'DatabaseBackup', trigger: 'data corruption', actions: ['identify_snapshot', 'restore_snapshot', 'verify'], safety: 'backup current first', fallback: 'PB-010' },
  { id: 'PB-009', name: 'Security Incident', category: 'core', icon: 'ShieldAlert', trigger: 'confirmed breach', actions: ['isolate', 'notify_security', 'await_manual'], safety: 'manual approval required', fallback: 'PB-010' },
  { id: 'PB-010', name: 'Escalation', category: 'core', icon: 'BellRing', trigger: 'auto-heal failed', actions: ['collect_context', 'escalate'], safety: 'human-in-the-loop', fallback: null },
  { id: 'PB-011', name: 'Database Reindex', category: 'advanced', icon: 'Database', trigger: 'query times > 5s, fragmentation > 30%', actions: ['analyze_perf', 'reindex_db', 'update_stats', 'verify'], safety: 'low-traffic only, backup first, max 3/day', fallback: 'PB-008' },
  { id: 'PB-012', name: 'Config Drift Correction', category: 'advanced', icon: 'SlidersHorizontal', trigger: 'checksum mismatch', actions: ['compare_baseline', 'apply_baseline', 'verify'], safety: 'never revert < 5min changes', fallback: 'PB-003' },
  { id: 'PB-013', name: 'Service Dependency Restart', category: 'advanced', icon: 'Network', trigger: 'cascading failures', actions: ['topo_sort', 'restart_deps', 'verify_health'], safety: 'max 10 services, < 5min total', fallback: 'PB-010' },
  { id: 'PB-014', name: 'Canary Rollback', category: 'advanced', icon: 'Bird', trigger: 'error rate > 2x baseline', actions: ['compare_metrics', 'stop_canary', 'route_stable'], safety: 'min 100 requests, 95% confidence', fallback: 'PB-003' },
  { id: 'PB-015', name: 'Rate Limiter Adjustment', category: 'advanced', icon: 'Gauge', trigger: 'traffic spike > 3x, DDoS pattern', actions: ['analyze_traffic', 'calculate_limits', 'apply_throttling'], safety: 'never block > 256 IPs', fallback: 'PB-006' },
  { id: 'PQM-001', name: 'Post-Quantum Crypto Upgrade', category: 'quantum', icon: 'Atom', trigger: 'quantum-vulnerable algorithm detected', actions: ['analyze_crypto', 'initiate_crypto_upgrade', 'deploy_post_quantum_patch', 'rotate_keys_pq', 'decommission_classical', 'verify'], safety: 'dual-sign during migration', fallback: 'PQR-001' },
  { id: 'PQR-001', name: 'Post-Quantum Key Rotation', category: 'quantum', icon: 'KeyRound', trigger: 'PQ migration needed, key expiry', actions: ['analyze_crypto', 'rotate_keys_pq', 'decommission_classical', 'verify'], safety: 'verify round-trip before activation, decommission classical keys', fallback: 'PB-010' },
];

export const PLAYBOOK_STATS = {
  total: PLAYBOOKS.length,
  core: PLAYBOOKS.filter((p) => p.category === 'core').length,
  advanced: PLAYBOOKS.filter((p) => p.category === 'advanced').length,
  quantum: PLAYBOOKS.filter((p) => p.category === 'quantum').length,
};