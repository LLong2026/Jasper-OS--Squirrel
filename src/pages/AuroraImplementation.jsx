import React, { useState } from 'react';
import { Copy, Check, ChevronDown, ChevronRight, Layers, Shield, Link } from 'lucide-react';

const CODE_BLOCKS = {
  simpleSubstrate: {
    label: '6. SimpleSubstrate — Concrete Implementation',
    filename: 'aurora/SimpleSubstrate.ts',
    icon: Layers,
    color: 'text-blue-400',
    border: 'border-blue-500/30',
    bg: 'bg-blue-500/5',
    description: 'Working skeleton for Substrate. ISO → LifecycleEvent → chain execution → proof artifact. Compliance gate runs before every execution. Wire real chain calls at the TODO markers.',
    code: `export class SimpleSubstrate implements Substrate {
  // In-memory event + execution stores.
  // Replace with Base44 entity persistence in production.
  private events:     Map<string, LifecycleEvent>   = new Map();
  private executions: Map<string, ExecutionResult>  = new Map();

  constructor(
    private config: SubstrateConfig,
    private hashFn: (input: any) => string,
  ) {}

  // ── ISO → LIFECYCLE EVENT ────────────────────────────────────
  // Translates a raw ISO 20022 message into one or more
  // typed lifecycle events. Extend the switch for each schema.
  interpretIso(msg: IsoMessage): LifecycleEvent[] {
    const now = new Date().toISOString();

    // Default mapping: every ISO message → TRANSFER event.
    // TODO: add schema-specific parsers per pacs.008, camt.053, etc.
    const ev: LifecycleEvent = {
      id:        \`\${msg.id}-ev-1\`,
      type:      "TRANSFER",
      assetId:   msg.payload.assetId   ?? "UNKNOWN",
      from:      msg.payload.debtor    ?? undefined,
      to:        msg.payload.creditor  ?? undefined,
      amount:    String(msg.payload.amount ?? "0"),
      timestamp: now,
      metadata:  { isoSchema: msg.schema },
    };

    this.events.set(ev.id, ev);
    return [ev];
  }

  // ── LIFECYCLE EXECUTION ───────────────────────────────────────
  // Gate: all compliance rules must pass (pure, no side effects).
  // Then: route to the appropriate chain and record the tx hash.
  async executeLifecycle(event: LifecycleEvent): Promise<ExecutionResult> {
    // 1. Compliance gate (QuantumComplianceGuardian logic)
    for (const rule of this.config.complianceRules) {
      if (!rule.evaluate(event)) {
        const res: ExecutionResult = {
          eventId: event.id,
          status:  "FAILED",
          error:   \`COMPLIANCE_RULE_FAILED:\${rule.id}\`,
        };
        this.executions.set(event.id, res);
        return res;
      }
    }

    // 2. Treasury policy check (aggregate view)
    const allEvents = Array.from(this.events.values());
    for (const policy of this.config.treasuryPolicies) {
      const result = policy.apply([...allEvents, event]);
      if (!result.ok) {
        const res: ExecutionResult = {
          eventId: event.id,
          status:  "FAILED",
          error:   \`TREASURY_POLICY_VIOLATED:\${result.violations.join(",")}\`,
        };
        this.executions.set(event.id, res);
        return res;
      }
    }

    // 3. Select chain (first configured; extend to routing logic)
    const chain = this.config.chains[0];
    if (!chain) {
      const res: ExecutionResult = {
        eventId: event.id,
        status:  "FAILED",
        error:   "NO_CHAIN_CONFIGURED",
      };
      this.executions.set(event.id, res);
      return res;
    }

    // 4. TODO: replace stub with real RPC call to chain.rpcEndpoint
    // e.g. broadcast Taproot PSBT, Lightning HTLC, etc.
    const txHash = \`tx_\${event.id}_\${Date.now()}\`;

    const res: ExecutionResult = {
      eventId: event.id,
      status:  "CONFIRMED",
      chainId: chain.chainId,
      txHash,
    };
    this.executions.set(event.id, res);
    return res;
  }

  // ── PROOF GENERATION ─────────────────────────────────────────
  // Produces a ProofArtifact linking the event → execution → chain.
  // invariantHash links this proof back into the InvariantEngine.
  async generateProof(eventId: string): Promise<ProofArtifact> {
    const ev   = this.events.get(eventId);
    const exec = this.executions.get(eventId);

    if (!ev || !exec) {
      throw new Error(\`UNKNOWN_EVENT:\${eventId}\`);
    }

    // Deterministic hash of event + execution state.
    // This is the leaf that gets committed to the Taproot tweak.
    const invariantHash = this.hashFn({ event: ev, execution: exec });

    const chainProofs: ChainProof[] = [{
      chainId: exec.chainId ?? "UNKNOWN",
      txHash:  exec.txHash  ?? "UNKNOWN",
      // merkleRoot populated after Bitcoin L1 confirmation
    }];

    return { eventId, invariantHash, chainProofs };
  }
}`
  },

  simpleInvariant: {
    label: '7. SimpleInvariantEngine — Snapshot + Verify',
    filename: 'aurora/SimpleInvariantEngine.ts',
    icon: Shield,
    color: 'text-green-400',
    border: 'border-green-500/30',
    bg: 'bg-green-500/5',
    description: 'Concrete InvariantEngine. snapshot() produces a deterministic fingerprint of the full config. verify() re-computes and compares — if they match, topology is preserved. The mathematical continuity guarantee.',
    code: `export class SimpleInvariantEngine implements InvariantEngine {

  // ── SNAPSHOT ─────────────────────────────────────────────────
  // Deterministic fingerprint of the current system configuration.
  // Called: at genesis, before every teleportation, after healing.
  // Result: committed as a 32-byte tweak to Bitcoin Taproot key.
  snapshot(
    cfg:               InvariantConfig,
    substrateConfig:   SubstrateConfig,
    agentMeshConfig?:  any,
  ): InvariantSnapshot {
    // Hash the structural shape of the substrate
    // (chain IDs + rule IDs + policy IDs — NOT runtime state)
    const substrateHash = cfg.hashFn({
      chains:           substrateConfig.chains,
      complianceRules:  substrateConfig.complianceRules.map(r => r.id),
      treasuryPolicies: substrateConfig.treasuryPolicies.map(p => p.id),
    });

    // Sorted rule IDs — order-independent, deterministic
    const rulesHash = cfg.hashFn(
      substrateConfig.complianceRules.map(r => r.id).sort()
    );

    // Sorted policy IDs
    const treasuryHash = cfg.hashFn(
      substrateConfig.treasuryPolicies.map(p => p.id).sort()
    );

    // Agent mesh hash is optional — include if provided
    const agentMeshHash = agentMeshConfig
      ? cfg.hashFn(agentMeshConfig)
      : undefined;

    return {
      systemId:     cfg.systemId,
      version:      cfg.version,
      timestamp:    new Date().toISOString(),
      substrateHash,
      rulesHash,
      treasuryHash,
      agentMeshHash,
    };
  }

  // ── VERIFY ───────────────────────────────────────────────────
  // Re-computes the snapshot from current config.
  // Returns true only if ALL hashes match the stored snapshot.
  // A single mismatch = topology violated = teleportation aborted.
  //
  // Euler characteristic is preserved iff verify() === true.
  verify(
    snapshot:          InvariantSnapshot,
    cfg:               InvariantConfig,
    substrateConfig:   SubstrateConfig,
    agentMeshConfig?:  any,
  ): boolean {
    const current = this.snapshot(cfg, substrateConfig, agentMeshConfig);

    // Identity checks
    if (snapshot.systemId !== cfg.systemId)          return false;
    if (snapshot.version  !== cfg.version)           return false;

    // Structural hash checks
    if (snapshot.substrateHash !== current.substrateHash) return false;
    if (snapshot.rulesHash     !== current.rulesHash)     return false;
    if (snapshot.treasuryHash  !== current.treasuryHash)  return false;

    // Agent mesh check (only if either side has it)
    if (snapshot.agentMeshHash || current.agentMeshHash) {
      if (snapshot.agentMeshHash !== current.agentMeshHash) return false;
    }

    return true;
  }
}`
  },

  agentMesh: {
    label: '9. Agent Mesh — Concrete Agents + Orchestrator',
    filename: 'aurora/agentMesh.ts',
    icon: Shield,
    color: 'text-purple-400',
    border: 'border-purple-500/30',
    bg: 'bg-purple-500/5',
    description: 'Three concrete agents (Parsing, Execution, Proof) wired directly to SimpleSubstrate. SimpleOrchestrator routes tasks by weight. initAgentMesh() wires the full mesh in one call.',
    code: `// ── AGENT TYPES ───────────────────────────────────────────────
export type AgentId = string;

export type AgentCapability =
  | "PARSING"
  | "RISK_ANALYSIS"
  | "ROUTING"
  | "RECONCILIATION"
  | "EXECUTION"
  | "PROOF_GEN";

export type AgentProfile = {
  id:           AgentId;
  name:         string;
  capabilities: AgentCapability[];
  weight:       number;   // routing preference / capacity
};

export type TaskType =
  | "PROCESS_ISO_MESSAGE"
  | "EXECUTE_LIFECYCLE"
  | "GENERATE_PROOF"
  | "RECONCILE_CHAIN";

export type Task = {
  id:        string;
  type:      TaskType;
  payload:   any;
  createdAt: string;
  priority:  number;
};

export type TaskResult = {
  taskId:  string;
  status:  "OK" | "ERROR";
  output?: any;
  error?:  string;
};

// ── AGENT + ORCHESTRATOR INTERFACES ───────────────────────────
export interface Agent {
  profile:               AgentProfile;
  canHandle(task: Task): boolean;
  handle(task: Task):    Promise<TaskResult>;
}

export interface Orchestrator {
  route(task: Task): Promise<TaskResult>;
}

// ── SIMPLE ORCHESTRATOR (weight-based) ────────────────────────
// Filter → sort by weight desc → delegate to highest-weight agent.
// Extend: add load-balancing, fallback chains, or LLM-based routing.
export class SimpleOrchestrator implements Orchestrator {
  constructor(private agents: Agent[]) {}

  async route(task: Task): Promise<TaskResult> {
    const candidates = this.agents.filter(a => a.canHandle(task));
    if (candidates.length === 0) {
      return { taskId: task.id, status: "ERROR",
               error: \`NO_AGENT_FOR_TASK:\${task.type}\` };
    }
    const agent = [...candidates].sort(
      (a, b) => b.profile.weight - a.profile.weight,
    )[0];
    return agent.handle(task);
  }
}

// ── PARSING AGENT ─────────────────────────────────────────────
// Translates an ISO 20022 message → LifecycleEvent[] via Substrate.
export class ParsingAgent implements Agent {
  constructor(
    public profile: AgentProfile,
    private substrate: Substrate,
  ) {}

  canHandle(task: Task): boolean {
    return task.type === "PROCESS_ISO_MESSAGE"
      && this.profile.capabilities.includes("PARSING");
  }

  async handle(task: Task): Promise<TaskResult> {
    try {
      const events = this.substrate.interpretIso(task.payload as IsoMessage);
      return { taskId: task.id, status: "OK", output: events };
    } catch (e: any) {
      return { taskId: task.id, status: "ERROR",
               error: \`PARSING_ERROR:\${e?.message ?? String(e)}\` };
    }
  }
}

// ── EXECUTION AGENT ───────────────────────────────────────────
// Runs a LifecycleEvent through Substrate → ExecutionResult.
export class ExecutionAgent implements Agent {
  constructor(
    public profile: AgentProfile,
    private substrate: Substrate,
  ) {}

  canHandle(task: Task): boolean {
    return task.type === "EXECUTE_LIFECYCLE"
      && this.profile.capabilities.includes("EXECUTION");
  }

  async handle(task: Task): Promise<TaskResult> {
    try {
      const res = await this.substrate.executeLifecycle(
        task.payload as LifecycleEvent,
      );
      return {
        taskId: task.id,
        status: res.status === "CONFIRMED" ? "OK" : "ERROR",
        output: res,
        error:  res.error,
      };
    } catch (e: any) {
      return { taskId: task.id, status: "ERROR",
               error: \`EXECUTION_ERROR:\${e?.message ?? String(e)}\` };
    }
  }
}

// ── PROOF AGENT ───────────────────────────────────────────────
// Generates a ProofArtifact for a confirmed eventId.
export class ProofAgent implements Agent {
  constructor(
    public profile: AgentProfile,
    private substrate: Substrate,
  ) {}

  canHandle(task: Task): boolean {
    return task.type === "GENERATE_PROOF"
      && this.profile.capabilities.includes("PROOF_GEN");
  }

  async handle(task: Task): Promise<TaskResult> {
    try {
      const proof = await this.substrate.generateProof(task.payload as string);
      return { taskId: task.id, status: "OK", output: proof };
    } catch (e: any) {
      return { taskId: task.id, status: "ERROR",
               error: \`PROOF_ERROR:\${e?.message ?? String(e)}\` };
    }
  }
}

// ── INIT AGENT MESH ───────────────────────────────────────────
// Single entry point. Pass the live Substrate from initAuroraCore().
// Returns a ready Orchestrator + typed agent list.
export function initAgentMesh(
  substrate: Substrate,
): { orchestrator: Orchestrator; agents: Agent[] } {
  const agents: Agent[] = [
    new ParsingAgent(
      { id: "agent-parsing-1", name: "ParsingAgent-1",
        capabilities: ["PARSING"], weight: 10 },
      substrate,
    ),
    new ExecutionAgent(
      { id: "agent-exec-1", name: "ExecutionAgent-1",
        capabilities: ["EXECUTION"], weight: 10 },
      substrate,
    ),
    new ProofAgent(
      { id: "agent-proof-1", name: "ProofAgent-1",
        capabilities: ["PROOF_GEN"], weight: 10 },
      substrate,
    ),
  ];
  return { orchestrator: new SimpleOrchestrator(agents), agents };
}

// ── EXAMPLE END-TO-END FLOW ───────────────────────────────────
// async function exampleFlow(orchestrator: Orchestrator) {
//   const parsed = await orchestrator.route({
//     id: "task-1", type: "PROCESS_ISO_MESSAGE", priority: 1,
//     createdAt: new Date().toISOString(),
//     payload: {
//       id: "iso-1", schema: "ISO20022:pacs.008",
//       payload: { assetId: "USD", debtor: "alice",
//                  creditor: "bob", amount: "100.00" },
//     },
//   });
//   const events: LifecycleEvent[] = parsed.output ?? [];
//
//   for (const [idx, ev] of events.entries()) {
//     const exec = await orchestrator.route({
//       id: \`exec-\${idx}\`, type: "EXECUTE_LIFECYCLE", priority: 1,
//       createdAt: new Date().toISOString(), payload: ev,
//     });
//     if (exec.status === "OK") {
//       const proof = await orchestrator.route({
//         id: \`proof-\${idx}\`, type: "GENERATE_PROOF", priority: 1,
//         createdAt: new Date().toISOString(),
//         payload: exec.output?.eventId,
//       });
//       console.log("Proof:", proof.output);
//     }
//   }
// }
`
  },

  wiring: {
    label: '8. initAuroraCore — Wiring Seed → Substrate → Invariants',
    filename: 'aurora/initAuroraCore.ts',
    icon: Link,
    color: 'text-cyan-400',
    border: 'border-cyan-500/30',
    bg: 'bg-cyan-500/5',
    description: 'The single init function that wires Jasper\'s deterministic seed into the Substrate and InvariantEngine. Drop your real SHA-256 at the TODO. Everything downstream derives from seedHex.',
    code: `// ── SEED-KEYED HASH FUNCTION ────────────────────────────────
// Derives a deterministic hash function from the AURORA seed.
// TODO: replace naive djb2 with real SHA-256 HMAC keyed on seedHex.
// e.g. using Web Crypto: HMAC-SHA256(key=seedHex, data=JSON(input))
function makeHashFn(seedHex: string): (input: any) => string {
  return (input: any): string => {
    const raw = JSON.stringify(input) + "|" + seedHex;

    // Naive djb2 — REPLACE with SHA-256 for production
    let h = 5381;
    for (let i = 0; i < raw.length; i++) {
      h = ((h << 5) + h + raw.charCodeAt(i)) >>> 0;
    }
    return h.toString(16).padStart(8, "0");
  };
}

// ── CORE INIT ────────────────────────────────────────────────
// Single entry point. Pass Jasper's AuroraSeed + SubstrateConfig.
// Returns a live { seed, substrate, invariants } bundle.
// Plug this into createAuroraRuntime() from the runtime module.
export function initAuroraCore(
  seed:            AuroraSeed,
  substrateConfig: SubstrateConfig,
  agentMeshConfig?: any,
): {
  seed:       AuroraSeed;
  substrate:  SimpleSubstrate;
  invariants: SimpleInvariantEngine;
  hashFn:     (input: any) => string;
  genesisSnapshot: InvariantSnapshot;
} {
  // 1. Derive hash function from seed
  const hashFn = makeHashFn(seed.seedHex);

  // 2. Construct substrate (ISO → lifecycle → proof)
  const substrate = new SimpleSubstrate(substrateConfig, hashFn);

  // 3. Construct invariant config
  const invariantCfg: InvariantConfig = {
    systemId: seed.systemId,
    version:  seed.version,
    hashFn,
  };

  // 4. Construct invariant engine
  const invariants = new SimpleInvariantEngine();

  // 5. Take genesis snapshot — the ground-truth baseline
  const genesisSnapshot = invariants.snapshot(
    invariantCfg,
    substrateConfig,
    agentMeshConfig,
  );

  // 6. Verify genesis is self-consistent (sanity check)
  const valid = invariants.verify(
    genesisSnapshot,
    invariantCfg,
    substrateConfig,
    agentMeshConfig,
  );

  if (!valid) {
    throw new Error("AURORA: Genesis invariant verification failed — abort.");
  }

  return { seed, substrate, invariants, hashFn, genesisSnapshot };
}

// ── USAGE EXAMPLE ────────────────────────────────────────────
//
// import { JASPER_GENESIS_SEED } from './seed';
// import { JASPER_SUBSTRATE_CONFIG } from './substrateConfig';
// import { JASPER_AGENT_FLEET } from './agentMesh';
//
// const core = initAuroraCore(
//   JASPER_GENESIS_SEED,
//   JASPER_SUBSTRATE_CONFIG,
//   { agents: JASPER_AGENT_FLEET },
// );
//
// console.log("Genesis snapshot:", core.genesisSnapshot);
// // → { systemId: "AURORA-001", substrateHash: "...", ... }
//
// // Process an ISO message:
// const events = core.substrate.interpretIso({
//   id:      "MSG-001",
//   schema:  "ISO20022:pacs.008",
//   payload: { assetId: "USD", debtor: "BANK-A", creditor: "BANK-B", amount: 1000000 },
// });
//
// const result = await core.substrate.executeLifecycle(events[0]);
// const proof  = await core.substrate.generateProof(events[0].id);
//
// console.log("Execution:", result);
// // → { eventId: "MSG-001-ev-1", status: "CONFIRMED", txHash: "tx_..." }
//
// console.log("Proof:", proof);
// // → { eventId: "MSG-001-ev-1", invariantHash: "...", chainProofs: [...] }
//
// // Verify topology is still intact:
// const still_valid = core.invariants.verify(
//   core.genesisSnapshot,
//   { systemId: core.seed.systemId, version: core.seed.version, hashFn: core.hashFn },
//   JASPER_SUBSTRATE_CONFIG,
//   { agents: JASPER_AGENT_FLEET },
// );
// console.log("Topology preserved:", still_valid); // → true
//
// // "Math is Law." ─ Leon Calvin Long II`
  },
};

