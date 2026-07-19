import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

/**
 * Token DSL Compiler
 * Compiles declarative token specs into runtime validators, smart-contract templates, and simulation graphs
 */

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user || user.role !== 'admin') {
            return Response.json({ error: 'Unauthorized - Admin only' }, { status: 401 });
        }

        const { action, payload } = await req.json();

        if (action === 'compile_token_spec') {
            const { dsl_source, project_id, version } = payload;
            
            // Parse DSL and validate syntax
            const parseResult = parseDSL(dsl_source);
            if (!parseResult.valid) {
                return Response.json({
                    success: false,
                    errors: parseResult.errors,
                    line_numbers: parseResult.error_lines
                }, { status: 400 });
            }

            // Static analysis for safety invariants
            const safetyChecks = performSafetyChecks(parseResult.ast);
            if (safetyChecks.critical_violations.length > 0) {
                return Response.json({
                    success: false,
                    safety_violations: safetyChecks.critical_violations,
                    message: 'DSL contains critical safety violations'
                }, { status: 400 });
            }

            // Generate runtime validators (JSON)
            const validators = generateValidators(parseResult.ast);
            
            // Generate smart contract templates
            const contractTemplates = generateContractTemplates(parseResult.ast);
            
            // Generate simulation graph
            const simulationGraph = generateSimulationGraph(parseResult.ast);
            
            // Create audit manifest
            const manifest = {
                project_id,
                version,
                dsl_source_hash: await hashContent(dsl_source),
                compiled_at: Date.now(),
                compiler_version: '1.0.0',
                validators_hash: await hashContent(JSON.stringify(validators)),
                contracts_hash: await hashContent(JSON.stringify(contractTemplates)),
                simulation_graph_hash: await hashContent(JSON.stringify(simulationGraph)),
                safety_checks: safetyChecks,
                warnings: safetyChecks.warnings
            };

            // Anchor the compilation artifacts
            const anchorResult = await base44.functions.invoke('tokenAuditAnchoring', {
                action: 'anchor_compilation',
                payload: {
                    manifest,
                    artifacts: {
                        dsl_source,
                        validators,
                        contract_templates: contractTemplates,
                        simulation_graph: simulationGraph
                    }
                }
            });

            // Store compilation result in database
            await base44.asServiceRole.entities.GlobalMemory.create({
                memory_type: 'compilation',
                content: {
                    manifest,
                    anchor_cid: anchorResult.data.ipfs_cid,
                    merkle_root: anchorResult.data.merkle_root
                },
                source_agent: 'TokenDSLCompiler',
                confidence_score: 1.0,
                tags: ['tokenomics', 'compilation', project_id, `v${version}`]
            });

            return Response.json({
                success: true,
                manifest,
                validators,
                contract_templates: contractTemplates,
                simulation_graph: simulationGraph,
                anchor_cid: anchorResult.data.ipfs_cid,
                merkle_root: anchorResult.data.merkle_root,
                warnings: safetyChecks.warnings
            });
        }

        if (action === 'validate_spec') {
            const { dsl_source } = payload;
            
            const parseResult = parseDSL(dsl_source);
            if (!parseResult.valid) {
                return Response.json({
                    valid: false,
                    errors: parseResult.errors
                });
            }

            const safetyChecks = performSafetyChecks(parseResult.ast);
            
            return Response.json({
                valid: safetyChecks.critical_violations.length === 0,
                critical_violations: safetyChecks.critical_violations,
                warnings: safetyChecks.warnings,
                ast: parseResult.ast
            });
        }

        return Response.json({ error: 'Invalid action' }, { status: 400 });

    } catch (error) {
        console.error('Token DSL Compiler error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});

function parseDSL(source) {
    try {
        const ast = {
            tokens: [],
            flows: [],
            staking: [],
            bonding_curves: [],
            oracles: [],
            compliance: [],
            simulation: {}
        };

        const lines = source.split('\n');
        let currentBlock = null;
        let currentObject = null;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line || line.startsWith('//')) continue;

            // Parse token blocks
            if (line.startsWith('token ')) {
                const match = line.match(/token\s+(\w+)\s*\{/);
                if (match) {
                    currentBlock = 'token';
                    currentObject = { name: match[1], properties: {} };
                }
            } else if (line.startsWith('flow ')) {
                const match = line.match(/flow\s+(\w+)\s*\{/);
                if (match) {
                    currentBlock = 'flow';
                    currentObject = { name: match[1], properties: {} };
                }
            } else if (line.startsWith('staking ')) {
                currentBlock = 'staking';
                currentObject = { properties: {} };
            } else if (line === '}' && currentObject) {
                if (currentBlock === 'token') ast.tokens.push(currentObject);
                else if (currentBlock === 'flow') ast.flows.push(currentObject);
                else if (currentBlock === 'staking') ast.staking.push(currentObject);
                currentBlock = null;
                currentObject = null;
            } else if (currentObject && line.includes(':')) {
                const [key, ...valueParts] = line.split(':');
                const value = valueParts.join(':').trim().replace(/,$/, '');
                currentObject.properties[key.trim()] = value;
            }
        }

        return { valid: true, ast, errors: [] };
    } catch (error) {
        return {
            valid: false,
            errors: [error.message],
            error_lines: []
        };
    }
}

function performSafetyChecks(ast) {
    const critical_violations = [];
    const warnings = [];

    // Check for tokens
    if (ast.tokens.length === 0) {
        critical_violations.push('No tokens defined in specification');
    }

    // Check each token for basic safety
    for (const token of ast.tokens) {
        const props = token.properties;

        // Supply cap check
        if (props.type === 'GOVERNANCE' && !props.supply?.includes('cap')) {
            warnings.push(`Token ${token.name}: Governance token should have supply cap`);
        }

        // Mint rules check
        if (!props.mint_rules) {
            warnings.push(`Token ${token.name}: No mint rules defined`);
        }

        // Check for negative supply possibility
        if (props.supply && props.supply.includes('elastic') && !props.burn_rules) {
            warnings.push(`Token ${token.name}: Elastic supply without burn rules may cause inflation`);
        }
    }

    // Check for circular flows
    const flowGraph = new Map();
    for (const flow of ast.flows) {
        const from = flow.properties.from;
        const to = flow.properties.to;
        if (!flowGraph.has(from)) flowGraph.set(from, []);
        flowGraph.get(from).push(to);
    }

    // Simple cycle detection
    for (const [start, destinations] of flowGraph.entries()) {
        if (destinations.includes(start)) {
            critical_violations.push(`Circular flow detected: ${start} -> ${start}`);
        }
    }

    return { critical_violations, warnings };
}

function generateValidators(ast) {
    const validators = {
        version: '1.0.0',
        tokens: {},
        flows: [],
        constraints: []
    };

    for (const token of ast.tokens) {
        validators.tokens[token.name] = {
            type: token.properties.type || 'UTILITY',
            supply: parseSupplyRules(token.properties.supply),
            mint_rules: parseMintRules(token.properties.mint_rules),
            burn_rules: parseBurnRules(token.properties.burn_rules),
            governance: parseGovernanceRules(token.properties.governance)
        };
    }

    for (const flow of ast.flows) {
        validators.flows.push({
            id: flow.name,
            from: flow.properties.from,
            to: flow.properties.to,
            amount_expr: flow.properties.amount_expr || '0',
            schedule: flow.properties.schedule || 'realtime',
            condition: flow.properties.condition || 'true'
        });
    }

    return validators;
}

function generateContractTemplates(ast) {
    const templates = [];

    for (const token of ast.tokens) {
        templates.push({
            name: token.name,
            type: 'ERC20',
            constructor_params: {
                name: token.name,
                symbol: token.name.substring(0, 4).toUpperCase(),
                initial_supply: extractInitialSupply(token.properties.supply)
            },
            features: {
                mintable: !!token.properties.mint_rules,
                burnable: !!token.properties.burn_rules,
                pausable: true,
                permit: true
            },
            governance: token.properties.governance ? {
                voting: true,
                timelock: true
            } : null
        });
    }

    return templates;
}

function generateSimulationGraph(ast) {
    return {
        nodes: ast.tokens.map(t => ({
            id: t.name,
            type: 'token',
            properties: t.properties
        })),
        edges: ast.flows.map(f => ({
            from: f.properties.from,
            to: f.properties.to,
            weight: f.properties.amount_expr || '1'
        })),
        agents: ast.simulation?.agents || 1000,
        scenarios: ast.simulation?.scenarios || ['baseline', 'stress']
    };
}

function parseSupplyRules(supply) {
    if (!supply) return { type: 'fixed', cap: 1000000 };
    return {
        type: supply.includes('elastic') ? 'elastic' : 'fixed',
        cap: extractNumber(supply, 'cap') || null,
        initial: extractNumber(supply, 'initial') || 0
    };
}

function parseMintRules(rules) {
    if (!rules) return null;
    return {
        raw: rules,
        requires_approval: rules.includes('requires_approval'),
        threshold: extractNumber(rules, 'threshold')
    };
}

function parseBurnRules(rules) {
    if (!rules) return null;
    return {
        raw: rules,
        on_fee: rules.includes('on_fee'),
        basis_points: extractNumber(rules, 'basis_points')
    };
}

function parseGovernanceRules(rules) {
    if (!rules) return null;
    return {
        raw: rules,
        staking_required: rules.includes('staking_required'),
        min_vote: extractNumber(rules, 'min_vote')
    };
}

function extractNumber(text, key) {
    const match = text?.match(new RegExp(`${key}[=:]\\s*([\\d_,]+)`));
    return match ? parseInt(match[1].replace(/[_,]/g, '')) : null;
}

function extractInitialSupply(supply) {
    return extractNumber(supply, 'initial') || extractNumber(supply, 'cap') || 1000000;
}

async function hashContent(content) {
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}