import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Check, AlertCircle, Zap, Link2, Unlink, ShieldCheck, Server } from 'lucide-react';

// OAuth-capable integrations. connectorId is populated once the workspace
// connector is registered (builder enters OAuth app credentials in chat).
export const OAUTH_CONNECTORS = {
    gmail: { integration_type: 'gmail', connectorId: null },
    slack: { integration_type: 'slack', connectorId: null },
    notion: { integration_type: 'notion', connectorId: null },
    github: { integration_type: 'github', connectorId: null },
    'google-calendar': { integration_type: 'googlecalendar', connectorId: null },
    salesforce: { integration_type: 'salesforce', connectorId: null },
};

export default function ConfigureModal({ integration, testStatus, onTest, onClose }) {
    const [connecting, setConnecting] = useState(false);
    const [error, setError] = useState(null);
    const meta = integration ? OAUTH_CONNECTORS[integration.id] : null;
    const isOAuth = !!meta;

    const handleConnect = async () => {
        if (!meta?.connectorId) return;
        setConnecting(true);
        setError(null);
        try {
            const url = await base44.connectors.connectAppUser(meta.connectorId);
            const popup = window.open(url, '_blank');
            const timer = setInterval(() => {
                if (!popup || popup.closed) {
                    clearInterval(timer);
                    setConnecting(false);
                }
            }, 600);
        } catch (e) {
            setError(e?.message || 'Unable to start OAuth flow.');
            setConnecting(false);
        }
    };

    const handleDisconnect = async () => {
        if (!meta?.connectorId) return;
        try {
            await base44.connectors.disconnectAppUser(meta.connectorId);
        } catch (e) {
            setError(e?.message || 'Disconnect failed.');
        }
    };

    const Icon = integration?.icon;

    return (
        <Dialog open={!!integration} onOpenChange={(o) => !o && onClose()}>
            <DialogContent className="bg-slate-800 border-slate-700 text-slate-100">
                <DialogHeader>
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-slate-700 flex items-center justify-center">
                            {Icon && <Icon className="h-5 w-5 text-blue-400" />}
                        </div>
                        <div>
                            <DialogTitle className="text-white">{integration?.name}</DialogTitle>
                            <DialogDescription className="text-slate-400">{integration?.category}</DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="space-y-4 mt-2">
                    <div className="text-sm text-slate-300 flex items-center gap-2">
                        <Server className="h-4 w-4 text-slate-500" />
                        <span className="text-slate-500">Backend function:</span>
                        <code className="px-1.5 py-0.5 rounded bg-slate-900 text-cyan-300 text-xs">
                            {integration?.function}
                        </code>
                    </div>

                    {isOAuth ? (
                        <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-4 space-y-3">
                            <div className="flex items-start gap-2 text-sm">
                                <ShieldCheck className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
                                <span className="text-slate-300">
                                    Each user connects their own account via OAuth. Credentials are scoped to the connected user.
                                </span>
                            </div>
                            {meta.connectorId ? (
                                <div className="flex gap-2">
                                    <Button
                                        onClick={handleConnect}
                                        disabled={connecting}
                                        className="bg-emerald-600 hover:bg-emerald-700 flex-1"
                                    >
                                        {connecting
                                            ? <Zap className="h-4 w-4 mr-2 animate-spin" />
                                            : <Link2 className="h-4 w-4 mr-2" />}
                                        {connecting ? 'Opening OAuth...' : 'Connect Account'}
                                    </Button>
                                    <Button
                                        onClick={handleDisconnect}
                                        variant="outline"
                                        className="bg-slate-700 border-slate-600 hover:bg-slate-600"
                                    >
                                        <Unlink className="h-4 w-4 mr-2" /> Disconnect
                                    </Button>
                                </div>
                            ) : (
                                <p className="text-xs text-amber-300/90 leading-relaxed">
                                    Workspace connector pending setup. Once your OAuth app credentials are saved
                                    (prompted in chat), the Connect button activates here for every user.
                                </p>
                            )}
                        </div>
                    ) : (
                        <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-4">
                            <p className="text-sm text-slate-400 leading-relaxed">
                                This integration runs as a backend function with no per-user OAuth.
                                Use <span className="text-slate-200 font-medium">Test</span> to verify it responds.
                            </p>
                        </div>
                    )}

                    {error && (
                        <p className="text-xs text-red-400 flex items-center gap-1.5">
                            <AlertCircle className="h-3.5 w-3.5" /> {error}
                        </p>
                    )}

                    <div className="flex gap-2">
                        <Button
                            onClick={onTest}
                            variant="outline"
                            className="flex-1 bg-slate-700 border-slate-600 hover:bg-slate-600"
                            disabled={testStatus === 'testing'}
                        >
                            {testStatus === 'testing' && <Zap className="h-4 w-4 mr-2 animate-spin" />}
                            {testStatus === 'success' && <Check className="h-4 w-4 mr-2 text-green-400" />}
                            {testStatus === 'error' && <AlertCircle className="h-4 w-4 mr-2 text-red-400" />}
                            {!testStatus && 'Test Connection'}
                            {testStatus === 'testing' && 'Testing...'}
                            {testStatus === 'success' && 'Healthy'}
                            {testStatus === 'error' && 'Error'}
                        </Button>
                        <Button onClick={onClose} variant="ghost" className="text-slate-300">
                            Close
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}