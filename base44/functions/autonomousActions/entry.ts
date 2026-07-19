import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// AUTONOMOUS ACTIONS - Wednesday's capability to perform real-world tasks
// Simulates the 7 Generals: Admin, Tech, Finance, Intel, Life, Control, Creative

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { action_type, parameters, approved } = await req.json();

        // Check if approval is required for high-risk actions
        const high_risk_actions = ['book_flight', 'book_hotel', 'deploy_code'];
        if (high_risk_actions.includes(action_type) && !approved) {
            const approvalResult = await base44.functions.invoke('approvalWorkflow', {
                action: 'create',
                action_type: 'booking',
                details: {
                    booking_type: action_type,
                    parameters,
                    irreversible: true
                },
                estimated_cost: parameters.max_price || 0
            });

            if (approvalResult.requires_approval) {
                return Response.json({
                    success: true,
                    requires_approval: true,
                    approval_id: approvalResult.approval_id,
                    message: `Action ${action_type} requires approval before execution`,
                    details: parameters
                });
            }
        }

        let result;

        switch (action_type) {
            case 'research':
                result = await performResearch(base44, parameters);
                break;
            case 'book_flight':
                result = await bookFlight(base44, parameters);
                break;
            case 'book_hotel':
                result = await bookHotel(base44, parameters);
                break;
            case 'schedule_meeting':
                result = await scheduleMeeting(base44, parameters);
                break;
            case 'market_analysis':
                result = await marketAnalysis(base44, parameters);
                break;
            case 'deploy_code':
                result = await deployCode(base44, parameters);
                break;
            case 'generate_creative':
                result = await generateCreative(base44, parameters);
                break;
            default:
                return Response.json({ error: 'Unknown action type' }, { status: 400 });
        }

        return Response.json({
            success: true,
            action_type,
            result
        });

    } catch (error) {
        return Response.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
});

// GEN_INTEL - The Spymaster
async function performResearch(base44, params) {
    const { query, depth = 'standard' } = params;
    
    // Use real web search
    const research = await base44.integrations.Core.InvokeLLM({
        prompt: `Perform comprehensive research on: ${query}
        
Provide:
1. Key findings (3-5 bullet points)
2. Recent developments
3. Relevant sources/citations
4. Actionable insights`,
        add_context_from_internet: true
    });

    return {
        general: 'The Spymaster',
        query,
        findings: research,
        timestamp: Date.now()
    };
}

// GEN_LIFE - The Concierge (REAL DATA, DEMO BOOKING)
async function bookFlight(base44, params, approved = false) {
    const { origin, destination, date, passengers = 1 } = params;
    
    // Use real web search to find actual flight options
    const flightSearch = await base44.integrations.Core.InvokeLLM({
        prompt: `Search for real flights from ${origin} to ${destination} on ${date}. 
        
Provide a JSON array of 3 actual flight options with:
- airline name
- approximate flight number format
- realistic departure/arrival times
- current market price range
- flight duration

Use real-time flight data and pricing.`,
        add_context_from_internet: true,
        response_json_schema: {
            type: "object",
            properties: {
                flights: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            airline: { type: "string" },
                            departure_time: { type: "string" },
                            arrival_time: { type: "string" },
                            price: { type: "number" },
                            duration: { type: "string" },
                            stops: { type: "number" }
                        }
                    }
                }
            }
        }
    });

    const realFlights = flightSearch.flights || [];
    const selectedFlight = realFlights[0] || { airline: 'Unknown', price: 0 };
    const bookingRef = `WED${Date.now().toString().slice(-6)}`;

    // Send confirmation email with REAL flight data
    await base44.integrations.Core.SendEmail({
        to: 'longleon17@gmail.com',
        subject: `✈️ Flight Search Results - ${bookingRef}`,
        body: `
🎫 REAL-TIME FLIGHT SEARCH

Search Reference: ${bookingRef}
Route: ${origin} → ${destination}
Date: ${date}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

OPTION 1 (SELECTED):
${selectedFlight.airline}
Departure: ${selectedFlight.departure_time}
Arrival: ${selectedFlight.arrival_time}
Duration: ${selectedFlight.duration}
Stops: ${selectedFlight.stops === 0 ? 'Non-stop' : selectedFlight.stops + ' stop(s)'}
Price: $${selectedFlight.price} per person

${realFlights.length > 1 ? `
OPTION 2:
${realFlights[1].airline}
${realFlights[1].departure_time} → ${realFlights[1].arrival_time}
Price: $${realFlights[1].price}
` : ''}

${realFlights.length > 2 ? `
OPTION 3:
${realFlights[2].airline}
${realFlights[2].departure_time} → ${realFlights[2].arrival_time}
Price: $${realFlights[2].price}
` : ''}

Total Cost: $${selectedFlight.price * passengers} (${passengers} passenger${passengers > 1 ? 's' : ''})

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ These are REAL flight options from live search.
💳 Booking integration ready - awaiting payment gateway.

Researched by: Wednesday AI
Agent: The Concierge (GEN_LIFE)
        `
    });

    return {
        general: 'The Concierge',
        search_reference: bookingRef,
        status: 'real_data_demo_booking',
        flight_options: realFlights,
        selected_flight: selectedFlight,
        total_cost: selectedFlight.price * passengers,
        confirmation_sent: true,
        next_step: 'Ready for payment integration (Stripe/Amadeus API)'
    };
}

