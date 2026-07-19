import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { action, params } = await req.json();

        if (action === 'develop_strategy') {
            const { 
                transaction_type, // 'property_purchase', 'property_sale', 'investment', etc.
                target_details,
                user_parameters, // max price, must-haves, deal-breakers, timeline
                market_conditions
            } = params;

            // Get market analysis
            const marketAnalysis = await base44.integrations.Core.InvokeLLM({
                prompt: `Perform comprehensive market analysis for negotiation:

Transaction Type: ${transaction_type}
Target: ${JSON.stringify(target_details)}
Market Conditions: ${JSON.stringify(market_conditions)}

Analyze:
1. Current market leverage (buyer's vs seller's market)
2. Comparable transactions
3. Time on market / urgency indicators
4. Seasonal factors
5. Economic indicators
6. Competitive landscape
7. Motivated seller/buyer signals

Provide tactical intelligence for negotiation positioning.`,
                add_context_from_internet: true,
                response_json_schema: {
                    type: "object",
                    properties: {
                        market_leverage: { type: "string", enum: ["strong_buyer", "moderate_buyer", "neutral", "moderate_seller", "strong_seller"] },
                        urgency_signals: { type: "array" },
                        comparables: { type: "array" },
                        recommended_opening_position: { type: "number" },
                        leverage_points: { type: "array" },
                        risk_factors: { type: "array" }
                    }
                }
            });

            // Develop negotiation strategy
            const strategy = await base44.integrations.Core.InvokeLLM({
                prompt: `Develop comprehensive negotiation strategy:

Transaction: ${transaction_type}
Target: ${JSON.stringify(target_details)}
User Parameters: ${JSON.stringify(user_parameters)}
Market Analysis: ${JSON.stringify(marketAnalysis)}

Create strategy including:
1. Opening position (price and terms)
2. Walkaway point (BATNA - Best Alternative To Negotiated Agreement)
3. Concession sequence (what to give up and when)
4. Leverage tactics (contingencies, timing, financing strength)
5. Counter-offer thresholds
6. Relationship-building approach
7. Pressure points to apply
8. Expected opposition tactics and responses
9. Win-win scenarios
10. Timeline for negotiation phases

Use game theory and behavioral economics principles.`,
                response_json_schema: {
                    type: "object",
                    properties: {
                        opening_offer: {
                            type: "object",
                            properties: {
                                price: { type: "number" },
                                terms: { type: "array" },
                                contingencies: { type: "array" },
                                rationale: { type: "string" }
                            }
                        },
                        walkaway_point: { type: "number" },
                        target_range: {
                            type: "object",
                            properties: {
                                ideal: { type: "number" },
                                acceptable: { type: "number" },
                                maximum: { type: "number" }
                            }
                        },
                        concession_plan: { type: "array" },
                        leverage_tactics: { type: "array" },
                        counter_tactics: { type: "object" },
                        negotiation_style: { type: "string" },
                        estimated_rounds: { type: "number" },
                        success_probability: { type: "number" }
                    }
                }
            });

            // Store strategy
            const strategyRecord = await base44.asServiceRole.entities.GlobalMemory.create({
                memory_type: 'knowledge',
                content: {
                    type: 'negotiation_strategy',
                    transaction_type,
                    target: target_details,
                    market_analysis: marketAnalysis,
                    strategy,
                    status: 'active',
                    created_for: user.email
                },
                source_agent: 'NegotiationEngine',
                tags: ['negotiation', 'strategy', transaction_type]
            });

            return Response.json({
                success: true,
                strategy_id: strategyRecord.id,
                market_analysis: marketAnalysis,
                strategy,
                message: 'Negotiation strategy developed based on market intelligence'
            });
        }

        if (action === 'generate_offer') {
            const { strategy_id, offer_type } = params; // 'opening', 'counter', 'final'

            // Retrieve strategy
            const strategyRecord = await base44.asServiceRole.entities.GlobalMemory.filter({ id: strategy_id })[0];
            
            if (!strategyRecord) {
                return Response.json({ error: 'Strategy not found' }, { status: 404 });
            }

            const strategy = strategyRecord.content.strategy;
            const offerData = offer_type === 'opening' ? strategy.opening_offer : strategy.target_range;

            // Generate formal offer document
            const offer = await base44.integrations.Core.InvokeLLM({
                prompt: `Generate professional ${offer_type} offer:

Strategy Context: ${JSON.stringify(strategy)}
Offer Type: ${offer_type}
Offer Data: ${JSON.stringify(offerData)}

Create formal offer including:
1. Purchase price / offer amount
2. Earnest money deposit
3. Financing terms
4. Contingencies (inspection, appraisal, financing, sale of current home)
5. Closing date
6. Possession date
7. Included/excluded items
8. Seller concessions requested
9. Escalation clause (if applicable)
10. Expiration deadline

Format professionally with clear terms and strategic positioning.`,
                response_json_schema: {
                    type: "object",
                    properties: {
                        offer_summary: { type: "string" },
                        price: { type: "number" },
                        terms: {
                            type: "object",
                            properties: {
                                earnest_money: { type: "number" },
                                financing: { type: "string" },
                                contingencies: { type: "array" },
                                closing_days: { type: "number" },
                                concessions: { type: "array" }
                            }
                        },
                        expiration_hours: { type: "number" },
                        strategic_notes: { type: "string" }
                    }
                }
            });

            // Require approval before submitting
            const approval = await base44.asServiceRole.entities.ApprovalRequest.create({
                action_type: 'submit_negotiation_offer',
                risk_level: 'high',
                details: {
                    offer_type,
                    offer,
                    strategy_id
                },
                estimated_cost: offer.price,
                status: 'pending'
            });

            return Response.json({
                success: true,
                requires_approval: true,
                approval_id: approval.id,
                offer,
                message: `${offer_type} offer generated. Review and approve to submit.`
            });
        }

        if (action === 'analyze_counteroffer') {
            const { strategy_id, counterparty_offer } = params;

            // Retrieve strategy
            const strategyRecord = await base44.asServiceRole.entities.GlobalMemory.filter({ id: strategy_id })[0];
            
            if (!strategyRecord) {
                return Response.json({ error: 'Strategy not found' }, { status: 404 });
            }

            const strategy = strategyRecord.content.strategy;
            const marketAnalysis = strategyRecord.content.market_analysis;

            // Analyze counteroffer
            const analysis = await base44.integrations.Core.InvokeLLM({
                prompt: `Analyze counterparty's offer against our negotiation strategy:

Our Strategy: ${JSON.stringify(strategy)}
Market Analysis: ${JSON.stringify(marketAnalysis)}
Their Counter-Offer: ${JSON.stringify(counterparty_offer)}

Analyze:
1. Gap from our target range
2. Terms favorability assessment
3. Concessions they made vs held firm
4. Hidden costs or risks
5. Signals about their position (strength/weakness)
6. Compliance with our must-haves
7. Deal-breaker violations
8. Overall attractiveness score (0-10)
9. Recommended response strategy
10. Counter-offer parameters

Use game theory to model their likely walkaway point.`,
                response_json_schema: {
                    type: "object",
                    properties: {
                        assessment: {
                            type: "object",
                            properties: {
                                overall_score: { type: "number" },
                                price_gap: { type: "number" },
                                terms_favorability: { type: "string" },
                                deal_breakers: { type: "array" },
                                hidden_costs: { type: "array" }
                            }
                        },
                        counterparty_signals: {
                            type: "object",
                            properties: {
                                negotiation_strength: { type: "string" },
                                urgency_level: { type: "string" },
                                flexibility_indicators: { type: "array" },
                                estimated_walkaway: { type: "number" }
                            }
                        },
                        recommendation: {
                            type: "object",
                            properties: {
                                action: { type: "string", enum: ["accept", "counter", "reject", "request_clarification"] },
                                reasoning: { type: "string" },
                                next_steps: { type: "array" }
                            }
                        }
                    }
                }
            });

            return Response.json({
                success: true,
                analysis,
                message: 'Counter-offer analyzed using market intelligence and game theory'
            });
        }

        if (action === 'generate_counteroffer') {
            const { strategy_id, counterparty_offer, round_number } = params;

            // Retrieve strategy
            const strategyRecord = await base44.asServiceRole.entities.GlobalMemory.filter({ id: strategy_id })[0];
            
            if (!strategyRecord) {
                return Response.json({ error: 'Strategy not found' }, { status: 404 });
            }

            const strategy = strategyRecord.content.strategy;

            // First, analyze their offer
            const analysis = await base44.functions.invoke('negotiationEngine', {
                action: 'analyze_counteroffer',
                params: { strategy_id, counterparty_offer }
            });

            // Generate adaptive counter-offer
            const counteroffer = await base44.integrations.Core.InvokeLLM({
                prompt: `Generate strategic counter-offer (Round ${round_number}):

Original Strategy: ${JSON.stringify(strategy)}
Their Offer: ${JSON.stringify(counterparty_offer)}
Analysis: ${JSON.stringify(analysis)}
Current Round: ${round_number}

Apply adaptive negotiation tactics:
1. Make calculated concessions per our concession plan
2. Request reciprocal concessions
3. Strengthen our position on key terms
4. Use anchoring and framing
5. Create urgency if they're hesitating
6. Signal flexibility on low-priority items
7. Protect deal-breakers
8. Move closer to target range
9. Include deadline pressure if appropriate

Generate counter-offer that:
- Shows good faith movement
- Maintains strategic advantage
- Tests their flexibility
- Moves toward win-win
- Has clear justification for each term`,
                response_json_schema: {
                    type: "object",
                    properties: {
                        counter_price: { type: "number" },
                        price_justification: { type: "string" },
                        concessions_made: { type: "array" },
                        concessions_requested: { type: "array" },
                        terms: { type: "object" },
                        messaging_strategy: { type: "string" },
                        pressure_tactics: { type: "array" },
                        relationship_builders: { type: "array" },
                        expiration_hours: { type: "number" },
                        expected_outcome: { type: "string" }
                    }
                }
            });

            // Require approval
            const approval = await base44.asServiceRole.entities.ApprovalRequest.create({
                action_type: 'submit_counteroffer',
                risk_level: 'high',
                details: {
                    round: round_number,
                    counteroffer,
                    analysis: analysis.analysis,
                    strategy_id
                },
                estimated_cost: counteroffer.counter_price,
                status: 'pending'
            });

            // Update strategy with negotiation history
            strategyRecord.content.negotiation_history = strategyRecord.content.negotiation_history || [];
            strategyRecord.content.negotiation_history.push({
                round: round_number,
                their_offer: counterparty_offer,
                our_counter: counteroffer,
                analysis: analysis.analysis,
                timestamp: Date.now()
            });

            await base44.asServiceRole.entities.GlobalMemory.update(strategyRecord.id, {
                content: strategyRecord.content
            });

            return Response.json({
                success: true,
                requires_approval: true,
                approval_id: approval.id,
                counteroffer,
                analysis: analysis.analysis,
                message: `Counter-offer #${round_number} generated. Approval required before submission.`
            });
        }

        if (action === 'assess_deal') {
            const { strategy_id, final_terms } = params;

            // Retrieve strategy
            const strategyRecord = await base44.asServiceRole.entities.GlobalMemory.filter({ id: strategy_id })[0];
            
            if (!strategyRecord) {
                return Response.json({ error: 'Strategy not found' }, { status: 404 });
            }

            const strategy = strategyRecord.content.strategy;
            const userParams = strategyRecord.content.target;

            // Final assessment
            const assessment = await base44.integrations.Core.InvokeLLM({
                prompt: `Assess final deal terms:

Original Strategy: ${JSON.stringify(strategy)}
User Requirements: ${JSON.stringify(userParams)}
Negotiation History: ${JSON.stringify(strategyRecord.content.negotiation_history || [])}
Final Terms: ${JSON.stringify(final_terms)}

Provide comprehensive assessment:
1. Price vs target range
2. Terms favorability
3. All user requirements met?
4. Deal-breakers avoided?
5. Hidden costs identified
6. Risk assessment
7. Comparison to alternatives
8. Long-term value analysis
9. Negotiation success score
10. Final recommendation (accept/reject/negotiate further)

Be objective and protect user interests.`,
                response_json_schema: {
                    type: "object",
                    properties: {
                        recommendation: { type: "string", enum: ["accept", "reject", "negotiate_further"] },
                        confidence: { type: "number" },
                        score: { type: "number" },
                        strengths: { type: "array" },
                        weaknesses: { type: "array" },
                        risks: { type: "array" },
                        requirements_met: { type: "boolean" },
                        deal_breakers_present: { type: "boolean" },
                        value_analysis: { type: "string" },
                        long_term_outlook: { type: "string" },
                        final_advice: { type: "string" }
                    }
                }
            });

            // If recommendation is accept, require approval
            if (assessment.recommendation === 'accept') {
                const approval = await base44.asServiceRole.entities.ApprovalRequest.create({
                    action_type: 'accept_final_terms',
                    risk_level: 'critical',
                    details: {
                        final_terms,
                        assessment,
                        strategy_id
                    },
                    estimated_cost: final_terms.price || final_terms.amount,
                    status: 'pending'
                });

                return Response.json({
                    success: true,
                    requires_approval: true,
                    approval_id: approval.id,
                    assessment,
                    message: 'Deal assessment complete. CRITICAL: Requires user approval to accept binding agreement.'
                });
            }

            return Response.json({
                success: true,
                assessment,
                message: assessment.recommendation === 'reject' 
                    ? 'Deal assessment recommends REJECTION. Review weaknesses and risks.'
                    : 'Deal assessment recommends further negotiation.'
            });
        }

        if (action === 'get_negotiation_status') {
            const { strategy_id } = params;

            const strategyRecord = await base44.asServiceRole.entities.GlobalMemory.filter({ id: strategy_id })[0];
            
            if (!strategyRecord) {
                return Response.json({ error: 'Strategy not found' }, { status: 404 });
            }

            const history = strategyRecord.content.negotiation_history || [];
            const currentRound = history.length;

            return Response.json({
                success: true,
                status: strategyRecord.content.status,
                current_round: currentRound,
                negotiation_history: history,
                strategy: strategyRecord.content.strategy,
                market_conditions: strategyRecord.content.market_analysis
            });
        }

        return Response.json({ error: 'Invalid action' }, { status: 400 });

    } catch (error) {
        console.error('Negotiation engine error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});