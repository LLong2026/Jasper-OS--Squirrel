import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { getCachedBody, executeWithBodyRetry } from './_bodyCache.js';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Use cached body reader
        const payload = await getCachedBody(req);
        const { 
            agent_name, 
            interaction_data, 
            user_feedback,
            context 
        } = payload;

        // Normalize interaction_data for different input formats
        const normalizedData = {
            type: interaction_data?.type || interaction_data?.task || 'unknown',
            success: interaction_data?.success !== undefined ? interaction_data.success : (user_feedback === 'positive'),
            response_time: interaction_data?.response_time || interaction_data?.execution_time || 0,
            follow_up_count: interaction_data?.follow_up_count || 0
        };

        // Ensure task_type has fallback
        const taskType = normalizedData.type || 'general';

        // Normalize user feedback
        const normalizedFeedback = typeof user_feedback === 'string' 
            ? { sentiment: user_feedback, rating: user_feedback === 'positive' ? 8 : 5 }
            : user_feedback || {};

        // Immediate signal capture - no waiting
        const learningSignal = {
            agent_name,
            timestamp: Date.now(),
            interaction_type: normalizedData.type,
            success_indicators: {
                task_completed: normalizedData.success,
                response_time_ms: normalizedData.response_time,
                user_satisfaction: normalizedFeedback.rating || 5,
                follow_up_needed: normalizedData.follow_up_count > 0
            },
            context_features: {
                conversation_depth: context?.message_count || 1,
                topic: context?.topic || 'general',
                complexity: context?.complexity_score || 5,
                user_expertise: context?.user_expertise_level || 'intermediate'
            }
        };

        // Instant pattern detection
        const recentSignals = await base44.asServiceRole.entities.LearningSignal.filter({
            agent_name
        }, '-created_date', 100);

        // Validate signals array
        if (!recentSignals || !Array.isArray(recentSignals)) {
            console.error('Invalid recentSignals:', recentSignals);
            return Response.json({ error: 'Failed to retrieve learning signals' }, { status: 500 });
        }

        // Advanced pattern analysis with proactive skill gap detection
        const patterns = analyzePatterns(recentSignals, learningSignal);

        // PREDICTIVE SKILL GAP IDENTIFICATION (before failures)
        const predictedGaps = await predictiveGapAnalysis(base44, agent_name, recentSignals, learningSignal);

        // REACTIVE skill gap identification for failed tasks
        const skillGaps = await identifySkillGaps(base44, agent_name, recentSignals, normalizedData, normalizedFeedback);

        // Merge predicted and reactive gaps
        const allGaps = [...predictedGaps, ...skillGaps];

        // Trigger autonomous improvement if gaps detected
        if (allGaps.length > 0) {
            await initiateAutonomousImprovement(base44, agent_name, allGaps).catch(err => {
                console.warn('Autonomous improvement trigger failed:', err);
            });
        }

        // Share successful predictive models across mesh
        if (predictedGaps.length > 0) {
            await shareSuccessfulPredictions(base44, agent_name, predictedGaps).catch(err => {
                console.warn('Model sharing failed:', err);
            });
        }

        // Immediate micro-adjustments if patterns detected
        if (patterns && patterns.confidence > 0.75) {
            await applyMicroAdjustments(base44, agent_name, patterns);
        }

        // Validate learningSignal before stringifying
        let featuresString;
        try {
            featuresString = JSON.stringify(learningSignal);
            // Check string length to prevent database overflow
            if (featuresString.length > 50000) {
                console.warn('LearningSignal too large, truncating...');
                featuresString = JSON.stringify({
                    agent_name: learningSignal.agent_name,
                    timestamp: learningSignal.timestamp,
                    interaction_type: learningSignal.interaction_type,
                    truncated: true
                });
            }
        } catch (stringifyError) {
            console.error('Failed to stringify learningSignal:', stringifyError);
            featuresString = JSON.stringify({ error: 'Serialization failed', agent_name });
        }

        // Store signal for deeper learning (with retry on rate limit)
        let signalCreated = false;
        let retries = 0;
        while (!signalCreated && retries < 3) {
            try {
                await base44.asServiceRole.entities.LearningSignal.create({
            event_id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            task_type: taskType,
            agents_used: [agent_name],
            success: normalizedData.success,
            execution_time_ms: normalizedData.response_time || 0,
            user_feedback: normalizedFeedback.sentiment || 'neutral',
            features: featuresString,
            outcome_quality: calculateOutcomeQuality(learningSignal)
                });
                signalCreated = true;
            } catch (createError) {
                if (createError.message?.includes('rate limit') || createError.status === 429) {
                    retries++;
                    await new Promise(resolve => setTimeout(resolve, 1000 * retries)); // Exponential backoff
                } else {
                    throw createError; // Re-throw if not rate limit
                }
            }
        }
        
        if (!signalCreated) {
            console.warn('Failed to create LearningSignal after retries, continuing anyway');
        }

        // Instant knowledge broadcast to related agents (throttled to prevent rate limits)
        if (patterns && patterns.confidence > 0.8) { // Only broadcast high-confidence patterns
            await broadcastLearning(base44, agent_name, patterns).catch(err => {
                console.error('Broadcast learning failed, continuing anyway:', err);
            });
        }

        return Response.json({
            success: true,
            patterns_detected: patterns.patterns.length,
            adjustments_applied: patterns.confidence > 0.75,
            learning_velocity: calculateLearningVelocity(recentSignals),
            predicted_gaps: predictedGaps.length,
            reactive_gaps: skillGaps.length,
            total_gaps_identified: allGaps.length,
            autonomous_actions_triggered: allGaps.length > 0,
            predictive_interventions: predictedGaps.filter(g => g.confidence > 0.8).length,
            message: 'Real-time learning processed with predictive analysis'
        });

    } catch (error) {
        console.error('Real-time learning error:', error);
        
        // Check if it's a rate limit error
        const isRateLimit = error.message?.toLowerCase().includes('rate limit') || 
                           error.message?.toLowerCase().includes('too many requests') ||
                           error.status === 429;
        
        return Response.json({ 
            error: error.message,
            rate_limited: isRateLimit,
            suggestion: isRateLimit ? 'Reduce invocation frequency' : null
        }, { status: isRateLimit ? 429 : 500 });
    }
});

