import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { action, contract_id, asset_id, contract_config } = await req.json();

        switch (action) {
            case 'create_contract':
                return await createSmartContract(base44, asset_id, contract_config, user);
            
            case 'execute_contract':
                return await executeSmartContract(base44, contract_id);
            
            case 'monitor_contracts':
                return await monitorActiveContracts(base44);
            
            default:
                return Response.json({ error: 'Invalid action' }, { status: 400 });
        }

    } catch (error) {
        return Response.json({ 
            error: error.message,
            stack: error.stack 
        }, { status: 500 });
    }
});

/**
 * Create smart contract for automated asset management
 */
async function createSmartContract(base44, assetId, config, user) {
    try {
        const { 
            contract_type, 
            trigger_conditions, 
            actions, 
            expiry_date 
        } = config;

        // Create Satoshi Covenant for the contract
        const covenantResult = await base44.functions.invoke('universalAppConnector', {
            action: 'interact',
            target_app_id: '695838f446e480d589e752b9',
            entity_name: 'SatoshiCovenant',
            operation: 'create',
            data: {
                covenant_type: 'smart_contract',
                asset_id: assetId,
                conditions: {
                    contract_type: contract_type,
                    triggers: trigger_conditions,
                    automated_actions: actions,
                    expiry: expiry_date
                },
                parties: [user.email],
                status: 'active',
                execution_rules: {
                    auto_execute: true,
                    require_confirmation: actions.includes('transfer'),
                    max_executions: actions.includes('recurring') ? 9999 : 1
                }
            }
        });

        return Response.json({
            success: true,
            contract_id: covenantResult.data?.data?.id,
            asset_id: assetId,
            contract_type: contract_type,
            status: 'active',
            created_by: user.email,
            blockchain_anchor: covenantResult.data?.data?.blockchain_anchor
        });

    } catch (error) {
        return Response.json({ 
            error: error.message 
        }, { status: 500 });
    }
}

/**
 * Execute smart contract based on conditions
 */
async function executeSmartContract(base44, contractId) {
    try {
        // Fetch contract covenant
        const covenantResult = await base44.functions.invoke('universalAppConnector', {
            action: 'interact',
            target_app_id: '695838f446e480d589e752b9',
            entity_name: 'SatoshiCovenant',
            operation: 'get',
            data: { id: contractId }
        });

        const covenant = covenantResult.data?.data;

        if (!covenant) {
            return Response.json({ 
                error: 'Contract not found' 
            }, { status: 404 });
        }

        const { asset_id, conditions } = covenant;
        const { triggers, automated_actions } = conditions;

        // Fetch asset
        const assets = await base44.asServiceRole.entities.AssetRecord.filter({ 
            asset_id: asset_id 
        });

        if (!assets || assets.length === 0) {
            return Response.json({ 
                error: 'Asset not found' 
            }, { status: 404 });
        }

        const asset = assets[0];

        // Check trigger conditions
        const triggered = await evaluateTriggers(base44, asset, triggers);

        if (!triggered.should_execute) {
            return Response.json({
                success: false,
                contract_id: contractId,
                executed: false,
                reason: triggered.reason
            });
        }

        // Execute automated actions
        const executionResults = [];

        for (const action of automated_actions) {
            const result = await executeAction(base44, asset, action);
            executionResults.push(result);
        }

        // Update covenant status
        await base44.functions.invoke('universalAppConnector', {
            action: 'interact',
            target_app_id: '695838f446e480d589e752b9',
            entity_name: 'SatoshiCovenant',
            operation: 'update',
            data: {
                id: contractId,
                last_execution: Date.now(),
                execution_count: (covenant.execution_count || 0) + 1
            }
        });

        return Response.json({
            success: true,
            contract_id: contractId,
            executed: true,
            trigger_reason: triggered.reason,
            actions_executed: executionResults,
            timestamp: Date.now()
        });

    } catch (error) {
        return Response.json({ 
            error: error.message 
        }, { status: 500 });
    }
}

/**
 * Evaluate trigger conditions
 */
