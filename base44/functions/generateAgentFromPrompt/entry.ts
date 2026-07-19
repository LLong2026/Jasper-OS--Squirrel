import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { agent_name, user_prompt } = await req.json();

        if (!agent_name || !user_prompt) {
            return Response.json({ 
                error: 'Missing required fields: agent_name and user_prompt' 
            }, { status: 400 });
        }

        // Use LLM to generate comprehensive agent specification
        const systemPrompt = `You are an expert AI agent architect. Generate a complete agent specification based on the user's natural language description.

Return a JSON object with this exact structure:
{
  "name": "AgentName",
  "description": "Brief description of the agent's purpose",
  "instructions": "Detailed instructions for the agent's behavior, personality, and capabilities. Be specific and comprehensive. Include personality traits, tone, expertise areas, and how to handle various situations.",
  "tool_configs": [
    {"function_name": "toolName1"},
    {"function_name": "toolName2"}
  ]
}

Available tools you can assign:
- modelRouter: For general AI tasks and reasoning
- imageGeneration: For creating images
- codeGeneration: For writing code
- realTimeWebAccess: For searching the web
- autonomousActions: For executing real-world tasks
- iotIntegration: For IoT device control
- salesforceIntegration: For CRM operations
- gmailIntegration: For email operations
- slackAdvanced: For Slack communication
- notionIntegration: For Notion workspace management
- githubIntegration: For GitHub operations
- quantumDevelopment: For quantum algorithms
- scientificInvention: For novel scientific work

Choose tools that make sense for the agent's purpose. Be thoughtful about tool selection.`;

        const response = await base44.integrations.Core.InvokeLLM({
            prompt: `User wants to create an agent named "${agent_name}" with this description:\n\n${user_prompt}\n\nGenerate a complete agent specification.`,
            response_json_schema: {
                type: "object",
                properties: {
                    name: { type: "string" },
                    description: { type: "string" },
                    instructions: { type: "string" },
                    tool_configs: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                function_name: { type: "string" }
                            }
                        }
                    }
                },
                required: ["name", "description", "instructions", "tool_configs"]
            }
        });

        const agentSpec = {
            name: agent_name,
            description: response.description,
            instructions: response.instructions,
            tool_configs: response.tool_configs || []
        };

        return Response.json({
            success: true,
            agent_spec: agentSpec
        });

    } catch (error) {
        console.error('Error generating agent:', error);
        return Response.json({ 
            error: error.message || 'Failed to generate agent specification' 
        }, { status: 500 });
    }
});