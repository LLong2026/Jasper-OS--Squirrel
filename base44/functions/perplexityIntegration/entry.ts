import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { model, prompt, system_message, temperature = 0.7, max_tokens = 4000, search_focus = 'internet' } = await req.json();
        
        const apiKey = Deno.env.get("PERPLEXITY_API_KEY");
        if (!apiKey) {
            return Response.json({ error: 'Perplexity API key not configured' }, { status: 500 });
        }

        const startTime = Date.now();
        let modelUsed = model || 'llama-3.1-sonar-small-128k-online';
        
        // Available Perplexity models
        const perplexityModels = {
            'sonar-small-online': 'llama-3.1-sonar-small-128k-online',
            'sonar-large-online': 'llama-3.1-sonar-large-128k-online',
            'sonar-huge-online': 'llama-3.1-sonar-huge-128k-online',
            'sonar-small-chat': 'llama-3.1-sonar-small-128k-chat',
            'sonar-large-chat': 'llama-3.1-sonar-large-128k-chat'
        };
        
        modelUsed = perplexityModels[modelUsed] || modelUsed;
        
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
            return_citations: true,
            search_domain_filter: search_focus === 'academic' ? ["scholar.google.com", "arxiv.org", "pubmed.ncbi.nlm.nih.gov"] : undefined,
            return_images: false
        };
        
        const response = await fetch('https://api.perplexity.ai/chat/completions', {
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
                error: data.error?.message || 'Perplexity API error',
                model: modelUsed
            }, { status: response.status });
        }
        
        return Response.json({
            success: true,
            model: modelUsed,
            response: data.choices?.[0]?.message?.content || 'No response generated',
            citations: data.citations || [],
            usage: data.usage,
            processing_time_ms: Date.now() - startTime,
            provider: 'Perplexity',
            type: 'research'
        });
        
    } catch (error) {
        return Response.json({
            success: false,
            error: error.message,
            provider: 'Perplexity'
        }, { status: 500 });
    }
});