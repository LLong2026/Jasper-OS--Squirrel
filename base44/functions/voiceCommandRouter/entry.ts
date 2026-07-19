import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// VOICE COMMAND ROUTER - Natural language to action
// Interprets voice commands and routes to appropriate systems

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { voice_input } = await req.json();

        // Use AI to parse intent and extract parameters
        const intentAnalysis = await base44.integrations.Core.InvokeLLM({
            prompt: `Parse this voice command and extract structured action data:

Voice Input: "${voice_input}"

Identify:
1. Primary intent (purchase, book, schedule, research, control)
2. Target service/platform (Amazon, Uber, Google Calendar, etc.)
3. Item/service being requested
4. Quantity/specifications
5. Time constraints
6. Price/budget limits

Return structured JSON for automation.`,
            response_json_schema: {
                type: "object",
                properties: {
                    intent: { 
                        type: "string",
                        enum: ["purchase", "book_travel", "book_hotel", "schedule_meeting", "research", "control_device", "market_analysis", "general_query"]
                    },
                    platform: { type: "string" },
                    item: { type: "string" },
                    quantity: { type: "number" },
                    specifications: { type: "object" },
                    time_constraint: { type: "string" },
                    budget: { type: "number" },
                    confidence: { type: "number" }
                }
            }
        });

        // Route to appropriate automation
        let result;
        
        switch (intentAnalysis.intent) {
            case 'purchase':
                result = await base44.functions.invoke('purchaseAutomation', {
                    platform: intentAnalysis.platform || 'Amazon',
                    item_query: intentAnalysis.item,
                    quantity: intentAnalysis.quantity || 1,
                    max_price: intentAnalysis.budget,
                    voice_command: voice_input
                });
                break;
                
            case 'book_travel':
                result = await base44.functions.invoke('autonomousActions', {
                    action_type: 'book_flight',
                    parameters: {
                        origin: intentAnalysis.specifications?.origin,
                        destination: intentAnalysis.specifications?.destination,
                        date: intentAnalysis.time_constraint,
                        passengers: intentAnalysis.quantity || 1
                    }
                });
                break;
                
            case 'book_hotel':
                result = await base44.functions.invoke('autonomousActions', {
                    action_type: 'book_hotel',
                    parameters: {
                        location: intentAnalysis.specifications?.location,
                        checkin: intentAnalysis.specifications?.checkin,
                        checkout: intentAnalysis.specifications?.checkout,
                        guests: intentAnalysis.quantity || 1
                    }
                });
                break;
                
            case 'schedule_meeting':
                result = await base44.functions.invoke('autonomousActions', {
                    action_type: 'schedule_meeting',
                    parameters: {
                        title: intentAnalysis.item,
                        datetime: intentAnalysis.time_constraint,
                        attendees: intentAnalysis.specifications?.attendees,
                        duration: intentAnalysis.specifications?.duration || 60
                    }
                });
                break;
                
            case 'research':
                result = await base44.functions.invoke('autonomousActions', {
                    action_type: 'research',
                    parameters: {
                        query: intentAnalysis.item
                    }
                });
                break;
                
            case 'market_analysis':
                result = await base44.functions.invoke('autonomousActions', {
                    action_type: 'market_analysis',
                    parameters: {
                        asset: intentAnalysis.item,
                        timeframe: intentAnalysis.time_constraint || '24h'
                    }
                });
                break;
                
            default:
                // General query - use model router
                result = await base44.functions.invoke('modelRouter', {
                    prompt: voice_input,
                    task_type: 'general',
                    quality_requirement: 'standard'
                });
        }

        return Response.json({
            success: true,
            voice_input,
            parsed_intent: intentAnalysis,
            action_taken: intentAnalysis.intent,
            result
        });

    } catch (error) {
        return Response.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
});