async function evaluateTriggers(base44, asset, triggers) {
    try {
        // Location-based triggers
        if (triggers.location_exit && asset.last_known_location) {
            const { latitude, longitude } = asset.last_known_location;
            const vault_coords = parseVaultCoordinates(asset.vault_location);
            
            if (vault_coords) {
                const distance = calculateDistance(
                    latitude, longitude,
                    vault_coords.lat, vault_coords.lng
                );
                
                if (distance > triggers.location_exit.radius_miles) {
                    return {
                        should_execute: true,
                        reason: `Asset moved ${distance.toFixed(2)} miles from vault`
                    };
                }
            }
        }

        // Time-based triggers
        if (triggers.time_based) {
            const now = Date.now();
            if (now >= triggers.time_based.execute_at) {
                return {
                    should_execute: true,
                    reason: 'Scheduled time reached'
                };
            }
        }

        // Ownership change triggers
        if (triggers.ownership_change && asset.owner_did !== triggers.ownership_change.previous_owner) {
            return {
                should_execute: true,
                reason: 'Ownership changed'
            };
        }

        // Blockchain event triggers
        if (triggers.blockchain_event) {
            const historyResult = await base44.functions.invoke('assetBlockchainAnchor', {
                action: 'get_asset_history',
                asset_id: asset.asset_id
            });

            const history = historyResult.data;
            const recentEvents = history?.timeline?.slice(0, 5) || [];

            if (recentEvents.some(e => e.operation === triggers.blockchain_event.event_type)) {
                return {
                    should_execute: true,
                    reason: `Blockchain event detected: ${triggers.blockchain_event.event_type}`
                };
            }
        }

        return {
            should_execute: false,
            reason: 'No trigger conditions met'
        };

    } catch (error) {
        return {
            should_execute: false,
            reason: `Error evaluating triggers: ${error.message}`
        };
    }
}

/**
 * Execute automated action
 */
async function executeAction(base44, asset, action) {
    try {
        switch (action.type) {
            case 'alert':
                // Send alert notification
                await base44.integrations.Core.SendEmail({
                    to: action.recipient,
                    subject: `Asset Alert: ${asset.asset_id}`,
                    body: action.message || `Automated action triggered for asset ${asset.asset_id}`
                });
                return { action: 'alert', success: true };

            case 'update_location':
                // Fetch latest GPS location
                await base44.functions.invoke('gpsTracker', {
                    action: 'track_asset',
                    asset_id: asset.asset_id
                });
                return { action: 'update_location', success: true };

            case 'transfer':
                // Initiate transfer (requires approval)
                await base44.asServiceRole.entities.AssetRecord.update(asset.id, {
                    pending_transfer: {
                        new_owner: action.new_owner,
                        initiated_by: 'smart_contract',
                        requires_approval: true
                    }
                });
                return { action: 'transfer', success: true, pending_approval: true };

            case 'anchor_to_blockchain':
                // Create blockchain anchor
                await base44.functions.invoke('assetBlockchainAnchor', {
                    action: 'anchor_asset_change',
                    asset_id: asset.asset_id,
                    operation: 'automated_update',
                    data: { automated: true }
                });
                return { action: 'anchor_to_blockchain', success: true };

            default:
                return { action: action.type, success: false, error: 'Unknown action type' };
        }
    } catch (error) {
        return { action: action.type, success: false, error: error.message };
    }
}

/**
 * Monitor all active smart contracts
 */
async function monitorActiveContracts(base44) {
    try {
        // Fetch all active contracts
        const covenantsResult = await base44.functions.invoke('universalAppConnector', {
            action: 'interact',
            target_app_id: '695838f446e480d589e752b9',
            entity_name: 'SatoshiCovenant',
            operation: 'query',
            filters: { covenant_type: 'smart_contract', status: 'active' },
            limit: 1000
        });

        const contracts = covenantsResult.data?.data || [];
        const executionResults = [];

        // Execute each contract
        for (const contract of contracts) {
            const result = await executeSmartContract(base44, contract.id);
            const resultData = await result.json();
            
            if (resultData.executed) {
                executionResults.push({
                    contract_id: contract.id,
                    asset_id: contract.asset_id,
                    executed: true,
                    timestamp: Date.now()
                });
            }
        }

        return Response.json({
            success: true,
            total_contracts: contracts.length,
            executed_count: executionResults.length,
            executions: executionResults
        });

    } catch (error) {
        return Response.json({ 
            error: error.message 
        }, { status: 500 });
    }
}

/**
 * Parse vault coordinates from location string
 */
function parseVaultCoordinates(vaultLocation) {
    // Example: "Texas Bullion Depository (30.2849°N, 97.7341°W)"
    const match = vaultLocation?.match(/([\d.]+)°[NS],?\s*([\d.]+)°[EW]/);
    if (match) {
        return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
    }
    return null;
}

/**
 * Calculate distance between two coordinates (Haversine formula)
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 3958.8; // Earth radius in miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}