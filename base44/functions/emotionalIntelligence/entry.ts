import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { action, message, conversation_history } = await req.json();

        switch (action) {
            case 'analyze_sentiment':
                return await analyzeSentiment(base44, message, conversation_history);
            
            case 'recommend_tone':
                return await recommendTone(base44, message);
            
            case 'detect_emotions':
                return await detectEmotions(message);
            
            case 'get_context_history':
                return await getContextHistory(base44);
            
            default:
                return Response.json({ error: 'Invalid action' }, { status: 400 });
        }

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});

async function analyzeSentiment(base44, message, history) {
    // Analyze message for emotional content
    const emotions = [];
    const stressIndicators = [];
    
    // Positive indicators
    if (message.match(/great|awesome|excellent|love|perfect|fantastic|amazing/i)) {
        emotions.push('excited', 'happy');
    }
    
    // Negative indicators
    if (message.match(/frustrated|annoyed|confused|stuck|problem|issue|error|broken/i)) {
        emotions.push('frustrated');
        stressIndicators.push('problem_keywords');
    }
    
    // Question marks suggest confusion
    if ((message.match(/\?/g) || []).length > 2) {
        emotions.push('confused');
    }
    
    // Exclamation points suggest excitement or frustration
    if ((message.match(/!/g) || []).length > 2) {
        emotions.push('intense');
    }
    
    // All caps suggests urgency or anger
    if (message === message.toUpperCase() && message.length > 10) {
        emotions.push('urgent');
        stressIndicators.push('all_caps');
    }

    // Determine overall sentiment
    let sentiment = 'neutral';
    if (emotions.includes('happy') || emotions.includes('excited')) {
        sentiment = 'positive';
    } else if (emotions.includes('frustrated') || emotions.includes('urgent')) {
        sentiment = 'negative';
    }

    // Determine energy level (0-10)
    const energyLevel = emotions.includes('excited') ? 8 : 
                       emotions.includes('frustrated') ? 7 :
                       emotions.includes('confused') ? 3 : 5;

    // Store emotional context
    const context = await base44.asServiceRole.entities.EmotionalContext.create({
        sentiment,
        emotions_detected: emotions,
        energy_level: energyLevel,
        stress_indicators: stressIndicators,
        conversation_context: { message_length: message.length },
        recommended_tone: determineTone(sentiment, emotions),
        confidence: 0.7
    });

    return Response.json({
        success: true,
        context_id: context.id,
        sentiment,
        emotions,
        energy_level: energyLevel,
        recommended_tone: context.recommended_tone,
        stress_level: stressIndicators.length > 0 ? 'elevated' : 'normal'
    });
}

async function recommendTone(base44, message) {
    // Get recent emotional contexts
    const recentContexts = await base44.asServiceRole.entities.EmotionalContext.list('-created_date', 5);

    // Analyze pattern
    const avgSentiment = recentContexts.reduce((sum, ctx) => {
        const score = ctx.sentiment === 'very_positive' ? 2 :
                     ctx.sentiment === 'positive' ? 1 :
                     ctx.sentiment === 'neutral' ? 0 :
                     ctx.sentiment === 'negative' ? -1 : -2;
        return sum + score;
    }, 0) / Math.max(recentContexts.length, 1);

    let tone;
    if (avgSentiment > 0.5) {
        tone = 'playful';
    } else if (avgSentiment < -0.5) {
        tone = 'empathetic';
    } else if (message.match(/urgent|asap|quickly|now/i)) {
        tone = 'direct';
    } else {
        tone = 'casual';
    }

    return Response.json({
        success: true,
        recommended_tone: tone,
        reasoning: `Based on recent interaction patterns`,
        sentiment_trend: avgSentiment > 0 ? 'positive' : avgSentiment < 0 ? 'negative' : 'neutral'
    });
}

async function detectEmotions(message) {
    const detected = [];

    // Joy/excitement
    if (message.match(/haha|lol|😂|🎉|awesome|great|love/i)) {
        detected.push({ emotion: 'joy', confidence: 0.8 });
    }

    // Frustration
    if (message.match(/ugh|damn|frustrated|annoying|wtf/i)) {
        detected.push({ emotion: 'frustration', confidence: 0.85 });
    }

    // Confusion
    if (message.match(/confused|don't understand|not sure|what|huh/i)) {
        detected.push({ emotion: 'confusion', confidence: 0.75 });
    }

    // Curiosity
    if (message.match(/interesting|curious|wonder|how does|why/i)) {
        detected.push({ emotion: 'curiosity', confidence: 0.7 });
    }

    return Response.json({
        success: true,
        emotions: detected,
        dominant_emotion: detected.length > 0 ? detected[0].emotion : 'neutral'
    });
}

async function getContextHistory(base44) {
    const history = await base44.asServiceRole.entities.EmotionalContext.list('-created_date', 20);

    return Response.json({
        success: true,
        history: history,
        summary: {
            total_interactions: history.length,
            avg_sentiment: calculateAvgSentiment(history),
            most_common_emotion: findMostCommonEmotion(history)
        }
    });
}

function determineTone(sentiment, emotions) {
    if (emotions.includes('frustrated')) return 'empathetic';
    if (emotions.includes('confused')) return 'patient';
    if (emotions.includes('excited')) return 'playful';
    if (emotions.includes('urgent')) return 'direct';
    if (sentiment === 'positive') return 'casual';
    return 'professional';
}

function calculateAvgSentiment(contexts) {
    if (contexts.length === 0) return 'neutral';
    
    const scores = contexts.map(ctx => {
        switch (ctx.sentiment) {
            case 'very_positive': return 2;
            case 'positive': return 1;
            case 'neutral': return 0;
            case 'negative': return -1;
            case 'very_negative': return -2;
            default: return 0;
        }
    });

    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    
    if (avg > 0.5) return 'positive';
    if (avg < -0.5) return 'negative';
    return 'neutral';
}

function findMostCommonEmotion(contexts) {
    const emotionCounts = {};
    
    for (const ctx of contexts) {
        for (const emotion of ctx.emotions_detected || []) {
            emotionCounts[emotion] = (emotionCounts[emotion] || 0) + 1;
        }
    }

    const sorted = Object.entries(emotionCounts).sort((a, b) => b[1] - a[1]);
    return sorted.length > 0 ? sorted[0][0] : 'neutral';
}