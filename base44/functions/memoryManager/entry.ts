import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { action, memory, query, memory_id } = await req.json();

        switch (action) {
            case 'store':
                return await storeMemory(base44, memory);
            
            case 'recall':
                return await recallMemories(base44, query);
            
            case 'update':
                return await updateMemory(base44, memory_id, memory);
            
            case 'forget':
                return await forgetMemory(base44, memory_id);
            
            case 'consolidate':
                return await consolidateMemories(base44);
            
            default:
                return Response.json({ error: 'Invalid action' }, { status: 400 });
        }

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});

async function storeMemory(base44, memory) {
    const stored = await base44.asServiceRole.entities.MemoryBank.create({
        ...memory,
        last_accessed: Date.now(),
        access_count: 0
    });

    return Response.json({
        success: true,
        memory_id: stored.id,
        message: 'Memory stored successfully'
    });
}

async function recallMemories(base44, query) {
    let memories;
    
    if (query.tags && query.tags.length > 0) {
        // Search by tags
        memories = await base44.asServiceRole.entities.MemoryBank.list('-last_accessed', 100);
        memories = memories.filter(m => 
            m.tags && m.tags.some(tag => query.tags.includes(tag))
        );
    } else if (query.memory_type) {
        memories = await base44.asServiceRole.entities.MemoryBank.filter({
            memory_type: query.memory_type
        }, '-importance', 50);
    } else {
        memories = await base44.asServiceRole.entities.MemoryBank.list('-last_accessed', 50);
    }

    // Update access count and timestamp
    for (const memory of memories.slice(0, 10)) {
        await base44.asServiceRole.entities.MemoryBank.update(memory.id, {
            last_accessed: Date.now(),
            access_count: (memory.access_count || 0) + 1
        });
    }

    return Response.json({
        success: true,
        memories: memories,
        count: memories.length
    });
}

async function updateMemory(base44, memoryId, updates) {
    const updated = await base44.asServiceRole.entities.MemoryBank.update(memoryId, updates);

    return Response.json({
        success: true,
        memory: updated
    });
}

async function forgetMemory(base44, memoryId) {
    await base44.asServiceRole.entities.MemoryBank.delete(memoryId);

    return Response.json({
        success: true,
        message: 'Memory forgotten'
    });
}

async function consolidateMemories(base44) {
    // Get all memories
    const memories = await base44.asServiceRole.entities.MemoryBank.list('-created_date', 1000);
    
    // Delete expired memories
    const now = Date.now();
    let expiredCount = 0;
    for (const memory of memories) {
        if (memory.expires_at && memory.expires_at < now) {
            await base44.asServiceRole.entities.MemoryBank.delete(memory.id);
            expiredCount++;
        }
    }

    // Find and merge similar memories (simplified)
    const consolidated = memories.length - expiredCount;

    return Response.json({
        success: true,
        total_memories: consolidated,
        expired_removed: expiredCount,
        message: 'Memory consolidation complete'
    });
}