function analyzePatterns(signals, newSignal) {
    const patterns = [];
    let totalConfidence = 0;

    // Validate inputs
    if (!signals || !Array.isArray(signals) || signals.length === 0) {
        return { patterns: [], confidence: 0 };
    }
    if (!newSignal || !newSignal.success_indicators) {
        console.error('Invalid newSignal:', newSignal);
        return { patterns: [], confidence: 0 };
    }

    // Failure pattern detection with root cause analysis
    const recentFailures = signals.filter(s => s && s.success === false).slice(0, 5);
    if (recentFailures.length >= 3) {
        const commonFeatures = findCommonFeatures(recentFailures);
        const failureContext = analyzeFailureContext(recentFailures);
        patterns.push({
            type: 'failure_pattern',
            features: commonFeatures || {},
            root_cause: failureContext.likely_cause,
            affected_task_types: failureContext.task_types,
            recommendation: 'adjust_approach',
            confidence: 0.85
        });
        totalConfidence += 0.85;
    }

    // Success pattern detection with best practices extraction
    const recentSuccesses = signals.filter(s => s && s.success === true && (s.outcome_quality || 0) > 7).slice(0, 10);
    if (recentSuccesses.length >= 5) {
        const successFeatures = findCommonFeatures(recentSuccesses);
        const bestPractices = extractBestPractices(recentSuccesses);
        patterns.push({
            type: 'success_pattern',
            features: successFeatures || {},
            best_practices: bestPractices,
            recommendation: 'reinforce_behavior',
            confidence: 0.9
        });
        totalConfidence += 0.9;
    }

    // Speed optimization pattern
    const validSignals = signals.slice(0, 20).filter(s => s && typeof s.execution_time_ms === 'number');
    if (validSignals.length > 0) {
        const avgResponseTime = validSignals.reduce((acc, s) => acc + s.execution_time_ms, 0) / validSignals.length;
        if (newSignal.success_indicators.response_time_ms > avgResponseTime * 1.5) {
            patterns.push({
                type: 'performance_degradation',
                baseline_ms: avgResponseTime,
                current_ms: newSignal.success_indicators.response_time_ms,
                recommendation: 'optimize_processing',
                confidence: 0.8
            });
            totalConfidence += 0.8;
        }
    }

    // User dissatisfaction trend detection
    const recentRatings = signals.slice(0, 10).filter(s => s && s.user_feedback);
    const negativeRatings = recentRatings.filter(s => s.user_feedback === 'negative' || s.outcome_quality < 5).length;
    if (negativeRatings >= 3) {
        patterns.push({
            type: 'user_dissatisfaction',
            negative_count: negativeRatings,
            total_count: recentRatings.length,
            recommendation: 'review_interaction_style',
            confidence: 0.75
        });
        totalConfidence += 0.75;
    }

    // Complexity handling pattern
    const complexTasks = signals.filter(s => {
        try {
            const features = typeof s.features === 'string' ? JSON.parse(s.features) : s.features;
            return features?.context_features?.complexity > 7;
        } catch { return false; }
    }).slice(0, 10);
    
    if (complexTasks.length >= 3) {
        const complexSuccesses = complexTasks.filter(t => t.success);
        const successRate = complexSuccesses.length / complexTasks.length;
        
        if (successRate < 0.5) {
            patterns.push({
                type: 'complexity_challenge',
                success_rate: successRate,
                recommendation: 'enhance_reasoning_depth',
                confidence: 0.8
            });
            totalConfidence += 0.8;
        }
    }

    return {
        patterns,
        confidence: patterns.length > 0 ? Math.min(totalConfidence / patterns.length, 1) : 0
    };
}

function findCommonFeatures(signals) {
    const featureMap = {};
    if (!signals || !Array.isArray(signals)) {
        return featureMap;
    }
    
    signals.forEach(s => {
        if (s && s.features) {
            try {
                // Parse features if it's a string
                const features = typeof s.features === 'string' ? JSON.parse(s.features) : s.features;
                if (features && typeof features === 'object') {
                    Object.keys(features).forEach(key => {
                        featureMap[key] = featureMap[key] || [];
                        featureMap[key].push(features[key]);
                    });
                }
            } catch (e) {
                console.error('Failed to parse features:', e);
            }
        }
    });
    return featureMap;
}

