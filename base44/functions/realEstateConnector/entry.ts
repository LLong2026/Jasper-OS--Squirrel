import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { action, params } = await req.json();

        // Real estate platform API configurations
        const PLATFORMS = {
            zillow: { 
                base_url: 'https://api.bridgedataoutput.com/api/v2',
                requires_key: 'ZILLOW_API_KEY'
            },
            redfin: {
                base_url: 'https://redfin-com-data.p.rapidapi.com',
                requires_key: 'RAPIDAPI_KEY'
            },
            realtor: {
                base_url: 'https://realtor.p.rapidapi.com',
                requires_key: 'RAPIDAPI_KEY'
            }
        };

        if (action === 'search_listings') {
            const { location, min_price, max_price, bedrooms, bathrooms, property_type } = params;

            // Use LLM with web access to aggregate across platforms
            const listings = await base44.integrations.Core.InvokeLLM({
                prompt: `Search real estate listings with the following criteria:
Location: ${location}
Price Range: $${min_price} - $${max_price}
Bedrooms: ${bedrooms || 'any'}
Bathrooms: ${bathrooms || 'any'}
Property Type: ${property_type || 'any'}

Search Zillow, Redfin, and Realtor.com. Return structured listing data including:
- Address
- Price
- Bedrooms/bathrooms
- Square footage
- Listing URL
- Photos (URLs)
- Days on market
- Property taxes
- HOA fees (if applicable)`,
                add_context_from_internet: true,
                response_json_schema: {
                    type: "object",
                    properties: {
                        listings: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    address: { type: "string" },
                                    price: { type: "number" },
                                    bedrooms: { type: "number" },
                                    bathrooms: { type: "number" },
                                    sqft: { type: "number" },
                                    listing_url: { type: "string" },
                                    photos: { type: "array", items: { type: "string" } },
                                    days_on_market: { type: "number" },
                                    property_taxes: { type: "number" },
                                    hoa_fees: { type: "number" },
                                    platform: { type: "string" }
                                }
                            }
                        },
                        total_results: { type: "number" }
                    }
                }
            });

            return Response.json({ success: true, ...listings });
        }

        if (action === 'get_property_details') {
            const { listing_url } = params;

            const details = await base44.integrations.Core.InvokeLLM({
                prompt: `Get comprehensive property details from: ${listing_url}

Include:
- Full property description
- All photos
- Neighborhood information
- School ratings
- Crime statistics
- Nearby amenities
- Market trends
- Price history
- Estimated monthly costs (mortgage, taxes, insurance, HOA)
- Agent contact information`,
                add_context_from_internet: true,
                response_json_schema: {
                    type: "object",
                    properties: {
                        property: { type: "object" },
                        neighborhood: { type: "object" },
                        schools: { type: "array" },
                        financials: { type: "object" },
                        agent: { type: "object" }
                    }
                }
            });

            return Response.json({ success: true, ...details });
        }

        if (action === 'schedule_viewing') {
            const { listing_url, preferred_times, contact_info } = params;

            // Create approval request for scheduling
            const approval = await base44.asServiceRole.entities.ApprovalRequest.create({
                action_type: 'schedule_property_viewing',
                risk_level: 'low',
                details: {
                    listing: listing_url,
                    times: preferred_times,
                    contact: contact_info
                },
                estimated_cost: 0,
                status: 'approved'
            });

            // Use LLM to draft professional viewing request email
            const email = await base44.integrations.Core.InvokeLLM({
                prompt: `Draft a professional email to request property viewing:

Property: ${listing_url}
Preferred Times: ${JSON.stringify(preferred_times)}
Requester: ${user.full_name} (${user.email})

Email should be polite, professional, and include alternative time flexibility.`,
                response_json_schema: {
                    type: "object",
                    properties: {
                        subject: { type: "string" },
                        body: { type: "string" },
                        recipient: { type: "string" }
                    }
                }
            });

            // Store as pending action for user to send
            return Response.json({
                success: true,
                approval_id: approval.id,
                draft_email: email,
                message: 'Viewing request prepared. Review and send the email draft.'
            });
        }

        if (action === 'submit_offer') {
            const { listing_url, offer_amount, contingencies, financing_type, closing_date } = params;

            // HIGH RISK - requires explicit approval
            const approval = await base44.asServiceRole.entities.ApprovalRequest.create({
                action_type: 'submit_property_offer',
                risk_level: 'critical',
                details: {
                    listing: listing_url,
                    offer: offer_amount,
                    contingencies,
                    financing: financing_type,
                    closing: closing_date
                },
                estimated_cost: offer_amount,
                status: 'pending'
            });

            return Response.json({
                success: true,
                requires_approval: true,
                approval_id: approval.id,
                message: 'Property offer requires explicit user approval before submission.'
            });
        }

        if (action === 'market_analysis') {
            const { location, property_type } = params;

            const analysis = await base44.integrations.Core.InvokeLLM({
                prompt: `Perform comprehensive real estate market analysis:

Location: ${location}
Property Type: ${property_type || 'residential'}

Analyze:
- Current market trends (buyer's vs seller's market)
- Average price per square foot
- Days on market average
- Price appreciation rates (1yr, 5yr, 10yr)
- Inventory levels
- New construction activity
- Economic indicators affecting the market
- Future outlook`,
                add_context_from_internet: true,
                response_json_schema: {
                    type: "object",
                    properties: {
                        market_status: { type: "string" },
                        avg_price_per_sqft: { type: "number" },
                        avg_days_on_market: { type: "number" },
                        appreciation_rates: { type: "object" },
                        inventory_level: { type: "string" },
                        outlook: { type: "string" },
                        recommendations: { type: "array" }
                    }
                }
            });

            return Response.json({ success: true, ...analysis });
        }

        return Response.json({ error: 'Invalid action' }, { status: 400 });

    } catch (error) {
        console.error('Real estate connector error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});