import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

/**
 * Collaborative Knowledge Synthesis Engine
 * Agents collaboratively synthesize insights from disparate sources
 */

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { action, payload } = await req.json();

        if (action === 'synthesize_knowledge') {
            const { topic, participating_agents, source_types = ['experiences', 'documentation', 'reasoning'], use_external_sources = true } = payload;

            // Step 1: Ingest external sources for this topic
            if (use_external_sources) {
                try {
                    await base44.functions.invoke('reasoningEngine', {
                        action: 'ingest_external_sources',
                        agent_name: 'CollectiveIntelligence',
                        payload: {
                            sources: [
                                { type: 'web_search', query: topic }
                            ],
                            query_context: topic
                        }
                    });
                } catch (error) {
                    console.error('External source ingestion failed:', error);
                }
            }

            // Step 2: Gather knowledge from all sources
            const knowledgePool = await gatherKnowledge(topic, source_types, base44);

            // Step 3: Each agent contributes their perspective
            const agentPerspectives = [];
            for (const agent of participating_agents) {
                const perspective = await base44.integrations.Core.InvokeLLM({
                    prompt: `You are ${agent}. Analyze this knowledge pool about: ${topic}

Knowledge Pool:
${JSON.stringify(knowledgePool, null, 2)}

From YOUR unique perspective and specialization:
1. What patterns do you see?
2. What insights emerge?
3. What connections exist between these pieces of knowledge?
4. What generalizable principles can be extracted?
5. What is the agent perspective nobody else would see?`,
                    response_json_schema: {
                        type: "object",
                        properties: {
                            patterns_identified: { type: "array", items: { type: "string" } },
                            unique_insights: { type: "array", items: { type: "string" } },
                            connections: { type: "array", items: { type: "string" } },
                            principles: { type: "array", items: { type: "string" } },
                            confidence: { type: "number" }
                        }
                    }
                });

                agentPerspectives.push({
                    agent,
                    perspective
                });
            }

            // Step 4: Collaborative synthesis - combine perspectives
            const synthesis = await base44.integrations.Core.InvokeLLM({
                prompt: `Synthesize collective knowledge from multiple agent perspectives.

Topic: ${topic}

Agent Perspectives:
${agentPerspectives.map(ap => `
${ap.agent}:
- Patterns: ${ap.perspective.patterns_identified.join(', ')}
- Insights: ${ap.perspective.unique_insights.join(', ')}
- Principles: ${ap.perspective.principles.join(', ')}
`).join('\n')}

Synthesize NEW knowledge that:
1. No single agent possesses individually
2. Emerges from combining perspectives
3. Creates generalizable principles
4. Has practical applications
5. Advances collective intelligence

Generate insights that are MORE than the sum of parts.`,
                response_json_schema: {
                    type: "object",
                    properties: {
                        synthesized_insights: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    title: { type: "string" },
                                    content: { type: "string" },
                                    novelty_explanation: { type: "string" },
                                    applications: { type: "array", items: { type: "string" } }
                                }
                            }
                        },
                        emergent_principles: { type: "array", items: { type: "string" } },
                        synthesis_confidence: { type: "number" }
                    }
                }
            });

            // Step 5: Validate through consensus
            const validation = await validateSynthesis(synthesis, participating_agents, base44);

            // Step 6: Store synthesized insights
            const storedInsights = [];
            for (const insight of synthesis.synthesized_insights) {
                if (validation.validated_insights.includes(insight.title)) {
                    const stored = await base44.asServiceRole.entities.SynthesizedInsight.create({
                        insight_id: `insight_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                        insight_title: insight.title,
                        insight_content: insight.content,
                        contributing_agents: participating_agents,
                        source_knowledge: knowledgePool.map(k => ({
                            source_type: k.source_type,
                            source_id: k.id,
                            contribution: k.content.substring(0, 200)
                        })),
                        synthesis_method: 'collaborative_reasoning',
                        novelty_score: calculateNovelty(insight, knowledgePool),
                        confidence: validation.confidence,
                        validated: true,
                        applications: insight.applications
                    });

                    // Add to knowledge base for future retrieval
                    await base44.functions.invoke('reasoningEngine', {
                        action: 'add_knowledge',
                        agent_name: 'CollectiveIntelligence',
                        payload: {
                            title: insight.title,
                            content: `${insight.content}\n\nApplications: ${insight.applications.join(', ')}`,
                            content_type: 'best_practice',
                            tags: ['synthesized', 'collective', topic, ...participating_agents],
                            source: 'collaborative_synthesis'
                        }
                    });

                    storedInsights.push(stored.insight_id);
                }
            }

            return Response.json({
                success: true,
                insights_synthesized: storedInsights.length,
                insights: synthesis.synthesized_insights,
                emergent_principles: synthesis.emergent_principles,
                validation,
                insight_ids: storedInsights
            });
        }

        if (action === 'cross_pollinate') {
            // Transfer insights between different domains
            const { source_domain, target_domain, facilitating_agents } = payload;

            const sourceDomainInsights = await base44.asServiceRole.entities.SynthesizedInsight.filter({});
            const relevantInsights = sourceDomainInsights.filter(i => 
                i.insight_content.toLowerCase().includes(source_domain.toLowerCase())
            );

            const crossPollination = await base44.integrations.Core.InvokeLLM({
                prompt: `Transfer insights from ${source_domain} to ${target_domain}.

Source Domain Insights:
${relevantInsights.map(i => `- ${i.insight_title}: ${i.insight_content}`).join('\n')}

How can these insights apply to ${target_domain}?
What analogies exist?
What principles transfer?
What new insights emerge from this cross-pollination?`,
                response_json_schema: {
                    type: "object",
                    properties: {
                        transferred_insights: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    original_insight: { type: "string" },
                                    adapted_for_target: { type: "string" },
                                    analogy: { type: "string" }
                                }
                            }
                        },
                        new_cross_domain_principles: { type: "array", items: { type: "string" } }
                    }
                }
            });

            // Store cross-pollinated insights
            for (const transfer of crossPollination.transferred_insights) {
                await base44.asServiceRole.entities.SynthesizedInsight.create({
                    insight_id: `crosspoll_${Date.now()}`,
                    insight_title: `${source_domain} → ${target_domain}: ${transfer.analogy}`,
                    insight_content: transfer.adapted_for_target,
                    contributing_agents: facilitating_agents,
                    source_knowledge: [{
                        source_type: 'cross_pollination',
                        source_id: source_domain,
                        contribution: transfer.original_insight
                    }],
                    synthesis_method: 'cross_pollination',
                    novelty_score: 8,
                    confidence: 0.85,
                    applications: [target_domain]
                });
            }

            return Response.json({
                success: true,
                cross_pollinated_insights: crossPollination.transferred_insights.length,
                new_principles: crossPollination.new_cross_domain_principles
            });
        }

        if (action === 'pattern_extraction') {
            // Extract meta-patterns from multiple insights
            const { insight_ids } = payload;

            const insights = [];
            for (const id of insight_ids) {
                const insight = await base44.asServiceRole.entities.SynthesizedInsight.filter({ insight_id: id });
                if (insight.length > 0) insights.push(insight[0]);
            }

            const metaPatterns = await base44.integrations.Core.InvokeLLM({
                prompt: `Extract meta-patterns from these synthesized insights:

${insights.map((i, idx) => `[${idx+1}] ${i.insight_title}\n${i.insight_content}`).join('\n\n')}

Find:
1. Common patterns across insights
2. Higher-level abstractions
3. Universal principles
4. Meta-strategies that apply broadly`,
                response_json_schema: {
                    type: "object",
                    properties: {
                        meta_patterns: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    pattern_name: { type: "string" },
                                    description: { type: "string" },
                                    examples_from_insights: { type: "array", items: { type: "string" } },
                                    universality_score: { type: "number" }
                                }
                            }
                        }
                    }
                }
            });

            // Store meta-patterns as high-level insights
            for (const pattern of metaPatterns.meta_patterns) {
                await base44.asServiceRole.entities.SynthesizedInsight.create({
                    insight_id: `meta_${Date.now()}`,
                    insight_title: `Meta-Pattern: ${pattern.pattern_name}`,
                    insight_content: pattern.description,
                    contributing_agents: ['CollectiveIntelligence'],
                    source_knowledge: insights.map(i => ({
                        source_type: 'synthesized_insight',
                        source_id: i.insight_id,
                        contribution: i.insight_title
                    })),
                    synthesis_method: 'pattern_extraction',
                    novelty_score: pattern.universality_score,
                    confidence: 0.9,
                    applications: ['universal']
                });
            }

            return Response.json({
                success: true,
                meta_patterns_extracted: metaPatterns.meta_patterns.length,
                meta_patterns: metaPatterns.meta_patterns
            });
        }

        if (action === 'consensus_building') {
            // Build consensus on controversial or uncertain knowledge
            const { topic, conflicting_sources } = payload;

            const agentVotes = [];
            const agents = ['Wednesday', 'Arete', 'CodeForge', 'SystemArchitect'];

            for (const agent of agents) {
                const vote = await base44.integrations.Core.InvokeLLM({
                    prompt: `You are ${agent}. Evaluate conflicting knowledge about: ${topic}

Conflicting Sources:
${conflicting_sources.map((s, i) => `[${i+1}] ${s}`).join('\n')}

Provide:
1. Which source is most credible? Why?
2. What is the truth given your expertise?
3. How confident are you?`,
                    response_json_schema: {
                        type: "object",
                        properties: {
                            most_credible_source: { type: "number" },
                            reasoning: { type: "string" },
                            synthesized_truth: { type: "string" },
                            confidence: { type: "number" }
                        }
                    }
                });

                agentVotes.push({ agent, vote });
            }

            // Build consensus
            const consensus = await base44.integrations.Core.InvokeLLM({
                prompt: `Build consensus from agent evaluations:

${agentVotes.map(av => `${av.agent}: ${av.vote.synthesized_truth} (confidence: ${av.vote.confidence})`).join('\n')}

Synthesize consensus truth considering:
- Agent expertise alignment with topic
- Confidence levels
- Reasoning quality`,
                response_json_schema: {
                    type: "object",
                    properties: {
                        consensus_truth: { type: "string" },
                        collective_confidence: { type: "number" },
                        dissenting_opinions: { type: "array", items: { type: "string" } }
                    }
                }
            });

            return Response.json({
                success: true,
                consensus: consensus.consensus_truth,
                confidence: consensus.collective_confidence,
                agent_votes: agentVotes.length
            });
        }

        return Response.json({ error: 'Invalid action' }, { status: 400 });

    } catch (error) {
        console.error('Knowledge synthesis error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});

async function gatherKnowledge(topic, sourceTypes, base44) {
    const knowledge = [];

    // Gather from agent experiences
    if (sourceTypes.includes('experiences')) {
        const experiences = await base44.asServiceRole.entities.GlobalMemory.filter({
            memory_type: 'experience'
        }, '-created_date', 20);
        
        knowledge.push(...experiences.map(e => ({
            source_type: 'experience',
            id: e.id,
            content: JSON.stringify(e.content),
            agent: e.source_agent
        })));
    }

    // Gather from documentation/knowledge base
    if (sourceTypes.includes('documentation')) {
        const docs = await base44.functions.invoke('reasoningEngine', {
            action: 'query_knowledge_base',
            agent_name: 'System',
            payload: {
                query: topic,
                top_k: 10
            }
        });
        
        if (docs.data.success) {
            knowledge.push(...docs.data.results.map(d => ({
                source_type: 'documentation',
                id: d.document_id,
                content: d.content,
                title: d.title
            })));
        }
    }

    // Gather from reasoning chains
    if (sourceTypes.includes('reasoning')) {
        const chains = await base44.asServiceRole.entities.ReasoningChain.filter({
            validated: true
        }, '-created_date', 10);
        
        knowledge.push(...chains.map(c => ({
            source_type: 'reasoning',
            id: c.chain_id,
            content: c.final_conclusion,
            agent: c.agent_name,
            confidence: c.confidence_score
        })));
    }

    return knowledge;
}

async function validateSynthesis(synthesis, agents, base44) {
    const validations = [];

    for (const agent of agents) {
        const validation = await base44.integrations.Core.InvokeLLM({
            prompt: `You are ${agent}. Validate these synthesized insights:

${synthesis.synthesized_insights.map(i => `- ${i.title}: ${i.content}`).join('\n')}

Which insights are:
1. Logically sound?
2. Practically useful?
3. Truly novel?

Rate each insight (valid/invalid).`,
            response_json_schema: {
                type: "object",
                properties: {
                    validated_insights: { type: "array", items: { type: "string" } },
                    rejected_insights: { type: "array", items: { type: "string" } },
                    reasoning: { type: "string" }
                }
            }
        });

        validations.push(validation);
    }

    // Consensus: insight needs majority validation
    const insightVotes = {};
    for (const insight of synthesis.synthesized_insights) {
        insightVotes[insight.title] = validations.filter(v => 
            v.validated_insights.includes(insight.title)
        ).length;
    }

    const validated = Object.entries(insightVotes)
        .filter(([title, votes]) => votes > agents.length / 2)
        .map(([title, votes]) => title);

    return {
        validated_insights: validated,
        confidence: validated.length / synthesis.synthesized_insights.length,
        validation_votes: insightVotes
    };
}

function calculateNovelty(insight, knowledgePool) {
    // Simple novelty heuristic
    const existingContent = knowledgePool.map(k => k.content.toLowerCase()).join(' ');
    const insightWords = insight.content.toLowerCase().split(' ');
    const newWords = insightWords.filter(word => !existingContent.includes(word));
    
    return Math.min(10, (newWords.length / insightWords.length) * 10);
}