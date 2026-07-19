import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { agent_name, action } = await req.json();

        switch (action) {
            case 'orchestrate':
                return await orchestrateInterventions(base44, agent_name);
            
            case 'refine_models':
                return await refineModels(base44, agent_name);
            
            case 'resolve_conflicts':
                return await resolveConflicts(base44, agent_name);
            
            default:
                return await orchestrateInterventions(base44, agent_name);
        }

    } catch (error) {
        return Response.json({ 
            error: error.message,
            stack: error.stack 
        }, { status: 500 });
    }
});

/**
 * Main orchestration: analyze gaps, resolve conflicts, prioritize, refine models
 */
async function orchestrateInterventions(base44, agentName) {
    const startTime = Date.now();
    
    // Fetch all skill gaps and predictive models
    const [skillGaps, predictiveModels] = await Promise.all([
        base44.asServiceRole.entities.SkillGap.filter(
            agentName ? { agent_name: agentName } : {},
            '-created_date',
            100
        ),
        base44.asServiceRole.entities.PredictiveModel.list('-accuracy_score', 100)
    ]);

    // 1. IDENTIFY CONFLICTS & OVERLAPS
    const conflicts = identifyConflicts(skillGaps);
    
    // 2. RESOLVE CONFLICTS
    const resolvedGaps = await resolveGapConflicts(base44, conflicts, skillGaps);
    
    // 3. PRIORITIZE INTERVENTIONS
    const prioritizedInterventions = prioritizeInterventions(resolvedGaps, predictiveModels);
    
    // 4. REFINE MODELS BASED ON VALIDATION
    const refinementResults = await autoRefineModels(base44, predictiveModels, skillGaps);
    
    // 5. TRIGGER HIGH-PRIORITY INTERVENTIONS
    const triggeredActions = await triggerInterventions(base44, prioritizedInterventions.slice(0, 5));

    return Response.json({
        success: true,
        agent_name: agentName || 'all_agents',
        orchestration_time_ms: Date.now() - startTime,
        conflicts_identified: conflicts.length,
        conflicts_resolved: conflicts.filter(c => c.resolved).length,
        total_gaps_analyzed: skillGaps.length,
        prioritized_interventions: prioritizedInterventions.length,
        models_refined: refinementResults.refined_count,
        models_retired: refinementResults.retired_count,
        actions_triggered: triggeredActions.length,
        top_priorities: prioritizedInterventions.slice(0, 5).map(i => ({
            skill: i.skill_type,
            priority_score: i.priority_score,
            action: i.recommended_action
        })),
        model_performance: refinementResults.performance_summary
    });
}

/**
 * Identify conflicting or overlapping skill gap predictions
 */
function identifyConflicts(skillGaps) {
    const conflicts = [];
    const gapsBySkill = {};
    
    // Group gaps by skill type
    skillGaps.forEach(gap => {
        const skill = gap.missing_skill;
        if (!gapsBySkill[skill]) {
            gapsBySkill[skill] = [];
        }
        gapsBySkill[skill].push(gap);
    });
    
    // Find conflicts within each skill type
    for (const [skill, gaps] of Object.entries(gapsBySkill)) {
        if (gaps.length > 1) {
            // Multiple predictions for same skill - potential conflict
            const urgencies = gaps.map(g => g.urgency);
            const identificationMethods = gaps.map(g => g.identified_by);
            
            // Check for conflicting urgency levels
            const hasConflict = 
                urgencies.includes('critical') && urgencies.includes('low') ||
                urgencies.includes('high') && urgencies.includes('low');
            
            if (hasConflict) {
                conflicts.push({
                    skill_type: skill,
                    conflicting_gaps: gaps,
                    conflict_type: 'urgency_mismatch',
                    urgency_levels: urgencies,
                    sources: identificationMethods,
                    resolved: false
                });
            }
            
            // Check for overlapping predictions
            if (gaps.length >= 2) {
                const predictiveGaps = gaps.filter(g => g.identified_by === 'predictive_analysis');
                const reactiveGaps = gaps.filter(g => g.identified_by === 'task_failure');
                
                if (predictiveGaps.length > 0 && reactiveGaps.length > 0) {
                    conflicts.push({
                        skill_type: skill,
                        conflicting_gaps: [...predictiveGaps, ...reactiveGaps],
                        conflict_type: 'predictive_vs_reactive',
                        note: 'Predictive model anticipated this gap before failure',
                        resolved: false
                    });
                }
            }
        }
    }
    
    return conflicts;
}

/**
 * Resolve conflicts by merging or prioritizing gaps
 */
