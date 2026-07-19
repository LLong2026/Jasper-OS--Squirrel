import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { action, file_path, target_version_id, reason } = await req.json();

        if (action === 'rollback') {
            // Get target version
            const targetVersion = await base44.entities.CodeVersion.filter({
                id: target_version_id
            })[0];

            if (!targetVersion) {
                return Response.json({ error: 'Target version not found' }, { status: 404 });
            }

            // Get current version
            const currentVersions = await base44.entities.CodeVersion.filter({
                file_path,
                is_current: true
            });

            // Capture current state before rollback
            const preRollbackSnapshot = await base44.functions.invoke('performanceMonitor', {
                action: 'capture_snapshot',
                code_version_id: currentVersions[0]?.id,
                snapshot_type: 'pre_rollback'
            });

            // Mark current as not current
            for (const version of currentVersions) {
                await base44.asServiceRole.entities.CodeVersion.update(version.id, {
                    is_current: false
                });
            }

            // Apply rollback by writing the old content
            await base44.functions.invoke('writeFile', {
                file_path: targetVersion.file_path,
                content: targetVersion.content
            });

            // Mark target version as current and increment rollback count
            await base44.asServiceRole.entities.CodeVersion.update(target_version_id, {
                is_current: true,
                rollback_count: (targetVersion.rollback_count || 0) + 1
            });

            // Create rollback performance snapshot
            await base44.asServiceRole.entities.PerformanceSnapshot.create({
                snapshot_type: 'rollback',
                code_version_id: target_version_id,
                metrics: preRollbackSnapshot.metrics
            });

            // Log the rollback event
            await base44.asServiceRole.entities.NodeEvent.create({
                node_id: 'wednesday_meta_engine',
                event_type: 'code_rollback',
                payload: {
                    file_path,
                    from_version: currentVersions[0]?.version_number,
                    to_version: targetVersion.version_number,
                    reason,
                    initiated_by: user.email
                }
            });

            return Response.json({
                success: true,
                message: `Rolled back ${file_path} to version ${targetVersion.version_number}`,
                target_version: targetVersion,
                rollback_reason: reason
            });
        }

        if (action === 'rollback_to_last_stable') {
            // Find versions with good performance
            const allVersions = await base44.entities.CodeVersion.filter({ file_path });
            
            // Get performance snapshots
            const snapshots = await base44.entities.PerformanceSnapshot.list();
            
            // Find version with best performance metrics
            let bestVersion = null;
            let bestScore = -1;
            
            for (const version of allVersions) {
                const versionSnapshot = snapshots.find(s => s.code_version_id === version.id);
                if (versionSnapshot) {
                    const score = versionSnapshot.metrics.success_rate - 
                                (versionSnapshot.metrics.error_count * 5) +
                                (versionSnapshot.metrics.avg_response_time_ms > 1000 ? -10 : 0);
                    
                    if (score > bestScore) {
                        bestScore = score;
                        bestVersion = version;
                    }
                }
            }

            if (!bestVersion) {
                return Response.json({
                    success: false,
                    error: 'No stable version found'
                }, { status: 404 });
            }

            // Perform rollback to best version
            return await base44.functions.invoke('rollbackManager', {
                action: 'rollback',
                file_path,
                target_version_id: bestVersion.id,
                reason: 'Automatic rollback to last stable version'
            });
        }

        if (action === 'list_rollback_points') {
            const versions = await base44.entities.CodeVersion.filter({ file_path });
            const snapshots = await base44.entities.PerformanceSnapshot.list();

            const rollbackPoints = versions.map(v => {
                const snapshot = snapshots.find(s => s.code_version_id === v.id);
                return {
                    version_id: v.id,
                    version_number: v.version_number,
                    change_description: v.change_description,
                    modified_by: v.modified_by,
                    created_date: v.created_date,
                    performance: snapshot?.metrics,
                    is_current: v.is_current,
                    rollback_count: v.rollback_count || 0
                };
            }).sort((a, b) => b.version_number - a.version_number);

            return Response.json({
                success: true,
                file_path,
                rollback_points
            });
        }

        return Response.json({ error: 'Invalid action' }, { status: 400 });

    } catch (error) {
        console.error('Rollback manager error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});