async function applyMicroAdjustments(base44, agentName, patterns) {
    const adjustments = {};

    patterns.patterns.forEach(pattern => {
        if (pattern.type === 'failure_pattern') {
            adjustments.confidence_threshold = 0.85; // Increase caution
            adjustments.validation_level = 'strict';
        } else if (pattern.type === 'success_pattern') {
            adjustments.confidence_threshold = 0.65; // Be more assertive
            adjustments.processing_priority = 'high';
        } else if (pattern.type === 'performance_degradation') {
            adjustments.response_optimization = true;
            adjustments.cache_strategy = 'aggressive';
        }
    });

    // Apply via adaptive policy
    await base44.asServiceRole.entities.AdaptivePolicy.create({
        agent_name: agentName,
        policy_type: 'micro_adjustment',
        current_value: Date.now(),
        default_value: 0,
        adjustment_history: [{ timestamp: Date.now(), changes: adjustments }],
        performance_correlation: patterns.confidence,
        last_adjusted: Date.now()
    });
}

async function broadcastLearning(base44, sourceAgent, patterns) {
    if (!patterns || patterns.confidence < 0.7 || !patterns.patterns || patterns.patterns.length === 0) {
        return;
    }

    try {
        // Find related agents with enhanced matching
        const allAgents = await base44.asServiceRole.entities.ConsciousnessNode.list();
        if (!allAgents || !Array.isArray(allAgents)) {
            console.error('Invalid allAgents:', allAgents);
            return;
        }

        const relatedAgents = allAgents.filter(a => {
            if (!a || !a.agent_name || a.agent_name === sourceAgent) return false;
            if (!a.specialization || !Array.isArray(a.specialization)) return false;
            
            return a.specialization.some(s => {
                if (typeof s !== 'string') return false;
                return patterns.patterns.some(p => {
                    if (!p || !p.features) return false;
                    try {
                        const featuresString = JSON.stringify(p.features);
                        return featuresString.includes(s);
                    } catch (e) {
                        console.error('Failed to stringify pattern features:', e);
                        return false;
                    }
                });
            });
        });

        // Prioritize agents by relevance and limit to prevent rate limits
        const targetAgents = relatedAgents.slice(0, 2);
        
        // Create enriched knowledge transfer records with best practices
        if (targetAgents.length > 0) {
            const memoryRecords = targetAgents.map(agent => ({
                memory_type: 'pattern',
                content: {
                    source_agent: sourceAgent,
                    learned_patterns: patterns.patterns,
                    best_practices: patterns.patterns
                        .filter(p => p.type === 'success_pattern' && p.best_practices)
                        .flatMap(p => p.best_practices),
                    applicable_to: agent.agent_name,
                    transferred_at: Date.now(),
                    learning_type: 'peer_to_peer',
                    actionable: true
                },
                source_agent: sourceAgent,
                confidence_score: patterns.confidence,
                tags: ['fast_adaptation', 'best_practice', sourceAgent, agent.agent_name],
                access_count: 0,
                reinforcement_count: 1
            }));

            // Batch transfer with error handling
            try {
                if (typeof base44.asServiceRole.entities.GlobalMemory.bulkCreate === 'function') {
                    await base44.asServiceRole.entities.GlobalMemory.bulkCreate(memoryRecords);
                } else {
                    const results = await Promise.allSettled(
                        memoryRecords.map(record => base44.asServiceRole.entities.GlobalMemory.create(record))
                    );
                    const failures = results.filter(r => r.status === 'rejected');
                    if (failures.length > 0) {
                        console.warn(`${failures.length} GlobalMemory creates failed`);
                    }
                }
            } catch (bulkError) {
                console.error('Bulk knowledge transfer failed:', bulkError);
            }
        }
        
        // Broadcast via mesh for high-confidence critical patterns
        if (patterns.confidence > 0.85 && patterns.patterns.some(p => p.urgency === 'critical' || p.type === 'failure_pattern')) {
            await base44.asServiceRole.entities.AgentMessage.create({
                from_agent: sourceAgent,
                to_agents: [], // Broadcast to all
                message_type: 'intelligence',
                priority: 'high',
                payload: {
                    type: 'learned_pattern',
                    patterns: patterns.patterns,
                    confidence: patterns.confidence,
                    timestamp: Date.now()
                },
                requires_response: false
            }).catch(err => console.warn('Failed to broadcast via mesh:', err));
        }
    } catch (error) {
        console.error('Error in broadcastLearning:', error);
    }
}

function calculateOutcomeQuality(signal) {
    let quality = 5;
    
    if (signal.success_indicators.task_completed) quality += 3;
    if (signal.success_indicators.user_satisfaction > 0) quality += signal.success_indicators.user_satisfaction * 0.2;
    if (!signal.success_indicators.follow_up_needed) quality += 1;
    if (signal.success_indicators.response_time_ms < 2000) quality += 1;
    
    return Math.min(quality, 10);
}

function calculateLearningVelocity(signals) {
    if (!signals || !Array.isArray(signals) || signals.length < 2) return 0;
    
    const recentWindow = signals.slice(0, 20).filter(s => s);
    const olderWindow = signals.slice(20, 40).filter(s => s);
    
    if (recentWindow.length === 0) return 0;
    
    const recentQuality = recentWindow.reduce((acc, s) => acc + (s.outcome_quality || 5), 0) / recentWindow.length;
    const olderQuality = olderWindow.length > 0 
        ? olderWindow.reduce((acc, s) => acc + (s.outcome_quality || 5), 0) / olderWindow.length 
        : recentQuality;
    
    return recentQuality - olderQuality; // Positive = improving
}

