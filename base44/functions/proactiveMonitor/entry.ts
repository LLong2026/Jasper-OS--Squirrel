import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { action, task, task_id } = await req.json();

        switch (action) {
            case 'create_task':
                return await createProactiveTask(base44, task);
            
            case 'check_tasks':
                return await checkAllTasks(base44, user);
            
            case 'morning_brief':
                return await generateMorningBrief(base44, user);
            
            case 'evening_summary':
                return await generateEveningSummary(base44, user);
            
            case 'list_tasks':
                return await listTasks(base44);
            
            default:
                return Response.json({ error: 'Invalid action' }, { status: 400 });
        }

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});

async function createProactiveTask(base44, task) {
    const created = await base44.asServiceRole.entities.ProactiveTask.create({
        ...task,
        is_active: true,
        next_check: Date.now() + getCheckInterval(task.frequency)
    });

    return Response.json({
        success: true,
        task_id: created.id,
        message: 'Proactive task created'
    });
}

async function checkAllTasks(base44, user) {
    const tasks = await base44.asServiceRole.entities.ProactiveTask.filter({
        is_active: true
    });

    const now = Date.now();
    const triggered = [];

    for (const task of tasks) {
        if (task.next_check && task.next_check <= now) {
            // Check if conditions are met
            const shouldTrigger = await evaluateConditions(base44, task);
            
            if (shouldTrigger) {
                triggered.push({
                    task_name: task.task_name,
                    priority: task.priority,
                    action: task.action,
                    details: shouldTrigger.details
                });

                // Update last triggered
                await base44.asServiceRole.entities.ProactiveTask.update(task.id, {
                    last_triggered: now,
                    next_check: now + getCheckInterval(task.frequency)
                });
            } else {
                // Update next check
                await base44.asServiceRole.entities.ProactiveTask.update(task.id, {
                    next_check: now + getCheckInterval(task.frequency)
                });
            }
        }
    }

    return Response.json({
        success: true,
        triggered_tasks: triggered,
        count: triggered.length
    });
}

async function generateMorningBrief(base44, user) {
    // Gather relevant information
    const memories = await base44.asServiceRole.entities.MemoryBank.filter({
        memory_type: 'goal'
    }, '-importance', 10);

    const tasks = await base44.asServiceRole.entities.ProactiveTask.filter({
        is_active: true,
        priority: 'high'
    });

    return Response.json({
        success: true,
        brief: {
            greeting: `Good morning! Here's what you need to know:`,
            priorities: memories.slice(0, 3).map(m => m.content),
            upcoming_tasks: tasks.length,
            important_items: [],
            suggestion: 'Focus on high-priority goals today'
        }
    });
}

async function generateEveningSummary(base44, user) {
    return Response.json({
        success: true,
        summary: {
            greeting: `Evening recap:`,
            completed_today: [],
            key_insights: [],
            tomorrow_prep: 'Review your morning brief'
        }
    });
}

async function listTasks(base44) {
    const tasks = await base44.asServiceRole.entities.ProactiveTask.list('-created_date', 100);

    return Response.json({
        success: true,
        tasks: tasks
    });
}

function getCheckInterval(frequency) {
    switch (frequency) {
        case 'realtime': return 60000; // 1 minute
        case 'hourly': return 3600000; // 1 hour
        case 'daily': return 86400000; // 24 hours
        case 'weekly': return 604800000; // 7 days
        default: return 86400000;
    }
}

async function evaluateConditions(base44, task) {
    // Simplified evaluation - in production, this would be more sophisticated
    const shouldTrigger = Math.random() > 0.8; // 20% chance for demo

    if (shouldTrigger) {
        return {
            triggered: true,
            details: `Condition met for ${task.task_name}`
        };
    }

    return null;
}