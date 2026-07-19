// Audit Holonomy — pure topological helpers (operator §10 + drift §9)
// Hol(γ) = identity means a loop is consistent; any deviation is a violation.

// Complement pairs: each operator must be paired with its complement for the
// active loop to compose to identity (closed / balanced holonomy).
export const COMPLEMENT_MAP = {
  boundary: 'cohomology',
  cohomology: 'boundary',
  gauge: 'teleport',
  teleport: 'gauge',
  wavepacket: 'hamiltonian',
  hamiltonian: 'wavepacket',
  sheaf: 'functor',
  functor: 'sheaf',
  topology: 'drift',
  drift: 'topology',
  holonomy: 'holonomy',
};

export const OPERATOR_META = {
  boundary: { glyph: '∂', label: 'Boundary' },
  cohomology: { glyph: 'Hⁿ', label: 'Cohomology' },
  sheaf: { glyph: 'F', label: 'Sheaf' },
  gauge: { glyph: '∇', label: 'Gauge' },
  wavepacket: { glyph: 'Ψ', label: 'Wave Packet' },
  topology: { glyph: 'Hₙ', label: 'Homology' },
  teleport: { glyph: '𝒯', label: 'Teleport' },
  hamiltonian: { glyph: 'Ĥᶜ', label: 'Hamiltonian' },
  drift: { glyph: 'Δ', label: 'Drift' },
  holonomy: { glyph: 'Hol', label: 'Holonomy' },
  functor: { glyph: 'F', label: 'Functor' },
};

export const ALL_OPERATORS = Object.keys(OPERATOR_META);

export async function sha256Hex(text) {
  if (typeof crypto === 'undefined' || !crypto.subtle) return text;
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Bit-level Hamming distance between two hex hashes, normalized to 0-1
export function bitHamming(a, b) {
  if (!a || !b) return 0;
  const len = Math.min(a.length, b.length);
  if (len === 0) return 0;
  let diff = 0;
  for (let i = 0; i < len; i++) {
    const xa = parseInt(a[i], 16);
    const xb = parseInt(b[i], 16);
    if (Number.isNaN(xa) || Number.isNaN(xb)) continue;
    let x = xa ^ xb;
    while (x) { diff += x & 1; x >>= 1; }
  }
  return diff / (len * 4);
}

// Jaccard distance between two operator sets, 0-1 (0 = identical topology)
export function jaccardDistance(a, b) {
  const sa = new Set(a);
  const sb = new Set(b);
  if (sa.size === 0 && sb.size === 0) return 0;
  let inter = 0;
  sa.forEach((x) => { if (sb.has(x)) inter += 1; });
  const union = sa.size + sb.size - inter;
  return union === 0 ? 0 : 1 - inter / union;
}

export function unpairedOperators(active) {
  const set = new Set(active);
  const violations = [];
  set.forEach((op) => {
    const comp = COMPLEMENT_MAP[op];
    if (!comp || !set.has(comp)) violations.push(op);
  });
  return [...new Set(violations)];
}

export function isBalancedLoop(active) {
  return unpairedOperators(active).length === 0;
}

export function classifyDrift(drift, threshold) {
  if (drift === 0) return 'continuous';
  if (drift <= threshold) return 'drifted';
  return 'broken';
}