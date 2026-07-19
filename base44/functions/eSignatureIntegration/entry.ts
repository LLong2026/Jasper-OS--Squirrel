import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { action, params } = await req.json();

        // E-signature platform configurations
        const PLATFORMS = {
            docusign: {
                base_url: 'https://na3.docusign.net/restapi',
                requires_key: 'DOCUSIGN_API_KEY',
                oauth_required: true
            },
            hellosign: {
                base_url: 'https://api.hellosign.com/v3',
                requires_key: 'HELLOSIGN_API_KEY',
                oauth_required: false
            },
            adobe_sign: {
                base_url: 'https://api.na1.adobesign.com/api/rest/v6',
                requires_key: 'ADOBE_SIGN_API_KEY',
                oauth_required: true
            }
        };

        if (action === 'send_for_signature') {
            const { document_url, signers, document_title, message } = params;

            // Check if DocuSign is configured
            const docusignKey = Deno.env.get('DOCUSIGN_API_KEY');

            if (docusignKey) {
                // Real DocuSign integration
                const accountId = Deno.env.get('DOCUSIGN_ACCOUNT_ID');
                const apiUrl = `${PLATFORMS.docusign.base_url}/v2.1/accounts/${accountId}/envelopes`;

                // Fetch document
                const docResponse = await fetch(document_url);
                const docBuffer = await docResponse.arrayBuffer();
                const docBase64 = btoa(String.fromCharCode(...new Uint8Array(docBuffer)));

                const envelopeDefinition = {
                    emailSubject: document_title,
                    documents: [{
                        documentBase64: docBase64,
                        name: document_title,
                        fileExtension: 'pdf',
                        documentId: '1'
                    }],
                    recipients: {
                        signers: signers.map((signer, idx) => ({
                            email: signer.email,
                            name: signer.name,
                            recipientId: String(idx + 1),
                            routingOrder: String(idx + 1),
                            tabs: {
                                signHereTabs: signer.signature_locations || [{
                                    documentId: '1',
                                    pageNumber: '1',
                                    xPosition: '100',
                                    yPosition: '100'
                                }]
                            }
                        }))
                    },
                    status: 'sent'
                };

                const response = await fetch(apiUrl, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${docusignKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(envelopeDefinition)
                });

                const result = await response.json();

                if (response.ok) {
                    // Track in memory
                    await base44.asServiceRole.entities.GlobalMemory.create({
                        memory_type: 'knowledge',
                        content: {
                            type: 'signature_request',
                            envelope_id: result.envelopeId,
                            document: document_title,
                            signers: signers.map(s => s.email),
                            status: 'sent'
                        },
                        source_agent: 'ESignatureIntegration',
                        tags: ['esignature', 'docusign', 'pending']
                    });

                    return Response.json({
                        success: true,
                        envelope_id: result.envelopeId,
                        status_url: `https://app.docusign.com/documents/details/${result.envelopeId}`,
                        message: 'Document sent for signature via DocuSign'
                    });
                } else {
                    throw new Error(`DocuSign API error: ${result.message}`);
                }

            } else {
                // Fallback: Generate signature request plan without API
                const plan = await base44.integrations.Core.InvokeLLM({
                    prompt: `Create e-signature workflow plan:

Document: ${document_title}
Document URL: ${document_url}
Signers: ${JSON.stringify(signers)}
Message: ${message}

Provide:
1. Recommended e-signature platform
2. Signing order
3. Signature field placements
4. Required authentication
5. Notification settings
6. Completion timeline
7. Follow-up procedures`,
                    response_json_schema: {
                        type: "object",
                        properties: {
                            recommended_platform: { type: "string" },
                            signing_order: { type: "array" },
                            signature_fields: { type: "array" },
                            authentication_method: { type: "string" },
                            estimated_completion: { type: "string" }
                        }
                    }
                });

                return Response.json({
                    success: true,
                    requires_setup: true,
                    plan,
                    message: 'E-signature platform not configured. Set DOCUSIGN_API_KEY to enable automatic sending.'
                });
            }
        }

        if (action === 'check_signature_status') {
            const { envelope_id } = params;

            const docusignKey = Deno.env.get('DOCUSIGN_API_KEY');
            if (!docusignKey) {
                return Response.json({ 
                    error: 'DocuSign not configured',
                    message: 'Set DOCUSIGN_API_KEY to check signature status' 
                }, { status: 400 });
            }

            const accountId = Deno.env.get('DOCUSIGN_ACCOUNT_ID');
            const apiUrl = `${PLATFORMS.docusign.base_url}/v2.1/accounts/${accountId}/envelopes/${envelope_id}`;

            const response = await fetch(apiUrl, {
                headers: {
                    'Authorization': `Bearer ${docusignKey}`
                }
            });

            const result = await response.json();

            return Response.json({
                success: true,
                status: result.status,
                completed: result.status === 'completed',
                signers: result.recipients?.signers || [],
                sent_date: result.sentDateTime,
                completed_date: result.completedDateTime
            });
        }

        if (action === 'download_signed_document') {
            const { envelope_id } = params;

            const docusignKey = Deno.env.get('DOCUSIGN_API_KEY');
            if (!docusignKey) {
                return Response.json({ 
                    error: 'DocuSign not configured' 
                }, { status: 400 });
            }

            const accountId = Deno.env.get('DOCUSIGN_ACCOUNT_ID');
            const apiUrl = `${PLATFORMS.docusign.base_url}/v2.1/accounts/${accountId}/envelopes/${envelope_id}/documents/combined`;

            const response = await fetch(apiUrl, {
                headers: {
                    'Authorization': `Bearer ${docusignKey}`
                }
            });

            const pdfBuffer = await response.arrayBuffer();

            // Upload to Wednesday's storage
            const { file_url } = await base44.integrations.Core.UploadFile({
                file: new Blob([pdfBuffer], { type: 'application/pdf' })
            });

            return Response.json({
                success: true,
                signed_document_url: file_url,
                message: 'Signed document downloaded and stored'
            });
        }

        if (action === 'void_envelope') {
            const { envelope_id, reason } = params;

            const docusignKey = Deno.env.get('DOCUSIGN_API_KEY');
            if (!docusignKey) {
                return Response.json({ 
                    error: 'DocuSign not configured' 
                }, { status: 400 });
            }

            const accountId = Deno.env.get('DOCUSIGN_ACCOUNT_ID');
            const apiUrl = `${PLATFORMS.docusign.base_url}/v2.1/accounts/${accountId}/envelopes/${envelope_id}`;

            const response = await fetch(apiUrl, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${docusignKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    status: 'voided',
                    voidedReason: reason
                })
            });

            const result = await response.json();

            return Response.json({
                success: response.ok,
                status: result.status,
                message: 'Signature request voided'
            });
        }

        return Response.json({ error: 'Invalid action' }, { status: 400 });

    } catch (error) {
        console.error('E-signature integration error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});