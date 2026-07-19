import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

/**
 * IoT Network Scanner
 * Discovers and identifies IoT devices on local network
 */

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { action, payload } = await req.json();

        if (action === 'scan_network') {
            const { network_range = '192.168.1.0/24', scan_timeout = 30000 } = payload;

            // Multi-protocol discovery
            const discoveries = await Promise.all([
                discoverMDNS(),
                discoverUPnP(),
                discoverSSDP(),
                scanIPRange(network_range)
            ]);

            const allDevices = discoveries.flat();
            const uniqueDevices = deduplicateDevices(allDevices);

            // Identify each device
            const identifiedDevices = [];
            for (const device of uniqueDevices) {
                const identified = await identifyDevice(device, base44);
                identifiedDevices.push(identified);
            }

            // Store discovered devices
            for (const device of identifiedDevices) {
                const existing = await base44.asServiceRole.entities.IoTDevice.filter({
                    ip_address: device.ip_address
                });

                if (existing.length > 0) {
                    await base44.asServiceRole.entities.IoTDevice.update(existing[0].id, {
                        ...device,
                        last_seen: Date.now(),
                        is_online: true
                    });
                } else {
                    await base44.asServiceRole.entities.IoTDevice.create({
                        ...device,
                        device_id: `iot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                        last_seen: Date.now(),
                        is_online: true
                    });
                }
            }

            return Response.json({
                success: true,
                devices_discovered: identifiedDevices.length,
                devices: identifiedDevices,
                protocols_used: [...new Set(identifiedDevices.map(d => d.protocol))]
            });
        }

        if (action === 'get_devices') {
            const { device_type_filter, online_only = true } = payload;

            let filter = {};
            if (device_type_filter) filter.device_type = device_type_filter;
            if (online_only) filter.is_online = true;

            const devices = await base44.asServiceRole.entities.IoTDevice.filter(filter);

            return Response.json({
                success: true,
                devices
            });
        }

        if (action === 'identify_device') {
            const { ip_address } = payload;

            const deviceInfo = await probeDevice(ip_address);
            const identified = await identifyDevice(deviceInfo, base44);

            return Response.json({
                success: true,
                device: identified
            });
        }

        return Response.json({ error: 'Invalid action' }, { status: 400 });

    } catch (error) {
        console.error('IoT network scanner error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});

async function discoverMDNS() {
    // mDNS/Bonjour discovery
    // In production, use actual mDNS library
    const services = [
        '_http._tcp.local.',
        '_hap._tcp.local.',      // HomeKit
        '_googlecast._tcp.local.', // Chromecast
        '_airplay._tcp.local.',   // AirPlay
        '_spotify-connect._tcp.local.'
    ];

    return []; // Placeholder - requires native mDNS implementation
}

async function discoverUPnP() {
    // UPnP discovery
    return []; // Placeholder
}

async function discoverSSDP() {
    // SSDP (Simple Service Discovery Protocol)
    return []; // Placeholder
}

async function scanIPRange(range) {
    // Basic IP range scan
    // In production, implement actual network scanning
    const devices = [];
    
    // Placeholder: Return empty for now
    // Real implementation would ping each IP in range
    
    return devices;
}

async function probeDevice(ipAddress) {
    try {
        // Try HTTP probe
        const response = await fetch(`http://${ipAddress}`, {
            signal: AbortSignal.timeout(3000)
        });

        const headers = Object.fromEntries(response.headers.entries());
        
        return {
            ip_address: ipAddress,
            http_accessible: true,
            http_headers: headers,
            status_code: response.status
        };
    } catch (error) {
        return {
            ip_address: ipAddress,
            http_accessible: false,
            error: error.message
        };
    }
}

async function identifyDevice(deviceInfo, base44) {
    // Use LLM to identify device based on probe data
    const identification = await base44.integrations.Core.InvokeLLM({
        prompt: `Identify this IoT device based on network probe data:

IP Address: ${deviceInfo.ip_address}
HTTP Headers: ${JSON.stringify(deviceInfo.http_headers || {})}
MAC Address: ${deviceInfo.mac_address || 'unknown'}

Determine:
1. What type of device is this? (light, thermostat, camera, etc.)
2. What manufacturer/brand?
3. What protocol does it use?
4. What capabilities does it have?
5. What API endpoint should be used?

Common IoT devices:
- Philips Hue (lights, HTTP API)
- Nest (thermostat, HTTP)
- Ring (camera, HTTP)
- Sonos (speaker, HTTP)
- Smart plugs (TP-Link, Wemo)
- HomeKit devices`,
        response_json_schema: {
            type: "object",
            properties: {
                device_type: { type: "string" },
                device_name: { type: "string" },
                manufacturer: { type: "string" },
                model: { type: "string" },
                protocol: { type: "string" },
                capabilities: { type: "array", items: { type: "string" } },
                api_endpoint: { type: "string" },
                confidence: { type: "number" }
            }
        }
    });

    return {
        ...deviceInfo,
        ...identification
    };
}

function deduplicateDevices(devices) {
    const seen = new Set();
    return devices.filter(device => {
        const key = device.ip_address || device.mac_address;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}