import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { action, payload } = await req.json();
        const zoomToken = Deno.env.get('ZOOM_API_TOKEN');

        const zoomHeaders = {
            'Authorization': `Bearer ${zoomToken}`,
            'Content-Type': 'application/json'
        };

        if (action === 'create_meeting') {
            const { topic, start_time, duration, timezone, password, settings } = payload;
            
            const response = await fetch('https://api.zoom.us/v2/users/me/meetings', {
                method: 'POST',
                headers: zoomHeaders,
                body: JSON.stringify({
                    topic,
                    type: 2,
                    start_time,
                    duration,
                    timezone: timezone || 'UTC',
                    password,
                    settings: settings || {
                        host_video: true,
                        participant_video: true,
                        join_before_host: false,
                        mute_upon_entry: true,
                        watermark: false,
                        audio: 'voip',
                        auto_recording: 'cloud'
                    }
                })
            });

            const result = await response.json();
            
            return Response.json({
                success: true,
                meeting_id: result.id,
                join_url: result.join_url,
                password: result.password
            });
        }

        if (action === 'list_meetings') {
            const response = await fetch('https://api.zoom.us/v2/users/me/meetings', {
                headers: zoomHeaders
            });

            const result = await response.json();
            
            return Response.json({
                success: true,
                meetings: result.meetings
            });
        }

        if (action === 'delete_meeting') {
            const { meeting_id } = payload;
            
            const response = await fetch(`https://api.zoom.us/v2/meetings/${meeting_id}`, {
                method: 'DELETE',
                headers: zoomHeaders
            });

            return Response.json({
                success: response.ok,
                status: response.status
            });
        }

        return Response.json({ error: 'Invalid action' }, { status: 400 });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});