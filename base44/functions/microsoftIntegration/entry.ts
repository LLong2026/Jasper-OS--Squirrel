import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

const GRAPH_API_BASE = 'https://graph.microsoft.com/v1.0';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { action, ...params } = await req.json();
        const accessToken = await base44.asServiceRole.connectors.getAccessToken('microsoft');

        const headers = {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        };

        let result;

        switch (action) {
            case 'send_email':
                result = await sendEmail(headers, params);
                break;
            case 'schedule_meeting':
                result = await scheduleMeeting(headers, params);
                break;
            case 'create_document':
                result = await createDocument(headers, params);
                break;
            case 'read_document':
                result = await readDocument(headers, params);
                break;
            case 'create_spreadsheet':
                result = await createSpreadsheet(headers, params);
                break;
            case 'update_spreadsheet':
                result = await updateSpreadsheet(headers, params);
                break;
            case 'send_teams_message':
                result = await sendTeamsMessage(headers, params);
                break;
            case 'list_files':
                result = await listFiles(headers, params);
                break;
            case 'search_emails':
                result = await searchEmails(headers, params);
                break;
            default:
                return Response.json({ error: 'Invalid action' }, { status: 400 });
        }

        return Response.json({ success: true, data: result });

    } catch (error) {
        console.error('Microsoft Integration Error:', error);
        return Response.json({ 
            error: error.message || 'Integration failed' 
        }, { status: 500 });
    }
});

async function sendEmail(headers, { to, subject, body, cc = [], attachments = [] }) {
    const message = {
        message: {
            subject,
            body: {
                contentType: 'HTML',
                content: body
            },
            toRecipients: to.map(email => ({ emailAddress: { address: email } })),
            ccRecipients: cc.map(email => ({ emailAddress: { address: email } })),
            attachments: attachments
        },
        saveToSentItems: true
    };

    const response = await fetch(`${GRAPH_API_BASE}/me/sendMail`, {
        method: 'POST',
        headers,
        body: JSON.stringify(message)
    });

    if (!response.ok) {
        throw new Error(`Failed to send email: ${await response.text()}`);
    }

    return { sent: true, timestamp: new Date().toISOString() };
}

async function scheduleMeeting(headers, { subject, start, end, attendees, body, location = '' }) {
    const event = {
        subject,
        body: {
            contentType: 'HTML',
            content: body || ''
        },
        start: {
            dateTime: start,
            timeZone: 'UTC'
        },
        end: {
            dateTime: end,
            timeZone: 'UTC'
        },
        location: {
            displayName: location
        },
        attendees: attendees.map(email => ({
            emailAddress: { address: email },
            type: 'required'
        })),
        isOnlineMeeting: true,
        onlineMeetingProvider: 'teamsForBusiness'
    };

    const response = await fetch(`${GRAPH_API_BASE}/me/events`, {
        method: 'POST',
        headers,
        body: JSON.stringify(event)
    });

    if (!response.ok) {
        throw new Error(`Failed to schedule meeting: ${await response.text()}`);
    }

    const data = await response.json();
    return {
        event_id: data.id,
        meeting_link: data.onlineMeeting?.joinUrl,
        calendar_link: data.webLink
    };
}

async function createDocument(headers, { name, content }) {
    // Create Word document in OneDrive
    const uploadUrl = `${GRAPH_API_BASE}/me/drive/root:/${name}.docx:/content`;
    
    const response = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
            'Authorization': headers.Authorization,
            'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        },
        body: content // Should be base64 or binary content
    });

    if (!response.ok) {
        throw new Error(`Failed to create document: ${await response.text()}`);
    }

    const data = await response.json();
    return {
        document_id: data.id,
        web_url: data.webUrl,
        download_url: data['@microsoft.graph.downloadUrl']
    };
}

async function readDocument(headers, { document_id }) {
    const response = await fetch(`${GRAPH_API_BASE}/me/drive/items/${document_id}/content`, {
        headers
    });

    if (!response.ok) {
        throw new Error(`Failed to read document: ${await response.text()}`);
    }

    const content = await response.text();
    return { content };
}

async function createSpreadsheet(headers, { name, data }) {
    // Create Excel workbook
    const workbook = {
        name: `${name}.xlsx`
    };

    const response = await fetch(`${GRAPH_API_BASE}/me/drive/root/children`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
            name: workbook.name,
            file: {},
            '@microsoft.graph.conflictBehavior': 'rename'
        })
    });

    if (!response.ok) {
        throw new Error(`Failed to create spreadsheet: ${await response.text()}`);
    }

    const file = await response.json();
    
    // Add data if provided
    if (data && data.length > 0) {
        await updateSpreadsheet(headers, { 
            workbook_id: file.id, 
            worksheet: 'Sheet1', 
            range: `A1:${String.fromCharCode(65 + data[0].length - 1)}${data.length}`,
            values: data 
        });
    }

    return {
        workbook_id: file.id,
        web_url: file.webUrl
    };
}

async function updateSpreadsheet(headers, { workbook_id, worksheet, range, values }) {
    const response = await fetch(
        `${GRAPH_API_BASE}/me/drive/items/${workbook_id}/workbook/worksheets/${worksheet}/range(address='${range}')`,
        {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ values })
        }
    );

    if (!response.ok) {
        throw new Error(`Failed to update spreadsheet: ${await response.text()}`);
    }

    return { updated: true };
}

async function sendTeamsMessage(headers, { chat_id, message }) {
    const response = await fetch(`${GRAPH_API_BASE}/chats/${chat_id}/messages`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
            body: {
                content: message
            }
        })
    });

    if (!response.ok) {
        throw new Error(`Failed to send Teams message: ${await response.text()}`);
    }

    const data = await response.json();
    return { message_id: data.id };
}

async function listFiles(headers, { folder = 'root', limit = 50 }) {
    const response = await fetch(
        `${GRAPH_API_BASE}/me/drive/${folder}/children?$top=${limit}`,
        { headers }
    );

    if (!response.ok) {
        throw new Error(`Failed to list files: ${await response.text()}`);
    }

    const data = await response.json();
    return {
        files: data.value.map(file => ({
            id: file.id,
            name: file.name,
            type: file.file ? 'file' : 'folder',
            size: file.size,
            web_url: file.webUrl,
            modified: file.lastModifiedDateTime
        }))
    };
}

async function searchEmails(headers, { query, limit = 25 }) {
    const response = await fetch(
        `${GRAPH_API_BASE}/me/messages?$search="${query}"&$top=${limit}&$select=subject,from,receivedDateTime,bodyPreview`,
        { headers }
    );

    if (!response.ok) {
        throw new Error(`Failed to search emails: ${await response.text()}`);
    }

    const data = await response.json();
    return {
        emails: data.value.map(email => ({
            subject: email.subject,
            from: email.from.emailAddress.address,
            date: email.receivedDateTime,
            preview: email.bodyPreview
        }))
    };
}