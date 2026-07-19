import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Bot, Handshake, Beaker, Brain, Network, Dna, GitBranch, Plug, Sparkles, Shield, Menu, X, Zap, Layers, Atom, Gauge, Orbit, Radio, Workflow, Coins, Heart, Cpu, Rocket, Info } from 'lucide-react';
import CollapsibleSection from '@/components/ui/CollapsibleSection';
import LegalFooter from '@/components/legal/LegalFooter';

export default function Layout({ children, currentPageName }) {
    const [isOpen, setIsOpen] = useState(false);

    const navGroups = [
        {
            title: 'Core', icon: Bot, accent: 'text-blue-400', defaultOpen: true,
            items: [
                { name: 'Chat', href: createPageUrl('Chat'), icon: Bot },
                { name: 'AgentCreator', href: createPageUrl('AgentCreator'), icon: Sparkles },
                { name: 'IntegrationHub', href: createPageUrl('IntegrationHub'), icon: Plug },
            ]
        },
        {
            title: 'Intelligence', icon: Brain, accent: 'text-emerald-400', defaultOpen: true,
            items: [
                { name: 'HiveMindDashboard', href: createPageUrl('HiveMindDashboard'), icon: Brain },
                { name: 'EvolutionDashboard', href: createPageUrl('EvolutionDashboard'), icon: GitBranch },
                { name: 'AreteMonitor', href: createPageUrl('AreteMonitor'), icon: Dna },
                { name: 'AreteEngine', href: createPageUrl('AreteEngine'), icon: Cpu },
                { name: 'AINodeDashboard', href: createPageUrl('AINodeDashboard'), icon: Network },
            ]
        },
        {
            title: 'Network', icon: Handshake, accent: 'text-amber-400', defaultOpen: false,
            items: [
                { name: 'Partnerships', href: createPageUrl('Partnerships'), icon: Handshake },
                { name: 'ResearchWorkbench', href: createPageUrl('ResearchWorkbench'), icon: Beaker },
            ]
        },
        {
            title: 'Sovereign Ledger', icon: Shield, accent: 'text-rose-400', defaultOpen: false,
            items: [
                { name: 'StabilityDashboard', href: createPageUrl('StabilityDashboard'), icon: Shield },
                { name: 'GovernanceDashboard', href: createPageUrl('GovernanceDashboard'), icon: Shield },
                { name: 'TexasSovereignLedger', href: createPageUrl('TexasSovereignLedger'), icon: Shield },
                { name: 'StableCoinMint', href: createPageUrl('StableCoinMint'), icon: Sparkles },
            ]
        },
        {
            title: 'Aegis', icon: Heart, accent: 'text-rose-400', defaultOpen: false,
            items: [
                { name: 'AegisSelfHealing', href: createPageUrl('AegisSelfHealing'), icon: Shield },
            ]
        },
        {
            title: 'Platform', icon: Layers, accent: 'text-violet-400', defaultOpen: false,
            items: [
                { name: 'GoLive', href: createPageUrl('GoLive'), icon: Rocket },
                { name: 'About', href: createPageUrl('About'), icon: Info },
                { name: 'GitHubExport', href: createPageUrl('GitHubExport'), icon: GitBranch },
                { name: 'CinematicDashboard', href: createPageUrl('CinematicDashboard'), icon: Sparkles },
                { name: 'AuroraArchitecture', href: createPageUrl('AuroraArchitecture'), icon: Zap },
                { name: 'AuroraImplementation', href: createPageUrl('AuroraImplementation'), icon: Layers },
                { name: 'OmegaManifold', href: createPageUrl('OmegaManifold'), icon: Atom },
                { name: 'CapabilitiesDashboard', href: createPageUrl('CapabilitiesDashboard'), icon: Gauge },
                { name: 'AuditHolonomy', href: createPageUrl('AuditHolonomyDashboard'), icon: Orbit },
                { name: 'BridgeVisualizer', href: createPageUrl('BridgeVisualizer'), icon: Radio },
                { name: 'SwarmConsole', href: createPageUrl('SwarmConsole'), icon: Workflow },
                { name: 'QuantumReadiness', href: createPageUrl('QuantumReadinessPanel'), icon: Shield },
                { name: 'TokenStudio', href: createPageUrl('TokenStudio'), icon: Coins },
            ]
        },
    ];

    return (
        <div className="flex h-screen bg-slate-900 text-slate-100 font-sans">
            <nav className="w-16 bg-slate-950/50 border-r border-slate-800 flex flex-col items-center py-4 gap-4">
                <Link 
                    to={createPageUrl('Chat')}
                    className={`rounded-full overflow-hidden ring-2 ${currentPageName === 'Chat' ? 'ring-blue-500/70 shadow-[0_0_15px_3px_rgba(59,130,246,0.7)]' : 'ring-blue-500/50 shadow-[0_0_10px_2px_rgba(59,130,246,0.6)]'} hover:ring-blue-500 transition-all`}
                    title="Jasper AI"
                >
                    <img 
                        src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/693d9a99ca82e178be7bca1b/e908cc8ba_arthur-artwork-1765675024047.png"
                        alt="Jasper AI"
                        className="h-10 w-10 object-cover"
                    />
                </Link>

                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="p-3 rounded-lg hover:bg-blue-500/20 hover:text-blue-400 transition-colors text-slate-400"
                    title="Menu"
                >
                    {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
                </button>
            </nav>

            {isOpen && (
                <>
                    <div 
                        className="fixed inset-0 bg-black/50 z-40"
                        onClick={() => setIsOpen(false)}
                    />
                    <div className="fixed left-16 top-0 h-full w-64 bg-slate-900 border-r border-slate-800 z-50 py-2 px-1 overflow-y-auto">
                        {navGroups.map(group => (
                            <CollapsibleSection
                                key={group.title}
                                title={group.title}
                                icon={group.icon}
                                accent={group.accent}
                                defaultOpen={group.defaultOpen}
                            >
                                <div className="space-y-0.5">
                                    {group.items.map(item => (
                                        <Link
                                            key={item.name}
                                            to={item.href}
                                            onClick={() => setIsOpen(false)}
                                            className={`flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-blue-500/20 hover:text-blue-400 transition-colors text-sm ${currentPageName === item.name ? 'bg-blue-500/20 text-blue-400' : 'text-slate-300'}`}
                                        >
                                            <item.icon className="h-4 w-4 shrink-0" />
                                            <span className="font-medium truncate">{item.name}</span>
                                        </Link>
                                    ))}
                                </div>
                            </CollapsibleSection>
                        ))}
                    </div>
                </>
            )}

            <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto">
                    {children}
                </div>
                <LegalFooter />
            </div>
        </div>
    );
}