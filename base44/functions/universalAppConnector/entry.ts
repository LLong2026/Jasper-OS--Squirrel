import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { action, target_app_id, entity_name, operation, data, filters, limit } = await req.json();

        switch (action) {
            case 'discover_apps':
                return await discoverAvailableApps(base44, user);
            
            case 'interact':
                return await interactWithApp(base44, user, target_app_id, entity_name, operation, data, filters, limit);
            
            case 'list_app_entities':
                return await listAppEntities(base44, user, target_app_id);
            
            default:
                return Response.json({ error: 'Invalid action' }, { status: 400 });
        }

    } catch (error) {
        return Response.json({ 
            error: error.message,
            stack: error.stack 
        }, { status: 500 });
    }
});

/**
 * Discover all available Base44 apps the user has access to
 */
async function discoverAvailableApps(base44, user) {
    try {
        const allApps = [];
        
        // 1. Fetch manually connected apps from database
        const connectedApps = await base44.asServiceRole.entities.ConnectedApp.filter({
            is_active: true
        }).catch(() => []);

        for (const app of connectedApps || []) {
            allApps.push({
                app_id: app.app_id,
                name: app.app_name,
                description: app.description || 'No description',
                available_entities: app.available_entities || [],
                connected_date: app.created_date,
                source: 'manual'
            });
        }

        // 2. Auto-discover apps from Base44 platform using LLM with web search
        try {
            const discoveryPrompt = `Search for Base44 apps that user "${user.email}" has access to. Look for any apps, projects, or workspaces this user owns or has been granted access to on the Base44 platform. Return a JSON array of apps with structure:
[{
  "app_id": "...",
  "name": "...",
  "description": "...",
  "available_entities": ["..."]
}]

If no apps found, return empty array [].`;

            const llmResponse = await base44.integrations.Core.InvokeLLM({
                prompt: discoveryPrompt,
                add_context_from_internet: true,
                response_json_schema: {
                    type: 'object',
                    properties: {
                        apps: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    app_id: { type: 'string' },
                                    name: { type: 'string' },
                                    description: { type: 'string' },
                                    available_entities: { type: 'array', items: { type: 'string' } }
                                }
                            }
                        }
                    }
                }
            });

            if (llmResponse && llmResponse.apps && Array.isArray(llmResponse.apps)) {
                for (const app of llmResponse.apps) {
                    // Avoid duplicates
                    if (!allApps.some(a => a.app_id === app.app_id)) {
                        allApps.push({
                            ...app,
                            source: 'auto_discovered'
                        });
                    }
                }
            }
        } catch (discoveryErr) {
            console.warn('Auto-discovery failed:', discoveryErr);
        }

        return Response.json({
            success: true,
            apps: allApps,
            user_email: user.email,
            total_apps: allApps.length,
            sources: {
                manual: allApps.filter(a => a.source === 'manual').length,
                auto_discovered: allApps.filter(a => a.source === 'auto_discovered').length
            }
        });
    } catch (err) {
        return Response.json({ error: err.message }, { status: 500 });
    }
}

/**
 * Interact with any Base44 app
 */
