import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

/**
 * Economics Simulator
 * Agent-based simulation for token economies with market dynamics and shock scenarios
 */

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { action, payload } = await req.json();

        if (action === 'run_simulation') {
            const { 
                simulation_graph, 
                validators,
                num_agents = 1000,
                num_steps = 365,
                scenarios = ['baseline'],
                seed = Date.now()
            } = payload;

            const results = [];

            for (const scenario of scenarios) {
                const simResult = await runScenarioSimulation({
                    simulation_graph,
                    validators,
                    num_agents,
                    num_steps,
                    scenario,
                    seed: seed + scenarios.indexOf(scenario)
                });

                results.push({
                    scenario,
                    metrics: simResult.metrics,
                    time_series: simResult.time_series,
                    final_state: simResult.final_state,
                    risk_flags: simResult.risk_flags
                });
            }

            // Compute aggregate metrics across scenarios
            const aggregateMetrics = computeAggregateMetrics(results);

            // Store simulation run
            await base44.asServiceRole.entities.GlobalMemory.create({
                memory_type: 'simulation',
                content: {
                    config: { num_agents, num_steps, scenarios, seed },
                    results,
                    aggregate_metrics: aggregateMetrics
                },
                source_agent: 'EconomicsSimulator',
                confidence_score: 1.0,
                tags: ['tokenomics', 'simulation']
            });

            return Response.json({
                success: true,
                results,
                aggregate_metrics: aggregateMetrics,
                risk_score: aggregateMetrics.overall_risk_score
            });
        }

        if (action === 'stress_test') {
            const { validators, shock_type, intensity } = payload;

            const stressScenarios = generateStressScenarios(shock_type, intensity);
            
            const stressResults = [];
            for (const scenario of stressScenarios) {
                const result = await runScenarioSimulation({
                    simulation_graph: { nodes: [], edges: [] },
                    validators,
                    num_agents: 500,
                    num_steps: 100,
                    scenario: scenario.name,
                    shock_params: scenario.params
                });

                stressResults.push({
                    scenario: scenario.name,
                    severity: scenario.severity,
                    survived: result.final_state.market_alive,
                    max_drawdown: result.metrics.max_price_drawdown,
                    recovery_time: result.metrics.recovery_steps
                });
            }

            return Response.json({
                success: true,
                shock_type,
                intensity,
                stress_results: stressResults,
                passed: stressResults.every(r => r.survived)
            });
        }

        if (action === 'sensitivity_analysis') {
            const { validators, parameter, range_min, range_max, steps = 10 } = payload;

            const results = [];
            const step_size = (range_max - range_min) / steps;

            for (let i = 0; i <= steps; i++) {
                const value = range_min + (i * step_size);
                
                // Modify validators with new parameter value
                const modifiedValidators = JSON.parse(JSON.stringify(validators));
                setParameterValue(modifiedValidators, parameter, value);

                const simResult = await runScenarioSimulation({
                    simulation_graph: { nodes: [], edges: [] },
                    validators: modifiedValidators,
                    num_agents: 500,
                    num_steps: 180,
                    scenario: 'baseline'
                });

                results.push({
                    parameter_value: value,
                    price_volatility: simResult.metrics.price_volatility,
                    inflation_rate: simResult.metrics.inflation_rate,
                    liquidity_depth: simResult.metrics.liquidity_depth,
                    user_retention: simResult.metrics.user_retention
                });
            }

            return Response.json({
                success: true,
                parameter,
                sensitivity_results: results,
                optimal_value: findOptimalValue(results)
            });
        }

        return Response.json({ error: 'Invalid action' }, { status: 400 });

    } catch (error) {
        console.error('Economics Simulator error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});

async function runScenarioSimulation(config) {
    const { validators, num_agents, num_steps, scenario, shock_params, seed } = config;

    // Initialize agents
    const agents = initializeAgents(num_agents, seed);
    
    // Initialize market state
    const marketState = {
        prices: {},
        liquidity_pools: {},
        circulating_supply: {},
        burned: {}
    };

    // Initialize token prices and supplies
    for (const [tokenName, tokenValidator] of Object.entries(validators.tokens || {})) {
        marketState.prices[tokenName] = 1.0;
        marketState.circulating_supply[tokenName] = tokenValidator.supply.initial || 0;
        marketState.burned[tokenName] = 0;
    }

    const time_series = {
        prices: {},
        supplies: {},
        volatility: [],
        gini: [],
        staking_rate: []
    };

    // Initialize time series
    for (const tokenName of Object.keys(marketState.prices)) {
        time_series.prices[tokenName] = [];
        time_series.supplies[tokenName] = [];
    }

    // Run simulation steps
    for (let step = 0; step < num_steps; step++) {
        // Apply shock if in shock scenario
        if (shock_params && step === Math.floor(num_steps / 2)) {
            applyShock(marketState, agents, shock_params);
        }

        // Agent actions
        for (const agent of agents) {
            executeAgentStrategy(agent, marketState, validators);
        }

        // Market dynamics (AMM)
        updateMarketPrices(marketState, agents);

        // Execute flows
        executeFlows(validators.flows || [], marketState);

        // Record metrics
        for (const tokenName of Object.keys(marketState.prices)) {
            time_series.prices[tokenName].push(marketState.prices[tokenName]);
            time_series.supplies[tokenName].push(marketState.circulating_supply[tokenName]);
        }

        time_series.volatility.push(computeVolatility(time_series.prices, step));
        time_series.gini.push(computeGini(agents));
        time_series.staking_rate.push(computeStakingRate(agents));
    }

    // Compute final metrics
    const metrics = {
        avg_price: average(time_series.prices[Object.keys(marketState.prices)[0]] || [1]),
        price_volatility: std(time_series.prices[Object.keys(marketState.prices)[0]] || [1]),
        max_price_drawdown: computeMaxDrawdown(time_series.prices[Object.keys(marketState.prices)[0]] || [1]),
        inflation_rate: computeInflationRate(time_series.supplies),
        final_gini: time_series.gini[time_series.gini.length - 1] || 0,
        liquidity_depth: computeLiquidityDepth(marketState),
        user_retention: computeUserRetention(agents),
        recovery_steps: computeRecoveryTime(time_series.prices)
    };

    const risk_flags = [];
    if (metrics.price_volatility > 0.5) risk_flags.push('HIGH_VOLATILITY');
    if (metrics.final_gini > 0.8) risk_flags.push('HIGH_CONCENTRATION');
    if (metrics.inflation_rate > 0.1) risk_flags.push('HIGH_INFLATION');

    return {
        metrics,
        time_series,
        final_state: {
            market_alive: marketState.prices[Object.keys(marketState.prices)[0]] > 0.01,
            prices: marketState.prices,
            supplies: marketState.circulating_supply
        },
        risk_flags
    };
}

function initializeAgents(num_agents, seed) {
    const agents = [];
    const strategies = ['holder', 'trader', 'liquidity_provider', 'arbitrageur', 'speculator'];
    
    for (let i = 0; i < num_agents; i++) {
        agents.push({
            id: i,
            strategy: strategies[Math.floor((seed + i) % strategies.length)],
            balance: {},
            risk_aversion: 0.3 + (((seed + i) % 100) / 100) * 0.6,
            active: true
        });
    }
    
    return agents;
}

function executeAgentStrategy(agent, marketState, validators) {
    if (!agent.active) return;

    // Simple strategy execution
    if (agent.strategy === 'trader' && Math.random() > 0.5) {
        // Buy or sell
        const tokens = Object.keys(marketState.prices);
        if (tokens.length > 0) {
            const token = tokens[Math.floor(Math.random() * tokens.length)];
            if (!agent.balance[token]) agent.balance[token] = 0;
            agent.balance[token] += (Math.random() - 0.5) * 10;
        }
    }
}

function updateMarketPrices(marketState, agents) {
    // Simple price update based on supply/demand
    for (const tokenName of Object.keys(marketState.prices)) {
        const demand = agents.filter(a => a.balance[tokenName] > 0).length;
        const supply = marketState.circulating_supply[tokenName] || 1;
        
        // Price adjustment (simplified AMM)
        const price_factor = 1 + ((demand / agents.length) - 0.5) * 0.02;
        marketState.prices[tokenName] *= price_factor;
    }
}

function executeFlows(flows, marketState) {
    for (const flow of flows) {
        // Execute flow logic (simplified)
        if (flow.schedule === 'realtime' && flow.from && flow.to) {
            // Transfer tokens according to flow rules
        }
    }
}

function applyShock(marketState, agents, shock_params) {
    if (shock_params.type === 'liquidity_drain') {
        // Reduce liquidity
        for (const token of Object.keys(marketState.prices)) {
            marketState.circulating_supply[token] *= 0.7;
        }
    } else if (shock_params.type === 'demand_spike') {
        // Increase demand
        for (const agent of agents.slice(0, Math.floor(agents.length * 0.3))) {
            agent.active = true;
        }
    }
}

function computeVolatility(prices, step) {
    const tokenPrices = Object.values(prices)[0] || [];
    if (tokenPrices.length < 2) return 0;
    const recent = tokenPrices.slice(Math.max(0, step - 30), step + 1);
    return std(recent);
}

function computeGini(agents) {
    const balances = agents.map(a => 
        Object.values(a.balance).reduce((sum, b) => sum + Math.abs(b), 0)
    ).sort((a, b) => a - b);
    
    if (balances.length === 0) return 0;
    
    const n = balances.length;
    const sum = balances.reduce((a, b) => a + b, 0);
    if (sum === 0) return 0;
    
    let gini = 0;
    for (let i = 0; i < n; i++) {
        gini += (2 * (i + 1) - n - 1) * balances[i];
    }
    
    return gini / (n * sum);
}

function computeStakingRate(agents) {
    return 0.3; // Simplified
}

function computeMaxDrawdown(prices) {
    let max = prices[0] || 1;
    let maxDrawdown = 0;
    
    for (const price of prices) {
        if (price > max) max = price;
        const drawdown = (max - price) / max;
        if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    }
    
    return maxDrawdown;
}

function computeInflationRate(supplies) {
    const tokenSupplies = Object.values(supplies)[0] || [];
    if (tokenSupplies.length < 2) return 0;
    const initial = tokenSupplies[0] || 1;
    const final = tokenSupplies[tokenSupplies.length - 1] || 1;
    return (final - initial) / initial;
}

function computeLiquidityDepth(marketState) {
    return Object.values(marketState.circulating_supply).reduce((a, b) => a + b, 0) / 1000;
}

function computeUserRetention(agents) {
    return agents.filter(a => a.active).length / agents.length;
}

function computeRecoveryTime(prices) {
    const tokenPrices = Object.values(prices)[0] || [];
    // Find recovery time after shock (simplified)
    return tokenPrices.length;
}

function generateStressScenarios(shock_type, intensity) {
    return [
        { name: `${shock_type}_low`, severity: 'low', params: { type: shock_type, intensity: intensity * 0.5 } },
        { name: `${shock_type}_medium`, severity: 'medium', params: { type: shock_type, intensity } },
        { name: `${shock_type}_high`, severity: 'high', params: { type: shock_type, intensity: intensity * 1.5 } }
    ];
}

function setParameterValue(validators, parameter, value) {
    // Navigate and set parameter in validators object
    const path = parameter.split('.');
    let obj = validators;
    for (let i = 0; i < path.length - 1; i++) {
        obj = obj[path[i]];
    }
    obj[path[path.length - 1]] = value;
}

function findOptimalValue(results) {
    // Find parameter value that minimizes volatility while maximizing retention
    let bestScore = -Infinity;
    let bestValue = null;
    
    for (const result of results) {
        const score = result.user_retention - result.price_volatility;
        if (score > bestScore) {
            bestScore = score;
            bestValue = result.parameter_value;
        }
    }
    
    return bestValue;
}

function computeAggregateMetrics(results) {
    const avgPrice = average(results.map(r => r.metrics.avg_price));
    const maxVolatility = Math.max(...results.map(r => r.metrics.price_volatility));
    const avgInflation = average(results.map(r => r.metrics.inflation_rate));
    
    const overall_risk_score = (maxVolatility * 0.4 + avgInflation * 0.3 + (1 - average(results.map(r => r.metrics.user_retention))) * 0.3);
    
    return {
        avg_price: avgPrice,
        max_volatility: maxVolatility,
        avg_inflation: avgInflation,
        overall_risk_score,
        risk_level: overall_risk_score > 0.7 ? 'high' : overall_risk_score > 0.4 ? 'medium' : 'low'
    };
}

function average(arr) {
    return arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

function std(arr) {
    const avg = average(arr);
    const squareDiffs = arr.map(value => Math.pow(value - avg, 2));
    return Math.sqrt(average(squareDiffs));
}