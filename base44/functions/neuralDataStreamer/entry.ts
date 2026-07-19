import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { action, device_id, signal_type, processing_mode } = await req.json();

        switch (action) {
            case 'stream_data':
                return await streamNeuralData(device_id, signal_type);
            
            case 'analyze_signals':
                return await analyzeNeuralSignals(device_id, processing_mode);
            
            case 'decode_intent':
                return await decodeUserIntent(device_id);
            
            default:
                return Response.json({ error: 'Invalid action' }, { status: 400 });
        }

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});

async function streamNeuralData(deviceId, signalType) {
    return Response.json({
        success: true,
        device_id: deviceId,
        stream: {
            signal_quality: 0.94,
            sampling_rate: 30000,
            channels: 1024,
            data_buffer_size: 2048,
            latency_ms: 3.2
        }
    });
}

async function analyzeNeuralSignals(deviceId, mode) {
    return Response.json({
        success: true,
        analysis: {
            detected_patterns: ['motor_intent', 'visual_attention'],
            confidence: 0.87,
            signal_to_noise: 24.3,
            artifacts_removed: 12
        }
    });
}

async function decodeUserIntent(deviceId) {
    return Response.json({
        success: true,
        intent: {
            action: 'move_cursor',
            direction: 'right',
            magnitude: 0.7,
            confidence: 0.91
        }
    });
}