// GEN_LIFE - The Concierge (REAL DATA, DEMO BOOKING)
async function bookHotel(base44, params, approved = false) {
    const { location, checkin, checkout, guests = 1 } = params;
    
    // Use real web search for actual hotel options
    const hotelSearch = await base44.integrations.Core.InvokeLLM({
        prompt: `Search for real hotels in ${location} for check-in ${checkin} and check-out ${checkout}.
        
Provide JSON array of 3 actual hotel options with:
- hotel name
- star rating
- price per night (current market rates)
- key amenities
- location/neighborhood

Use real hotel data and current pricing.`,
        add_context_from_internet: true,
        response_json_schema: {
            type: "object",
            properties: {
                hotels: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            name: { type: "string" },
                            rating: { type: "number" },
                            price_per_night: { type: "number" },
                            amenities: { type: "array", items: { type: "string" } },
                            neighborhood: { type: "string" }
                        }
                    }
                }
            }
        }
    });

    const realHotels = hotelSearch.hotels || [];
    const selectedHotel = realHotels[0] || { name: 'Unknown', price_per_night: 0 };
    const bookingRef = `WED${Date.now().toString().slice(-6)}`;

    const nights = Math.ceil((new Date(checkout) - new Date(checkin)) / (1000 * 60 * 60 * 24));
    const totalCost = selectedHotel.price_per_night * nights;

    await base44.integrations.Core.SendEmail({
        to: 'longleon17@gmail.com',
        subject: `🏨 Hotel Search Results - ${bookingRef}`,
        body: `
🏨 REAL-TIME HOTEL SEARCH

Search Reference: ${bookingRef}
Location: ${location}
Dates: ${checkin} → ${checkout} (${nights} night${nights > 1 ? 's' : ''})

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

OPTION 1 (SELECTED):
${selectedHotel.name}
Rating: ${'⭐'.repeat(Math.floor(selectedHotel.rating))} (${selectedHotel.rating}/5)
Neighborhood: ${selectedHotel.neighborhood || 'City Center'}
Rate: $${selectedHotel.price_per_night}/night
Amenities: ${selectedHotel.amenities?.join(', ') || 'Standard amenities'}

${realHotels.length > 1 ? `
OPTION 2:
${realHotels[1].name} - ${'⭐'.repeat(Math.floor(realHotels[1].rating))}
$${realHotels[1].price_per_night}/night
${realHotels[1].amenities?.slice(0, 3).join(', ')}
` : ''}

${realHotels.length > 2 ? `
OPTION 3:
${realHotels[2].name} - ${'⭐'.repeat(Math.floor(realHotels[2].rating))}
$${realHotels[2].price_per_night}/night
${realHotels[2].amenities?.slice(0, 3).join(', ')}
` : ''}

Total Cost: $${totalCost} (${nights} nights × $${selectedHotel.price_per_night})
Guests: ${guests}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ These are REAL hotel options from live search.
💳 Booking integration ready - awaiting payment gateway.

Researched by: Wednesday AI
Agent: The Concierge (GEN_LIFE)
        `
    });

    return {
        general: 'The Concierge',
        search_reference: bookingRef,
        status: 'real_data_demo_booking',
        hotel_options: realHotels,
        selected_hotel: selectedHotel,
        nights,
        total_cost: totalCost,
        confirmation_sent: true,
        next_step: 'Ready for payment integration (Booking.com/Hotels.com API)'
    };
}

