import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { action, asset_id, device_id } = await req.json();

        const apiKey = Deno.env.get('GPS_API_KEY');
        const apiUrl = Deno.env.get('GPS_API_URL');
        const provider = Deno.env.get('GPS_PROVIDER') || 'generic';

        if (!apiKey || !apiUrl) {
            return Response.json({ 
                error: 'GPS service not configured',
                message: 'Please set GPS_API_KEY and GPS_API_URL secrets'
            }, { status: 503 });
        }

        switch (action) {
            case 'get_location':
                return await getDeviceLocation(device_id, apiKey, apiUrl, provider);
            
            case 'track_asset':
                return await trackAsset(base44, asset_id);
            
            case 'update_all_locations':
                return await updateAllAssetLocations(base44, apiKey, apiUrl, provider);
            
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
 * Get real-time location from GPS device
 */
async function getDeviceLocation(deviceId, apiKey, apiUrl, provider) {
    if (!deviceId) {
        return Response.json({ error: 'device_id required' }, { status: 400 });
    }

    try {
        // Generic API call that works with most GPS providers
        const response = await fetch(`${apiUrl}/devices/${deviceId}/location`, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            return Response.json({ 
                error: 'GPS API error',
                status: response.status,
                details: errorText 
            }, { status: response.status });
        }

        const locationData = await response.json();

        // Normalize response based on provider
        const normalized = normalizeLocationResponse(locationData, provider);

        return Response.json({
            success: true,
            device_id: deviceId,
            location: normalized,
            timestamp: Date.now()
        });

    } catch (error) {
        return Response.json({ 
            error: 'Failed to fetch GPS location',
            message: error.message 
        }, { status: 500 });
    }
}

/**
 * Track specific asset by asset_id
 */
async function trackAsset(base44, assetId) {
    if (!assetId) {
        return Response.json({ error: 'asset_id required' }, { status: 400 });
    }

    try {
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

        if (!asset.gps_device_id) {
            return Response.json({ 
                error: 'No GPS device linked to this asset',
                asset_id: assetId,
                suggestion: 'Add gps_device_id to AssetRecord'
            }, { status: 404 });
        }

        // Fetch live GPS location
        const apiKey = Deno.env.get('GPS_API_KEY');
        const apiUrl = Deno.env.get('GPS_API_URL');
        const provider = Deno.env.get('GPS_PROVIDER') || 'generic';

        const response = await fetch(`${apiUrl}/devices/${asset.gps_device_id}/location`, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            return Response.json({ 
                error: 'GPS API error',
                status: response.status 
            }, { status: response.status });
        }

        const locationData = await response.json();
        const normalized = normalizeLocationResponse(locationData, provider);

        // Update asset record with latest location
        await base44.asServiceRole.entities.AssetRecord.update(asset.id, {
            last_known_location: normalized,
            last_location_update: Date.now()
        });

        return Response.json({
            success: true,
            asset_id: assetId,
            asset_type: asset.asset_type,
            weight: asset.weight,
            vault_location: asset.vault_location,
            gps_device_id: asset.gps_device_id,
            current_location: normalized,
            timestamp: Date.now()
        });

    } catch (error) {
        return Response.json({ 
            error: error.message 
        }, { status: 500 });
    }
}

/**
 * Update all asset locations in batch
 */
async function updateAllAssetLocations(base44, apiKey, apiUrl, provider) {
    try {
        const assets = await base44.asServiceRole.entities.AssetRecord.filter({});
        
        const assetsWithGPS = assets.filter(a => a.gps_device_id);
        const updated = [];
        const failed = [];

        for (const asset of assetsWithGPS) {
            try {
                const response = await fetch(`${apiUrl}/devices/${asset.gps_device_id}/location`, {
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json'
                    }
                });

                if (response.ok) {
                    const locationData = await response.json();
                    const normalized = normalizeLocationResponse(locationData, provider);

                    await base44.asServiceRole.entities.AssetRecord.update(asset.id, {
                        last_known_location: normalized,
                        last_location_update: Date.now()
                    });

                    updated.push(asset.asset_id);
                } else {
                    failed.push({ asset_id: asset.asset_id, error: 'API error' });
                }
            } catch (error) {
                failed.push({ asset_id: asset.asset_id, error: error.message });
            }
        }

        return Response.json({
            success: true,
            total_assets: assets.length,
            assets_with_gps: assetsWithGPS.length,
            updated: updated.length,
            failed: failed.length,
            updated_assets: updated,
            failed_assets: failed
        });

    } catch (error) {
        return Response.json({ 
            error: error.message 
        }, { status: 500 });
    }
}

/**
 * Normalize GPS responses from different providers
 */
function normalizeLocationResponse(data, provider) {
    switch (provider) {
        case 'geotab':
            return {
                latitude: data.latitude,
                longitude: data.longitude,
                speed: data.speed,
                heading: data.bearing,
                timestamp: data.dateTime
            };
        
        case 'fleet_complete':
            return {
                latitude: data.lat,
                longitude: data.lng,
                speed: data.speed_mph,
                heading: data.direction,
                timestamp: data.last_update
            };
        
        case 'calamp':
            return {
                latitude: data.location?.latitude,
                longitude: data.location?.longitude,
                speed: data.speed,
                heading: data.heading,
                timestamp: data.timestamp
            };
        
        default:
            // Generic format
            return {
                latitude: data.latitude || data.lat,
                longitude: data.longitude || data.lng || data.lon,
                speed: data.speed || data.velocity,
                heading: data.heading || data.bearing || data.direction,
                timestamp: data.timestamp || data.time || Date.now()
            };
    }
}