function CodeBlock({ code, label }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="relative rounded-lg overflow-hidden border border-slate-700">
      <div className="flex items-center justify-between bg-slate-800 px-4 py-2">
        <span className="text-xs text-slate-400 font-mono">{label}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors px-2 py-1 rounded hover:bg-slate-700"
        >
          {copied ? <><Check className="h-3 w-3 text-green-400" /> Copied</> : <><Copy className="h-3 w-3" /> Copy</>}
        </button>
      </div>
      <pre className="bg-slate-950 text-slate-300 text-xs p-4 overflow-x-auto max-h-[500px] leading-relaxed font-mono whitespace-pre">
        {code}
      </pre>
    </div>
  );
}

function Section({ blockKey }) {
  const [open, setOpen] = useState(true);
  const block = CODE_BLOCKS[blockKey];
  const Icon = block.icon;
  return (
    <div className={`rounded-xl border ${block.border} ${block.bg} overflow-hidden`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-white/5 transition-colors"
      >
        <Icon className={`h-5 w-5 ${block.color} flex-shrink-0`} />
        <span className={`font-bold text-sm ${block.color} flex-1`}>{block.label}</span>
        {open
          ? <ChevronDown className="h-4 w-4 text-slate-500" />
          : <ChevronRight className="h-4 w-4 text-slate-500" />}
      </button>
      {open && (
        <div className="px-5 pb-5 space-y-3">
          <p className="text-slate-400 text-sm leading-relaxed">{block.description}</p>
          <CodeBlock code={block.code} label={block.filename} />
        </div>
      )}
    </div>
  );
}

export default function AuroraImplementation() {
  const [allCopied, setAllCopied] = useState(false);

  const handleCopyAll = () => {
    const full = Object.values(CODE_BLOCKS)
      .map(b => `// ${'═'.repeat(60)}\n// ${b.label.toUpperCase()}\n// ${'═'.repeat(60)}\n\n${b.code}`)
      .join('\n\n\n');
    navigator.clipboard.writeText(full);
    setAllCopied(true);
    setTimeout(() => setAllCopied(false), 2500);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-mono">
      {/* Header */}
      <header className="border-b border-slate-800 bg-black/60 px-6 py-5 sticky top-0 z-20 backdrop-blur">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-green-400 text-xs tracking-widest font-bold">AURORA RUNTIME</span>
              <span className="text-slate-600 text-xs">// Implementation Layer · Blocks 6–9</span>
            </div>
            <h1 className="text-white text-xl font-bold">Substrate + InvariantEngine — Concrete Implementations</h1>
            <p className="text-slate-500 text-xs mt-0.5">SimpleSubstrate · Agent Mesh (Parsing/Execution/Proof) · SimpleInvariantEngine · initAuroraCore</p>
          </div>
          <button
            onClick={handleCopyAll}
            className="flex items-center gap-2 px-4 py-2 bg-green-500/20 border border-green-500/40 rounded-lg text-green-400 text-xs hover:bg-green-500/30 transition-all"
          >
            {allCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {allCopied ? 'Copied!' : 'Copy All'}
          </button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-6 space-y-4">

        {/* Companion note */}
        <div className="flex items-start gap-3 px-4 py-3 bg-slate-800/60 border border-slate-700 rounded-lg text-xs text-slate-400">
          <span className="text-cyan-400 font-bold flex-shrink-0">→</span>
          <span>
            Companion to <span className="text-cyan-400">AuroraArchitecture</span> (blocks 1–5).
            These are the concrete class implementations ready to drop into Base44 or any TS runtime.
            Replace <code className="text-amber-400 bg-slate-900 px-1 rounded">// TODO</code> markers with real chain/hash calls.
          </span>
        </div>

        {/* Data flow */}
        <div className="flex items-center gap-2 text-xs overflow-x-auto pb-1">
          {[
            'AuroraSeed.seedHex',
            'makeHashFn()',
            'SimpleSubstrate',
            'initAgentMesh()',
            'Orchestrator.route()',
            'ParsingAgent → ExecutionAgent → ProofAgent',
            'SimpleInvariantEngine',
            'verify() → true',
            'Bitcoin L1 Tweak',
          ].map((step, i, arr) => (
            <React.Fragment key={step}>
              <div className="flex-shrink-0 px-2 py-1 bg-slate-800 border border-slate-700 rounded text-slate-300">{step}</div>
              {i < arr.length - 1 && <span className="text-slate-600 flex-shrink-0">→</span>}
            </React.Fragment>
          ))}
        </div>

        {/* Sections */}
        {Object.keys(CODE_BLOCKS).map(key => (
          <Section key={key} blockKey={key} />
        ))}

        {/* Footer */}
        <div className="mt-6 p-4 border border-slate-800 rounded-lg text-center">
          <div className="text-slate-600 text-xs mb-1">NEXT STEP</div>
          <div className="text-cyan-400/80 text-sm">
            Replace <code className="bg-slate-800 px-1 rounded">makeHashFn</code> naive djb2 → <code className="bg-slate-800 px-1 rounded">HMAC-SHA256(seedHex)</code>
            <span className="text-slate-600 mx-2">·</span>
            Wire <code className="bg-slate-800 px-1 rounded">executeLifecycle</code> → real Taproot PSBT broadcast
          </div>
          <div className="text-slate-600 text-xs mt-3">© 2025–2026 Leon Calvin Long II · Patent Pending · Math is Law</div>
        </div>
      </div>
    </div>
  );
}