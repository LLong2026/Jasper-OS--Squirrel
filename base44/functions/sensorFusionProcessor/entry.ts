import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { action, vehicle_id, sensor_data, fusion_mode } = await req.json();

        switch (action) {
            case 'fuse_sensors':
                return await fuseSensorData(vehicle_id, sensor_data, fusion_mode);
            
            case 'get_environment_model':
                return await getEnvironmentModel(vehicle_id);
            
            case 'detect_objects':
                return await detectObjects(vehicle_id);
            
            default:
                return Response.json({ error: 'Invalid action' }, { status: 400 });
        }

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});

async function fuseSensorData(vehicleId, sensorData, mode) {
    return Response.json({
        success: true,
        vehicle_id: vehicleId,
        fused_data: {
            timestamp: Date.now(),
            environment: {
                objects_detected: 24,
                road_conditions: 'clear',
                weather: 'sunny',
                visibility: 'excellent'
            },
            confidence_scores: {
                lidar: 0.98,
                camera: 0.94,
                radar: 0.97,
                overall: 0.96
            }
        }
    });
}

async function getEnvironmentModel(vehicleId) {
    return Response.json({
        success: true,
        environment_model: {
            static_objects: [
                { type: 'building', position: [10, 20], confidence: 0.99 },
                { type: 'tree', position: [5, 15], confidence: 0.97 }
            ],
            dynamic_objects: [
                { type: 'vehicle', position: [30, 5], velocity: [15, 0], confidence: 0.95 },
                { type: 'pedestrian', position: [12, 8], velocity: [1.2, 0.5], confidence: 0.92 }
            ],
            road_geometry: {
                lanes: 3,
                curvature: 0.02,
                grade: 0.01
            }
        }
    });
}

async function detectObjects(vehicleId) {
    return Response.json({
        success: true,
        detected_objects: [
            { id: 'obj-001', type: 'car', distance: 45.2, bearing: 12, speed: 25 },
            { id: 'obj-002', type: 'pedestrian', distance: 18.5, bearing: -5, speed: 1.5 }
        ]
    });
}