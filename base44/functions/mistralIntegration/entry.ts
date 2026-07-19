import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { model, prompt, system_message, temperature = 0.7, max_tokens = 4000 } = await req.json();
        
        const apiKey = Deno.env.get("MISTRAL_API_KEY");
        if (!apiKey) {
            return Response.json({ error: 'Mistral API key not configured' }, { status: 500 });
        }

        const startTime = Date.now();
        let modelUsed = model || 'mixtral-8x7b-instruct';
        
        // Map model names
        const modelMap = {
            'mixtral': 'mixtral-8x7b-instruct',
            'mistral-small': 'mistral-small-latest',
            'mistral-medium': 'mistral-medium-latest',
            'mistral-large': 'mistral-large-latest'
        };
        
        modelUsed = modelMap[modelUsed] || modelUsed;
        
        const messages = [];
        if (system_message) {
            messages.push({ role: "system", content: system_message });
        }
        messages.push({ role: "user", content: prompt });
        
        const requestBody = {
            model: modelUsed,
            messages: messages,
            temperature: temperature,
            max_tokens: max_tokens,
            top_p: 1,
            stream: false
        };
        
        const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            return Response.json({
                success: false,
                error: data.error?.message || 'Mistral API error',
                model: modelUsed
            }, { status: response.status });
        }
        
        return Response.json({
            success: true,
            model: modelUsed,
            response: data.choices?.[0]?.message?.content || 'No response generated',
            usage: data.usage,
            processing_time_ms: Date.now() - startTime,
            provider: 'Mistral',
            type: 'text'
        });
        
    } catch (error) {
        return Response.json({
            success: false,
            error: error.message,
            provider: 'Mistral'
        }, { status: 500 });
    }
});