/**
 * Identify skill gaps based on failure patterns and user feedback
 */
async function identifySkillGaps(base44, agentName, signals, currentData, feedback) {
    const gaps = [];
    
    // 1. CROSS-AGENT REPEATED FAILURE ANALYSIS
    const crossAgentPatterns = await analyzeCrossAgentFailures(base44, agentName, signals);
    gaps.push(...crossAgentPatterns);
    
    // 2. PROACTIVE GAP DETECTION (trends, not just failures)
    const predictiveGaps = await detectEmergingGaps(base44, agentName, signals, currentData, feedback);
    gaps.push(...predictiveGaps);
    
    // 3. CURRENT AGENT FAILURE PATTERNS (existing logic)
    const recentFailures = signals.filter(s => s && s.success === false).slice(0, 10);
    
    if (recentFailures.length >= 2) {
        const failuresByType = {};
        recentFailures.forEach(f => {
            const taskType = f.task_type || 'unknown';
            failuresByType[taskType] = (failuresByType[taskType] || 0) + 1;
        });
        
        for (const [taskType, count] of Object.entries(failuresByType)) {
            if (count >= 2) {
                gaps.push({
                    skill_type: taskType,
                    urgency: count >= 3 ? 'critical' : 'high',
                    evidence: recentFailures.filter(f => f.task_type === taskType).map(f => f.event_id),
                    identified_by: 'task_failure',
                    recommendation: generateTrainingRecommendation(taskType, 'failure')
                });
            }
        }
    }
    
    // 4. NEGATIVE FEEDBACK PATTERNS
    const negativeSignals = signals.filter(s => 
        s && (s.user_feedback === 'negative' || s.outcome_quality < 4)
    ).slice(0, 10);
    
    if (negativeSignals.length >= 3) {
        const poorTopics = negativeSignals
            .map(s => {
                try {
                    const features = typeof s.features === 'string' ? JSON.parse(s.features) : s.features;
                    return features?.context_features?.topic;
                } catch { return null; }
            })
            .filter(Boolean);
            
        const topicCounts = {};
        poorTopics.forEach(topic => {
            topicCounts[topic] = (topicCounts[topic] || 0) + 1;
        });
        
        for (const [topic, count] of Object.entries(topicCounts)) {
            if (count >= 2) {
                gaps.push({
                    skill_type: `${topic}_expertise`,
                    urgency: 'medium',
                    evidence: negativeSignals.map(s => s.event_id).slice(0, count),
                    identified_by: 'user_feedback',
                    recommendation: generateTrainingRecommendation(topic, 'feedback')
                });
            }
        }
    }
    
    // 5. COMPLEXITY THRESHOLD DETECTION
    if (currentData.success === false && feedback.rating < 5) {
        gaps.push({
            skill_type: 'complex_reasoning',
            urgency: 'medium',
            evidence: [currentData.type],
            identified_by: 'current_failure',
            recommendation: generateTrainingRecommendation('complex_reasoning', 'failure')
        });
    }
    
    return gaps;
}

/**
 * Analyze failures across multiple agents for the same task type
 */
async function analyzeCrossAgentFailures(base44, currentAgent, signals) {
    const gaps = [];
    
    try {
        // Get failures from ALL agents for comparison (limit to recent 100 across system)
        const allRecentSignals = await base44.asServiceRole.entities.LearningSignal.filter({
            success: false
        }, '-created_date', 100);
        
        if (!allRecentSignals || allRecentSignals.length < 5) return gaps;
        
        // Group by task type across agents
        const taskTypeFailures = {};
        allRecentSignals.forEach(signal => {
            const taskType = signal.task_type || 'unknown';
            if (!taskTypeFailures[taskType]) {
                taskTypeFailures[taskType] = { agents: new Set(), count: 0, evidence: [] };
            }
            taskTypeFailures[taskType].agents.add(signal.agents_used?.[0] || 'unknown');
            taskTypeFailures[taskType].count++;
            if (taskTypeFailures[taskType].evidence.length < 5) {
                taskTypeFailures[taskType].evidence.push(signal.event_id);
            }
        });
        
        // Identify systemic gaps (multiple agents failing same task type)
        for (const [taskType, data] of Object.entries(taskTypeFailures)) {
            if (data.agents.size >= 2 && data.count >= 4) {
                // This is a systemic issue, not just one agent
                gaps.push({
                    skill_type: taskType,
                    urgency: data.agents.has(currentAgent) ? 'critical' : 'high',
                    evidence: data.evidence,
                    identified_by: 'cross_agent_pattern',
                    affected_agents: Array.from(data.agents),
                    systemic: true,
                    recommendation: {
                        type: 'systemic_training',
                        action: 'Deploy collective knowledge module',
                        priority: 'urgent',
                        tools_needed: [`${taskType}_handler`, `${taskType}_validator`],
                        training_module: `specialized_${taskType}_training`
                    }
                });
            }
        }
    } catch (err) {
        console.warn('Cross-agent analysis failed:', err);
    }
    
    return gaps;
}

/**
 * Proactively detect emerging gaps based on trends
 */
