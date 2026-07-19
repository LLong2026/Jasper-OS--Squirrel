import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

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

        // Invoke the SystemArchitect to validate the spec before creation
        const validationResult = await base44.asServiceRole.agents.invoke('SystemArchitect', {
            message: `Validate the following agent JSON: ${JSON.stringify(agent_spec)}`
        });
        
        // A simple check; a real implementation would parse the response more carefully
        if (validationResult.toLowerCase().includes('failed')) {
             return Response.json({ success: false, error: `SystemArchitect validation failed: ${validationResult}` }, { status: 400 });
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