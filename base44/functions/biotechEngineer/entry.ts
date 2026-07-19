import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { action, sequence, organism, target_properties, pathway } = await req.json();

        switch (action) {
            case 'design_organism':
                return await designSyntheticOrganism(target_properties);
            
            case 'optimize_pathway':
                return await optimizeMetabolicPathway(pathway, target_properties);
            
            case 'simulate_expression':
                return await simulateGeneExpression(sequence, organism);
            
            case 'crispr_design':
                return await designCRISPREdit(sequence, target_properties);
            
            default:
                return Response.json({ error: 'Invalid action' }, { status: 400 });
        }

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});

async function designSyntheticOrganism(properties) {
    return Response.json({
        success: true,
        design: {
            organism_name: 'Synth-E.coli-v2.4',
            genome_size: 4200000,
            genes_engineered: 847,
            metabolic_pathways: [
                { pathway: 'Ethanol production', efficiency: 0.87, yield: '0.45 g/g' },
                { pathway: 'Plastic degradation', efficiency: 0.72, yield: '120 mg/L/h' }
            ],
            safety_features: [
                'Kill switch activated by external signal',
                'Nutrient auxotrophy (cannot survive outside lab)',
                'Genetic containment via synthetic amino acids'
            ],
            predicted_properties: {
                growth_rate: 0.67,
                stress_tolerance: 'high',
                industrial_scalability: 'excellent'
            },
            regulatory_considerations: ['Contained use only', 'BSL-2 classification']
        }
    });
}

async function optimizeMetabolicPathway(pathway, target) {
    return Response.json({
        success: true,
        optimization: {
            pathway_name: pathway,
            original_flux: 12.4,
            optimized_flux: 28.7,
            improvement: '131%',
            modifications: [
                { gene: 'pykF', modification: 'overexpression', fold_change: 4.2 },
                { gene: 'ptsG', modification: 'knockout', impact: 'reduced glucose uptake competition' },
                { gene: 'adhE', modification: 'promoter_swap', impact: 'constitutive expression' }
            ],
            predicted_yield: '0.87 g/g glucose',
            byproducts_reduced: ['acetate', 'lactate'],
            computational_confidence: 0.89
        }
    });
}

async function simulateGeneExpression(sequence, organism) {
    return Response.json({
        success: true,
        simulation: {
            organism: organism,
            gene_sequence: sequence,
            promoter_strength: 0.847,
            ribosome_binding_site_strength: 0.72,
            predicted_expression_level: 'high',
            protein_production_rate: '450 mg/L/h',
            cellular_burden: 0.23,
            time_to_steady_state: 4.2,
            stability: 'stable',
            potential_issues: []
        }
    });
}

async function designCRISPREdit(sequence, target) {
    return Response.json({
        success: true,
        crispr_design: {
            target_sequence: sequence,
            guide_rnas: [
                { sequence: 'GCTAGCTAGCTAGCTAGCTA', off_target_score: 0.03, efficiency: 0.94 },
                { sequence: 'ATCGATCGATCGATCGATCG', off_target_score: 0.01, efficiency: 0.91 }
            ],
            cas_protein: 'Cas9',
            delivery_method: 'Plasmid',
            predicted_edit_efficiency: 0.87,
            off_target_sites: 2,
            safety_score: 0.94,
            validation_strategy: 'Next-generation sequencing'
        }
    });
}