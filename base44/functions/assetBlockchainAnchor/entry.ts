import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { action, asset_id, operation, data } = await req.json();

        switch (action) {
            case 'anchor_asset_change':
                return await anchorAssetChange(base44, asset_id, operation, data, user);
            
            case 'get_asset_history':
                return await getAssetBlockchainHistory(base44, asset_id);
            
            case 'verify_asset_integrity':
                return await verifyAssetIntegrity(base44, asset_id);
            
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
 * Anchor asset record change to blockchain via Satoshi Covenant
 */
async function anchorAssetChange(base44, assetId, operation, data, user) {
    try {
        // Get current asset state
        const assets = await base44.asServiceRole.entities.AssetRecord.filter({ 
            asset_id: assetId 
        });

        if (!assets || assets.length === 0) {
            return Response.json({ 
                error: 'Asset not found',
                asset_id: assetId 
            }, { status: 404 });
        }

        const asset = assets[0];

        // Create data anchor payload
        const anchorData = {
            asset_id: assetId,
            operation: operation, // 'create', 'update', 'transfer', 'delete'
            previous_state: operation === 'update' ? {
                weight: asset.weight,
                owner_did: asset.owner_did,
                vault_location: asset.vault_location,
                gps_device_id: asset.gps_device_id
            } : null,
            new_state: data,
            timestamp: Date.now(),
            actor: user.email,
            metadata: {
                asset_type: asset.asset_type,
                purity: asset.purity
            }
        };

        // Anchor to blockchain via universalAppConnector
        const anchorResult = await base44.functions.invoke('universalAppConnector', {
            action: 'interact',
            target_app_id: '695838f446e480d589e752b9', // Texas Sovereign Ledger
            entity_name: 'DataAnchor',
            operation: 'create',
            data: {
                data_type: 'asset_record_change',
                data_hash: await generateHash(JSON.stringify(anchorData)),
                payload: anchorData,
                source_app: 'vault_management',
                integrity_verified: true
            }
        });

        // Create Satoshi Covenant if transfer or significant change
        let covenantTxId = null;
        if (operation === 'transfer' || operation === 'create') {
            const covenantResult = await base44.functions.invoke('universalAppConnector', {
                action: 'interact',
                target_app_id: '695838f446e480d589e752b9',
                entity_name: 'SatoshiCovenant',
                operation: 'create',
                data: {
                    covenant_type: operation === 'transfer' ? 'asset_transfer' : 'asset_creation',
                    asset_id: assetId,
                    conditions: {
                        asset_type: asset.asset_type,
                        minimum_weight: asset.weight,
                        vault_location: asset.vault_location
                    },
                    parties: [user.email, data.new_owner || asset.owner_did],
                    status: 'active',
                    blockchain_anchor: anchorResult.data?.data?.id || 'pending'
                }
            });

            covenantTxId = covenantResult.data?.data?.id;
        }

        // Update asset record with blockchain reference
        await base44.asServiceRole.entities.AssetRecord.update(asset.id, {
            satoshi_anchor: covenantTxId || anchorResult.data?.data?.id,
            last_blockchain_update: Date.now()
        });

        return Response.json({
            success: true,
            asset_id: assetId,
            operation: operation,
            anchor_id: anchorResult.data?.data?.id,
            covenant_id: covenantTxId,
            blockchain_confirmed: true,
            timestamp: Date.now()
        });

    } catch (error) {
        return Response.json({ 
            error: error.message,
            details: 'Failed to anchor asset change to blockchain'
        }, { status: 500 });
    }
}

/**
 * Get complete blockchain history for an asset
 */
async function getAssetBlockchainHistory(base44, assetId) {
    try {
        // Fetch all data anchors for this asset
        const anchorsResult = await base44.functions.invoke('universalAppConnector', {
            action: 'interact',
            target_app_id: '695838f446e480d589e752b9',
            entity_name: 'DataAnchor',
            operation: 'query',
            filters: { 'payload.asset_id': assetId },
            limit: 1000
        });

        // Fetch all covenants for this asset
        const covenantsResult = await base44.functions.invoke('universalAppConnector', {
            action: 'interact',
            target_app_id: '695838f446e480d589e752b9',
            entity_name: 'SatoshiCovenant',
            operation: 'query',
            filters: { asset_id: assetId },
            limit: 1000
        });

        const anchors = anchorsResult.data?.data || [];
        const covenants = covenantsResult.data?.data || [];

        // Build timeline
        const timeline = [
            ...anchors.map(a => ({
                type: 'anchor',
                operation: a.payload?.operation,
                timestamp: a.payload?.timestamp || a.created_date,
                actor: a.payload?.actor,
                data: a.payload,
                hash: a.data_hash,
                id: a.id
            })),
            ...covenants.map(c => ({
                type: 'covenant',
                covenant_type: c.covenant_type,
                timestamp: c.created_date,
                parties: c.parties,
                status: c.status,
                conditions: c.conditions,
                id: c.id
            }))
        ].sort((a, b) => b.timestamp - a.timestamp);

        return Response.json({
            success: true,
            asset_id: assetId,
            total_events: timeline.length,
            timeline: timeline,
            anchors_count: anchors.length,
            covenants_count: covenants.length
        });

    } catch (error) {
        return Response.json({ 
            error: error.message 
        }, { status: 500 });
    }
}

/**
 * Verify asset integrity against blockchain
 */
async function verifyAssetIntegrity(base44, assetId) {
    try {
        const assets = await base44.asServiceRole.entities.AssetRecord.filter({ 
            asset_id: assetId 
        });

        if (!assets || assets.length === 0) {
            return Response.json({ 
                error: 'Asset not found' 
            }, { status: 404 });
        }

        const asset = assets[0];

        // Fetch blockchain history
        const historyResult = await getAssetBlockchainHistory(base44, assetId);
        const historyData = await historyResult.json();

        if (!historyData.success) {
            return Response.json({ 
                error: 'Failed to fetch blockchain history' 
            }, { status: 500 });
        }

        const timeline = historyData.timeline;

        // Verify current state matches last blockchain anchor
        const lastAnchor = timeline.find(t => t.type === 'anchor');
        
        let integrity_valid = true;
        let discrepancies = [];

        if (lastAnchor) {
            const lastState = lastAnchor.data?.new_state || lastAnchor.data?.previous_state;
            
            if (lastState) {
                if (lastState.weight !== asset.weight) {
                    integrity_valid = false;
                    discrepancies.push(`Weight mismatch: blockchain=${lastState.weight}, current=${asset.weight}`);
                }
                if (lastState.owner_did !== asset.owner_did) {
                    integrity_valid = false;
                    discrepancies.push(`Owner mismatch: blockchain=${lastState.owner_did}, current=${asset.owner_did}`);
                }
            }
        }

        return Response.json({
            success: true,
            asset_id: assetId,
            integrity_valid: integrity_valid,
            discrepancies: discrepancies,
            blockchain_events: timeline.length,
            last_verified: Date.now()
        });

    } catch (error) {
        return Response.json({ 
            error: error.message 
        }, { status: 500 });
    }
}

/**
 * Generate SHA-256 hash
 */
async function generateHash(data) {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}