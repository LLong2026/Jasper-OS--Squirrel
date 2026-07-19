import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { action, payload } = await req.json();
        const notionToken = Deno.env.get('NOTION_API_KEY');

        const notionHeaders = {
            'Authorization': `Bearer ${notionToken}`,
            'Content-Type': 'application/json',
            'Notion-Version': '2022-06-28'
        };

        if (action === 'create_page') {
            const { parent_id, title, content } = payload;
            
            const response = await fetch('https://api.notion.com/v1/pages', {
                method: 'POST',
                headers: notionHeaders,
                body: JSON.stringify({
                    parent: { page_id: parent_id },
                    properties: {
                        title: {
                            title: [{ text: { content: title } }]
                        }
                    },
                    children: content
                })
            });

            const result = await response.json();
            
            return Response.json({
                success: true,
                page_id: result.id,
                url: result.url
            });
        }

        if (action === 'query_database') {
            const { database_id, filter, sorts } = payload;
            
            const response = await fetch(`https://api.notion.com/v1/databases/${database_id}/query`, {
                method: 'POST',
                headers: notionHeaders,
                body: JSON.stringify({
                    filter,
                    sorts
                })
            });

            const result = await response.json();
            
            return Response.json({
                success: true,
                results: result.results,
                has_more: result.has_more
            });
        }

        if (action === 'append_blocks') {
            const { page_id, blocks } = payload;
            
            const response = await fetch(`https://api.notion.com/v1/blocks/${page_id}/children`, {
                method: 'PATCH',
                headers: notionHeaders,
                body: JSON.stringify({
                    children: blocks
                })
            });

            const result = await response.json();
            
            return Response.json({
                success: true,
                block_ids: result.results.map(r => r.id)
            });
        }

        return Response.json({ error: 'Invalid action' }, { status: 400 });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});