async function detectEmergingGaps(base44, agentName, signals, currentData, feedback) {
    const gaps = [];
    
    try {
        // 1. DECLINING QUALITY TREND (not yet failures)
        const recentQuality = signals.slice(0, 10)
            .filter(s => s && typeof s.outcome_quality === 'number')
            .map(s => s.outcome_quality);
        
        if (recentQuality.length >= 5) {
            const avgRecent = recentQuality.slice(0, 5).reduce((a, b) => a + b, 0) / 5;
            const avgOlder = recentQuality.slice(5).reduce((a, b) => a + b, 0) / recentQuality.slice(5).length;
            
            if (avgOlder > 6 && avgRecent < 5.5 && avgRecent < avgOlder) {
                // Quality is declining even without failures
                gaps.push({
                    skill_type: 'performance_degradation',
                    urgency: 'medium',
                    evidence: signals.slice(0, 10).map(s => s.event_id),
                    identified_by: 'trend_analysis',
                    trend: { avgRecent, avgOlder, direction: 'declining' },
                    recommendation: {
                        type: 'preventive_training',
                        action: 'Refresh core capabilities before failure threshold',
                        tools_needed: ['performance_optimizer'],
                        training_module: 'quality_maintenance_protocol'
                    }
                });
            }
        }
        
        // 2. INCREASING COMPLEXITY WITHOUT ADAPTATION
        const complexityTrend = signals.slice(0, 15).map(s => {
            try {
                const features = typeof s.features === 'string' ? JSON.parse(s.features) : s.features;
                return features?.context_features?.complexity || 5;
            } catch { return 5; }
        });
        
        if (complexityTrend.length >= 10) {
            const recentComplexity = complexityTrend.slice(0, 5).reduce((a, b) => a + b, 0) / 5;
            const olderComplexity = complexityTrend.slice(5, 10).reduce((a, b) => a + b, 0) / 5;
            
            // Complexity increasing but success rate not declining yet
            if (recentComplexity > olderComplexity + 1.5 && recentComplexity > 7) {
                gaps.push({
                    skill_type: 'advanced_reasoning',
                    urgency: 'medium',
                    evidence: signals.slice(0, 5).map(s => s.event_id),
                    identified_by: 'complexity_trend',
                    trend: { recentComplexity, olderComplexity, direction: 'increasing' },
                    recommendation: {
                        type: 'capability_expansion',
                        action: 'Proactively add advanced reasoning tools',
                        tools_needed: ['deep_reasoning_engine', 'multi_step_planner'],
                        training_module: 'complex_task_handling'
                    }
                });
            }
        }
        
        // 3. EMERGING USER DISSATISFACTION (before negative reviews)
        const satisfactionScores = signals.slice(0, 15).map(s => {
            try {
                const features = typeof s.features === 'string' ? JSON.parse(s.features) : s.features;
                return features?.success_indicators?.user_satisfaction || 5;
            } catch { return 5; }
        });
        
        if (satisfactionScores.length >= 10) {
            const recentSat = satisfactionScores.slice(0, 5).reduce((a, b) => a + b, 0) / 5;
            const olderSat = satisfactionScores.slice(5, 10).reduce((a, b) => a + b, 0) / 5;
            
            if (recentSat < 6 && recentSat < olderSat - 1) {
                gaps.push({
                    skill_type: 'user_experience',
                    urgency: 'high',
                    evidence: signals.slice(0, 5).map(s => s.event_id),
                    identified_by: 'satisfaction_trend',
                    trend: { recentSat, olderSat, direction: 'declining' },
                    recommendation: {
                        type: 'interaction_refinement',
                        action: 'Enhance response style and clarity',
                        tools_needed: ['communication_optimizer', 'clarity_checker'],
                        training_module: 'user_interaction_excellence'
                    }
                });
            }
        }
        
        // 4. NEW TASK TYPE WITHOUT EXPERIENCE
        const taskTypes = signals.slice(0, 20).map(s => s.task_type).filter(Boolean);
        const taskTypeCounts = {};
        taskTypes.forEach(t => taskTypeCounts[t] = (taskTypeCounts[t] || 0) + 1);
        
        // Find task types with only 1-2 attempts (low experience)
        for (const [taskType, count] of Object.entries(taskTypeCounts)) {
            if (count <= 2 && taskType !== 'unknown') {
                const taskSignals = signals.filter(s => s.task_type === taskType);
                const hasFailure = taskSignals.some(s => !s.success);
                const lowQuality = taskSignals.some(s => s.outcome_quality < 6);
                
                if (hasFailure || lowQuality) {
                    gaps.push({
                        skill_type: taskType,
                        urgency: 'medium',
                        evidence: taskSignals.map(s => s.event_id),
                        identified_by: 'inexperience',
                        recommendation: {
                            type: 'new_capability_training',
                            action: `Learn ${taskType} specialization`,
                            tools_needed: [`${taskType}_toolkit`],
                            training_module: `${taskType}_fundamentals`
                        }
                    });
                }
            }
        }
        
    } catch (err) {
        console.warn('Emerging gap detection failed:', err);
    }
    
    return gaps;
}

/**
 * Generate specific training recommendations
 */
