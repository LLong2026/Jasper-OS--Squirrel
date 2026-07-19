import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { getCachedBody } from './_bodyCache.js';

/**
 * Comprehensive Audit Logging for Compliance & Investor Confidence
 * Tracks all critical operations with immutable records
 */

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { 
            action = 'log',
            event_type,
            event_data,
            severity = 'info',
            query_params
        } = await getCachedBody(req);

        if (action === 'log') {
            // Create immutable audit record
            const auditRecord = await base44.asServiceRole.entities.AuditLog.create({
                event_type,
                actor: user.email,
                timestamp: Date.now(),
                severity,
                event_data: JSON.stringify(event_data),
                ip_address: req.headers.get('x-forwarded-for') || 'unknown',
                user_agent: req.headers.get('user-agent') || 'unknown'
            });

            return Response.json({
                success: true,
                audit_id: auditRecord.id
            });
        } else if (action === 'query') {
            // Query audit logs
            const logs = await base44.entities.AuditLog.filter(
                query_params || {},
                '-created_date',
                100
            );

            return Response.json({
                success: true,
                logs,
                count: logs.length
            });
        } else if (action === 'get_stats') {
            // Get audit statistics
            const allLogs = await base44.entities.AuditLog.list('-created_date', 1000);
            
            const eventCounts = {};
            const severityCounts = { info: 0, warning: 0, error: 0, critical: 0 };
            
            for (const log of allLogs) {
                eventCounts[log.event_type] = (eventCounts[log.event_type] || 0) + 1;
                severityCounts[log.severity] = (severityCounts[log.severity] || 0) + 1;
            }

            return Response.json({
                success: true,
                total_events: allLogs.length,
                event_types: eventCounts,
                severity_distribution: severityCounts,
                recent_events: allLogs.slice(0, 10)
            });
        }

        return Response.json({ error: 'Unknown action' }, { status: 400 });

    } catch (error) {
        return Response.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
});