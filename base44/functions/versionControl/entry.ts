import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

async function hashContent(content) {
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { action, file_path, content, change_description, modified_by, modification_reason } = await req.json();

        if (action === 'commit') {
            // Get current versions for this file
            const existingVersions = await base44.asServiceRole.entities.CodeVersion.filter({
                file_path
            });

            // Mark all existing versions as not current
            for (const version of existingVersions) {
                await base44.asServiceRole.entities.CodeVersion.update(version.id, {
                    is_current: false
                });
            }

            // Calculate version number
            const versionNumber = existingVersions.length + 1;
            
            // Hash content
            const contentHash = await hashContent(content);

            // Assess impact before committing
            const impactAssessment = await base44.functions.invoke('codeImpactAnalysis', {
                file_path,
                new_content: content,
                previous_content: existingVersions[existingVersions.length - 1]?.content
            });

            // Create new version
            const newVersion = await base44.asServiceRole.entities.CodeVersion.create({
                file_path,
                version_number: versionNumber,
                content,
                content_hash: contentHash,
                change_description,
                modified_by: modified_by || 'wednesday',
                modification_reason,
                impact_assessment: impactAssessment,
                is_current: true
            });

            // Create baseline performance snapshot if first version
            if (versionNumber === 1) {
                await base44.asServiceRole.entities.PerformanceSnapshot.create({
                    snapshot_type: 'baseline',
                    code_version_id: newVersion.id,
                    metrics: {
                        avg_response_time_ms: 0,
                        success_rate: 100,
                        error_count: 0,
                        memory_usage_mb: 0,
                        llm_token_usage: 0
                    }
                });
            }

            return Response.json({
                success: true,
                version: newVersion,
                message: `Committed version ${versionNumber} of ${file_path}`
            });
        }

        if (action === 'get_history') {
            const versions = await base44.entities.CodeVersion.filter({
                file_path
            });

            return Response.json({
                success: true,
                file_path,
                versions: versions.sort((a, b) => b.version_number - a.version_number)
            });
        }

        if (action === 'get_current') {
            const currentVersion = await base44.entities.CodeVersion.filter({
                file_path,
                is_current: true
            });

            if (currentVersion.length === 0) {
                return Response.json({
                    success: false,
                    error: 'No version found for this file'
                }, { status: 404 });
            }

            return Response.json({
                success: true,
                version: currentVersion[0]
            });
        }

        if (action === 'diff') {
            const { version_a, version_b } = await req.json();
            
            const versionA = await base44.entities.CodeVersion.filter({ id: version_a })[0];
            const versionB = await base44.entities.CodeVersion.filter({ id: version_b })[0];

            if (!versionA || !versionB) {
                return Response.json({ error: 'Version not found' }, { status: 404 });
            }

            // Simple diff - in production would use a proper diff algorithm
            return Response.json({
                success: true,
                version_a: { number: versionA.version_number, hash: versionA.content_hash },
                version_b: { number: versionB.version_number, hash: versionB.content_hash },
                content_a: versionA.content,
                content_b: versionB.content,
                changes_detected: versionA.content_hash !== versionB.content_hash
            });
        }

        return Response.json({ error: 'Invalid action' }, { status: 400 });

    } catch (error) {
        console.error('Version control error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});