import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { service, action, parameters } = await req.json();

        switch (service) {
            case 'stripe':
                return await stripeAction(action, parameters);
            
            case 'tesla':
                return await teslaAction(action, parameters);
            
            case 'philips_hue':
                return await philipsHueAction(action, parameters);
            
            case 'nest':
                return await nestAction(action, parameters);
            
            case 'booking':
                return await bookingAction(action, parameters);
            
            default:
                return Response.json({ error: 'Unsupported service' }, { status: 400 });
        }

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});

async function stripeAction(action, params) {
    const STRIPE_KEY = Deno.env.get('STRIPE_SECRET_KEY');
    
    if (!STRIPE_KEY) {
        return Response.json({
            success: false,
            error: 'Stripe API key not configured',
            action: action,
            note: 'Set STRIPE_SECRET_KEY to enable real payments'
        });
    }

    // Real Stripe integration
    const stripe = await import('npm:stripe@14.11.0').then(m => m.default(STRIPE_KEY));

    switch (action) {
        case 'create_payment':
            const paymentIntent = await stripe.paymentIntents.create({
                amount: params.amount,
                currency: params.currency || 'usd',
                metadata: params.metadata
            });
            return Response.json({ success: true, payment_intent: paymentIntent });
        
        case 'list_charges':
            const charges = await stripe.charges.list({ limit: params.limit || 10 });
            return Response.json({ success: true, charges: charges.data });
        
        default:
            return Response.json({ error: 'Unknown Stripe action' }, { status: 400 });
    }
}

async function teslaAction(action, params) {
    const TESLA_TOKEN = Deno.env.get('TESLA_ACCESS_TOKEN');
    
    if (!TESLA_TOKEN) {
        return Response.json({
            success: false,
            error: 'Tesla access token not configured',
            action: action,
            note: 'Set TESLA_ACCESS_TOKEN to enable real Tesla control'
        });
    }

    // Real Tesla API integration
    const baseUrl = 'https://owner-api.teslamotors.com/api/1';
    
    switch (action) {
        case 'list_vehicles':
            const response = await fetch(`${baseUrl}/vehicles`, {
                headers: { 'Authorization': `Bearer ${TESLA_TOKEN}` }
            });
            const data = await response.json();
            return Response.json({ success: true, vehicles: data.response });
        
        case 'wake_vehicle':
            const wakeResponse = await fetch(`${baseUrl}/vehicles/${params.vehicle_id}/wake_up`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${TESLA_TOKEN}` }
            });
            const wakeData = await wakeResponse.json();
            return Response.json({ success: true, data: wakeData.response });
        
        default:
            return Response.json({ error: 'Unknown Tesla action' }, { status: 400 });
    }
}

async function philipsHueAction(action, params) {
    const HUE_BRIDGE_IP = Deno.env.get('HUE_BRIDGE_IP');
    const HUE_API_KEY = Deno.env.get('HUE_API_KEY');
    
    if (!HUE_BRIDGE_IP || !HUE_API_KEY) {
        return Response.json({
            success: false,
            error: 'Philips Hue not configured',
            note: 'Set HUE_BRIDGE_IP and HUE_API_KEY'
        });
    }

    const baseUrl = `http://${HUE_BRIDGE_IP}/api/${HUE_API_KEY}`;

    switch (action) {
        case 'list_lights':
            const response = await fetch(`${baseUrl}/lights`);
            const lights = await response.json();
            return Response.json({ success: true, lights });
        
        case 'set_light':
            const setResponse = await fetch(`${baseUrl}/lights/${params.light_id}/state`, {
                method: 'PUT',
                body: JSON.stringify(params.state)
            });
            const result = await setResponse.json();
            return Response.json({ success: true, result });
        
        default:
            return Response.json({ error: 'Unknown Hue action' }, { status: 400 });
    }
}

async function nestAction(action, params) {
    return Response.json({
        success: false,
        error: 'Nest integration not yet implemented',
        note: 'Requires Google OAuth setup'
    });
}

async function bookingAction(action, params) {
    return Response.json({
        success: false,
        error: 'Booking integration not yet implemented',
        note: 'Requires booking platform API keys'
    });
}