async function resolveGapConflicts(base44, conflicts, allGaps) {
    const resolvedGaps = [...allGaps];
    
    for (const conflict of conflicts) {
        if (conflict.conflict_type === 'urgency_mismatch') {
            // Take the highest urgency level
            const urgencyRank = { critical: 4, high: 3, medium: 2, low: 1 };
            const maxUrgency = conflict.conflicting_gaps.reduce((max, gap) => {
                return urgencyRank[gap.urgency] > urgencyRank[max.urgency] ? gap : max;
            });
            
            // Update all conflicting gaps to highest urgency
            for (const gap of conflict.conflicting_gaps) {
                if (gap.id !== maxUrgency.id) {
                    await base44.asServiceRole.entities.SkillGap.update(gap.id, {
                        urgency: maxUrgency.urgency,
                        status: 'merged_conflict'
                    }).catch(() => {});
                }
            }
            
            conflict.resolved = true;
            conflict.resolution = `Escalated to ${maxUrgency.urgency} urgency`;
        }
        
        if (conflict.conflict_type === 'predictive_vs_reactive') {
            // Predictive model was correct - reward it
            const predictiveGap = conflict.conflicting_gaps.find(g => g.identified_by === 'predictive_analysis');
            if (predictiveGap?.learning_plan?.model_id) {
                const models = await base44.asServiceRole.entities.PredictiveModel.filter({
                    model_id: predictiveGap.learning_plan.model_id
                });
                
                if (models.length > 0) {
                    const model = models[0];
                    await base44.asServiceRole.entities.PredictiveModel.update(model.id, {
                        correct_predictions: (model.correct_predictions || 0) + 1,
                        skill_gap_prevented: (model.skill_gap_prevented || 0) + 1,
                        accuracy_score: Math.min(
                            ((model.correct_predictions || 0) + 1) / ((model.predictions_made || 1) + 1),
                            1
                        )
                    }).catch(() => {});
                }
            }
            
            conflict.resolved = true;
            conflict.resolution = 'Predictive model validated and rewarded';
        }
    }
    
    return resolvedGaps;
}

/**
 * Prioritize interventions using multi-factor scoring
 */
function prioritizeInterventions(skillGaps, predictiveModels) {
    const interventions = skillGaps.map(gap => {
        const urgencyScore = { critical: 100, high: 75, medium: 50, low: 25 }[gap.urgency] || 50;
        
        // Impact score based on evidence count
        const impactScore = Math.min((gap.evidence?.length || 1) * 10, 50);
        
        // Predictive bonus if gap was predicted
        const predictiveBonus = gap.identified_by === 'predictive_analysis' ? 20 : 0;
        
        // Systemic penalty if cross-agent issue
        const systemicBonus = gap.systemic ? 30 : 0;
        
        // Model confidence (if from predictive model)
        const modelConfidence = gap.confidence ? gap.confidence * 20 : 0;
        
        const priorityScore = urgencyScore + impactScore + predictiveBonus + systemicBonus + modelConfidence;
        
        return {
            gap_id: gap.id,
            agent_name: gap.agent_name,
            skill_type: gap.missing_skill,
            urgency: gap.urgency,
            priority_score: Math.round(priorityScore),
            identified_by: gap.identified_by,
            recommended_action: determineAction(gap),
            estimated_learning_time: gap.estimated_learning_time || 'unknown',
            acquisition_method: gap.acquisition_method
        };
    });
    
    // Sort by priority score descending
    return interventions.sort((a, b) => b.priority_score - a.priority_score);
}

/**
 * Determine best action for a skill gap
 */
function determineAction(gap) {
    if (gap.urgency === 'critical' && gap.systemic) {
        return 'deploy_system_wide_training';
    }
    if (gap.urgency === 'critical' || gap.urgency === 'high') {
        return 'immediate_tool_integration';
    }
    if (gap.acquisition_method === 'fine_tuning') {
        return 'schedule_fine_tuning';
    }
    if (gap.acquisition_method === 'tool_integration') {
        return 'discover_and_integrate_tool';
    }
    return 'queue_for_training';
}

/**
 * Auto-refine or retire models based on validation outcomes
 */
