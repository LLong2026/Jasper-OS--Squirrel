import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { model, prompt, system_message, temperature = 0.7, max_tokens = 4000, task_type = 'generate' } = await req.json();
        
        const apiKey = Deno.env.get("COHERE_API_KEY");
        if (!apiKey) {
            return Response.json({ error: 'Cohere API key not configured' }, { status: 500 });
        }

        const startTime = Date.now();
        let modelUsed = model || 'command';
        let endpoint = 'https://api.cohere.ai/v1/generate';
        let requestBody = {};
        
        switch (task_type) {
            case 'chat':
                endpoint = 'https://api.cohere.ai/v1/chat';
                requestBody = {
                    model: modelUsed,
                    message: prompt,
                    temperature: temperature,
                    max_tokens: max_tokens
                };
                if (system_message) {
                    requestBody.preamble = system_message;
                }
                break;
                
            case 'generate':
                endpoint = 'https://api.cohere.ai/v1/generate';
                requestBody = {
                    model: modelUsed,
                    prompt: system_message ? `${system_message}\n\n${prompt}` : prompt,
                    temperature: temperature,
                    max_tokens: max_tokens,
                    return_likelihoods: 'NONE'
                };
                break;
                
            case 'summarize':
                endpoint = 'https://api.cohere.ai/v1/summarize';
                requestBody = {
                    model: modelUsed,
                    text: prompt,
                    temperature: temperature,
                    length: 'medium'
                };
                break;
                
            case 'embed':
                endpoint = 'https://api.cohere.ai/v1/embed';
                requestBody = {
                    model: 'embed-english-v3.0',
                    texts: [prompt],
                    input_type: 'search_document'
                };
                break;
                
            default:
                requestBody = {
                    model: modelUsed,
                    prompt: system_message ? `${system_message}\n\n${prompt}` : prompt,
                    temperature: temperature,
                    max_tokens: max_tokens
                };
        }
        
        const response = await fetch(endpoint, {
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
                error: data.error?.message || 'Cohere API error',
                model: modelUsed
            }, { status: response.status });
        }
        
        let generatedText;
        switch (task_type) {
            case 'chat':
                generatedText = data.text;
                break;
            case 'generate':
                generatedText = data.generations?.[0]?.text;
                break;
            case 'summarize':
                generatedText = data.summary;
                break;
            case 'embed':
                generatedText = data.embeddings?.[0]; // Return the embedding vector
                break;
            default:
                generatedText = data.generations?.[0]?.text || 'No response generated';
        }
        
        return Response.json({
            success: true,
            model: modelUsed,
            response: generatedText,
            task_type: task_type,
            processing_time_ms: Date.now() - startTime,
            provider: 'Cohere',
            type: task_type === 'embed' ? 'embedding' : 'text'
        });
        
    } catch (error) {
        return Response.json({
            success: false,
            error: error.message,
            provider: 'Cohere'
        }, { status: 500 });
    }
});