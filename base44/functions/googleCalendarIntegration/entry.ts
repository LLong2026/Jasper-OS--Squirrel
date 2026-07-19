import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// GOOGLE CALENDAR INTEGRATION - Real calendar management
// Creates, updates, and manages calendar events automatically

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get OAuth access token
        const accessToken = await base44.asServiceRole.connectors.getAccessToken('googlecalendar');

        const { action, event_details } = await req.json();

        if (action === 'create_event') {
            const { title, start_time, end_time, attendees, description, location } = event_details;

            // Create calendar event
            const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    summary: title,
                    description: description || '',
                    location: location || '',
                    start: {
                        dateTime: start_time,
                        timeZone: 'America/New_York'
                    },
                    end: {
                        dateTime: end_time,
                        timeZone: 'America/New_York'
                    },
                    attendees: attendees?.map(email => ({ email })) || [],
                    reminders: {
                        useDefault: false,
                        overrides: [
                            { method: 'email', minutes: 24 * 60 },
                            { method: 'popup', minutes: 30 }
                        ]
                    }
                })
            });

            const event = await response.json();

            if (!response.ok) {
                throw new Error(event.error?.message || 'Failed to create event');
            }

            return Response.json({
                success: true,
                event_id: event.id,
                event_link: event.htmlLink,
                hangout_link: event.hangoutLink,
                status: event.status
            });
        }

        if (action === 'list_events') {
            const { time_min, time_max, max_results = 10 } = event_details || {};

            const params = new URLSearchParams({
                timeMin: time_min || new Date().toISOString(),
                timeMax: time_max || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                maxResults: max_results,
                singleEvents: true,
                orderBy: 'startTime'
            });

            const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });

            const data = await response.json();

            return Response.json({
                success: true,
                events: data.items || []
            });
        }

        return Response.json({ error: 'Invalid action' }, { status: 400 });

    } catch (error) {
        return Response.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
});