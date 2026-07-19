import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { action, payload } = await req.json();

        if (action === 'send_email') {
            const { to, subject, body, cc, bcc, attachments } = payload;
            
            // Use Gmail API
            const gmailApiKey = Deno.env.get('GMAIL_API_KEY');
            const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${gmailApiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    raw: btoa(`To: ${to}\nSubject: ${subject}\n\n${body}`)
                })
            });

            const result = await response.json();
            
            return Response.json({
                success: true,
                message_id: result.id,
                thread_id: result.threadId
            });
        }

        if (action === 'fetch_emails') {
            const { query, max_results = 10 } = payload;
            
            const gmailApiKey = Deno.env.get('GMAIL_API_KEY');
            const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=${max_results}`, {
                headers: {
                    'Authorization': `Bearer ${gmailApiKey}`
                }
            });

            const result = await response.json();
            
            return Response.json({
                success: true,
                emails: result.messages || [],
                result_size: result.resultSizeEstimate
            });
        }

        if (action === 'create_draft') {
            const { to, subject, body } = payload;
            
            const gmailApiKey = Deno.env.get('GMAIL_API_KEY');
            const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/drafts', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${gmailApiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: {
                        raw: btoa(`To: ${to}\nSubject: ${subject}\n\n${body}`)
                    }
                })
            });

            const result = await response.json();
            
            return Response.json({
                success: true,
                draft_id: result.id
            });
        }

        return Response.json({ error: 'Invalid action' }, { status: 400 });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});