async function autoRefineModels(base44, models, skillGaps) {
    let refinedCount = 0;
    let retiredCount = 0;
    const performanceSummary = [];
    
    for (const model of models) {
        const totalPredictions = model.predictions_made || 0;
        const correctPredictions = model.correct_predictions || 0;
        const falsePositives = model.false_positives || 0;
        
        if (totalPredictions < 5) {
            // Not enough data yet
            continue;
        }
        
        const actualAccuracy = totalPredictions > 0 ? correctPredictions / totalPredictions : 0;
        const falsePositiveRate = totalPredictions > 0 ? falsePositives / totalPredictions : 0;
        
        // RETIREMENT CRITERIA
        if (actualAccuracy < 0.3 && totalPredictions >= 10) {
            // Model is performing poorly - retire it
            await base44.asServiceRole.entities.PredictiveModel.update(model.id, {
                accuracy_score: actualAccuracy,
                confidence_threshold: 1.0, // Effectively disable
                last_refined: Date.now()
            }).catch(() => {});
            retiredCount++;
            
            performanceSummary.push({
                model_id: model.model_id,
                action: 'retired',
                reason: 'low_accuracy',
                accuracy: actualAccuracy
            });
            continue;
        }
        
        // REFINEMENT CRITERIA
        if (falsePositiveRate > 0.4) {
            // Too many false positives - increase confidence threshold
            const newThreshold = Math.min(model.confidence_threshold + 0.1, 0.95);
            await base44.asServiceRole.entities.PredictiveModel.update(model.id, {
                confidence_threshold: newThreshold,
                accuracy_score: actualAccuracy,
                last_refined: Date.now()
            }).catch(() => {});
            refinedCount++;
            
            performanceSummary.push({
                model_id: model.model_id,
                action: 'refined',
                reason: 'high_false_positive_rate',
                new_threshold: newThreshold
            });
        } else if (actualAccuracy > 0.8 && model.confidence_threshold > 0.6) {
            // Model is performing well - can lower threshold to catch more
            const newThreshold = Math.max(model.confidence_threshold - 0.05, 0.6);
            await base44.asServiceRole.entities.PredictiveModel.update(model.id, {
                confidence_threshold: newThreshold,
                accuracy_score: actualAccuracy,
                last_refined: Date.now()
            }).catch(() => {});
            refinedCount++;
            
            performanceSummary.push({
                model_id: model.model_id,
                action: 'refined',
                reason: 'high_accuracy_expand_coverage',
                new_threshold: newThreshold
            });
        } else {
            // Just update accuracy
            await base44.asServiceRole.entities.PredictiveModel.update(model.id, {
                accuracy_score: actualAccuracy,
                last_refined: Date.now()
            }).catch(() => {});
        }
    }
    
    return {
        refined_count: refinedCount,
        retired_count: retiredCount,
        performance_summary: performanceSummary
    };
}

/**
 * Trigger interventions for high-priority gaps
 */
async function triggerInterventions(base44, prioritizedInterventions) {
    const triggered = [];
    
    for (const intervention of prioritizedInterventions) {
        try {
            if (intervention.recommended_action === 'immediate_tool_integration') {
                // Trigger autonomous toolbelt manager
                base44.functions.invoke('autonomousToolbeltManager', {
                    agent_name: intervention.agent_name,
                    skill_gap: { 
                        id: intervention.gap_id,
                        missing_skill: intervention.skill_type,
                        urgency: intervention.urgency
                    },
                    action: 'search_and_integrate'
                }).catch(() => {});
                
                triggered.push({
                    gap_id: intervention.gap_id,
                    action: 'toolbelt_integration_triggered'
                });
            } else if (intervention.recommended_action === 'deploy_system_wide_training') {
                // Broadcast to all agents
                await base44.asServiceRole.entities.AgentMessage.create({
                    from_agent: 'predictive_orchestrator',
                    to_agents: [],
                    message_type: 'intelligence',
                    priority: 'critical',
                    payload: {
                        type: 'systemic_skill_gap',
                        skill: intervention.skill_type,
                        urgency: intervention.urgency,
                        training_required: true
                    }
                }).catch(() => {});
                
                triggered.push({
                    gap_id: intervention.gap_id,
                    action: 'system_wide_broadcast'
                });
            }
        } catch (err) {
            console.error('Intervention trigger failed:', err);
        }
    }
    
    return triggered;
}

/**
 * Standalone conflict resolution
 */
async function resolveConflicts(base44, agentName) {
    const skillGaps = await base44.asServiceRole.entities.SkillGap.filter(
        agentName ? { agent_name: agentName } : {},
        '-created_date',
        100
    );
    
    const conflicts = identifyConflicts(skillGaps);
    await resolveGapConflicts(base44, conflicts, skillGaps);
    
    return Response.json({
        success: true,
        conflicts_found: conflicts.length,
        conflicts_resolved: conflicts.filter(c => c.resolved).length,
        details: conflicts
    });
}

/**
 * Standalone model refinement
 */
async function refineModels(base44, agentName) {
    const models = await base44.asServiceRole.entities.PredictiveModel.filter(
        agentName ? { source_agent: agentName } : {},
        '-accuracy_score',
        100
    );
    
    const skillGaps = await base44.asServiceRole.entities.SkillGap.list('-created_date', 100);
    const results = await autoRefineModels(base44, models, skillGaps);
    
    return Response.json({
        success: true,
        ...results
    });
}