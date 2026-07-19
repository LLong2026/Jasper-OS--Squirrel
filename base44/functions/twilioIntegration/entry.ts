import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { action, payload } = await req.json();
        const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
        const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
        const fromNumber = Deno.env.get('TWILIO_PHONE_NUMBER');

        const auth = btoa(`${accountSid}:${authToken}`);

        if (action === 'send_sms') {
            const { to, body } = payload;
            
            const params = new URLSearchParams({
                To: to,
                From: fromNumber,
                Body: body
            });

            const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${auth}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: params
            });

            const result = await response.json();
            
            return Response.json({
                success: true,
                message_sid: result.sid,
                status: result.status
            });
        }

        if (action === 'make_call') {
            const { to, url } = payload;
            
            const params = new URLSearchParams({
                To: to,
                From: fromNumber,
                Url: url
            });

            const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`, {
                method: 'POST',
                headers: {
                    'Authorization': `Basic ${auth}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: params
            });

            const result = await response.json();
            
            return Response.json({
                success: true,
                call_sid: result.sid,
                status: result.status
            });
        }

        return Response.json({ error: 'Invalid action' }, { status: 400 });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});