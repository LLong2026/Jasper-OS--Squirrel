// Aegis Playbook Registry — 28 playbooks (core + advanced + quantum + system).
// World-class autonomous repair coverage. Mirror of backend registry in aegisActuator.

export const PLAYBOOKS = [
  // === CORE (PB-001 — PB-010) ===
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

  // === ADVANCED (PB-011 — PB-017) ===
  { id: 'PB-011', name: 'Database Reindex', category: 'advanced', icon: 'Database', trigger: 'query times > 5s, fragmentation > 30%', actions: ['analyze_perf', 'reindex_db', 'update_stats', 'verify'], safety: 'low-traffic only, backup first, max 3/day', fallback: 'PB-008' },
  { id: 'PB-012', name: 'Config Drift Correction', category: 'advanced', icon: 'SlidersHorizontal', trigger: 'checksum mismatch', actions: ['compare_baseline', 'apply_baseline', 'verify'], safety: 'never revert < 5min changes', fallback: 'PB-003' },
  { id: 'PB-013', name: 'Service Dependency Restart', category: 'advanced', icon: 'Network', trigger: 'cascading failures', actions: ['topo_sort', 'restart_deps', 'verify_health'], safety: 'max 10 services, < 5min total', fallback: 'PB-010' },
  { id: 'PB-014', name: 'Canary Rollback', category: 'advanced', icon: 'Bird', trigger: 'error rate > 2x baseline', actions: ['compare_metrics', 'stop_canary', 'route_stable'], safety: 'min 100 requests, 95% confidence', fallback: 'PB-003' },
  { id: 'PB-015', name: 'Rate Limiter Adjustment', category: 'advanced', icon: 'Gauge', trigger: 'traffic spike > 3x, DDoS pattern', actions: ['analyze_traffic', 'calculate_limits', 'apply_throttling'], safety: 'never block > 256 IPs', fallback: 'PB-006' },
  { id: 'PB-016', name: 'Entity Recovery', category: 'advanced', icon: 'Database', trigger: 'entity_error — schema validation failure, query timeout', actions: ['probe_entities', 'identify_failing_entity', 'repair_entity', 'verify'], safety: 'read-only probe first, targeted repair only', fallback: 'PB-010' },
  { id: 'PB-017', name: 'Integration Failover', category: 'advanced', icon: 'Network', trigger: 'integration_degraded — LLM provider or connector slow/failing', actions: ['probe_integrations', 'select_healthy_provider', 'reroute_integration', 'verify'], safety: 'prefer free-tier providers, preserve conversation context', fallback: 'PB-010' },

  // === SYSTEM REPAIR (PB-018 — PB-028) ===
  { id: 'PB-018', name: 'Memory Bank Defragmentation', category: 'advanced', icon: 'Database', trigger: 'slow recall, memory fragmentation, high access latency', actions: ['scan_memory', 'defragment_memory', 'compact_indexes', 'verify'], safety: 'read-only scan first, compaction during low traffic', fallback: 'PB-010' },
  { id: 'PB-019', name: 'Agent Deadlock Resolution', category: 'advanced', icon: 'Lock', trigger: 'agent mesh stuck, no progress detected, circular wait', actions: ['detect_deadlock', 'break_deadlock', 'restart_stalled_agents', 'verify'], safety: 'preserve completed work, restart only stalled agents', fallback: 'PB-013' },
  { id: 'PB-020', name: 'Quantum Decoherence Recovery', category: 'quantum', icon: 'Atom', trigger: 'PQ signature verification failure, key corruption', actions: ['detect_decoherence', 'reissue_pq_keys', 'verify_signatures', 'verify'], safety: 're-issue via quantumResilience, verify round-trip before activation', fallback: 'PQR-001' },
  { id: 'PB-021', name: 'Swarm Consensus Repair', category: 'advanced', icon: 'Network', trigger: 'swarm unable to reach consensus, deliberation timeout', actions: ['assess_consensus', 'reset_stalled_swarm', 'reinitiate_voting', 'verify'], safety: 'preserve partial results, reset only stalled swarms', fallback: 'PB-013' },
  { id: 'PB-022', name: 'Token Economy Stabilization', category: 'advanced', icon: 'Coins', trigger: 'token supply anomaly, policy violation, mint/burn imbalance', actions: ['audit_token_supply', 'stabilize_supply', 'verify_policy', 'verify'], safety: 'audit before action, policy engine enforcement', fallback: 'PB-010' },
  { id: 'PB-023', name: 'DID Rotation & Recovery', category: 'advanced', icon: 'KeyRound', trigger: 'DID document stale, credential verification failure', actions: ['audit_dids', 'rotate_stale_dids', 'verify_credentials', 'verify'], safety: 'preserve trust scores, rotate only stale DIDs', fallback: 'PB-010' },
  { id: 'PB-024', name: 'URIB Settlement Retry', category: 'advanced', icon: 'Radio', trigger: 'settlement stall, partial rail coverage, retry storm', actions: ['identify_stalled_settlement', 'retry_settlement', 'verify_rails', 'verify'], safety: 'exponential backoff, max 3 retries, preserve thread anchor', fallback: 'PB-010' },
  { id: 'PB-025', name: 'Circuit Breaker Reset', category: 'core', icon: 'ToggleRight', trigger: 'circuit breaker tripped, service isolated, cascading protection', actions: ['identify_tripped_breakers', 'reset_breakers', 'gradual_traffic_restore', 'verify'], safety: 'gradual restore, monitor error rate, auto-trip on regression', fallback: 'PB-010' },
  { id: 'PB-026', name: 'Cache Poisoning Remediation', category: 'advanced', icon: 'Bug', trigger: 'corrupted cache entries, invalid data served from cache', actions: ['detect_poisoned_entries', 'purge_poisoned_cache', 'rebuild_cache', 'verify'], safety: 'full purge + rebuild, verify integrity before serving', fallback: 'PB-008' },
  { id: 'PB-027', name: 'Connection Pool Recovery', category: 'advanced', icon: 'Plug', trigger: 'connection pool exhausted, connection leaks, pool timeout', actions: ['detect_pool_exhaustion', 'drain_idle_connections', 'rebuild_pool', 'verify'], safety: 'drain idle first, rebuild pool, verify before traffic restore', fallback: 'PB-001' },
  { id: 'PB-028', name: 'Event Mesh Backpressure Relief', category: 'advanced', icon: 'Layers', trigger: 'event queue overflow, backpressure, event processing lag', actions: ['detect_backpressure', 'shed_low_priority_events', 'replay_queued_events', 'verify'], safety: 'shed only low-priority, preserve critical events, replay after relief', fallback: 'PB-013' },

  // === QUANTUM REMEDIATION ===
  { id: 'PQM-001', name: 'Post-Quantum Crypto Upgrade', category: 'quantum', icon: 'Atom', trigger: 'quantum-vulnerable algorithm detected', actions: ['analyze_crypto', 'initiate_crypto_upgrade', 'deploy_post_quantum_patch', 'rotate_keys_pq', 'decommission_classical', 'verify'], safety: 'dual-sign during migration', fallback: 'PQR-001' },
  { id: 'PQR-001', name: 'Post-Quantum Key Rotation', category: 'quantum', icon: 'KeyRound', trigger: 'PQ migration needed, key expiry', actions: ['analyze_crypto', 'rotate_keys_pq', 'decommission_classical', 'verify'], safety: 'verify round-trip before activation, decommission classical keys', fallback: 'PB-010' },
];

export const PLAYBOOK_STATS = {
  total: PLAYBOOKS.length,
  core: PLAYBOOKS.filter((p) => p.category === 'core').length,
  advanced: PLAYBOOKS.filter((p) => p.category === 'advanced').length,
  quantum: PLAYBOOKS.filter((p) => p.category === 'quantum').length,
};