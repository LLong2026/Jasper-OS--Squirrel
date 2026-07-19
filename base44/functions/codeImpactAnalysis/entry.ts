import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { file_path, new_content, previous_content } = await req.json();

        // Use LLM to analyze code changes
        const analysis = await base44.integrations.Core.InvokeLLM({
            prompt: `Analyze this code modification for potential impact:

File: ${file_path}

${previous_content ? `PREVIOUS VERSION:
\`\`\`
${previous_content.substring(0, 2000)}
\`\`\`

` : ''}NEW VERSION:
\`\`\`
${new_content.substring(0, 2000)}
\`\`\`

Analyze:
1. What functionality changed?
2. Potential breaking changes or risks
3. Performance implications
4. Dependencies affected
5. Testing recommendations
6. Overall risk level (low/medium/high)`,
            response_json_schema: {
                type: "object",
                properties: {
                    functionality_changes: { type: "array", items: { type: "string" } },
                    breaking_changes: { type: "array", items: { type: "string" } },
                    performance_impact: { type: "string" },
                    dependencies_affected: { type: "array", items: { type: "string" } },
                    testing_recommendations: { type: "array", items: { type: "string" } },
                    risk_level: { type: "string", enum: ["low", "medium", "high"] }
                }
            }
        });

        return Response.json(analysis);

    } catch (error) {
        console.error('Code impact analysis error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});