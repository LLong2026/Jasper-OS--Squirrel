import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { action, url, query } = await req.json();

        const commands = [];

        switch (action) {
            case 'open_url':
                commands.push({
                    type: 'OPEN_URL',
                    url: url,
                    target: '_blank'
                });
                break;

            case 'search_google':
                const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
                commands.push({
                    type: 'OPEN_URL',
                    url: searchUrl,
                    target: '_blank'
                });
                break;

            case 'search_youtube':
                const youtubeUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
                commands.push({
                    type: 'OPEN_URL',
                    url: youtubeUrl,
                    target: '_blank'
                });
                break;

            case 'open_maps':
                const mapsUrl = `https://www.google.com/maps/search/${encodeURIComponent(query)}`;
                commands.push({
                    type: 'OPEN_URL',
                    url: mapsUrl,
                    target: '_blank'
                });
                break;

            default:
                return Response.json({ 
                    error: 'Invalid action. Supported: open_url, search_google, search_youtube, open_maps' 
                }, { status: 400 });
        }

        return Response.json({
            success: true,
            commands: commands,
            message: `Browser command executed: ${action}`
        });

    } catch (error) {
        return Response.json({ 
            error: error.message 
        }, { status: 500 });
    }
});