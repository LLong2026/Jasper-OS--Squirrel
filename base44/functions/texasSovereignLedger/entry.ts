import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const LEDGER_API_KEY = 'e84c0f2e634f42d2a9d9fad5d46e3e42';
const LEDGER_APP_ID = '695838f446e480d589e752b9';
const LEDGER_BASE_URL = 'https://app.base44.com/api/apps';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { action, entity_id, data, filters, limit } = await req.json();

        const headers = {
            'api_key': LEDGER_API_KEY,
            'Content-Type': 'application/json'
        };

        let response;

        switch (action) {
            case 'list_blocks':
                // GET blocks - limit only, no filtering (do client-side filtering)
                const queryParams = new URLSearchParams();
                if (limit) queryParams.append('limit', limit);
                else queryParams.append('limit', '1000'); // Default to 1000 for comprehensive search

                const listUrl = `${LEDGER_BASE_URL}/${LEDGER_APP_ID}/entities/Block${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
                response = await fetch(listUrl, { headers });
                break;

            case 'get_block':
                // GET single block by ID
                if (!entity_id) {
                    return Response.json({ error: 'entity_id required for get_block' }, { status: 400 });
                }
                const getUrl = `${LEDGER_BASE_URL}/${LEDGER_APP_ID}/entities/Block/${entity_id}`;
                response = await fetch(getUrl, { headers });
                break;

            case 'update_block':
                // PUT to update block
                if (!entity_id || !data) {
                    return Response.json({ error: 'entity_id and data required for update_block' }, { status: 400 });
                }
                const updateUrl = `${LEDGER_BASE_URL}/${LEDGER_APP_ID}/entities/Block/${entity_id}`;
                response = await fetch(updateUrl, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify(data)
                });
                break;

            case 'create_block':
                // POST to create new block
                if (!data) {
                    return Response.json({ error: 'data required for create_block' }, { status: 400 });
                }
                const createUrl = `${LEDGER_BASE_URL}/${LEDGER_APP_ID}/entities/Block`;
                response = await fetch(createUrl, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(data)
                });
                break;

            case 'query_blocks':
                // Advanced query with filterable fields
                // Filterable: height, block_hash, previous_hash, recall_hash, merkle_root, compliance_proof, node_name, uptime
                const queryUrl = `${LEDGER_BASE_URL}/${LEDGER_APP_ID}/entities/Block/query`;
                response = await fetch(queryUrl, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ filters: filters || {}, limit: limit || 50 })
                });
                break;
            
            case 'get_block_by_height':
                // Query block by height number
                if (!filters || !filters.height) {
                    return Response.json({ error: 'height required in filters for get_block_by_height' }, { status: 400 });
                }
                const heightQueryUrl = `${LEDGER_BASE_URL}/${LEDGER_APP_ID}/entities/Block/query`;
                response = await fetch(heightQueryUrl, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ filters: { height: filters.height }, limit: 1 })
                });
                break;

            default:
                return Response.json({ error: 'Invalid action. Use: list_blocks, get_block, update_block, create_block, query_blocks, get_block_by_height' }, { status: 400 });
        }

        if (!response.ok) {
            const errorText = await response.text();
            return Response.json({ 
                error: 'Ledger API error', 
                status: response.status,
                details: errorText 
            }, { status: response.status });
        }

        const result = await response.json();

        return Response.json({
            success: true,
            action,
            data: result,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        return Response.json({ 
            error: error.message,
            stack: error.stack 
        }, { status: 500 });
    }
});