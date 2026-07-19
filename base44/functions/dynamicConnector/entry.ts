import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// DYNAMIC CONNECTOR - Self-expanding integration system
// Wednesday analyzes what you need and builds the connector herself

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { action, service_name, service_type, user_intent } = await req.json();

        if (action === 'discover') {
            // Analyze what service is needed and how to connect
            return await discoverService(base44, service_name, service_type, user_intent);
        }

        if (action === 'create') {
            // Generate the integration code
            return await createConnector(base44, service_name, service_type);
        }

        if (action === 'list') {
            // List all connected services
            const services = await base44.asServiceRole.entities.ConnectedService.filter({});
            return Response.json({ success: true, services });
        }

        return Response.json({ error: 'Invalid action' }, { status: 400 });

    } catch (error) {
        return Response.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
});

async function discoverService(base44, serviceName, serviceType, userIntent) {
    // Use AI to research the service's API
    const research = await base44.integrations.Core.InvokeLLM({
        prompt: `Research ${serviceName} API integration for: ${userIntent}

Provide a detailed technical analysis:
1. Does ${serviceName} have a public API?
2. What authentication method (OAuth, API Key, etc.)?
3. What endpoints would handle: ${userIntent}
4. Is there a simpler alternative (web scraping, email parsing)?
5. Estimated complexity (1-10)

Be specific and technical. Include actual API documentation if found.`,
        add_context_from_internet: true,
        response_json_schema: {
            type: "object",
            properties: {
                has_api: { type: "boolean" },
                auth_method: { type: "string" },
                required_endpoints: { type: "array", items: { type: "string" } },
                alternative_approach: { type: "string" },
                complexity: { type: "number" },
                documentation_url: { type: "string" },
                implementation_notes: { type: "string" }
            }
        }
    });

    return Response.json({
        success: true,
        service: serviceName,
        analysis: research,
        ready_to_build: research.has_api || research.alternative_approach,
        next_step: research.has_api ? 'Create OAuth/API Key connector' : 'Use alternative method'
    });
}

async function createConnector(base44, serviceName, serviceType) {
    // Generate the actual integration code using AI
    const functionName = serviceName.toLowerCase().replace(/[^a-z0-9]/g, '') + 'Integration';
    
    const codeGeneration = await base44.integrations.Core.InvokeLLM({
        prompt: `Generate a complete Deno backend function for ${serviceName} integration.

Requirements:
- Function name: ${functionName}
- Use Deno.serve pattern
- Handle authentication (API key from environment)
- Support common operations for ${serviceType} service
- Include error handling
- Use fetch API for HTTP requests
- Return structured JSON responses

Generate production-ready code with comments.`,
        add_context_from_internet: true
    });

    // Store the connector metadata
    const connector = await base44.asServiceRole.entities.ConnectedService.create({
        service_name: serviceName,
        service_type: serviceType,
        function_name: functionName,
        capabilities: ['purchase', 'order', 'book', 'schedule'],
        status: 'active'
    });

    return Response.json({
        success: true,
        connector_id: connector.id,
        function_name: functionName,
        generated_code: codeGeneration,
        status: 'Generated - Ready for deployment',
        instructions: `Deploy this function to functions/${functionName}.js and set required secrets`
    });
}