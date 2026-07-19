import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

/**
 * Evolution Cycle Orchestrator
 * Runs a full self-evolution cycle across the agent fleet:
 *  - Analyzes each agent via InvokeLLM
 *  - Persists ImprovementProposal, SkillGap, and FineTuningJob records
 *  - Returns a summary the dashboard can render
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const agents = body.agents && body.agents.length > 0
      ? body.agents
      : ['Jasper', 'Arete', 'CodeForge', 'CreativeForge', 'SystemArchitect'];

    const agentsBlock = agents.map((a, i) => `Agent ${i + 1}: ${a}`).join('\n');

    const analysis = await base44.integrations.Core.InvokeLLM({
      prompt: `You are the Evolution Engine for the Jasper multi-agent platform.
Analyze the following agents and produce a realistic evolution cycle report.

Agents:
${agentsBlock}

For EACH agent, produce:
1. One ImprovementProposal — a concrete self-improvement (proposal_type must be one of: model_routing, parameter_tuning, task_delegation, specialization_expansion, code_optimization). Include a specific identified_weakness, the proposed_change summary, expected improvement metrics. NOTE: status must always be "proposed" — agents cannot self-approve or self-deploy.
2. One or two SkillGap entries — a missing skill (acquisition_method one of: fine_tuning, prompt_engineering, tool_integration, agent_collaboration; urgency one of: critical, high, medium, low; identified_by one of: task_failure, predictive_analysis, user_request, peer_comparison), with an estimated learning time in hours.
3. Optionally one FineTuningJob (only when the improvement would benefit from fine-tuning) — with base_model, provider (openai/anthropic/google), training_data_source (one of: performance_history, failed_tasks, user_feedback, synthetic_generation), training_examples_count, target_improvement, status (one of: preparing, training, validating, deployed), and estimated cost_usd.

Be specific, realistic, and varied per agent. Return strictly valid JSON matching the schema.`,
      response_json_schema: {
        type: 'object',
        properties: {
          cycles: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                agent_name: { type: 'string' },
                fitness_score: { type: 'number' },
                improvement: {
                  type: 'object',
                  properties: {
                    proposal_type: { type: 'string' },
                    identified_weakness: { type: 'string' },
                    proposed_change: { type: 'string' },
                    expected_success_rate_increase: { type: 'number' },
                    status: { type: 'string' }
                  }
                },
                skill_gaps: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      missing_skill: { type: 'string' },
                      urgency: { type: 'string' },
                      identified_by: { type: 'string' },
                      acquisition_method: { type: 'string' },
                      estimated_learning_time_hours: { type: 'number' },
                      evidence: { type: 'string' }
                    }
                  }
                },
                fine_tuning: {
                  type: 'object',
                  properties: {
                    base_model: { type: 'string' },
                    provider: { type: 'string' },
                    training_data_source: { type: 'string' },
                    training_examples_count: { type: 'number' },
                    target_improvement: { type: 'string' },
                    status: { type: 'string' },
                    cost_usd: { type: 'number' }
                  }
                }
              }
            }
          }
        }
      }
    });

    const cycles = Array.isArray(analysis.cycles) ? analysis.cycles : [];

    const improvements = [];
    const skillGaps = [];
    const fineTuningJobs = [];

    for (const cycle of cycles) {
      const agentName = cycle.agent_name || agents[0];

      // Persist improvement proposal
      if (cycle.improvement && cycle.improvement.proposal_type) {
        const imp = await base44.asServiceRole.entities.ImprovementProposal.create({
          agent_name: agentName,
          proposal_type: cycle.improvement.proposal_type,
          identified_weakness: cycle.improvement.identified_weakness || 'Unspecified weakness',
          proposed_change: {
            description: cycle.improvement.proposed_change,
            expected_success_rate_increase: cycle.improvement.expected_success_rate_increase
          },
          expected_improvement: {
            success_rate_increase: cycle.improvement.expected_success_rate_increase || 0
          },
          status: 'proposed',
          current_performance: { fitness_score: cycle.fitness_score || 0 },
          constitutional_check: { approved: false, checked_by: 'evolutionOrchestrator', requires_manual_review: true }
        });
        improvements.push(imp);
      }

      // Persist skill gaps
      if (Array.isArray(cycle.skill_gaps)) {
        for (const gap of cycle.skill_gaps) {
          const sg = await base44.asServiceRole.entities.SkillGap.create({
            agent_name: agentName,
            missing_skill: gap.missing_skill || 'Unknown skill',
            identified_by: ['task_failure', 'predictive_analysis', 'user_request', 'peer_comparison'].includes(gap.identified_by) ? gap.identified_by : 'predictive_analysis',
            urgency: ['critical', 'high', 'medium', 'low'].includes(gap.urgency) ? gap.urgency : 'medium',
            evidence: [gap.evidence || 'Identified during evolution cycle'],
            status: 'identified',
            acquisition_method: ['fine_tuning', 'prompt_engineering', 'tool_integration', 'agent_collaboration'].includes(gap.acquisition_method) ? gap.acquisition_method : 'prompt_engineering',
            estimated_learning_time: gap.estimated_learning_time_hours || 4
          });
          skillGaps.push(sg);
        }
      }

      // Persist fine-tuning job if present
      if (cycle.fine_tuning && cycle.fine_tuning.base_model) {
        const ft = await base44.asServiceRole.entities.FineTuningJob.create({
          agent_name: agentName,
          base_model: cycle.fine_tuning.base_model,
          provider: cycle.fine_tuning.provider || 'openai',
          training_data_source: ['performance_history', 'failed_tasks', 'user_feedback', 'synthetic_generation'].includes(cycle.fine_tuning.training_data_source) ? cycle.fine_tuning.training_data_source : 'performance_history',
          training_examples_count: cycle.fine_tuning.training_examples_count || 50,
          target_improvement: cycle.fine_tuning.target_improvement || 'General performance',
          status: ['preparing', 'training', 'validating', 'deployed', 'failed'].includes(cycle.fine_tuning.status) ? cycle.fine_tuning.status : 'preparing',
          cost_usd: cycle.fine_tuning.cost_usd || 0,
          created_from_proposal: improvements.length > 0 ? improvements[improvements.length - 1].id : undefined
        });
        fineTuningJobs.push(ft);
      }
    }

    return Response.json({
      success: true,
      agents_analyzed: cycles.length,
      improvements_created: improvements.length,
      skill_gaps_created: skillGaps.length,
      fine_tuning_jobs_created: fineTuningJobs.length,
      cycle_timestamp: Date.now()
    });
  } catch (error) {
    console.error('Evolution orchestrator error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});