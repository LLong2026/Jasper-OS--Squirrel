import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { action, query, context } = await req.json();

        switch (action) {
            case 'searchWeb': {
                // Use the built-in web search capability through the base44 SDK
                const searchResults = await base44.integrations.Core.InvokeLLM({
                    prompt: `Research and provide current information about: ${query}. Context: ${context || 'General inquiry'}`,
                    add_context_from_internet: true,
                    response_json_schema: {
                        type: "object",
                        properties: {
                            summary: { type: "string" },
                            key_findings: { type: "array", items: { type: "string" } },
                            sources: { type: "array", items: { type: "string" } },
                            last_updated: { type: "string" }
                        }
                    }
                });

                return Response.json({
                    success: true,
                    results: searchResults,
                    timestamp: new Date().toISOString()
                });
            }

            case 'getNews': {
                const newsResults = await base44.integrations.Core.InvokeLLM({
                    prompt: `Get the latest news about: ${query}. Provide current, factual information with sources.`,
                    add_context_from_internet: true,
                    response_json_schema: {
                        type: "object",
                        properties: {
                            headlines: { type: "array", items: { type: "string" } },
                            articles: { 
                                type: "array", 
                                items: {
                                    type: "object",
                                    properties: {
                                        title: { type: "string" },
                                        summary: { type: "string" },
                                        source: { type: "string" },
                                        timestamp: { type: "string" }
                                    }
                                }
                            }
                        }
                    }
                });

                return Response.json({
                    success: true,
                    news: newsResults,
                    retrieved_at: new Date().toISOString()
                });
            }

            case 'factCheck': {
                const factCheckResults = await base44.integrations.Core.InvokeLLM({
                    prompt: `Fact-check this statement with current, reliable sources: "${query}"`,
                    add_context_from_internet: true,
                    response_json_schema: {
                        type: "object",
                        properties: {
                            accuracy_score: { type: "number" },
                            verdict: { type: "string" },
                            evidence: { type: "array", items: { type: "string" } },
                            sources: { type: "array", items: { type: "string" } }
                        }
                    }
                });

                return Response.json({
                    success: true,
                    fact_check: factCheckResults,
                    checked_at: new Date().toISOString()
                });
            }

            default:
                return Response.json({ error: 'Invalid action' }, { status: 400 });
        }
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});