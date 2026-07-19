import React from 'react';
import { BookOpen, FileText, Code2, Shield, User } from 'lucide-react';
import LegalFooter from '@/components/legal/LegalFooter';

const LICENSES = [
    {
        id: 'cc',
        icon: FileText,
        title: 'Creative Commons BY-NC-ND 4.0',
        subtitle: 'Content License',
        accent: 'text-amber-400',
        url: 'https://creativecommons.org/licenses/by-nc-nd/4.0/',
        body: `All creative content — including documentation, designs, UI assets, written materials, and non-code works — is licensed under Creative Commons Attribution-NonCommercial-NoDerivatives 4.0 International (CC BY-NC-ND 4.0).

You are free to:
• Share — copy and redistribute the material in any medium or format.
Under the following terms:
• Attribution — You must give appropriate credit to Leon Calvin Long II, provide a link to the license, and indicate if changes were made. You must do so in any reasonable manner, but not in any way that suggests the licensor endorses you or your use.
• NonCommercial — You may not use the material for commercial purposes without explicit written permission.
• NoDerivatives — You may not adapt, transform, or build upon the material. If you remix, transform, or build upon the material, you may not distribute the modified material.

Full license text: https://creativecommons.org/licenses/by-nc-nd/4.0/legalcode`,
    },
    {
        id: 'apache',
        icon: Code2,
        title: 'Apache License 2.0',
        subtitle: 'Code License',
        accent: 'text-emerald-400',
        url: 'https://www.apache.org/licenses/LICENSE-2.0',
        body: `All source code in this repository is licensed under the Apache License, Version 2.0.

You are free to:
• Use — commercially and non-commercially.
• Modify — adapt and build upon the code.
• Distribute — redistribute the code, modified or unmodified.
• Sublicense — grant a sublicense under a compatible license.

Under the following conditions:
• You must retain the copyright notice ("Copyright © 2026 Leon Calvin Long II").
• You must include a copy of the Apache 2.0 license in all distributions.
• You must state any significant changes made to the original files.
• You must not use the names "Jasper," "Aegis," "Arete," or associated trademarks to endorse or promote products derived from this software without prior written permission from Leon Calvin Long II.

Full license text: https://www.apache.org/licenses/LICENSE-2.0`,
    },
];

const OVERVIEW_SECTIONS = [
    {
        title: 'What Is Jasper?',
        body: `Jasper is a deterministic multi-agent orchestration engine for cross-rail financial lifecycle management. It unifies fragmented financial rails — ISO 20022, Bitcoin, XRP, CBDC — through the URIB (Universal Rail Integration Bridge) pipeline, with cryptographic proofing at every stage.

The platform features three core subsystems:
• URIB — 7-stage cross-rail settlement pipeline (Canonical → Semantic → ThreadZero → Stack → Taproot → Rails → Settlement).
• Aegis — Autonomous self-healing infrastructure with 28 playbooks that detect, diagnose, and repair anomalies without human intervention.
• Arete — Recursive self-learning engine with a 9-stage optimization loop (Observe → Orient → Decide → Act → Evaluate → Learn → Optimize → Propose → Evolve).`,
    },
    {
        title: 'Owner & Author',
        body: `This software is owned and authored by Leon Calvin Long II. All copyright, trademark, and licensing rights are held by Leon Calvin Long II. Third-party contributions are accepted under the terms of the Apache 2.0 license and must include appropriate attribution.`,
    },
    {
        title: 'Dual Licensing Model',
        body: `Jasper uses a dual licensing strategy to protect both creative content and source code:

• Creative content (documentation, designs, UI assets) is covered under CC BY-NC-ND 4.0 — this means no commercial use, no derivatives, and attribution required. This protects the brand, design language, and documentation from unauthorized commercial exploitation.

• Source code is covered under Apache 2.0 — this permits commercial and non-commercial use, modification, and distribution of code, subject to the conditions above. This allows developers to build upon the code while preserving attribution.

This model ensures the project's creative identity and brand assets remain protected, while the code itself remains open and usable under standard open-source terms.`,
    },
    {
        title: 'Third-Party Acknowledgments',
        body: `Jasper is built on and/or integrates with the following third-party technologies:
• React (MIT License) — UI framework
• Tailwind CSS (MIT License) — styling
• Base44 Platform (Proprietary) — backend-as-a-service, hosting, and deployment
• @noble/post-quantum (MIT License) — FIPS 204 / FIPS 203 cryptographic implementations
• lucide-react (ISC License) — icon set
• Recharts (MIT License) — charting library
• Framer Motion (MIT License) — animations
• Three.js (MIT License) — 3D rendering

All third-party trademarks, service marks, and trade names are the property of their respective owners. Their inclusion does not imply endorsement.`,
    },
];

export default function Readme() {
    return (
        <div className="bg-slate-950 text-slate-100 min-h-full">
            <div className="p-4 lg:p-6 space-y-6 max-w-4xl mx-auto w-full">
                <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
                    <BookOpen className="h-7 w-7 text-blue-400" />
                    <div>
                        <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">README</h1>
                        <p className="text-xs text-slate-400 mt-0.5">Project overview, licensing, and attribution</p>
                    </div>
                </div>

                <div className="flex items-center gap-3 bg-slate-900/80 border border-slate-800 rounded-xl p-4">
                    <div className="h-12 w-12 rounded-full bg-gradient-to-br from-blue-500/20 to-violet-500/20 border border-slate-700 flex items-center justify-center shrink-0">
                        <User className="h-6 w-6 text-blue-400" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-slate-200">Owner & Author</p>
                        <p className="text-lg font-bold text-slate-100">Leon Calvin Long II</p>
                        <p className="text-xs text-slate-500">Copyright © 2026 — All rights reserved</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {LICENSES.map(lic => (
                        <div key={lic.id} className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-3">
                            <div className="flex items-center gap-2">
                                <lic.icon className={`h-5 w-5 ${lic.accent}`} />
                                <div>
                                    <p className="text-xs text-slate-500">{lic.subtitle}</p>
                                    <p className="text-sm font-semibold text-slate-100">{lic.title}</p>
                                </div>
                            </div>
                            <div className="text-xs text-slate-400 whitespace-pre-wrap leading-relaxed">{lic.body}</div>
                            <a
                                href={lic.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
                            >
                                <Shield className="h-3 w-3" />
                                View full license
                            </a>
                        </div>
                    ))}
                </div>

                <div className="space-y-4">
                    {OVERVIEW_SECTIONS.map((sec, idx) => (
                        <div key={idx} className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-2">
                            <h2 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                                <span className="text-blue-400">{String(idx + 1).padStart(2, '0')}</span>
                                {sec.title}
                            </h2>
                            <div className="text-xs text-slate-400 whitespace-pre-wrap leading-relaxed">{sec.body}</div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}