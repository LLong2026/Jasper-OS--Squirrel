import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { action, params } = await req.json();

        if (action === 'orchestrate_property_purchase') {
            const { 
                property_criteria, 
                financing_info, 
                buyer_info,
                max_budget,
                timeline 
            } = params;

            // Create high-level approval request
            const approval = await base44.asServiceRole.entities.ApprovalRequest.create({
                action_type: 'complete_property_purchase',
                risk_level: 'critical',
                details: {
                    criteria: property_criteria,
                    budget: max_budget,
                    timeline
                },
                estimated_cost: max_budget,
                status: 'pending'
            });

            // Generate comprehensive transaction plan
            const plan = await base44.integrations.Core.InvokeLLM({
                prompt: `Create comprehensive property purchase orchestration plan:

Property Criteria: ${JSON.stringify(property_criteria)}
Budget: $${max_budget}
Financing: ${JSON.stringify(financing_info)}
Timeline: ${timeline}

Generate step-by-step plan including:
1. Property search and shortlisting
2. Viewings and inspections
3. Market analysis and valuation
4. Offer strategy
5. Financing pre-approval
6. Purchase agreement drafting
7. Contingency management (inspection, appraisal, financing)
8. Escrow setup
9. Title search and insurance
10. Legal review
11. Final walkthrough
12. Closing coordination
13. Document signing
14. Fund transfer
15. Keys and possession

For each step, specify:
- Responsible party (Wednesday function or user action)
- Estimated timeline
- Dependencies
- Required approvals
- Risk mitigation`,
                response_json_schema: {
                    type: "object",
                    properties: {
                        phases: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    phase_name: { type: "string" },
                                    steps: { type: "array" },
                                    duration_estimate: { type: "string" },
                                    automated: { type: "boolean" },
                                    requires_approval: { type: "boolean" }
                                }
                            }
                        },
                        total_timeline: { type: "string" },
                        estimated_total_cost: { type: "number" },
                        risk_factors: { type: "array" },
                        success_probability: { type: "number" }
                    }
                }
            });

            // Store orchestration plan
            await base44.asServiceRole.entities.GlobalMemory.create({
                memory_type: 'knowledge',
                content: {
                    type: 'transaction_orchestration',
                    category: 'property_purchase',
                    approval_id: approval.id,
                    plan,
                    status: 'awaiting_approval',
                    created_for: user.email
                },
                source_agent: 'TransactionOrchestrator',
                tags: ['orchestration', 'real_estate', 'pending_approval']
            });

            return Response.json({
                success: true,
                requires_approval: true,
                approval_id: approval.id,
                plan,
                message: 'Property purchase orchestration plan created. Review and approve to begin execution.',
                next_steps: [
                    'Review the complete transaction plan',
                    'Approve the orchestration request',
                    'Wednesday will begin Phase 1: Property Search',
                    'You will be notified at each approval gate'
                ]
            });
        }

        if (action === 'execute_orchestration_phase') {
            const { orchestration_id, phase_number } = params;

            // Retrieve orchestration plan
            const memories = await base44.asServiceRole.entities.GlobalMemory.filter({
                'content.type': 'transaction_orchestration',
                'content.orchestration_id': orchestration_id
            });

            if (memories.length === 0) {
                return Response.json({ error: 'Orchestration not found' }, { status: 404 });
            }

            const orchestration = memories[0];
            const phase = orchestration.content.plan.phases[phase_number];

            if (!phase) {
                return Response.json({ error: 'Invalid phase number' }, { status: 400 });
            }

            // Execute phase steps
            const results = [];

            for (const step of phase.steps) {
                if (step.automated) {
                    // Execute automated step
                    let result;

                    switch (step.action) {
                        case 'search_listings':
                            result = await base44.functions.invoke('realEstateConnector', {
                                action: 'search_listings',
                                params: step.params
                            });
                            break;

                        case 'check_financing':
                            result = await base44.functions.invoke('financialInstitutionConnector', {
                                action: 'check_financing_options',
                                params: step.params
                            });
                            break;

                        case 'generate_agreement':
                            result = await base44.functions.invoke('legalDocumentProcessor', {
                                action: 'generate_purchase_agreement',
                                params: step.params
                            });
                            break;

                        case 'send_for_signature':
                            result = await base44.functions.invoke('eSignatureIntegration', {
                                action: 'send_for_signature',
                                params: step.params
                            });
                            break;

                        default:
                            result = { message: `Step ${step.name} requires manual execution` };
                    }

                    results.push({
                        step: step.name,
                        result,
                        completed: true
                    });
                } else {
                    results.push({
                        step: step.name,
                        result: { message: 'Requires user action' },
                        completed: false,
                        user_action_required: true
                    });
                }
            }

            // Update orchestration status
            orchestration.content.status = `phase_${phase_number}_completed`;
            orchestration.content.last_phase_results = results;

            await base44.asServiceRole.entities.GlobalMemory.update(orchestration.id, {
                content: orchestration.content
            });

            return Response.json({
                success: true,
                phase_completed: phase.phase_name,
                results,
                next_phase: orchestration.content.plan.phases[phase_number + 1]?.phase_name || 'Complete'
            });
        }

        if (action === 'get_orchestration_status') {
            const { orchestration_id } = params;

            const memories = await base44.asServiceRole.entities.GlobalMemory.filter({
                'content.orchestration_id': orchestration_id
            });

            if (memories.length === 0) {
                return Response.json({ error: 'Orchestration not found' }, { status: 404 });
            }

            const orchestration = memories[0];

            return Response.json({
                success: true,
                status: orchestration.content.status,
                plan: orchestration.content.plan,
                current_phase: orchestration.content.current_phase,
                completed_phases: orchestration.content.completed_phases || [],
                pending_approvals: orchestration.content.pending_approvals || []
            });
        }

        return Response.json({ error: 'Invalid action' }, { status: 400 });

    } catch (error) {
        console.error('Transaction orchestrator error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});