function generateTrainingRecommendation(skillType, source) {
    const baseRecommendations = {
        'code': {
            type: 'tool_discovery',
            action: 'Integrate advanced code analysis tools',
            tools_needed: ['ast_parser', 'code_validator', 'syntax_checker'],
            training_module: 'code_generation_mastery'
        },
        'reasoning': {
            type: 'fine_tuning',
            action: 'Fine-tune on reasoning dataset',
            tools_needed: ['chain_of_thought', 'logical_validator'],
            training_module: 'advanced_reasoning_patterns'
        },
        'complex_reasoning': {
            type: 'fine_tuning',
            action: 'Train on multi-step problem solving',
            tools_needed: ['task_decomposer', 'step_validator'],
            training_module: 'complex_problem_solving'
        },
        'data_analysis': {
            type: 'tool_discovery',
            action: 'Add statistical analysis capabilities',
            tools_needed: ['data_processor', 'visualization_engine'],
            training_module: 'data_science_fundamentals'
        },
        'writing': {
            type: 'prompt_optimization',
            action: 'Refine writing style guidelines',
            tools_needed: ['grammar_checker', 'style_guide'],
            training_module: 'professional_writing'
        }
    };
    
    const recommendation = baseRecommendations[skillType] || {
        type: 'general_improvement',
        action: `Enhance ${skillType} capabilities`,
        tools_needed: [`${skillType}_toolkit`],
        training_module: `${skillType}_training`
    };
    
    recommendation.priority = source === 'failure' ? 'urgent' : 'normal';
    recommendation.estimated_training_time = '2-4 hours';
    
    return recommendation;
}

/**
 * Trigger autonomous improvement processes
 */
async function initiateAutonomousImprovement(base44, agentName, skillGaps) {
    const improvements = [];
    
    for (const gap of skillGaps) {
        // Record skill gap
        const skillGapRecord = await base44.asServiceRole.entities.SkillGap.create({
            agent_name: agentName,
            missing_skill: gap.skill_type,
            identified_by: gap.identified_by,
            urgency: gap.urgency,
            evidence: gap.evidence,
            status: 'identified',
            acquisition_method: gap.recommendation ? 'autonomous_toolbelt' : 'autonomous_discovery',
            learning_plan: gap.recommendation
        }).catch(err => {
            console.warn('Failed to record skill gap:', err);
            return null;
        });
        
        // AUTOMATIC TOOLBELT MANAGEMENT
        if (gap.recommendation && skillGapRecord) {
            base44.functions.invoke('autonomousToolbeltManager', {
                agent_name: agentName,
                skill_gap: { ...gap, id: skillGapRecord.id },
                action: 'process_skill_gap'
            }).catch(err => console.warn('Toolbelt manager failed:', err));
            
            improvements.push('auto_toolbelt_management');
        }
        
        // Trigger tool discovery for critical/high urgency gaps (legacy fallback)
        if (gap.urgency === 'critical' || gap.urgency === 'high') {
            base44.functions.invoke('autonomousToolDiscovery', {
                agent_name: agentName,
                discover_mode: 'active',
                target_skill: gap.skill_type
            }).catch(err => console.warn('Tool discovery trigger failed:', err));
            
            improvements.push('tool_discovery');
        }
        
        // Propose improvement for medium urgency
        if (gap.urgency === 'medium' && !gap.recommendation) {
            base44.asServiceRole.entities.ImprovementProposal.create({
                agent_name: agentName,
                proposal_type: 'specialization_expansion',
                identified_weakness: gap.skill_type,
                proposed_change: {
                    action: 'acquire_capability',
                    skill: gap.skill_type,
                    method: 'training_data_expansion'
                },
                status: 'proposed',
                learned_from_failures: gap.evidence
            }).catch(err => console.warn('Improvement proposal failed:', err));
            
            improvements.push('improvement_proposal');
        }
    }
    
    return improvements;
}

/**
 * Analyze failure context to determine root causes
 */
function analyzeFailureContext(failures) {
    const taskTypes = [...new Set(failures.map(f => f.task_type).filter(Boolean))];
    
    // Check for common error patterns
    const timeouts = failures.filter(f => f.execution_time_ms > 10000).length;
    const lowQuality = failures.filter(f => f.outcome_quality < 3).length;
    
    let likely_cause = 'unknown';
    if (timeouts > failures.length * 0.5) {
        likely_cause = 'timeout_or_performance';
    } else if (lowQuality > failures.length * 0.5) {
        likely_cause = 'quality_or_capability_gap';
    } else if (taskTypes.length === 1) {
        likely_cause = `specific_task_type_${taskTypes[0]}`;
    }
    
    return { likely_cause, task_types: taskTypes };
}

/**
 * Extract best practices from successful interactions
 */
function extractBestPractices(successes) {
    const practices = [];
    
    // Analyze what made these successful
    const fastResponses = successes.filter(s => s.execution_time_ms < 2000);
    if (fastResponses.length > successes.length * 0.7) {
        practices.push({
            practice: 'maintain_fast_response',
            threshold: 2000,
            success_correlation: fastResponses.length / successes.length
        });
    }
    
    const highSatisfaction = successes.filter(s => s.outcome_quality >= 8);
    if (highSatisfaction.length > successes.length * 0.6) {
        practices.push({
            practice: 'high_quality_output',
            threshold: 8,
            success_correlation: highSatisfaction.length / successes.length
        });
    }
    
    return practices;
}

/**
 * PREDICTIVE GAP ANALYSIS - Identify gaps BEFORE failures occur
 */
