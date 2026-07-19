import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { action } = await req.json();

        if (action === 'detect_patterns') {
            // Analyze recent agent interactions
            const messages = await base44.asServiceRole.entities.AgentMessage.list('-created_date', 200);
            const taskForces = await base44.asServiceRole.entities.TaskForce.list('-created_date', 50);
            const collaborations = await base44.asServiceRole.entities.AgentCollaboration.list('-created_date', 50);

            // Use LLM to detect emergent patterns
            const analysis = await base44.integrations.Core.InvokeLLM({
                prompt: `Analyze these agent interactions for emergent patterns:

Recent Messages: ${messages.length} communications
Task Forces Formed: ${taskForces.length}
Active Collaborations: ${collaborations.length}

Sample Interactions:
${messages.slice(0, 20).map(m => `${m.from_agent} → ${m.to_agents.join(',')} [${m.message_type}]`).join('\n')}

Identify:
1. Recurring collaboration patterns (which agents naturally work together)
2. Spontaneous task routing behaviors (which agents handle what)
3. Resource allocation patterns
4. Communication protocols that emerged naturally

For each pattern, assess:
- How often it occurs
- Effectiveness (0-10)
- Should it be formalized as a protocol?`,
                response_json_schema: {
                    type: "object",
                    properties: {
                        patterns: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    type: { type: "string" },
                                    participants: { type: "array", items: { type: "string" } },
                                    behavior: { type: "string" },
                                    frequency: { type: "number" },
                                    effectiveness: { type: "number" },
                                    should_formalize: { type: "boolean" }
                                }
                            }
                        }
                    }
                }
            });

            // Store detected patterns
            const storedPatterns = [];
            for (const pattern of analysis.patterns) {
                const existing = await base44.asServiceRole.entities.EmergentPattern.filter({
                    pattern_type: pattern.type,
                    participants: pattern.participants
                });

                if (existing.length > 0) {
                    await base44.asServiceRole.entities.EmergentPattern.update(existing[0].id, {
                        frequency: existing[0].frequency + 1,
                        effectiveness_score: pattern.effectiveness,
                        should_formalize: pattern.should_formalize
                    });
                } else {
                    const newPattern = await base44.asServiceRole.entities.EmergentPattern.create({
                        pattern_type: pattern.type,
                        participants: pattern.participants,
                        trigger_conditions: {},
                        observed_behavior: pattern.behavior,
                        effectiveness_score: pattern.effectiveness,
                        should_formalize: pattern.should_formalize
                    });
                    storedPatterns.push(newPattern);
                }
            }

            return Response.json({
                success: true,
                patterns_detected: analysis.patterns.length,
                new_patterns: storedPatterns.length
            });
        }

        if (action === 'formalize_pattern') {
            const { pattern_id } = await req.json();

            const pattern = await base44.entities.EmergentPattern.filter({ id: pattern_id })[0];
            
            if (!pattern.should_formalize) {
                return Response.json({
                    error: 'Pattern effectiveness too low to formalize'
                }, { status: 400 });
            }

            // Stability Period Check
            const now = Date.now();
            const stabilityPeriodMs = (pattern.stability_period_days || 7) * 24 * 60 * 60 * 1000;
            
            if (pattern.last_formalized_date && (now - pattern.last_formalized_date) < stabilityPeriodMs) {
                const daysRemaining = Math.ceil((stabilityPeriodMs - (now - pattern.last_formalized_date)) / (24 * 60 * 60 * 1000));
                return Response.json({
                    error: 'Stability period active',
                    days_remaining: daysRemaining,
                    message: `Protocol must remain stable for ${daysRemaining} more days before modification`
                }, { status: 429 });
            }

            // Generate formal protocol
            const protocol = await base44.integrations.Core.InvokeLLM({
                prompt: `Formalize this emergent behavior into a protocol:

Behavior: ${pattern.observed_behavior}
Participants: ${pattern.participants.join(', ')}
Effectiveness: ${pattern.effectiveness_score}/10

Create a formal protocol specification including:
1. Protocol name
2. Trigger conditions
3. Step-by-step procedure
4. Expected outcomes
5. Fallback mechanisms`,
                response_json_schema: {
                    type: "object",
                    properties: {
                        protocol_name: { type: "string" },
                        triggers: { type: "array", items: { type: "string" } },
                        procedure: { type: "array", items: { type: "string" } },
                        expected_outcomes: { type: "array", items: { type: "string" } }
                    }
                }
            });

            await base44.asServiceRole.entities.EmergentPattern.update(pattern_id, {
                formalized_as: protocol.protocol_name,
                last_formalized_date: Date.now()
            });

            // Broadcast new protocol to participants
            await base44.functions.invoke('agentCommunication', {
                action: 'send_message',
                from_agent: 'system',
                to_agents: pattern.participants,
                message_type: 'capability_broadcast',
                payload: {
                    new_protocol: protocol.protocol_name,
                    details: protocol
                },
                priority: 'medium'
            });

            return Response.json({
                success: true,
                protocol,
                message: 'Emergent pattern formalized'
            });
        }

        return Response.json({ error: 'Invalid action' }, { status: 400 });

    } catch (error) {
        console.error('Emergent behavior error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});