async function interactWithApp(base44, user, appId, entityName, operation, data, filters, limit) {
    try {
        // Check if this is an internal Base44 app (no API key = internal)
        const connectedApp = await base44.asServiceRole.entities.ConnectedApp.filter({ 
            app_id: appId,
            is_active: true 
        });
        
        const isInternal = connectedApp && connectedApp.length > 0 && !connectedApp[0].api_key;
        
        if (isInternal) {
            // Use Base44 SDK directly for internal apps (same user/ecosystem)
            return await interactWithInternalApp(base44, appId, entityName, operation, data, filters, limit);
        }
        
        // External app - requires API key
        let apiKey = Deno.env.get(`APP_${appId}_KEY`);
        
        if (!apiKey && connectedApp && connectedApp.length > 0) {
            apiKey = connectedApp[0].api_key;
        }
        
        if (!apiKey) {
            return Response.json({ 
                error: 'API key required for external app',
                app_id: appId,
                suggestion: `Add api_key to ConnectedApp record for external apps`
            }, { status: 401 });
        }

        const baseUrl = `https://app.base44.com/api/apps/${appId}/entities/${entityName}`;
        const headers = {
            'api_key': apiKey,
            'Content-Type': 'application/json'
        };

        let response;

        switch (operation) {
            case 'list':
                const queryParams = new URLSearchParams();
                if (limit) queryParams.append('limit', limit);
                response = await fetch(`${baseUrl}${queryParams.toString() ? '?' + queryParams.toString() : ''}`, { headers });
                break;

            case 'get':
                if (!data?.id) {
                    return Response.json({ error: 'ID required for get operation' }, { status: 400 });
                }
                response = await fetch(`${baseUrl}/${data.id}`, { headers });
                break;

            case 'create':
                response = await fetch(baseUrl, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(data)
                });
                break;

            case 'update':
                if (!data?.id) {
                    return Response.json({ error: 'ID required for update operation' }, { status: 400 });
                }
                response = await fetch(`${baseUrl}/${data.id}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify(data)
                });
                break;

            case 'query':
                response = await fetch(`${baseUrl}/query`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ filters: filters || {}, limit: limit || 50 })
                });
                break;

            default:
                return Response.json({ error: 'Invalid operation' }, { status: 400 });
        }

        if (!response.ok) {
            const errorText = await response.text();
            return Response.json({ 
                error: 'External app error',
                status: response.status,
                details: errorText 
            }, { status: response.status });
        }

        const result = await response.json();

        return Response.json({
            success: true,
            app_id: appId,
            entity: entityName,
            operation,
            data: result
        });

    } catch (err) {
        return Response.json({ error: err.message }, { status: 500 });
    }
}

/**
 * Interact with internal Base44 apps using SDK
 */
async function interactWithInternalApp(base44, appId, entityName, operation, data, filters, limit) {
    try {
        // For internal apps, use the Base44 SDK directly
        // This assumes entities are accessible within the same ecosystem
        
        const entityAPI = base44.asServiceRole.entities[entityName];
        
        if (!entityAPI) {
            return Response.json({ 
                error: `Entity "${entityName}" not found in internal app`,
                app_id: appId,
                suggestion: 'Check available_entities in ConnectedApp record'
            }, { status: 404 });
        }

        let result;

        switch (operation) {
            case 'list':
                result = await entityAPI.list('-created_date', limit || 50);
                break;

            case 'get':
                if (!data?.id) {
                    return Response.json({ error: 'ID required for get operation' }, { status: 400 });
                }
                result = await entityAPI.filter({ id: data.id });
                result = result[0] || null;
                break;

            case 'create':
                result = await entityAPI.create(data);
                break;

            case 'update':
                if (!data?.id) {
                    return Response.json({ error: 'ID required for update operation' }, { status: 400 });
                }
                result = await entityAPI.update(data.id, data);
                break;

            case 'query':
                result = await entityAPI.filter(filters || {}, '-created_date', limit || 50);
                break;

            default:
                return Response.json({ error: 'Invalid operation' }, { status: 400 });
        }

        return Response.json({
            success: true,
            app_id: appId,
            entity: entityName,
            operation,
            internal: true,
            data: result
        });

    } catch (err) {
        return Response.json({ error: err.message }, { status: 500 });
    }
}

/**
 * List all entities available in a Base44 app
 */
async function listAppEntities(base44, user, appId) {
    try {
        const connectedApp = await base44.asServiceRole.entities.ConnectedApp.filter({ 
            app_id: appId,
            is_active: true 
        });
        
        if (!connectedApp || connectedApp.length === 0) {
            return Response.json({
                success: false,
                app_id: appId,
                error: 'App not found in connected apps'
            }, { status: 404 });
        }

        return Response.json({
            success: true,
            app_id: appId,
            app_name: connectedApp[0].app_name,
            entities: connectedApp[0].available_entities || [],
            description: connectedApp[0].description
        });
    } catch (err) {
        return Response.json({ error: err.message }, { status: 500 });
    }
}