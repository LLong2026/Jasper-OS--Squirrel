import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { action, payload } = await req.json();
        const slackToken = Deno.env.get('SLACK_BOT_TOKEN');

        if (action === 'send_message') {
            const { channel, text, blocks, thread_ts } = payload;
            
            const response = await fetch('https://slack.com/api/chat.postMessage', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${slackToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    channel,
                    text,
                    blocks,
                    thread_ts
                })
            });

            const result = await response.json();
            
            return Response.json({
                success: result.ok,
                ts: result.ts,
                channel: result.channel
            });
        }

        if (action === 'create_channel') {
            const { name, is_private = false } = payload;
            
            const response = await fetch('https://slack.com/api/conversations.create', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${slackToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name,
                    is_private
                })
            });

            const result = await response.json();
            
            return Response.json({
                success: result.ok,
                channel: result.channel
            });
        }

        if (action === 'upload_file') {
            const { channels, content, filename, title } = payload;
            
            const formData = new FormData();
            formData.append('channels', channels);
            formData.append('content', content);
            formData.append('filename', filename);
            formData.append('title', title);

            const response = await fetch('https://slack.com/api/files.upload', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${slackToken}`
                },
                body: formData
            });

            const result = await response.json();
            
            return Response.json({
                success: result.ok,
                file: result.file
            });
        }

        if (action === 'set_status') {
            const { status_text, status_emoji, status_expiration } = payload;
            
            const response = await fetch('https://slack.com/api/users.profile.set', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${slackToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    profile: {
                        status_text,
                        status_emoji,
                        status_expiration
                    }
                })
            });

            const result = await response.json();
            
            return Response.json({
                success: result.ok
            });
        }

        return Response.json({ error: 'Invalid action' }, { status: 400 });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});