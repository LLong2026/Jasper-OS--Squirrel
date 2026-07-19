import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

// In-memory cache for ultra-fast responses
const marketCache = new Map();
const CACHE_TTL = 30000; // 30 seconds

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { market_request, cache_key, force_refresh = false } = await req.json();
        const requestStartTime = Date.now();
        
        // Check cache first for sub-50ms responses
        if (!force_refresh && cache_key && marketCache.has(cache_key)) {
            const cached = marketCache.get(cache_key);
            if (Date.now() - cached.timestamp < CACHE_TTL) {
                return Response.json({
                    success: true,
                    data: cached.data,
                    cache_hit: true,
                    response_time_ms: Date.now() - requestStartTime,
                    cached_at: cached.timestamp
                });
            } else {
                marketCache.delete(cache_key); // Remove expired cache
            }
        }

        // Process market request with appropriate specialists
        const specialists = {
            'price_analysis': 'financial_analyst',
            'trend_prediction': 'financial_oracle', 
            'tokenomics_analysis': 'dual_tokenomics_expert',
            'economic_impact': 'economist',
            'blockchain_metrics': 'smart_contract_auditor',
            'market_sentiment': 'financial_analyst'
        };

        const specialist = specialists[market_request.type] || 'financial_analyst';
        
        // Ultra-fast parallel processing for complex requests
        const promises = [];
        
        if (market_request.type === 'comprehensive_analysis') {
            // Spawn multiple specialists in parallel
            promises.push(
                base44.asServiceRole.agents.invoke('financial_analyst', {
                    message: `Analyze current market conditions: ${market_request.query}`,
                    context: { priority: 'urgent', max_response_time: '10s' }
                }),
                base44.asServiceRole.agents.invoke('financial_oracle', {
                    message: `Predict short-term market movements: ${market_request.query}`,
                    context: { priority: 'urgent', max_response_time: '10s' }
                }),
                base44.asServiceRole.agents.invoke('economist', {
                    message: `Assess economic implications: ${market_request.query}`,
                    context: { priority: 'urgent', max_response_time: '10s' }
                })
            );
        } else {
            // Single specialist for specific analysis
            promises.push(
                base44.asServiceRole.agents.invoke(specialist, {
                    message: market_request.query,
                    context: { priority: 'urgent', max_response_time: '10s' }
                })
            );
        }

        const results = await Promise.all(promises);
        const processingTime = Date.now() - requestStartTime;
        
        // Aggregate results for comprehensive analysis
        let finalResult;
        if (results.length > 1) {
            finalResult = {
                comprehensive_analysis: true,
                financial_analysis: results[0],
                trend_prediction: results[1],
                economic_impact: results[2],
                synthesis: "Multi-specialist analysis completed"
            };
        } else {
            finalResult = results[0];
        }

        // Cache the result for future ultra-fast retrieval
        if (cache_key) {
            marketCache.set(cache_key, {
                data: finalResult,
                timestamp: Date.now()
            });
            
            // Clean up old cache entries periodically
            if (marketCache.size > 1000) {
                const oldEntries = [...marketCache.entries()]
                    .filter(([_, value]) => Date.now() - value.timestamp > CACHE_TTL);
                oldEntries.forEach(([key]) => marketCache.delete(key));
            }
        }

        return Response.json({
            success: true,
            data: finalResult,
            cache_hit: false,
            response_time_ms: processingTime,
            specialists_used: promises.length,
            performance_target_met: processingTime < 50,
            cache_size: marketCache.size
        });

    } catch (error) {
        return Response.json({
            success: false,
            error: error.message,
            response_time_ms: Date.now() - (req.startTime || Date.now())
        }, { status: 500 });
    }
});