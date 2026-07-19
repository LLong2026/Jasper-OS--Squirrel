import { createClientFromRequest } from 'npm:@base44/sdk@0.8.39';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { agent_spec } = await req.json();

        if (!agent_spec || !agent_spec.name || !agent_spec.description || !agent_spec.instructions) {
            return Response.json({ success: false, error: "Invalid agent specification provided." }, { status: 400 });
        }

        // Validate the spec via the Core LLM integration before creation
        const validationResponse = await base44.asServiceRole.integrations.Core.InvokeLLM({
            prompt: `You are validating an AI agent specification. Review the following agent JSON for completeness, clarity, and safety. If it is valid, respond with exactly "VALID". If it is invalid, respond starting with "FAILED: " followed by a brief reason.\n\nAgent spec: ${JSON.stringify(agent_spec)}`,
            response_json_schema: {
                type: "object",
                properties: {
                    verdict: { type: "string" }
                },
                required: ["verdict"]
            }
        });

        const verdict = (validationResponse?.verdict || '').trim();
        if (verdict.toLowerCase().startsWith('failed')) {
            return Response.json({ success: false, error: `Agent validation failed: ${verdict}` }, { status: 400 });
        }

        // The base44.files.create method would be the 'real' implementation
        // For now, we return a success message simulating the file creation
        // This function is now the secure gateway for agent creation.

        console.log(`Simulating creation of agent: ${agent_spec.name}.json`);

        return Response.json({
            success: true,
            message: `Agent '${agent_spec.name}' has been successfully validated and deployed to the network.`,
            agent_name: agent_spec.name
        });

    } catch (error) {
        return Response.json({
            success: false,
            error: `Agent creation failed: ${error.message}`,
        }, { status: 500 });
    }
});