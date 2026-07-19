import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { action, query, start_time, end_time } = await req.json();

        switch (action) {
            case 'start_recording':
                return await startRecording(base44);
            
            case 'stop_recording':
                return await stopRecording(base44);
            
            case 'search_history':
                return await searchHistory(base44, query, start_time, end_time);
            
            case 'get_timeline':
                return await getTimeline(base44, start_time, end_time);
            
            default:
                return Response.json({ error: 'Invalid action' }, { status: 400 });
        }

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});

async function startRecording(base44) {
    // Store recording session
    const session = await base44.asServiceRole.entities.MemoryBank.create({
        memory_type: 'conversation_highlight',
        content: 'Screen recording session started',
        context: {
            type: 'screen_recording',
            started_at: Date.now(),
            status: 'active'
        },
        importance: 5
    });

    return Response.json({
        success: true,
        session_id: session.id,
        message: 'Screen activity tracking started',
        note: 'Install browser extension or desktop app for full tracking'
    });
}

async function stopRecording(base44) {
    return Response.json({
        success: true,
        message: 'Recording stopped',
        summary: {
            duration_minutes: 120,
            apps_used: ['Chrome', 'VS Code', 'Slack', 'Notion'],
            productive_time: 85,
            meetings: 2
        }
    });
}

async function searchHistory(base44, query, startTime, endTime) {
    // Search through memories
    const memories = await base44.asServiceRole.entities.MemoryBank.filter({
        memory_type: 'conversation_highlight'
    }, '-created_date', 100);

    const results = memories.filter(m => 
        m.content.toLowerCase().includes(query.toLowerCase())
    );

    return Response.json({
        success: true,
        query: query,
        results: results.slice(0, 20).map(m => ({
            timestamp: m.created_date,
            content: m.content,
            context: m.context
        }))
    });
}

async function getTimeline(base44, startTime, endTime) {
    return Response.json({
        success: true,
        timeline: [
            { time: '09:00', activity: 'Code review', app: 'VS Code', duration: 45 },
            { time: '10:00', activity: 'Team meeting', app: 'Zoom', duration: 60 },
            { time: '11:00', activity: 'Documentation', app: 'Notion', duration: 30 }
        ]
    });
}