import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { action, approval_id, decision, action_type, details, estimated_cost } = await req.json();

        if (action === 'create') {
            // Assess risk
            const riskResult = await base44.functions.invoke('riskAssessment', {
                action_type,
                details,
                estimated_cost
            });

            // Create approval request
            const approval = await base44.asServiceRole.entities.ApprovalRequest.create({
                action_type,
                risk_level: riskResult.risk_level,
                details,
                estimated_cost: estimated_cost || 0,
                status: 'pending',
                auto_approve_threshold: user.auto_approve_limit || 50
            });

            // Auto-approve low-risk or below threshold
            if (riskResult.risk_level === 'low' || (estimated_cost && estimated_cost < approval.auto_approve_threshold)) {
                await base44.asServiceRole.entities.ApprovalRequest.update(approval.id, {
                    status: 'approved'
                });
                return Response.json({
                    success: true,
                    approval_id: approval.id,
                    auto_approved: true,
                    risk_assessment: riskResult
                });
            }

            return Response.json({
                success: true,
                approval_id: approval.id,
                requires_approval: true,
                risk_assessment: riskResult
            });
        }

        if (action === 'decide') {
            const approval = await base44.entities.ApprovalRequest.filter({ id: approval_id })[0];
            
            if (!approval) {
                return Response.json({ error: 'Approval request not found' }, { status: 404 });
            }

            await base44.asServiceRole.entities.ApprovalRequest.update(approval_id, {
                status: decision === 'approve' ? 'approved' : 'rejected'
            });

            return Response.json({
                success: true,
                status: decision === 'approve' ? 'approved' : 'rejected'
            });
        }

        if (action === 'execute') {
            const approval = await base44.entities.ApprovalRequest.filter({ id: approval_id })[0];
            
            if (!approval || approval.status !== 'approved') {
                return Response.json({ error: 'Action not approved' }, { status: 403 });
            }

            // Execute based on action type
            let result;
            switch (approval.action_type) {
                case 'purchase':
                    result = await base44.functions.invoke('purchaseAutomation', {
                        ...approval.details,
                        approved: true
                    });
                    break;
                case 'booking':
                    result = await base44.functions.invoke('autonomousActions', {
                        action_type: approval.details.booking_type,
                        parameters: approval.details.parameters,
                        approved: true
                    });
                    break;
                default:
                    result = { error: 'Unknown action type' };
            }

            await base44.asServiceRole.entities.ApprovalRequest.update(approval_id, {
                status: 'executed',
                executed_at: Date.now(),
                execution_result: result
            });

            return Response.json({
                success: true,
                result
            });
        }

        if (action === 'list') {
            const approvals = await base44.entities.ApprovalRequest.filter({
                status: 'pending'
            });

            return Response.json({
                success: true,
                approvals
            });
        }

        return Response.json({ error: 'Invalid action' }, { status: 400 });

    } catch (error) {
        console.error('Approval workflow error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});