import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Read agents directory to get all agent files
        const agentsPath = './agents';
        const agents = [];

        try {
            for await (const dirEntry of Deno.readDir(agentsPath)) {
                if (dirEntry.isFile && !dirEntry.name.startsWith('.')) {
                    try {
                        const agentData = JSON.parse(
                            await Deno.readTextFile(`${agentsPath}/${dirEntry.name}`)
                        );
                        agents.push({
                            name: agentData.name || dirEntry.name.replace('.json', ''),
                            description: agentData.description || '',
                            avatar: agentData.avatar,
                            tool_count: agentData.tool_configs?.length || 0
                        });
                    } catch (parseError) {
                        console.error(`Error parsing agent file ${dirEntry.name}:`, parseError);
                    }
                }
            }
        } catch (readError) {
            console.error('Error reading agents directory:', readError);
        }

        return Response.json({
            success: true,
            agents: agents
        });

    } catch (error) {
        console.error('Error listing agents:', error);
        return Response.json({ 
            error: error.message || 'Failed to list agents' 
        }, { status: 500 });
    }
});