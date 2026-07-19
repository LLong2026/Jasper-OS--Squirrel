import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { action, payload } = await req.json();
        const shopifyDomain = Deno.env.get('SHOPIFY_DOMAIN');
        const shopifyToken = Deno.env.get('SHOPIFY_ACCESS_TOKEN');

        const shopifyHeaders = {
            'X-Shopify-Access-Token': shopifyToken,
            'Content-Type': 'application/json'
        };

        if (action === 'create_product') {
            const { title, body_html, vendor, product_type, price, inventory_quantity } = payload;
            
            const response = await fetch(`https://${shopifyDomain}/admin/api/2024-01/products.json`, {
                method: 'POST',
                headers: shopifyHeaders,
                body: JSON.stringify({
                    product: {
                        title,
                        body_html,
                        vendor,
                        product_type,
                        variants: [{
                            price,
                            inventory_quantity
                        }]
                    }
                })
            });

            const result = await response.json();
            
            return Response.json({
                success: true,
                product_id: result.product.id,
                handle: result.product.handle
            });
        }

        if (action === 'get_orders') {
            const { status = 'any', limit = 50 } = payload;
            
            const response = await fetch(`https://${shopifyDomain}/admin/api/2024-01/orders.json?status=${status}&limit=${limit}`, {
                headers: shopifyHeaders
            });

            const result = await response.json();
            
            return Response.json({
                success: true,
                orders: result.orders
            });
        }

        if (action === 'fulfill_order') {
            const { order_id, location_id, tracking_number, tracking_company } = payload;
            
            const response = await fetch(`https://${shopifyDomain}/admin/api/2024-01/orders/${order_id}/fulfillments.json`, {
                method: 'POST',
                headers: shopifyHeaders,
                body: JSON.stringify({
                    fulfillment: {
                        location_id,
                        tracking_number,
                        tracking_company,
                        notify_customer: true
                    }
                })
            });

            const result = await response.json();
            
            return Response.json({
                success: true,
                fulfillment_id: result.fulfillment.id
            });
        }

        return Response.json({ error: 'Invalid action' }, { status: 400 });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});