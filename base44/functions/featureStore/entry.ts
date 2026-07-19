import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// FEATURE STORE - Real-time feature extraction and management
// Converts raw data into ML-ready features

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { action, task, context, domain } = await req.json();

        if (action === 'extract') {
            const features = await extractFeatures(task, context, domain);
            return Response.json({
                success: true,
                features,
                complexity_score: calculateComplexity(features)
            });
        }

        return Response.json({ error: 'Invalid action' }, { status: 400 });

    } catch (error) {
        return Response.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
});

async function extractFeatures(task, context, domain) {
    return {
        task_length: task.length,
        task_type: classifyTask(task),
        domain,
        complexity_indicators: {
            has_code: task.toLowerCase().includes('code'),
            has_data: task.toLowerCase().includes('data'),
            has_visual: task.toLowerCase().includes('image') || task.toLowerCase().includes('visual'),
            requires_reasoning: task.toLowerCase().includes('analyze') || task.toLowerCase().includes('explain'),
            requires_realtime: task.toLowerCase().includes('current') || task.toLowerCase().includes('latest')
        },
        sentiment: analyzeSentiment(task),
        urgency: context?.priority || 'normal',
        timestamp: Date.now()
    };
}

function classifyTask(task) {
    const lower = task.toLowerCase();
    if (lower.includes('code') || lower.includes('program')) return 'code_generation';
    if (lower.includes('image') || lower.includes('visual')) return 'visual_generation';
    if (lower.includes('analyze') || lower.includes('explain')) return 'analysis';
    if (lower.includes('create') || lower.includes('generate')) return 'creation';
    if (lower.includes('fix') || lower.includes('repair')) return 'remediation';
    return 'general';
}

function analyzeSentiment(text) {
    const positiveWords = ['good', 'great', 'excellent', 'perfect'];
    const negativeWords = ['bad', 'poor', 'broken', 'failed'];
    
    const lower = text.toLowerCase();
    const positive = positiveWords.filter(w => lower.includes(w)).length;
    const negative = negativeWords.filter(w => lower.includes(w)).length;
    
    if (positive > negative) return 'positive';
    if (negative > positive) return 'negative';
    return 'neutral';
}

function calculateComplexity(features) {
    let score = 5; // Base
    if (features.task_length > 500) score += 2;
    if (features.complexity_indicators.has_code) score += 3;
    if (features.complexity_indicators.requires_reasoning) score += 2;
    if (features.complexity_indicators.requires_realtime) score += 1;
    return Math.min(score, 10);
}