import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { model, prompt, system_message, temperature = 0.7, max_tokens = 4000, image_url, audio_url } = await req.json();
        
        const apiKey = Deno.env.get("OPENAI_API_KEY");
        if (!apiKey) {
            return Response.json({ error: 'OpenAI API key not configured' }, { status: 500 });
        }

        const startTime = Date.now();
        
        // Handle different OpenAI model types
        let response;
        let modelUsed = model || 'gpt-4-turbo';
        
        if (model === 'dall-e-3' || model === 'dall-e-2') {
            // Image generation
            response = await fetch('https://api.openai.com/v1/images/generations', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: model,
                    prompt: prompt,
                    n: 1,
                    size: "1024x1024",
                    quality: "standard"
                })
            });
            
            const imageData = await response.json();
            return Response.json({
                success: true,
                model: modelUsed,
                response: imageData.data?.[0]?.url || 'Image generation failed',
                type: 'image',
                processing_time_ms: Date.now() - startTime,
                provider: 'OpenAI'
            });
            
        } else if (model === 'whisper-1') {
            // Audio transcription (would need audio file handling)
            return Response.json({
                success: false,
                error: 'Audio processing not implemented in this demo',
                model: modelUsed
            });
            
        } else if (model?.includes('gpt-4-vision') || image_url) {
            // Vision model
            const messages = [
                {
                    role: "user",
                    content: [
                        { type: "text", text: prompt },
                        ...(image_url ? [{ type: "image_url", image_url: { url: image_url } }] : [])
                    ]
                }
            ];
            
            response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'gpt-4-vision-preview',
                    messages: messages,
                    max_tokens: max_tokens,
                    temperature: temperature
                })
            });
            
        } else {
            // Standard chat completion
            const messages = [];
            if (system_message) {
                messages.push({ role: "system", content: system_message });
            }
            messages.push({ role: "user", content: prompt });
            
            response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: modelUsed,
                    messages: messages,
                    temperature: temperature,
                    max_tokens: max_tokens
                })
            });
        }
        
        const data = await response.json();
        
        if (!response.ok) {
            return Response.json({
                success: false,
                error: data.error?.message || 'OpenAI API error',
                model: modelUsed
            }, { status: response.status });
        }
        
        return Response.json({
            success: true,
            model: modelUsed,
            response: data.choices?.[0]?.message?.content || data.choices?.[0]?.text || 'No response generated',
            usage: data.usage,
            processing_time_ms: Date.now() - startTime,
            provider: 'OpenAI',
            type: 'text'
        });
        
    } catch (error) {
        return Response.json({
            success: false,
            error: error.message,
            provider: 'OpenAI'
        }, { status: 500 });
    }
});