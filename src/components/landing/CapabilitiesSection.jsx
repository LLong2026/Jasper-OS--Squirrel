import React, { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { Network, Heart, Brain, Shield, Bot, Atom } from 'lucide-react';

const CAPABILITIES = [
  {
    icon: Network,
    title: 'URIB Cross-Rail Settlement',
    desc: '7-stage deterministic pipeline — canonical tokenization to ISO 20022 pacs.008 emission across BTC, XRP, ISO, and CBDC rails.',
    accent: 'from-blue-500 to-cyan-400',
  },
  {
    icon: Heart,
    title: 'Aegis Self-Healing',
    desc: '30 playbooks of autonomous monitor-analyzer-actuator loops. The infrastructure heals itself before you notice it broke.',
    accent: 'from-rose-500 to-orange-400',
  },
  {
    icon: Brain,
    title: 'Arete Recursive Learning',
    desc: 'A 9-stage recursive self-improvement loop that treats system health as a learnable optimization signal.',
    accent: 'from-emerald-500 to-teal-400',
  },
  {
    icon: Shield,
    title: 'Post-Quantum Cryptography',
    desc: 'FIPS-204 ML-DSA-65 hybrid signatures. Quantum-resistant key lifecycle from issuance to revocation.',
    accent: 'from-violet-500 to-purple-400',
  },
  {
    icon: Bot,
    title: '17-Agent Fleet',
    desc: 'A hierarchical AI collective — Jasper, Arete, CodeForge, QuantumComplianceGuardian — orchestrated as fiber bundles on a manifold.',
    accent: 'from-amber-500 to-yellow-400',
  },
  {
    icon: Atom,
    title: 'Topological Manifold OS',
    desc: 'The Unified Field Equation governs all state. Topological teleportation preserves invariants across substrate migrations.',
    accent: 'from-sky-500 to-indigo-400',
  },
];

export default function CapabilitiesSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-50px' });

  return (
    <section ref={ref} className="relative py-32 px-6 bg-gradient-to-b from-black via-slate-950 to-black">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-6xl font-bold text-white">One Manifold. Infinite Capability.</h2>
          <p className="mt-4 text-slate-400 text-lg max-w-2xl mx-auto">Every subsystem is a fiber bundle woven into the same mathematical fabric.</p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {CAPABILITIES.map((cap, i) => (
            <motion.div
              key={cap.title}
              initial={{ opacity: 0, y: 40 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: i * 0.1 }}
              whileHover={{ y: -6 }}
              className="group relative p-6 rounded-2xl bg-slate-900/50 border border-slate-800 backdrop-blur-sm overflow-hidden"
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${cap.accent} opacity-0 group-hover:opacity-10 transition-opacity`} />
              <div className={`relative inline-flex p-3 rounded-xl bg-gradient-to-br ${cap.accent} mb-4`}>
                <cap.icon className="h-6 w-6 text-white" />
              </div>
              <h3 className="relative text-lg font-semibold text-white mb-2">{cap.title}</h3>
              <p className="relative text-sm text-slate-400 leading-relaxed">{cap.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}