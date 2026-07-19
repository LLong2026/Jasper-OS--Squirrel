import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { action, task_force_id, proposal, rationale, proposed_by } = await req.json();

        if (action === 'propose') {
            // Create consensus proposal
            const consensusProposal = await base44.asServiceRole.entities.ConsensusProposal.create({
                task_force_id,
                proposed_by,
                proposal,
                rationale,
                consensus_threshold: 0.7
            });

            const taskForce = await base44.entities.TaskForce.filter({ id: task_force_id })[0];

            // Request votes from all members
            for (const member of taskForce.members) {
                await base44.functions.invoke('agentCommunication', {
                    action: 'send_message',
                    from_agent: proposed_by,
                    to_agents: [member.agent_name],
                    message_type: 'consensus_request',
                    payload: {
                        proposal_id: consensusProposal.id,
                        proposal,
                        rationale,
                        vote_options: ['approve', 'reject', 'abstain']
                    },
                    priority: 'high',
                    thread_id: `consensus_${consensusProposal.id}`
                });
            }

            return Response.json({
                success: true,
                proposal: consensusProposal,
                message: 'Consensus request sent to all task force members'
            });
        }

        if (action === 'vote') {
            const { proposal_id, agent_name, vote, reasoning } = await req.json();

            const proposal = await base44.entities.ConsensusProposal.filter({ id: proposal_id })[0];
            
            if (!proposal) {
                return Response.json({ error: 'Proposal not found' }, { status: 404 });
            }

            // Get agent's weight (lead gets more weight)
            const taskForce = await base44.entities.TaskForce.filter({ id: proposal.task_force_id })[0];
            const weight = agent_name === taskForce.lead_agent ? 1.5 : 1.0;

            // Add vote
            const updatedVotes = [
                ...proposal.votes,
                { agent: agent_name, vote, reasoning, weight, timestamp: Date.now() }
            ];

            await base44.asServiceRole.entities.ConsensusProposal.update(proposal_id, {
                votes: updatedVotes
            });

            // Check if all members have voted
            const allMembersVoted = taskForce.members.every(m => 
                updatedVotes.some(v => v.agent === m.agent_name)
            );

            if (allMembersVoted) {
                // Calculate consensus
                const result = await calculateConsensus(updatedVotes, proposal.consensus_threshold);
                
                await base44.asServiceRole.entities.ConsensusProposal.update(proposal_id, {
                    status: result.consensus_reached ? 'approved' : 'rejected',
                    final_decision: result
                });

                // Broadcast result
                await base44.functions.invoke('agentCommunication', {
                    action: 'send_message',
                    from_agent: 'system',
                    to_agents: taskForce.members.map(m => m.agent_name),
                    message_type: 'status_update',
                    payload: {
                        proposal_id,
                        decision: result.consensus_reached ? 'APPROVED' : 'REJECTED',
                        voting_breakdown: result.breakdown,
                        next_action: result.consensus_reached ? 'Execute proposal' : 'Propose alternative'
                    },
                    priority: 'high'
                });

                return Response.json({
                    success: true,
                    consensus_reached: result.consensus_reached,
                    result
                });
            }

            return Response.json({
                success: true,
                message: 'Vote recorded',
                votes_remaining: taskForce.members.length - updatedVotes.length
            });
        }

        if (action === 'get_pending') {
            const proposals = await base44.entities.ConsensusProposal.filter({
                task_force_id,
                status: 'pending'
            });

            return Response.json({
                success: true,
                pending_proposals: proposals
            });
        }

        if (action === 'execute') {
            const { proposal_id } = await req.json();

            const proposal = await base44.entities.ConsensusProposal.filter({ id: proposal_id })[0];
            
            if (proposal.status !== 'approved') {
                return Response.json({
                    error: 'Proposal must be approved before execution'
                }, { status: 400 });
            }

            // Execute using LLM to interpret and execute the decision
            const execution = await base44.integrations.Core.InvokeLLM({
                prompt: `Execute this consensus decision:

Proposal: ${proposal.proposal}
Rationale: ${proposal.rationale}

Voting Results:
${proposal.votes.map(v => `- ${v.agent}: ${v.vote} (${v.reasoning})`).join('\n')}

Determine the concrete actions needed to implement this decision and return an execution plan.`,
                response_json_schema: {
                    type: "object",
                    properties: {
                        actions: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    action: { type: "string" },
                                    assigned_to: { type: "string" },
                                    priority: { type: "string" }
                                }
                            }
                        },
                        estimated_completion: { type: "string" },
                        success_criteria: { type: "array", items: { type: "string" } }
                    }
                }
            });

            await base44.asServiceRole.entities.ConsensusProposal.update(proposal_id, {
                status: 'executed',
                execution_result: execution
            });

            // Update task force with new decision
            const taskForce = await base44.entities.TaskForce.filter({ id: proposal.task_force_id })[0];
            await base44.asServiceRole.entities.TaskForce.update(proposal.task_force_id, {
                decisions: [...taskForce.decisions, {
                    proposal: proposal.proposal,
                    executed_at: Date.now(),
                    actions: execution.actions
                }]
            });

            return Response.json({
                success: true,
                execution_plan: execution,
                message: 'Decision executed'
            });
        }

        return Response.json({ error: 'Invalid action' }, { status: 400 });

    } catch (error) {
        console.error('Consensus engine error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});

function calculateConsensus(votes, threshold) {
    const totalWeight = votes.reduce((sum, v) => sum + v.weight, 0);
    const approvalWeight = votes
        .filter(v => v.vote === 'approve')
        .reduce((sum, v) => sum + v.weight, 0);
    
    const approvalPercentage = approvalWeight / totalWeight;
    const consensus_reached = approvalPercentage >= threshold;

    return {
        consensus_reached,
        approval_percentage: approvalPercentage * 100,
        threshold_percentage: threshold * 100,
        breakdown: {
            approve: votes.filter(v => v.vote === 'approve').length,
            reject: votes.filter(v => v.vote === 'reject').length,
            abstain: votes.filter(v => v.vote === 'abstain').length
        },
        weighted_approval: approvalWeight,
        total_weight: totalWeight
    };
}