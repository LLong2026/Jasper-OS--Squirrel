import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

/**
 * Advanced Reasoning Engine - Multi-hop reasoning with knowledge retrieval
 * Enables agents to chain logical steps and consult knowledge bases
 */

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { action, agent_name, payload } = await req.json();

        if (action === 'multi_hop_reasoning') {
            const { query, max_hops = 5, require_validation = true, use_external_knowledge = true, external_urls = [] } = payload;
            const startTime = Date.now();

            const reasoningSteps = [];
            let currentHypothesis = query;
            let confidence = 1.0;

            // Ingest external URLs if provided
            if (external_urls.length > 0) {
                for (const url of external_urls) {
                    try {
                        const urlContent = await base44.functions.invoke('realTimeWebAccess', {
                            url,
                            extract_text: true
                        });
                        
                        if (urlContent.data.success) {
                            const embedding = await generateEmbedding(urlContent.data.content, base44);
                            await base44.asServiceRole.entities.KnowledgeBase.create({
                                document_id: `url_${Date.now()}`,
                                title: urlContent.data.title || url,
                                content: urlContent.data.content,
                                content_type: 'documentation',
                                embedding_vector: embedding,
                                tags: ['external', 'url_ingest', query],
                                source: url,
                                last_accessed: Date.now()
                            });
                        }
                    } catch (error) {
                        console.error(`Failed to ingest ${url}:`, error);
                    }
                }
            }

            // Multi-hop reasoning loop
            for (let hop = 0; hop < max_hops; hop++) {
                // Retrieve relevant knowledge from internal KB
                const internalKnowledge = await retrieveKnowledge(currentHypothesis, base44);
                
                // Retrieve external knowledge via web search if enabled
                let externalKnowledge = [];
                if (use_external_knowledge) {
                    try {
                        const webSearchResult = await base44.integrations.Core.InvokeLLM({
                            prompt: `Research: ${currentHypothesis}`,
                            add_context_from_internet: true
                        });
                        
                        externalKnowledge.push({
                            document_id: `web_${Date.now()}`,
                            title: 'Real-Time Web Search',
                            content: webSearchResult,
                            source: 'web_search',
                            similarity_score: 0.9
                        });
                    } catch (error) {
                        console.error('Web search failed:', error);
                    }
                }
                
                const relevantKnowledge = [...internalKnowledge, ...externalKnowledge];

                // Perform reasoning step
                const stepReasoning = await base44.integrations.Core.InvokeLLM({
                    prompt: `You are ${agent_name} performing step ${hop + 1} of multi-hop reasoning.

Original Query: ${query}
Current Hypothesis: ${currentHypothesis}

Retrieved Knowledge:
${relevantKnowledge.map((k, i) => `[${i + 1}] ${k.title}: ${k.content.substring(0, 500)}...`).join('\n\n')}

Reasoning Instructions:
1. What logical step follows from the current hypothesis?
2. What new information can be inferred from the retrieved knowledge?
3. What's the next sub-question that needs answering?
4. How confident are you in this reasoning step?
5. Should reasoning continue or is this conclusive?

Think step-by-step. Build on previous reasoning.`,
                    response_json_schema: {
                        type: "object",
                        properties: {
                            reasoning: { type: "string" },
                            new_hypothesis: { type: "string" },
                            next_question: { type: "string" },
                            confidence: { type: "number" },
                            is_conclusive: { type: "boolean" },
                            key_insights: { type: "array", items: { type: "string" } },
                            knowledge_applied: { type: "array", items: { type: "string" } }
                        }
                    }
                });

                reasoningSteps.push({
                    step_number: hop + 1,
                    hypothesis: currentHypothesis,
                    reasoning: stepReasoning.reasoning,
                    knowledge_retrieved: relevantKnowledge.map(k => k.document_id),
                    confidence: stepReasoning.confidence,
                    validation: null
                });

                // Validate reasoning step if required
                if (require_validation) {
                    const validation = await validateReasoningStep(stepReasoning, relevantKnowledge, base44);
                    reasoningSteps[hop].validation = validation.is_valid ? 'valid' : 'invalid';
                    
                    if (!validation.is_valid) {
                        confidence *= 0.5; // Reduce confidence if validation fails
                    }
                }

                // Update confidence
                confidence *= stepReasoning.confidence;

                // Check if reasoning is conclusive
                if (stepReasoning.is_conclusive) {
                    currentHypothesis = stepReasoning.new_hypothesis;
                    break;
                }

                // Continue to next hop
                currentHypothesis = stepReasoning.next_question;
            }

            // Store reasoning chain
            const chain = await base44.asServiceRole.entities.ReasoningChain.create({
                chain_id: `reasoning_${Date.now()}`,
                agent_name,
                original_query: query,
                reasoning_steps: reasoningSteps,
                final_conclusion: currentHypothesis,
                confidence_score: confidence,
                knowledge_sources_used: [...new Set(reasoningSteps.flatMap(s => s.knowledge_retrieved))],
                reasoning_time_ms: Date.now() - startTime,
                validated: require_validation
            });

            return Response.json({
                success: true,
                chain_id: chain.chain_id,
                reasoning_steps: reasoningSteps,
                final_conclusion: currentHypothesis,
                confidence: confidence,
                hops_taken: reasoningSteps.length,
                knowledge_sources_consulted: chain.knowledge_sources_used.length
            });
        }

        if (action === 'query_knowledge_base') {
            const { query, top_k = 5, content_type_filter } = payload;

            const results = await retrieveKnowledge(query, base44, top_k, content_type_filter);

            // Update access stats
            for (const doc of results) {
                await base44.asServiceRole.entities.KnowledgeBase.update(doc.id, {
                    last_accessed: Date.now(),
                    relevance_score: doc.relevance_score + 1
                });
            }

            return Response.json({
                success: true,
                results: results.map(r => ({
                    document_id: r.document_id,
                    title: r.title,
                    content: r.content,
                    similarity_score: r.similarity_score
                }))
            });
        }

        if (action === 'add_knowledge') {
            const { title, content, content_type, tags, source } = payload;

            // Generate embedding for content
            const embedding = await generateEmbedding(content, base44);

            const doc = await base44.asServiceRole.entities.KnowledgeBase.create({
                document_id: `doc_${Date.now()}`,
                title,
                content,
                content_type,
                embedding_vector: embedding,
                tags: tags || [],
                source: source || agent_name,
                last_accessed: Date.now()
            });

            return Response.json({
                success: true,
                document_id: doc.document_id,
                message: 'Knowledge added to base'
            });
        }

        if (action === 'ingest_external_sources') {
            const { sources, query_context } = payload;
            const ingested = [];

            for (const source of sources) {
                try {
                    let content, title;

                    if (source.type === 'url') {
                        const urlData = await base44.functions.invoke('realTimeWebAccess', {
                            url: source.url,
                            extract_text: true
                        });
                        content = urlData.data.content;
                        title = urlData.data.title || source.url;
                    } else if (source.type === 'api') {
                        const apiData = await fetch(source.endpoint, {
                            method: source.method || 'GET',
                            headers: source.headers || {}
                        });
                        const json = await apiData.json();
                        content = JSON.stringify(json, null, 2);
                        title = source.name || source.endpoint;
                    } else if (source.type === 'web_search') {
                        content = await base44.integrations.Core.InvokeLLM({
                            prompt: source.query || query_context,
                            add_context_from_internet: true
                        });
                        title = `Web Search: ${source.query || query_context}`;
                    }

                    if (content) {
                        const embedding = await generateEmbedding(content, base44);
                        
                        const doc = await base44.asServiceRole.entities.KnowledgeBase.create({
                            document_id: `external_${Date.now()}`,
                            title,
                            content,
                            content_type: 'documentation',
                            embedding_vector: embedding,
                            tags: ['external', source.type, query_context],
                            source: source.url || source.endpoint || 'web_search',
                            last_accessed: Date.now()
                        });

                        ingested.push({
                            document_id: doc.document_id,
                            title,
                            source_type: source.type
                        });
                    }
                } catch (error) {
                    console.error(`Failed to ingest ${source.type}:`, error);
                }
            }

            return Response.json({
                success: true,
                ingested_count: ingested.length,
                documents: ingested
            });
        }

        if (action === 'learn_from_reasoning') {
            // Extract knowledge from successful reasoning chains
            const { chain_id } = payload;

            const chain = await base44.asServiceRole.entities.ReasoningChain.filter({
                chain_id
            })[0];

            if (!chain || chain.confidence_score < 0.8) {
                return Response.json({
                    success: false,
                    error: 'Chain not found or confidence too low'
                }, { status: 400 });
            }

            // Extract key insights and store as knowledge
            const insights = await base44.integrations.Core.InvokeLLM({
                prompt: `Extract reusable knowledge from this reasoning chain:

Query: ${chain.original_query}
Conclusion: ${chain.final_conclusion}
Steps: ${JSON.stringify(chain.reasoning_steps, null, 2)}

What generalizable insights can be extracted?
What can other agents learn from this reasoning?`,
                response_json_schema: {
                    type: "object",
                    properties: {
                        key_insights: { type: "array", items: { type: "string" } },
                        best_practices: { type: "array", items: { type: "string" } },
                        patterns_discovered: { type: "array", items: { type: "string" } }
                    }
                }
            });

            // Store as learned experience
            for (const insight of insights.key_insights) {
                await base44.functions.invoke('reasoningEngine', {
                    action: 'add_knowledge',
                    agent_name,
                    payload: {
                        title: `Learned: ${insight.substring(0, 50)}...`,
                        content: insight,
                        content_type: 'learned_experience',
                        tags: ['reasoning', 'learned', agent_name],
                        source: `reasoning_chain_${chain_id}`
                    }
                });
            }

            return Response.json({
                success: true,
                insights_extracted: insights.key_insights.length,
                message: 'Knowledge extracted from reasoning chain'
            });
        }

        return Response.json({ error: 'Invalid action' }, { status: 400 });

    } catch (error) {
        console.error('Reasoning engine error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});

async function retrieveKnowledge(query, base44, top_k = 5, content_type_filter = null) {
    // Generate query embedding
    const queryEmbedding = await generateEmbedding(query, base44);

    // Retrieve all knowledge documents
    const filter = content_type_filter ? { content_type: content_type_filter } : {};
    const allDocs = await base44.asServiceRole.entities.KnowledgeBase.filter(filter);

    // Calculate similarity scores
    const scoredDocs = allDocs.map(doc => ({
        ...doc,
        similarity_score: cosineSimilarity(queryEmbedding, doc.embedding_vector || [])
    }));

    // Sort by similarity and return top_k
    return scoredDocs
        .sort((a, b) => b.similarity_score - a.similarity_score)
        .slice(0, top_k);
}

async function generateEmbedding(text, base44) {
    // Use LLM to generate semantic embedding
    // In production, use a dedicated embedding model like text-embedding-ada-002
    const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Generate a semantic embedding vector (768 dimensions) for this text. Output as array of numbers between -1 and 1.

Text: ${text.substring(0, 1000)}

Output format: [0.123, -0.456, ...]`,
        response_json_schema: {
            type: "object",
            properties: {
                embedding: { type: "array", items: { type: "number" } }
            }
        }
    });

    return result.embedding;
}

function cosineSimilarity(vecA, vecB) {
    if (!vecA || !vecB || vecA.length === 0 || vecB.length === 0) return 0;
    
    let dotProduct = 0;
    let magnitudeA = 0;
    let magnitudeB = 0;

    for (let i = 0; i < Math.min(vecA.length, vecB.length); i++) {
        dotProduct += vecA[i] * vecB[i];
        magnitudeA += vecA[i] * vecA[i];
        magnitudeB += vecB[i] * vecB[i];
    }

    magnitudeA = Math.sqrt(magnitudeA);
    magnitudeB = Math.sqrt(magnitudeB);

    return magnitudeA && magnitudeB ? dotProduct / (magnitudeA * magnitudeB) : 0;
}

async function validateReasoningStep(step, knowledge, base44) {
    const validation = await base44.integrations.Core.InvokeLLM({
        prompt: `Validate this reasoning step:

Reasoning: ${step.reasoning}
Conclusion: ${step.new_hypothesis}
Knowledge Used: ${knowledge.map(k => k.title).join(', ')}

Is this reasoning step:
1. Logically sound?
2. Supported by the knowledge?
3. Free from logical fallacies?
4. A valid inference?`,
        response_json_schema: {
            type: "object",
            properties: {
                is_valid: { type: "boolean" },
                logical_soundness: { type: "number" },
                evidence_support: { type: "number" },
                fallacies_detected: { type: "array", items: { type: "string" } },
                reasoning: { type: "string" }
            }
        }
    });

    return validation;
}