import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { model, prompt, system_message, temperature = 0.7, max_tokens = 4000 } = await req.json();
        
        const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
        if (!apiKey) {
            return Response.json({ error: 'Anthropic API key not configured' }, { status: 500 });
        }

        const startTime = Date.now();
        let modelUsed = model || 'claude-3-sonnet-20240229';
        
        // Map model names to Anthropic's naming convention
        const modelMap = {
            'claude-3-opus': 'claude-3-opus-20240229',
            'claude-3-sonnet': 'claude-3-sonnet-20240229',
            'claude-3-haiku': 'claude-3-haiku-20240307',
            'claude-2': 'claude-2.1'
        };
        
        modelUsed = modelMap[modelUsed] || modelUsed;
        
        const messages = [{ role: "user", content: prompt }];
        
        const requestBody = {
            model: modelUsed,
            max_tokens: max_tokens,
            temperature: temperature,
            messages: messages
        };
        
        if (system_message) {
            requestBody.system = system_message;
        }
        
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'x-api-key': apiKey,
                'Content-Type': 'application/json',
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify(requestBody)
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            return Response.json({
                success: false,
                error: data.error?.message || 'Anthropic API error',
                model: modelUsed
            }, { status: response.status });
        }
        
        return Response.json({
            success: true,
            model: modelUsed,
            response: data.content?.[0]?.text || 'No response generated',
            usage: data.usage,
            processing_time_ms: Date.now() - startTime,
            provider: 'Anthropic',
            type: 'text'
        });
        
    } catch (error) {
        return Response.json({
            success: false,
            error: error.message,
            provider: 'Anthropic'
        }, { status: 500 });
    }
});