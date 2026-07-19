import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { action, params } = await req.json();

        // Financial institution integrations
        const INSTITUTIONS = {
            plaid: {
                name: 'Plaid',
                capabilities: ['account_linking', 'balance_check', 'transaction_history'],
                requires_key: 'PLAID_CLIENT_ID',
                base_url: 'https://production.plaid.com'
            },
            stripe: {
                name: 'Stripe',
                capabilities: ['payment_processing', 'payouts', 'disputes'],
                requires_key: 'STRIPE_API_KEY',
                base_url: 'https://api.stripe.com/v1'
            },
            wise: {
                name: 'Wise (TransferWise)',
                capabilities: ['international_transfers', 'multi_currency'],
                requires_key: 'WISE_API_KEY',
                base_url: 'https://api.transferwise.com'
            }
        };

        if (action === 'check_financing_options') {
            const { property_price, down_payment, credit_score, annual_income } = params;

            const options = await base44.integrations.Core.InvokeLLM({
                prompt: `Calculate financing options for property purchase:

Property Price: $${property_price}
Down Payment: $${down_payment}
Credit Score: ${credit_score}
Annual Income: $${annual_income}

Calculate:
1. Loan amount needed
2. Estimated interest rates for credit score
3. Monthly payment (30yr, 20yr, 15yr fixed)
4. Total interest paid over loan term
5. DTI ratio
6. Closing costs estimate
7. PMI requirements
8. Pre-approval likelihood

Use current market rates.`,
                add_context_from_internet: true,
                response_json_schema: {
                    type: "object",
                    properties: {
                        loan_amount: { type: "number" },
                        estimated_rate: { type: "number" },
                        monthly_payments: { type: "object" },
                        total_interest: { type: "object" },
                        dti_ratio: { type: "number" },
                        closing_costs: { type: "number" },
                        pmi_required: { type: "boolean" },
                        pre_approval_likelihood: { type: "string" },
                        recommended_lenders: { type: "array" }
                    }
                }
            });

            return Response.json({ success: true, ...options });
        }

        if (action === 'initiate_wire_transfer') {
            const { amount, recipient, purpose, account_info } = params;

            // CRITICAL RISK - requires approval
            const approval = await base44.asServiceRole.entities.ApprovalRequest.create({
                action_type: 'wire_transfer',
                risk_level: 'critical',
                details: {
                    amount,
                    recipient,
                    purpose,
                    account: account_info
                },
                estimated_cost: amount,
                status: 'pending'
            });

            return Response.json({
                success: true,
                requires_approval: true,
                approval_id: approval.id,
                message: `Wire transfer of $${amount} requires explicit user approval and bank authentication.`
            });
        }

        if (action === 'setup_escrow') {
            const { property_address, purchase_price, buyer_info, seller_info, closing_date } = params;

            const escrow = await base44.integrations.Core.InvokeLLM({
                prompt: `Generate escrow setup instructions for real estate transaction:

Property: ${property_address}
Purchase Price: $${purchase_price}
Buyer: ${JSON.stringify(buyer_info)}
Seller: ${JSON.stringify(seller_info)}
Closing Date: ${closing_date}

Provide:
1. Recommended escrow companies
2. Escrow fees estimate
3. Required documents from buyer
4. Required documents from seller
5. Timeline and milestones
6. Earnest money deposit amount
7. Title insurance requirements`,
                add_context_from_internet: true,
                response_json_schema: {
                    type: "object",
                    properties: {
                        recommended_companies: { type: "array" },
                        escrow_fees: { type: "number" },
                        buyer_documents: { type: "array" },
                        seller_documents: { type: "array" },
                        timeline: { type: "array" },
                        earnest_money: { type: "number" },
                        title_insurance: { type: "object" }
                    }
                }
            });

            // Store escrow plan
            await base44.asServiceRole.entities.GlobalMemory.create({
                memory_type: 'knowledge',
                content: {
                    type: 'escrow_plan',
                    property: property_address,
                    ...escrow
                },
                source_agent: 'FinancialInstitutionConnector',
                tags: ['escrow', 'real_estate', 'transaction']
            });

            return Response.json({ success: true, escrow });
        }

        if (action === 'investment_analysis') {
            const { property_address, purchase_price, rental_income_estimate, expenses } = params;

            const analysis = await base44.integrations.Core.InvokeLLM({
                prompt: `Perform investment property analysis:

Property: ${property_address}
Purchase Price: $${purchase_price}
Estimated Rental Income: $${rental_income_estimate}/month
Expenses: ${JSON.stringify(expenses)}

Calculate:
1. Cap rate
2. Cash-on-cash return
3. ROI (1yr, 5yr, 10yr)
4. Net operating income (NOI)
5. Cash flow projections
6. Break-even occupancy rate
7. Appreciation scenarios
8. Tax benefits
9. Investment grade (A, B, C, D)`,
                add_context_from_internet: true,
                response_json_schema: {
                    type: "object",
                    properties: {
                        cap_rate: { type: "number" },
                        cash_on_cash: { type: "number" },
                        roi_projections: { type: "object" },
                        noi: { type: "number" },
                        cash_flow: { type: "object" },
                        break_even: { type: "number" },
                        grade: { type: "string" },
                        recommendation: { type: "string" }
                    }
                }
            });

            return Response.json({ success: true, ...analysis });
        }

        if (action === 'connect_bank_account') {
            // Would integrate with Plaid in production
            return Response.json({
                success: true,
                message: 'Bank account linking requires Plaid integration. User must authenticate via Plaid Link.',
                plaid_link_url: 'https://cdn.plaid.com/link/v2/stable/link-initialize.js',
                instructions: 'Implement Plaid Link in frontend for secure bank connection.'
            });
        }

        return Response.json({ error: 'Invalid action' }, { status: 400 });

    } catch (error) {
        console.error('Financial institution connector error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});