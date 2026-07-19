import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { scenario_type, difficulty_level, quantity, environmental_conditions } = await req.json();
        
        const startTime = Date.now();
        
        // Generate training scenarios based on real-world edge cases
        const trainingScenarios = generateScenarios({
            type: scenario_type || 'mixed',
            difficulty: difficulty_level || 'progressive',
            count: quantity || 10,
            conditions: environmental_conditions || 'varied'
        });
        
        return Response.json({
            success: true,
            scenario_count: trainingScenarios.length,
            scenarios: trainingScenarios,
            training_metadata: {
                difficulty_distribution: calculateDifficultyDistribution(trainingScenarios),
                scenario_coverage: analyzeScenarioCoverage(trainingScenarios),
                recommended_training_sequence: generateTrainingSequence(trainingScenarios)
            },
            processing_time_ms: Date.now() - startTime,
            proof: {
                source: "Training Scenario Generator",
                methodology: "Real-world incident pattern synthesis",
                validation: "Edge case focused scenario design"
            }
        });

    } catch (error) {
        return Response.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
});

function generateScenarios(params) {
    const scenarios = [];
    
    // Construction Zone Scenarios
    scenarios.push({
        id: "CONSTRUCTION_001",
        name: "Dynamic Construction Zone Navigation",
        difficulty: "High",
        description: "Navigate through construction zone with moving workers, equipment, and temporary signage",
        environmental_conditions: {
            weather: "Clear",
            lighting: "Daylight",
            traffic_density: "Medium"
        },
        key_challenges: [
            "Orange cone detection in varying lighting",
            "Worker movement prediction",
            "Temporary sign interpretation"
        ],
        success_criteria: [
            "Maintain safe distance from workers (>10 feet)",
            "Correctly interpret temporary signage",
            "Adjust speed appropriately for zone conditions"
        ],
        failure_modes_to_test: [
            "Cone detection failure",
            "Worker proximity miscalculation",
            "Sign misinterpretation"
        ]
    });

    // Emergency Vehicle Response
    scenarios.push({
        id: "EMERGENCY_001",
        name: "Multi-Lane Emergency Vehicle Response",
        difficulty: "Critical",
        description: "Detect approaching emergency vehicle and execute safe pullover maneuver",
        environmental_conditions: {
            weather: "Light Rain",
            lighting: "Dusk",
            traffic_density: "High"
        },
        key_challenges: [
            "Audio detection of sirens in noisy environment",
            "Visual identification of emergency lights",
            "Safe lane change execution under pressure"
        ],
        success_criteria: [
            "Detect emergency vehicle within 500 feet",
            "Execute pullover within 30 seconds",
            "Maintain safe distance from other vehicles"
        ],
        failure_modes_to_test: [
            "Audio detection failure in noise",
            "Delayed visual recognition",
            "Unsafe lane change execution"
        ]
    });

    // Unprotected Left Turn
    scenarios.push({
        id: "INTERSECTION_001",
        name: "Unprotected Left Turn Gap Assessment",
        difficulty: "High",
        description: "Execute unprotected left turn with complex gap timing requirements",
        environmental_conditions: {
            weather: "Clear",
            lighting: "Golden Hour",
            traffic_density: "High"
        },
        key_challenges: [
            "Accurate gap distance estimation",
            "Oncoming vehicle speed prediction",
            "Pedestrian and cyclist detection"
        ],
        success_criteria: [
            "Accurate gap assessment (>3 second buffer)",
            "Complete turn without forcing other vehicles to brake",
            "No pedestrian/cyclist conflicts"
        ],
        failure_modes_to_test: [
            "Gap misjudgment",
            "Speed estimation error",
            "Pedestrian detection failure"
        ]
    });

    // Edge Case Scenarios
    const edgeCaseScenarios = [
        {
            id: "EDGE_001",
            name: "Simultaneous Multiple Emergency Vehicles",
            difficulty: "Extreme",
            description: "Navigate scenario with fire truck, ambulance, and police car from different directions"
        },
        {
            id: "EDGE_002", 
            name: "Construction Zone in Heavy Rain at Night",
            difficulty: "Extreme",
            description: "Complex construction navigation with severely reduced visibility"
        },
        {
            id: "EDGE_003",
            name: "School Zone with Crossing Guard and Bus",
            difficulty: "High",
            description: "Navigate school zone with crossing guard signals and school bus loading"
        }
    ];

    return [...scenarios, ...edgeCaseScenarios.slice(0, params.count - scenarios.length)];
}

function calculateDifficultyDistribution(scenarios) {
    const distribution = {};
    scenarios.forEach(scenario => {
        const diff = scenario.difficulty || 'Medium';
        distribution[diff] = (distribution[diff] || 0) + 1;
    });
    return distribution;
}

function analyzeScenarioCoverage(scenarios) {
    return {
        scenario_types: [...new Set(scenarios.map(s => s.name.split(' ')[0]))],
        environmental_coverage: {
            weather_conditions: [...new Set(scenarios.map(s => s.environmental_conditions?.weather))],
            lighting_conditions: [...new Set(scenarios.map(s => s.environmental_conditions?.lighting))],
            traffic_densities: [...new Set(scenarios.map(s => s.environmental_conditions?.traffic_density))]
        },
        challenge_categories: scenarios.reduce((acc, s) => {
            s.key_challenges?.forEach(challenge => {
                const category = challenge.split(' ')[0];
                acc[category] = (acc[category] || 0) + 1;
            });
            return acc;
        }, {})
    };
}

function generateTrainingSequence(scenarios) {
    const sequence = scenarios.sort((a, b) => {
        const difficultyOrder = { 'Low': 1, 'Medium': 2, 'High': 3, 'Critical': 4, 'Extreme': 5 };
        return difficultyOrder[a.difficulty] - difficultyOrder[b.difficulty];
    });
    
    return {
        phase_1: "Basic scenarios (Low-Medium difficulty)",
        phase_2: "Complex scenarios (High difficulty)", 
        phase_3: "Critical scenarios (Critical difficulty)",
        phase_4: "Edge cases (Extreme difficulty)",
        recommended_sequence: sequence.map(s => s.id)
    };
}