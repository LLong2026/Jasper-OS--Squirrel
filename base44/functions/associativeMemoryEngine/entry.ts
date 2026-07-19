import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { action, ...params } = await req.json();

        switch (action) {
            case 'associative_recall':
                return Response.json(await associativeRecall(base44, params));
            case 'surface_forgotten':
                return Response.json(await surfaceForgottenMemories(base44, params));
            case 'link_memories':
                return Response.json(await linkMemories(base44, params));
            case 'curate_memory':
                return Response.json(await curateMemory(base44, params));
            case 'get_memory_network':
                return Response.json(await getMemoryNetwork(base44, params));
            default:
                return Response.json({ error: 'Invalid action' }, { status: 400 });
        }

    } catch (error) {
        console.error('Associative Memory Error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});

// Smart contextual memory recall using embeddings and semantic similarity
async function associativeRecall(base44, { context, agent_name, limit = 10 }) {
    const allMemories = await base44.asServiceRole.entities.GlobalMemory.list();
    
    // Extract contextual cues
    const contextTokens = extractContextTokens(context);
    
    // Score each memory by relevance
    const scoredMemories = allMemories.map(memory => {
        let score = memory.confidence_score || 0;
        
        // Boost by access patterns
        score += (memory.access_count || 0) * 0.1;
        score += (memory.reinforcement_count || 1) * 0.2;
        
        // Decay over time if not accessed
        const daysSinceAccess = memory.last_accessed 
            ? (Date.now() - memory.last_accessed) / (1000 * 60 * 60 * 24)
            : 999;
        score -= daysSinceAccess * (memory.decay_rate || 0);
        
        // Semantic matching with context
        const semanticScore = calculateSemanticMatch(memory, contextTokens);
        score += semanticScore * 2;
        
        // Boost if from same agent
        if (memory.source_agent === agent_name) {
            score += 1;
        }
        
        return { ...memory, relevance_score: Math.max(0, score) };
    });
    
    // Sort by relevance and return top results
    const topMemories = scoredMemories
        .sort((a, b) => b.relevance_score - a.relevance_score)
        .slice(0, limit);
    
    // Update access counts and timestamps
    await Promise.all(topMemories.map(mem => 
        base44.asServiceRole.entities.GlobalMemory.update(mem.id, {
            access_count: (mem.access_count || 0) + 1,
            last_accessed: Date.now()
        })
    ));
    
    return {
        memories: topMemories,
        context_analyzed: contextTokens.length,
        total_searched: allMemories.length
    };
}

// Surface forgotten but potentially relevant memories
async function surfaceForgottenMemories(base44, { current_context, time_threshold_days = 30 }) {
    const allMemories = await base44.asServiceRole.entities.GlobalMemory.list();
    const thresholdMs = time_threshold_days * 24 * 60 * 60 * 1000;
    const now = Date.now();
    
    // Find under-accessed memories
    const forgottenMemories = allMemories.filter(mem => {
        const timeSinceAccess = mem.last_accessed ? now - mem.last_accessed : Infinity;
        const isOld = timeSinceAccess > thresholdMs;
        const isUnderAccessed = (mem.access_count || 0) < 3;
        const hasHighConfidence = (mem.confidence_score || 0) > 0.7;
        
        return isOld && isUnderAccessed && hasHighConfidence;
    });
    
    // Score by potential relevance to current context
    const contextTokens = extractContextTokens(current_context);
    const relevantForgotten = forgottenMemories.map(mem => ({
        ...mem,
        rediscovery_score: calculateSemanticMatch(mem, contextTokens) + (mem.confidence_score || 0)
    }))
    .filter(mem => mem.rediscovery_score > 0.5)
    .sort((a, b) => b.rediscovery_score - a.rediscovery_score)
    .slice(0, 5);
    
    return {
        forgotten_memories: relevantForgotten,
        total_forgotten: forgottenMemories.length,
        resurfaced: relevantForgotten.length
    };
}

// Create associative links between memories
async function linkMemories(base44, { memory_id, related_memory_ids, link_strength = 1.0, reason }) {
    const memory = await base44.asServiceRole.entities.GlobalMemory.filter({ id: memory_id });
    if (!memory || memory.length === 0) {
        throw new Error('Memory not found');
    }
    
    const currentMemory = memory[0];
    const existingLinks = currentMemory.related_memories || [];
    
    // Add new links (avoid duplicates)
    const newLinks = [...new Set([...existingLinks, ...related_memory_ids])];
    
    // Update primary memory
    await base44.asServiceRole.entities.GlobalMemory.update(memory_id, {
        related_memories: newLinks
    });
    
    // Create bidirectional links
    await Promise.all(related_memory_ids.map(async (relatedId) => {
        const relatedMemory = await base44.asServiceRole.entities.GlobalMemory.filter({ id: relatedId });
        if (relatedMemory && relatedMemory.length > 0) {
            const relatedLinks = relatedMemory[0].related_memories || [];
            if (!relatedLinks.includes(memory_id)) {
                await base44.asServiceRole.entities.GlobalMemory.update(relatedId, {
                    related_memories: [...relatedLinks, memory_id]
                });
            }
        }
    }));
    
    // Log the linking event
    await base44.asServiceRole.entities.GlobalMemory.create({
        memory_type: 'pattern',
        content: {
            type: 'memory_association',
            primary_memory: memory_id,
            linked_memories: related_memory_ids,
            reason,
            link_strength,
            timestamp: Date.now()
        },
        source_agent: 'AssociativeEngine',
        confidence_score: link_strength,
        tags: ['meta', 'association', 'pattern']
    });
    
    return {
        success: true,
        memory_id,
        new_links_count: related_memory_ids.length,
        total_links: newLinks.length
    };
}

// Collaborative curation - agents can validate, refine, or challenge memories
async function curateMemory(base44, { memory_id, agent_name, curation_action, updates }) {
    const memory = await base44.asServiceRole.entities.GlobalMemory.filter({ id: memory_id });
    if (!memory || memory.length === 0) {
        throw new Error('Memory not found');
    }
    
    const currentMemory = memory[0];
    
    switch (curation_action) {
        case 'validate':
            // Agent confirms memory is accurate
            await base44.asServiceRole.entities.GlobalMemory.update(memory_id, {
                reinforcement_count: (currentMemory.reinforcement_count || 1) + 1,
                confidence_score: Math.min((currentMemory.confidence_score || 0.5) + 0.1, 1.0),
                last_accessed: Date.now()
            });
            break;
            
        case 'refine':
            // Agent improves memory content
            const refinedContent = {
                ...currentMemory.content,
                ...updates.content,
                refinement_history: [
                    ...(currentMemory.content?.refinement_history || []),
                    { agent: agent_name, timestamp: Date.now(), changes: updates.content }
                ]
            };
            
            await base44.asServiceRole.entities.GlobalMemory.update(memory_id, {
                content: refinedContent,
                confidence_score: Math.min((currentMemory.confidence_score || 0.5) + 0.05, 1.0),
                last_accessed: Date.now()
            });
            break;
            
        case 'challenge':
            // Agent questions memory accuracy
            await base44.asServiceRole.entities.GlobalMemory.update(memory_id, {
                confidence_score: Math.max((currentMemory.confidence_score || 0.5) - 0.15, 0.1),
                content: {
                    ...currentMemory.content,
                    challenges: [
                        ...(currentMemory.content?.challenges || []),
                        { agent: agent_name, timestamp: Date.now(), reason: updates.reason }
                    ]
                }
            });
            break;
            
        case 'enrich':
            // Agent adds additional context or tags
            await base44.asServiceRole.entities.GlobalMemory.update(memory_id, {
                tags: [...new Set([...(currentMemory.tags || []), ...(updates.tags || [])])],
                content: {
                    ...currentMemory.content,
                    enrichments: [
                        ...(currentMemory.content?.enrichments || []),
                        { agent: agent_name, timestamp: Date.now(), data: updates.data }
                    ]
                }
            });
            break;
    }
    
    return {
        success: true,
        memory_id,
        action: curation_action,
        curated_by: agent_name
    };
}

// Get full memory network for visualization
async function getMemoryNetwork(base44, { root_memory_id, depth = 2 }) {
    const visited = new Set();
    const nodes = [];
    const edges = [];
    
    async function traverse(memoryId, currentDepth) {
        if (currentDepth > depth || visited.has(memoryId)) return;
        visited.add(memoryId);
        
        const memory = await base44.asServiceRole.entities.GlobalMemory.filter({ id: memoryId });
        if (!memory || memory.length === 0) return;
        
        const mem = memory[0];
        nodes.push({
            id: mem.id,
            type: mem.memory_type,
            confidence: mem.confidence_score,
            access_count: mem.access_count,
            source: mem.source_agent,
            tags: mem.tags,
            depth: currentDepth
        });
        
        // Traverse related memories
        const relatedIds = mem.related_memories || [];
        for (const relatedId of relatedIds) {
            edges.push({
                from: memoryId,
                to: relatedId,
                strength: 1.0
            });
            
            if (currentDepth < depth) {
                await traverse(relatedId, currentDepth + 1);
            }
        }
    }
    
    await traverse(root_memory_id, 0);
    
    return {
        nodes,
        edges,
        total_nodes: nodes.length,
        total_edges: edges.length
    };
}

// Helper: Extract contextual tokens from text
function extractContextTokens(context) {
    if (!context || typeof context !== 'object') return [];
    
    const tokens = [];
    
    // Extract from various context fields
    if (context.query) tokens.push(...context.query.toLowerCase().split(/\s+/));
    if (context.topic) tokens.push(...context.topic.toLowerCase().split(/\s+/));
    if (context.tags) tokens.push(...context.tags.map(t => t.toLowerCase()));
    if (context.entities) tokens.push(...context.entities.map(e => e.toLowerCase()));
    
    // Remove common words
    const stopWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for'];
    return tokens.filter(t => t.length > 2 && !stopWords.includes(t));
}

// Helper: Calculate semantic match between memory and context
function calculateSemanticMatch(memory, contextTokens) {
    if (contextTokens.length === 0) return 0;
    
    let matches = 0;
    const memoryText = JSON.stringify(memory.content).toLowerCase();
    const memoryTags = (memory.tags || []).map(t => t.toLowerCase());
    
    for (const token of contextTokens) {
        if (memoryText.includes(token)) matches += 1;
        if (memoryTags.some(tag => tag.includes(token))) matches += 2;
    }
    
    return matches / contextTokens.length;
}