import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Lightbulb, Cog, ListChecks, Wrench, ChevronDown, ChevronUp } from 'lucide-react';
import LegalFooter from '@/components/legal/LegalFooter';

const SECTIONS = [
  {
    id: 'why', icon: Lightbulb, title: 'Why Build This', accent: 'text-amber-400',
    content: `Jasper was built to solve a fundamental problem: financial infrastructure is fragmented across incompatible rails (ISO 20022, Bitcoin, XRP, CBDC), each with its own messaging, settlement, and security protocols. Cross-rail transactions require manual reconciliation, trusted intermediaries, and days of latency.

Jasper unifies these rails through a deterministic multi-agent orchestration engine. The URIB (Universal Rail Integration Bridge) pipeline canonically maps any financial instruction across all rails in 7 stages — Canonical, Semantic, ThreadZero, Stack, Taproot, Rails, Settlement — with cryptographic proofing at every step.

The Aegis self-healing engine ensures the infrastructure never goes down: 28 autonomous playbooks detect, diagnose, and repair anomalies without human intervention. The Arete recursive self-learning engine continuously optimizes the agent fleet, making the system smarter with every transaction.

This is infrastructure that runs itself — 24/7, quantum-resilient, and self-healing.`,
  },
  {
    id: 'how', icon: Cog, title: 'How It Works', accent: 'text-blue-400',
    content: `Jasper operates as a layered architecture:

1. URIB Pipeline (7 stages): Canonical → Semantic → ThreadZero → Stack → Taproot → Rails → Settlement. Each stage produces a cryptographic commitment hash, creating an immutable audit trail.

2. Aegis Self-Healing: The Monitor probes entity stores, crypto posture, integration health, and data integrity every 10 seconds. The Analyzer (LLM-powered) diagnoses anomalies and selects the right playbook. The Actuator executes real remediation — from service restarts to post-quantum key issuance.

3. Arete Recursive Engine: A 9-stage loop (Observe → Orient → Decide → Act → Evaluate → Learn → Optimize → Propose → Evolve) that continuously improves the 16-agent fleet. Each agent is backed by a real backend function — no simulations.

4. Quantum Resilience: ML-DSA-65 (FIPS 204) post-quantum signatures protect all critical surfaces. The system transitions through Hybrid → PQ-Only → PQ-Native modes, decommissioning classical ECDSA keys.

5. Swarm Orchestration: Agents collaborate via DIDs (Decentralized Identifiers) with W3C-compliant governance. Swarms form, deliberate, reach consensus, and execute multi-step tasks autonomously.

6. Tokenomics: A DSL-to-WASM policy engine enables declarative, simulatable, and auditable token economies with real-time compliance enforcement.`,
  },
  {
    id: 'setup', icon: ListChecks, title: 'Set Up Requirements', accent: 'text-emerald-400',
    content: `To run Jasper in production:

Browser: Chrome 90+, Firefox 88+, or Safari 14+ with JavaScript and WebAssembly enabled.

Network: Broadband internet (10 Mbps+). The system makes real-time API calls to backend functions, LLM providers, and blockchain rails.

Authentication: A registered Base44 account. Users join via invitation — admins invite with base44.users.inviteUser(email, role).

Backend Services: All 190+ backend functions must be deployed (they run on Deno Deploy via Base44). The Pre-Flight Checklist on the Go-Live page verifies each function is reachable.

LLM Integrations: The freeLLMRouter provides zero-key access to platform-managed LLMs. For additional providers (OpenAI, Anthropic, Google), configure API keys in the Integration Hub.

Quantum Keys: The quantumResilience function issues real ML-DSA-65 keypairs using @noble/post-quantum. No external HSM required for software-backed keys.

Storage: Entity data is stored in the Base44 managed database. File uploads (images, documents) use the UploadFile integration.

Webhooks: Configure the webhookReceiver endpoint to receive external events. No additional infrastructure needed.`,
  },
  {
    id: 'troubleshoot', icon: Wrench, title: 'Troubleshooting Steps & Tricks', accent: 'text-rose-400',
    content: `Common issues and solutions:

Blank Page / Loading Spinner: The app requires authentication. If stuck on the loading spinner, clear browser cookies and reload. The AuthProvider handles redirects automatically.

"Aegis Monitor returned 503": The freeLLMRouter may be temporarily unavailable. The Aegis heartbeat will automatically detect this as an integration_degraded anomaly and execute PB-017 (Integration Failover), rerouting to the Core.InvokeLLM fallback. No action needed.

Agent Fleet Returns Empty Results: Backend functions have specific input schemas. If an agent returns [], it means the input payload didn't match the function's expected format. Use the Arete Engine page to customize the event JSON for each agent's schema.

Quantum Compliance Score Below 50%: Active ECDSA (classical) keys lower the score. Run a Quantum Compliance Repair from the Aegis dashboard — this issues real ML-DSA-65 keypairs and decommissions classical keys.

Entity Store Timeout: If entity operations time out, the Aegis monitor will detect this as an entity_error anomaly and execute PB-016 (Entity Recovery). The actuator re-probes and retries the failing entity.

URIB Settlement Stalls: Cross-rail settlements may stall if a rail is unreachable. The settlementSentinel monitors for stalls and the Aegis actuator can execute PB-024 (URIB Settlement Retry) with exponential backoff.

Swarm Consensus Timeout: If a swarm can't reach consensus, PB-021 (Swarm Consensus Repair) resets the stalled swarm and reinitiates voting while preserving partial results.

Performance: The system polls every 5-10 seconds. If the UI feels slow, reduce the polling interval on dashboards or close unused tabs. The Aegis heartbeat is multi-tab coordinated.

Trick: Use the Pre-Flight Checklist (Go-Live page) before any critical operation. It verifies all 190+ backend functions, entity stores, and integration layers in under 30 seconds.

Trick: The Arete Engine's "Run Recursive Loop" button processes an event through all 9 stages with real agent execution. Check the Agent Fleet panel to see which agents were invoked and their actual return values.`,
  },
];

function Section({ section }) {
  const [expanded, setExpanded] = useState(section.id === 'why');
  const Icon = section.icon;
  return (
    <Card className="bg-slate-900/80 border-slate-800">
      <CardHeader className="pb-2">
        <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-2 w-full text-left">
          <Icon className={`h-4 w-4 ${section.accent}`} />
          <CardTitle className="text-sm text-slate-100">{section.title}</CardTitle>
          {expanded ? <ChevronUp className="h-4 w-4 ml-auto text-slate-500" /> : <ChevronDown className="h-4 w-4 ml-auto text-slate-500" />}
        </button>
      </CardHeader>
      {expanded && (
        <CardContent>
          <div className="text-xs text-slate-400 whitespace-pre-wrap leading-relaxed">{section.content}</div>
        </CardContent>
      )}
    </Card>
  );
}

export default function About() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <div className="p-4 lg:p-6 space-y-4 flex-1 max-w-4xl mx-auto w-full">
        <div className="text-center mb-4">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">About Jasper</h1>
          <p className="text-xs text-slate-400 mt-1">The deterministic multi-agent orchestration engine for cross-rail financial lifecycle management</p>
        </div>
        {SECTIONS.map(s => <Section key={s.id} section={s} />)}
      </div>
      <LegalFooter />
    </div>
  );
}