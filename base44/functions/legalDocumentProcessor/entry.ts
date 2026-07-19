import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { action, params } = await req.json();

        if (action === 'generate_purchase_agreement') {
            const { property, buyer, seller, terms } = params;

            const agreement = await base44.integrations.Core.InvokeLLM({
                prompt: `Generate a comprehensive real estate purchase agreement:

Property Details:
${JSON.stringify(property, null, 2)}

Buyer Information:
${JSON.stringify(buyer, null, 2)}

Seller Information:
${JSON.stringify(seller, null, 2)}

Terms:
${JSON.stringify(terms, null, 2)}

Include all standard clauses:
1. Purchase price and payment terms
2. Earnest money deposit
3. Financing contingency
4. Inspection contingency
5. Appraisal contingency
6. Title and survey
7. Closing date and possession
8. Prorations (taxes, HOA, utilities)
9. As-is vs repairs
10. Default and remedies
11. Dispute resolution
12. Entire agreement clause

Format as professional legal document with proper sections and signatures.`,
                response_json_schema: {
                    type: "object",
                    properties: {
                        document_title: { type: "string" },
                        full_text: { type: "string" },
                        key_sections: { type: "array" },
                        signature_blocks: { type: "array" },
                        exhibits: { type: "array" }
                    }
                }
            });

            // Store draft
            const { file_url } = await base44.integrations.Core.UploadFile({
                file: new Blob([agreement.full_text], { type: 'text/plain' })
            });

            await base44.asServiceRole.entities.GlobalMemory.create({
                memory_type: 'knowledge',
                content: {
                    type: 'legal_document',
                    category: 'purchase_agreement',
                    property: property.address,
                    document_url: file_url,
                    status: 'draft'
                },
                source_agent: 'LegalDocumentProcessor',
                tags: ['legal', 'real_estate', 'draft']
            });

            return Response.json({
                success: true,
                agreement,
                document_url: file_url,
                message: 'Purchase agreement generated. Have attorney review before signing.'
            });
        }

        if (action === 'generate_disclosure_forms') {
            const { property, state } = params;

            const disclosures = await base44.integrations.Core.InvokeLLM({
                prompt: `Generate required seller disclosure forms for:

Property: ${JSON.stringify(property)}
State: ${state}

Include state-specific disclosures:
1. Property condition disclosure
2. Lead-based paint disclosure (if pre-1978)
3. Natural hazard disclosures
4. HOA disclosures
5. Environmental disclosures
6. Structural/mechanical systems
7. Past repairs and renovations
8. Insurance claims
9. Neighborhood nuisances
10. Any other state-mandated disclosures

Provide forms in proper legal format.`,
                add_context_from_internet: true,
                response_json_schema: {
                    type: "object",
                    properties: {
                        forms: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    form_name: { type: "string" },
                                    required: { type: "boolean" },
                                    content: { type: "string" }
                                }
                            }
                        },
                        state_specific_requirements: { type: "array" }
                    }
                }
            });

            return Response.json({ success: true, ...disclosures });
        }

        if (action === 'review_contract') {
            const { document_url } = params;

            // Fetch document content
            const docResponse = await fetch(document_url);
            const docText = await docResponse.text();

            const review = await base44.integrations.Core.InvokeLLM({
                prompt: `Review this real estate contract for potential issues:

${docText}

Analyze:
1. Missing clauses or protections
2. Unfavorable terms for buyer
3. Ambiguous language
4. Contingencies and deadlines
5. Financial obligations
6. Risk areas
7. Recommended changes
8. Red flags

Provide detailed legal analysis.`,
                response_json_schema: {
                    type: "object",
                    properties: {
                        overall_assessment: { type: "string" },
                        risk_level: { type: "string" },
                        missing_clauses: { type: "array" },
                        unfavorable_terms: { type: "array" },
                        red_flags: { type: "array" },
                        recommended_changes: { type: "array" },
                        attorney_review_recommended: { type: "boolean" }
                    }
                }
            });

            return Response.json({ success: true, ...review });
        }

        if (action === 'generate_deed') {
            const { property, grantor, grantee, deed_type, consideration } = params;

            const deed = await base44.integrations.Core.InvokeLLM({
                prompt: `Generate a ${deed_type} deed for property transfer:

Property: ${JSON.stringify(property)}
Grantor (Seller): ${JSON.stringify(grantor)}
Grantee (Buyer): ${JSON.stringify(grantee)}
Consideration: $${consideration}

Include:
1. Proper legal description
2. Granting clause
3. Warranty (if warranty deed)
4. Covenants
5. Signature blocks
6. Notary acknowledgment
7. Preparation statement
8. Recording information

Format according to state requirements.`,
                response_json_schema: {
                    type: "object",
                    properties: {
                        deed_text: { type: "string" },
                        legal_description: { type: "string" },
                        recording_requirements: { type: "array" }
                    }
                }
            });

            return Response.json({
                success: true,
                deed,
                message: 'Deed generated. Must be reviewed by attorney and executed before notary.'
            });
        }

        if (action === 'compliance_check') {
            const { transaction_details, state } = params;

            const compliance = await base44.integrations.Core.InvokeLLM({
                prompt: `Check real estate transaction compliance:

Transaction: ${JSON.stringify(transaction_details)}
State: ${state}

Verify compliance with:
1. State real estate laws
2. Federal regulations (RESPA, TILA, etc.)
3. Fair Housing Act
4. Local ordinances
5. Disclosure requirements
6. Licensing requirements
7. Anti-money laundering (AML)
8. Title requirements

Flag any compliance issues.`,
                add_context_from_internet: true,
                response_json_schema: {
                    type: "object",
                    properties: {
                        compliant: { type: "boolean" },
                        issues: { type: "array" },
                        required_actions: { type: "array" },
                        risk_assessment: { type: "string" }
                    }
                }
            });

            return Response.json({ success: true, ...compliance });
        }

        return Response.json({ error: 'Invalid action' }, { status: 400 });

    } catch (error) {
        console.error('Legal document processor error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});