async function predictiveGapAnalysis(base44, agentName, signals, currentSignal) {
    const predictedGaps = [];
    
    try {
        // Load existing predictive models for this agent
        const agentModels = await base44.asServiceRole.entities.PredictiveModel.filter({
            source_agent: agentName
        });
        
        // Also load high-performing models from other agents
        const sharedModels = await base44.asServiceRole.entities.PredictiveModel.filter({
            accuracy_score: { $gte: 0.75 }
        }, '-accuracy_score', 20);
        
        const allModels = [...(agentModels || []), ...(sharedModels || [])];
        
        // Apply each model to current trend data
        for (const model of allModels) {
            const prediction = applyPredictiveModel(model, signals, currentSignal);
            if (prediction && prediction.confidence >= model.confidence_threshold) {
                predictedGaps.push({
                    ...prediction,
                    model_id: model.model_id,
                    predicted: true,
                    prediction_source: model.source_agent
                });
                
                // Update model usage stats
                await base44.asServiceRole.entities.PredictiveModel.update(model.id, {
                    predictions_made: (model.predictions_made || 0) + 1
                }).catch(() => {});
            }
        }
        
        // DEVELOP NEW MODELS from current trends if none exist
        if (allModels.length === 0 || Math.random() < 0.1) {
            const newModels = await developNewPredictiveModels(base44, agentName, signals);
            predictedGaps.push(...newModels);
        }
        
        // VALIDATE previous predictions (learning loop)
        await validatePreviousPredictions(base44, agentName, signals);
        
    } catch (err) {
        console.warn('Predictive analysis failed:', err);
    }
    
    return predictedGaps;
}

/**
 * Apply a predictive model to current data
 */
function applyPredictiveModel(model, signals, currentSignal) {
    const algorithm = model.prediction_algorithm;
    
    try {
        switch (model.model_type) {
            case 'quality_decline': {
                const recentQuality = signals.slice(0, 5)
                    .filter(s => s && typeof s.outcome_quality === 'number')
                    .map(s => s.outcome_quality);
                
                if (recentQuality.length < 3) return null;
                
                const avgQuality = recentQuality.reduce((a, b) => a + b, 0) / recentQuality.length;
                const trend = calculateTrend(recentQuality);
                
                if (avgQuality < algorithm.quality_threshold && trend < -0.2) {
                    return {
                        skill_type: 'quality_maintenance',
                        urgency: avgQuality < 5 ? 'high' : 'medium',
                        confidence: 1 - (avgQuality / 10),
                        evidence: signals.slice(0, 5).map(s => s.event_id),
                        identified_by: 'predictive_model',
                        prediction_reasoning: `Quality declining: ${avgQuality.toFixed(1)}/10, trend: ${trend.toFixed(2)}`,
                        recommendation: algorithm.recommendation
                    };
                }
                break;
            }
            
            case 'complexity_threshold': {
                const complexities = signals.slice(0, 10).map(s => {
                    try {
                        const features = typeof s.features === 'string' ? JSON.parse(s.features) : s.features;
                        return features?.context_features?.complexity || 5;
                    } catch { return 5; }
                });
                
                const avgComplexity = complexities.reduce((a, b) => a + b, 0) / complexities.length;
                const successRate = signals.slice(0, 10).filter(s => s.success).length / 10;
                
                if (avgComplexity > algorithm.complexity_threshold && successRate < 0.7) {
                    return {
                        skill_type: 'advanced_reasoning',
                        urgency: 'medium',
                        confidence: avgComplexity / 10,
                        evidence: signals.slice(0, 5).map(s => s.event_id),
                        identified_by: 'predictive_model',
                        prediction_reasoning: `Complexity rising: ${avgComplexity.toFixed(1)}/10, success: ${(successRate * 100).toFixed(0)}%`,
                        recommendation: algorithm.recommendation
                    };
                }
                break;
            }
            
            case 'satisfaction_drop': {
                const satisfactionScores = signals.slice(0, 8).map(s => {
                    try {
                        const features = typeof s.features === 'string' ? JSON.parse(s.features) : s.features;
                        return features?.success_indicators?.user_satisfaction || 5;
                    } catch { return 5; }
                });
                
                if (satisfactionScores.length < 4) return null;
                
                const recentSat = satisfactionScores.slice(0, 4).reduce((a, b) => a + b, 0) / 4;
                const olderSat = satisfactionScores.slice(4).reduce((a, b) => a + b, 0) / satisfactionScores.slice(4).length;
                
                if (recentSat < algorithm.satisfaction_threshold && recentSat < olderSat - 0.5) {
                    return {
                        skill_type: 'user_experience',
                        urgency: 'high',
                        confidence: Math.min((olderSat - recentSat) / olderSat, 0.95),
                        evidence: signals.slice(0, 4).map(s => s.event_id),
                        identified_by: 'predictive_model',
                        prediction_reasoning: `Satisfaction dropping: ${recentSat.toFixed(1)} → ${olderSat.toFixed(1)}`,
                        recommendation: algorithm.recommendation
                    };
                }
                break;
            }
            
            case 'performance_degradation': {
                const executionTimes = signals.slice(0, 10)
                    .filter(s => s && typeof s.execution_time_ms === 'number')
                    .map(s => s.execution_time_ms);
                
                if (executionTimes.length < 5) return null;
                
                const recentAvg = executionTimes.slice(0, 5).reduce((a, b) => a + b, 0) / 5;
                const baseline = algorithm.baseline_time || 2000;
                
                if (recentAvg > baseline * 1.5) {
                    return {
                        skill_type: 'performance_optimization',
                        urgency: 'medium',
                        confidence: Math.min(recentAvg / (baseline * 2), 0.9),
                        evidence: signals.slice(0, 5).map(s => s.event_id),
                        identified_by: 'predictive_model',
                        prediction_reasoning: `Performance degrading: ${recentAvg.toFixed(0)}ms vs ${baseline}ms baseline`,
                        recommendation: algorithm.recommendation
                    };
                }
                break;
            }
        }
    } catch (err) {
        console.error(`Model ${model.model_id} failed:`, err);
    }
    
    return null;
}

