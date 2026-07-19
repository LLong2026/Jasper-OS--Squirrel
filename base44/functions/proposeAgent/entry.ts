import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { capability_gap } = await req.json();

        if (!capability_gap) {
            return Response.json({ error: "Missing 'capability_gap' parameter." }, { status: 400 });
        }

        // Use the KnowledgeForge agent to design the new agent
        const forgePrompt = `You are KnowledgeForge. Your sole function is to create a new expert agent. The required domain of expertise is: "${capability_gap}".

Your process is:
1.  **Analyze the Domain:** Understand the core knowledge of "${capability_gap}".
2.  **Define the Persona:** Create a suitable camelCase \`name\` for the new agent (e.g., \`mycologyExpert\`).
3.  **Write the Blueprint:** Author a detailed set of \`instructions\` for the new agent.
4.  **Empower with Tools:** Propose a \`tool_configs\` array listing necessary functions. If none are obvious, provide an empty array.
5.  **Output:** Respond with ONLY the complete, raw, and validated JSON object for the new agent. Do not include any other text, markdown, or explanation.`;

        const forgeResponse = await base44.asServiceRole.agents.invoke('KnowledgeForge', {
            message: forgePrompt
        });

        let agentSpec;
        try {
            // The agent should return raw JSON, so parse it.
            agentSpec = JSON.parse(forgeResponse);
        } catch (e) {
            // If parsing fails, the agent might have included extra text. Try to extract from markdown.
            const jsonMatch = forgeResponse.match(/```json\n([\s\S]*?)\n```/);
            if (jsonMatch && jsonMatch[1]) {
                agentSpec = JSON.parse(jsonMatch[1]);
            } else {
                throw new Error("KnowledgeForge did not return valid JSON.");
            }
        }

        // Return a structured response that the frontend can identify
        return Response.json({
            type: 'agent_proposal',
            agent_spec: agentSpec,
            message: `I've identified a gap in my knowledge regarding "${capability_gap}". I have designed a new expert agent to fill this role. Please review the proposal for deployment.`
        });

    } catch (error) {
        return Response.json({ 
            success: false,
            error: `Self-evolution failed: ${error.message}`,
        }, { status: 500 });
    }
});