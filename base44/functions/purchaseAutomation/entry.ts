import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// PURCHASE AUTOMATION - Execute purchases across connected services
// Handles Amazon, any e-commerce, with voice command support

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { platform, item_query, quantity = 1, max_price, voice_command, approved } = await req.json();

        // Check if service is connected
        const connectedServices = await base44.asServiceRole.entities.ConnectedService.filter({ 
            service_name: platform 
        });

        if (connectedServices.length === 0) {
            // Service not connected - trigger dynamic connector
            return Response.json({
                success: false,
                error: 'Service not connected',
                action_required: 'connect_service',
                platform,
                suggestion: `I need to connect to ${platform} first. Would you like me to set that up?`
            });
        }

        // Search for the item using real-time data
        const itemSearch = await base44.integrations.Core.InvokeLLM({
            prompt: `Search ${platform} for: ${item_query}
            
Find the best matching product with:
- Exact product name
- Current price
- Product URL
- Rating/reviews
- Availability
- Estimated delivery

${max_price ? `Budget constraint: Under $${max_price}` : ''}

Use real-time data from the internet.`,
            add_context_from_internet: true,
            response_json_schema: {
                type: "object",
                properties: {
                    product_name: { type: "string" },
                    price: { type: "number" },
                    url: { type: "string" },
                    rating: { type: "number" },
                    in_stock: { type: "boolean" },
                    estimated_delivery: { type: "string" }
                }
            }
        });

        const orderRef = `ORD${Date.now().toString().slice(-6)}`;

        const totalCost = itemSearch.price * quantity;

        // Check if approval is required
        if (!approved) {
            const approvalResult = await base44.functions.invoke('approvalWorkflow', {
                action: 'create',
                action_type: 'purchase',
                details: {
                    platform,
                    item: itemSearch.product_name,
                    quantity,
                    price: itemSearch.price,
                    involves_payment_info: true,
                    irreversible: true
                },
                estimated_cost: totalCost
            });

            if (approvalResult.requires_approval) {
                return Response.json({
                    success: true,
                    requires_approval: true,
                    approval_id: approvalResult.approval_id,
                    message: 'Purchase requires approval before execution',
                    item: itemSearch.product_name,
                    price: itemSearch.price,
                    quantity,
                    total: totalCost,
                    order_reference: orderRef
                });
            }
        }

        // Create Stripe checkout session for payment
        const payment = await base44.functions.invoke('stripePayment', {
            action: 'create_checkout_session',
            amount: totalCost,
            currency: 'usd',
            description: itemSearch.product_name,
            metadata: {
                order_ref: orderRef,
                platform,
                product_url: itemSearch.url,
                quantity,
                product_name: itemSearch.product_name
            }
        });

        // Send confirmation with payment link
        await base44.integrations.Core.SendEmail({
            to: 'longleon17@gmail.com',
            subject: `🛒 Purchase Ready - ${itemSearch.product_name}`,
            body: `
🛒 PURCHASE AUTOMATION - PAYMENT READY

Order Reference: ${orderRef}
Platform: ${platform}
${voice_command ? `Voice Command: "${voice_command}"` : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PRODUCT FOUND:
${itemSearch.product_name}

Price: $${itemSearch.price}
Rating: ${itemSearch.rating}/5 ⭐
Availability: ${itemSearch.in_stock ? '✅ IN STOCK' : '❌ Out of Stock'}
Delivery: ${itemSearch.estimated_delivery}

Quantity: ${quantity}
Total: $${totalCost}

Product Link: ${itemSearch.url}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💳 COMPLETE PAYMENT:
${payment.checkout_url}

Click above to complete your purchase securely via Stripe.
After payment, we'll coordinate with ${platform} for delivery.

⚠️ Note: Stripe payment is live. Final ${platform} order placement requires API partnership.

Processed by: Wednesday AI
Agent: The Concierge (GEN_LIFE)
            `
        });

        return Response.json({
            success: true,
            order_reference: orderRef,
            platform,
            product: itemSearch,
            quantity,
            total_cost: totalCost,
            payment_url: payment.checkout_url,
            payment_session_id: payment.session_id,
            status: 'payment_ready',
            next_step: 'Complete payment via Stripe',
            confirmation_sent: true
        });

    } catch (error) {
        return Response.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
});