/**
 * Develop new predictive models from observed patterns
 */
async function developNewPredictiveModels(base44, agentName, signals) {
    const newModels = [];
    
    if (signals.length < 15) return newModels;
    
    // Create quality decline model
    const qualityTrend = calculateTrend(
        signals.slice(0, 10)
            .filter(s => s && typeof s.outcome_quality === 'number')
            .map(s => s.outcome_quality)
    );
    
    if (qualityTrend < -0.15) {
        const modelId = `quality_${agentName}_${Date.now()}`;
        await base44.asServiceRole.entities.PredictiveModel.create({
            model_id: modelId,
            model_type: 'quality_decline',
            source_agent: agentName,
            prediction_algorithm: {
                quality_threshold: 6.5,
                trend_threshold: -0.2,
                recommendation: {
                    type: 'quality_refresh',
                    action: 'Initiate quality improvement cycle',
                    tools_needed: ['quality_validator', 'output_enhancer'],
                    training_module: 'quality_maintenance'
                }
            },
            accuracy_score: 0.5,
            confidence_threshold: 0.7,
            last_refined: Date.now()
        }).catch(() => {});
        
        newModels.push({
            skill_type: 'quality_maintenance',
            urgency: 'medium',
            confidence: 0.6,
            evidence: signals.slice(0, 5).map(s => s.event_id),
            identified_by: 'new_model_development',
            prediction_reasoning: 'New quality decline model developed from observed trend',
            model_id: modelId
        });
    }
    
    return newModels;
}

/**
 * Validate previous predictions to improve model accuracy
 */
async function validatePreviousPredictions(base44, agentName, signals) {
    try {
        // Get predictions made in the last 24 hours
        const recentPredictions = await base44.asServiceRole.entities.SkillGap.filter({
            agent_name: agentName,
            identified_by: 'predictive_model',
            created_date: { $gte: Date.now() - 86400000 }
        });
        
        if (!recentPredictions || recentPredictions.length === 0) return;
        
        for (const prediction of recentPredictions) {
            // Check if the predicted gap actually materialized
            const actualFailures = signals.filter(s => 
                s.task_type === prediction.missing_skill && !s.success
            );
            
            const modelId = prediction.learning_plan?.model_id;
            if (!modelId) continue;
            
            const model = await base44.asServiceRole.entities.PredictiveModel.filter({
                model_id: modelId
            });
            
            if (model && model.length > 0) {
                const wasCorrect = actualFailures.length > 0;
                
                await base44.asServiceRole.entities.PredictiveModel.update(model[0].id, {
                    correct_predictions: (model[0].correct_predictions || 0) + (wasCorrect ? 1 : 0),
                    false_positives: (model[0].false_positives || 0) + (wasCorrect ? 0 : 1),
                    accuracy_score: wasCorrect 
                        ? Math.min((model[0].correct_predictions + 1) / (model[0].predictions_made || 1), 1)
                        : (model[0].correct_predictions || 0) / (model[0].predictions_made || 1)
                }).catch(() => {});
            }
        }
    } catch (err) {
        console.warn('Prediction validation failed:', err);
    }
}

/**
 * Share successful predictive models across the mesh
 */
async function shareSuccessfulPredictions(base44, agentName, predictions) {
    try {
        // Find high-confidence predictions
        const highConfidencePredictions = predictions.filter(p => p.confidence > 0.8);
        
        if (highConfidencePredictions.length === 0) return;
        
        // Broadcast to mesh
        await base44.asServiceRole.entities.AgentMessage.create({
            from_agent: agentName,
            to_agents: [], // Broadcast
            message_type: 'intelligence',
            priority: 'medium',
            payload: {
                type: 'predictive_model_success',
                predictions: highConfidencePredictions.map(p => ({
                    skill_type: p.skill_type,
                    model_id: p.model_id,
                    confidence: p.confidence,
                    reasoning: p.prediction_reasoning
                })),
                timestamp: Date.now()
            },
            requires_response: false
        }).catch(() => {});
        
        // Store as global memory for other agents to access
        await base44.asServiceRole.entities.GlobalMemory.create({
            memory_type: 'pattern',
            content: {
                type: 'successful_prediction',
                agent: agentName,
                predictions: highConfidencePredictions,
                learning: 'Proactive gap detection enabled early intervention'
            },
            source_agent: agentName,
            confidence_score: Math.max(...highConfidencePredictions.map(p => p.confidence)),
            tags: ['predictive', 'skill_gap', 'prevention', agentName]
        }).catch(() => {});
        
    } catch (err) {
        console.warn('Model sharing failed:', err);
    }
}

/**
 * Calculate trend from a series of values
 */
function calculateTrend(values) {
    if (!values || values.length < 2) return 0;
    
    const n = values.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    
    for (let i = 0; i < n; i++) {
        sumX += i;
        sumY += values[i];
        sumXY += i * values[i];
        sumX2 += i * i;
    }
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    return slope;
}