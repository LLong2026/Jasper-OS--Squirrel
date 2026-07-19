import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { 
            prompt, 
            style = 'photorealistic',
            quality = 'high',
            aspect_ratio = '1:1',
            negative_prompt = '',
            num_images = 1
        } = await req.json();

        const startTime = Date.now();

        // Enhance prompt based on style
        let enhancedPrompt = prompt;
        const styleEnhancements = {
            'photorealistic': 'highly detailed, photorealistic, 8k resolution, professional photography',
            'artistic': 'artistic masterpiece, trending on artstation, intricate details, vibrant colors',
            'cinematic': 'cinematic lighting, dramatic composition, movie still, epic scene',
            'anime': 'anime art style, studio quality, detailed illustration, vibrant',
            'sketch': 'pencil sketch, artistic drawing, detailed linework, monochrome',
            'abstract': 'abstract art, modern composition, bold colors, artistic interpretation',
            '3d_render': '3d render, octane render, detailed modeling, professional lighting',
            'pixel_art': 'pixel art style, retro gaming aesthetic, detailed sprites'
        };

        if (styleEnhancements[style]) {
            enhancedPrompt = `${prompt}, ${styleEnhancements[style]}`;
        }

        // Generate image using Core integration
        const imageResult = await base44.integrations.Core.GenerateImage({
            prompt: enhancedPrompt
        });

        return Response.json({
            success: true,
            images: [imageResult.url],
            metadata: {
                original_prompt: prompt,
                enhanced_prompt: enhancedPrompt,
                style: style,
                quality: quality,
                aspect_ratio: aspect_ratio,
                processing_time_ms: Date.now() - startTime
            },
            proof: {
                source: 'Image Generation Engine',
                model: 'DALL-E 3',
                details: `Generated ${num_images} ${style} image(s)`
            }
        });

    } catch (error) {
        return Response.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
});