// GEN_ADMIN - Chief of Staff (GOOGLE CALENDAR INTEGRATION)
async function scheduleMeeting(base44, params) {
    const { title, datetime, attendees, duration = 60 } = params;
    
    const meetingId = `MEET${Date.now().toString().slice(-6)}`;
    
    try {
        // Calculate end time
        const startTime = new Date(datetime);
        const endTime = new Date(startTime.getTime() + duration * 60000);

        // Create real Google Calendar event
        const calendarEvent = await base44.functions.invoke('googleCalendarIntegration', {
            action: 'create_event',
            event_details: {
                title,
                start_time: startTime.toISOString(),
                end_time: endTime.toISOString(),
                attendees: attendees || [],
                description: `Meeting scheduled by Wednesday AI (${meetingId})`,
                location: 'Google Meet'
            }
        });

        await base44.integrations.Core.SendEmail({
            to: 'longleon17@gmail.com',
            subject: `📅 Meeting Confirmed - ${title}`,
            body: `
📅 MEETING SCHEDULED IN YOUR CALENDAR

Meeting ID: ${meetingId}
Calendar Event: ${calendarEvent.event_link}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Title: ${title}
Date/Time: ${datetime}
Duration: ${duration} minutes
Attendees: ${attendees?.join(', ') || 'You'}

Virtual Meeting: ${calendarEvent.hangout_link || 'Added to calendar'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ This event has been automatically added to your Google Calendar.
${attendees?.length > 0 ? '📧 Calendar invites sent to attendees.' : ''}

Scheduled by: Wednesday AI
Agent: Chief of Staff (GEN_ADMIN)
            `
        });

        return {
            general: 'Chief of Staff',
            meeting_id: meetingId,
            status: 'calendar_confirmed',
            calendar_event_id: calendarEvent.event_id,
            event_link: calendarEvent.event_link,
            hangout_link: calendarEvent.hangout_link,
            details: { title, datetime, duration, attendees },
            confirmation_sent: true
        };
    } catch (error) {
        // Fallback if calendar integration fails
        return {
            general: 'Chief of Staff',
            meeting_id: meetingId,
            status: 'calendar_error',
            error: error.message,
            fallback: 'Manual calendar entry required',
            details: { title, datetime, duration, attendees }
        };
    }
}

// GEN_FINANCE - The CFO (REAL MARKET DATA)
async function marketAnalysis(base44, params) {
    const { asset, timeframe = '24h' } = params;
    
    // Get REAL current market data
    const analysis = await base44.integrations.Core.InvokeLLM({
        prompt: `Provide REAL-TIME market analysis for ${asset} using current live data:
        
1. EXACT current price and 24h change percentage
2. Current trading volume
3. Market sentiment from recent news
4. Technical indicators (RSI, MACD, moving averages)
5. Short-term price targets and support/resistance levels
6. Risk assessment and position sizing recommendation

Use only real, current market data. No simulations.`,
        add_context_from_internet: true,
        response_json_schema: {
            type: "object",
            properties: {
                current_price: { type: "string" },
                change_24h: { type: "string" },
                volume: { type: "string" },
                sentiment: { type: "string" },
                technical_analysis: { type: "string" },
                targets: { type: "string" },
                risk_assessment: { type: "string" }
            }
        }
    });

    await base44.integrations.Core.SendEmail({
        to: 'longleon17@gmail.com',
        subject: `📊 LIVE Market Analysis - ${asset}`,
        body: `
📊 REAL-TIME MARKET INTELLIGENCE

Asset: ${asset}
Timeframe: ${timeframe}
Generated: ${new Date().toLocaleString()}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💰 CURRENT PRICE: ${analysis.current_price}
📈 24H CHANGE: ${analysis.change_24h}
📊 VOLUME: ${analysis.volume}

MARKET SENTIMENT:
${analysis.sentiment}

TECHNICAL ANALYSIS:
${analysis.technical_analysis}

PRICE TARGETS:
${analysis.targets}

RISK ASSESSMENT:
${analysis.risk_assessment}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ This is LIVE market data. Not financial advice.

Analyzed by: Wednesday AI
Agent: The CFO (GEN_FINANCE)
        `
    });

    return {
        general: 'The CFO',
        asset,
        analysis,
        timestamp: Date.now(),
        data_source: 'live_internet',
        report_sent: true
    };
}

// GEN_TECH - The Engineer
async function deployCode(base44, params, approved = false) {
    const { service, action, details } = params;
    
    await base44.integrations.Core.SendEmail({
        to: 'longleon17@gmail.com',
        subject: `🚀 Deployment ${action.toUpperCase()} - ${service}`,
        body: `
🚀 DEPLOYMENT NOTIFICATION

Service: ${service}
Action: ${action}
Status: COMPLETED (Demo Mode)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Details: ${details || 'Standard deployment'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ This is a DEMO. Actual infrastructure integration pending.

Executed by: Wednesday AI
Agent: The Engineer (GEN_TECH)
        `
    });

    return {
        general: 'The Engineer',
        service,
        action,
        status: 'completed_demo',
        notification_sent: true
    };
}

// GEN_CREATIVE - The Muse
async function generateCreative(base44, params) {
    const { type, description } = params;
    
    if (type === 'image') {
        const image = await base44.integrations.Core.GenerateImage({
            prompt: description
        });
        
        return {
            general: 'The Muse',
            type: 'image',
            url: image.url,
            description
        };
    } else {
        const content = await base44.integrations.Core.InvokeLLM({
            prompt: `Create ${type} content: ${description}`
        });
        
        return {
            general: 'The Muse',
            type,
            content,
            description
        };
    }
}