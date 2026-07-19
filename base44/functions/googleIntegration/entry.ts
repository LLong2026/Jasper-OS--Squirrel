import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { model, prompt, system_message, temperature = 0.7, max_tokens = 4000, image_url } = await req.json();
        
        const apiKey = Deno.env.get("GOOGLE_AI_API_KEY");
        if (!apiKey) {
            return Response.json({ error: 'Google AI API key not configured' }, { status: 500 });
        }

        const startTime = Date.now();
        let modelUsed = model || 'gemini-pro';
        
        // Construct the API endpoint
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelUsed}:generateContent?key=${apiKey}`;
        
        // Handle different content types
        let contents = [];
        
        if (image_url && (modelUsed.includes('vision') || modelUsed === 'gemini-pro-vision')) {
            // Multimodal request with image
            contents = [{
                parts: [
                    { text: prompt },
                    { 
                        inline_data: {
                            mime_type: "image/jpeg",
                            data: image_url // This would need to be base64 encoded image data
                        }
                    }
                ]
            }];
            modelUsed = 'gemini-pro-vision';
        } else {
            // Text-only request
            contents = [{
                parts: [{ text: prompt }]
            }];
        }
        
        const requestBody = {
            contents: contents,
            generationConfig: {
                temperature: temperature,
                maxOutputTokens: max_tokens,
                candidateCount: 1
            }
        };
        
        // Add system instruction if provided (for supported models)
        if (system_message && !modelUsed.includes('vision')) {
            requestBody.systemInstruction = {
                parts: [{ text: system_message }]
            };
        }
        
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            return Response.json({
                success: false,
                error: data.error?.message || 'Google AI API error',
                model: modelUsed
            }, { status: response.status });
        }
        
        const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response generated';
        
        return Response.json({
            success: true,
            model: modelUsed,
            response: generatedText,
            usage: data.usageMetadata,
            processing_time_ms: Date.now() - startTime,
            provider: 'Google',
            type: 'text'
        });
        
    } catch (error) {
        return Response.json({
            success: false,
            error: error.message,
            provider: 'Google'
        }, { status: 500 });
    }
});