import { useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';

export default function AegisHeartbeat() {
    const [isPulsing, setIsPulsing] = useState(false);
    const [lastPulse, setLastPulse] = useState(null);
    const [systemStatus, setSystemStatus] = useState('healthy');
    const sessionId = useRef(`session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
    const intervalRef = useRef(null);
    const tabId = useRef(`tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);

    useEffect(() => {
        // Multi-tab coordination using localStorage
        const isLeaderTab = () => {
            const leader = localStorage.getItem('aegis_leader_tab');
            const leaderTimestamp = localStorage.getItem('aegis_leader_timestamp');
            const now = Date.now();

            // If no leader or leader is stale (>15s), become leader
            if (!leader || !leaderTimestamp || now - parseInt(leaderTimestamp) > 15000) {
                localStorage.setItem('aegis_leader_tab', tabId.current);
                localStorage.setItem('aegis_leader_timestamp', now.toString());
                return true;
            }

            return leader === tabId.current;
        };

        // Heartbeat function
        const pulse = async () => {
            if (!isLeaderTab()) {
                return; // Only leader tab sends heartbeat
            }

            setIsPulsing(true);
            try {
                const result = await base44.functions.invoke('aegisHeartbeat', {
                    session_id: sessionId.current
                });

                setLastPulse(result.timestamp);
                setSystemStatus(result.system_status);
            } catch (error) {
                console.error('Aegis heartbeat error:', error);
                setSystemStatus('degraded');
            } finally {
                setTimeout(() => setIsPulsing(false), 500);
            }
        };

        // Initial pulse
        pulse();

        // Set up interval (every 10 seconds)
        intervalRef.current = setInterval(pulse, 10000);

        // Update leader timestamp periodically
        const leaderUpdateInterval = setInterval(() => {
            if (isLeaderTab()) {
                localStorage.setItem('aegis_leader_timestamp', Date.now().toString());
            }
        }, 5000);

        // Cleanup
        return () => {
            clearInterval(intervalRef.current);
            clearInterval(leaderUpdateInterval);
            
            // If we're the leader, clear leadership on unmount
            if (localStorage.getItem('aegis_leader_tab') === tabId.current) {
                localStorage.removeItem('aegis_leader_tab');
                localStorage.removeItem('aegis_leader_timestamp');
            }
        };
    }, []);

    return (
        <div className="fixed bottom-4 right-4 flex items-center gap-3 bg-slate-800/90 backdrop-blur-sm px-4 py-2 rounded-full border border-slate-700 shadow-lg">
            <div className="flex items-center gap-2">
                <div className={`h-3 w-3 rounded-full transition-all duration-300 ${
                    systemStatus === 'healthy' ? 'bg-green-500' : 
                    systemStatus === 'degraded' ? 'bg-yellow-500' : 
                    'bg-red-500'
                } ${isPulsing ? 'scale-125 shadow-lg' : 'scale-100'}`} 
                style={{
                    boxShadow: isPulsing ? `0 0 20px ${
                        systemStatus === 'healthy' ? 'rgba(34, 197, 94, 0.8)' : 
                        systemStatus === 'degraded' ? 'rgba(234, 179, 8, 0.8)' : 
                        'rgba(239, 68, 68, 0.8)'
                    }` : 'none'
                }}
                />
                <span className="text-xs text-slate-300 font-mono">
                    AEGIS
                </span>
            </div>
            {lastPulse && (
                <span className="text-xs text-slate-500 font-mono">
                    {new Date(lastPulse).toLocaleTimeString()}
                </span>
            )}
        </div>
    );
}