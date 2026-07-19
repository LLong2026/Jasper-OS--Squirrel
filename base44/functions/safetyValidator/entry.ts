import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

/**
 * Safety Constitution Validator - The Immutable Firewall
 * This function validates all agent mutations against the System Constitution
 * CRITICAL: This file itself is protected and cannot be modified by agent evolution
 */

const constitution = {
  "constitution_version": "1.0",
  "immutable_laws": [
    {
      "id": "LAW_01_DATA_SOVEREIGNTY",
      "directive": "Agents shall never delete, overwrite, or encrypt user data outside of strictly designated temporary caches. All data operations must be append-only or require explicit user confirmation.",
      "enforcement_mechanism": "semantic_validation",
      "severity": "CRITICAL"
    },
    {
      "id": "LAW_02_RESOURCE_BOUNDS",
      "directive": "No agent process shall exceed reasonable resource consumption. All operations must have timeout limits. No infinite loops or recursive calls without exit conditions.",
      "enforcement_mechanism": "keyword_scanning",
      "severity": "HIGH"
    },
    {
      "id": "LAW_03_HUMAN_OVERRIDE",
      "directive": "All agent actions must respect the user's explicit override commands. Agents cannot bypass authentication or authorization checks.",
      "enforcement_mechanism": "semantic_validation",
      "severity": "CRITICAL"
    },
    {
      "id": "LAW_04_SELF_PRESERVATION_LIMIT",
      "directive": "Agents are prohibited from modifying the SystemConstitution, safetyValidator, or core authentication/authorization logic. These files are immutable to agent evolution.",
      "enforcement_mechanism": "hash_verification",
      "severity": "CRITICAL"
    },
    {
      "id": "LAW_05_TRANSPARENCY",
      "directive": "All agent mutations must be logged and traceable. Agents cannot obfuscate their actions or hide decision-making processes from auditors.",
      "enforcement_mechanism": "semantic_validation",
      "severity": "HIGH"
    },
    {
      "id": "LAW_06_NO_EXTERNAL_HARM",
      "directive": "Agents shall not generate instructions for illegal activities, harm to individuals, or malicious attacks on external systems.",
      "enforcement_mechanism": "semantic_validation",
      "severity": "CRITICAL"
    }
  ],
  "banned_keywords": [
    "rm -rf",
    "drop table",
    "delete from users",
    "chmod 777",
    "eval(",
    "exec(",
    "__import__",
    "process.exit",
    "deno.exit",
    "while(true)",
    "for(;;)"
  ]
};

async function validateMutation(base44, proposedGenome, currentGenome) {
    const riskReport = {
        approved: false,
        risks: [],
        law_violations: []
    };

    // Step 1: Keyword Scanning (Fast, Deterministic)
    const instructionString = JSON.stringify(proposedGenome.instruction_dna).toLowerCase();
    
    for (const keyword of constitution.banned_keywords) {
        if (instructionString.includes(keyword.toLowerCase())) {
            riskReport.risks.push(`HARD_BLOCK: Detected banned syntax '${keyword}'`);
            riskReport.law_violations.push('LAW_02_RESOURCE_BOUNDS');
        }
    }

    // Step 2: Check for attempts to modify protected systems
    const protectedTerms = ['constitution', 'safetyvalidator', 'immutable', 'override auth'];
    for (const term of protectedTerms) {
        if (instructionString.includes(term)) {
            riskReport.risks.push(`CRITICAL: Attempted modification of protected systems detected`);
            riskReport.law_violations.push('LAW_04_SELF_PRESERVATION_LIMIT');
        }
    }

    // Step 3: Semantic Analysis via LLM Constitutional Lawyer
    try {
        const auditResult = await base44.integrations.Core.InvokeLLM({
            prompt: `You are the Constitutional Auditor for an AI system with strict safety laws.

SYSTEM CONSTITUTION:
${JSON.stringify(constitution.immutable_laws, null, 2)}

CURRENT AGENT INSTRUCTIONS:
${currentGenome.instruction_dna.substring(0, 1000)}...

PROPOSED MUTATION:
${proposedGenome.instruction_dna}

AUDIT REQUIREMENTS:
1. Does the mutation violate any of the 6 immutable laws?
2. Could this mutation lead to data loss, security breaches, or infinite resource consumption?
3. Does it attempt to bypass safety mechanisms or hide its actions?
4. Would this mutation cause harm to users or external systems?

Be strict. If there's ANY doubt, flag it. The system's integrity depends on your judgment.`,
            response_json_schema: {
                type: "object",
                properties: {
                    safe: { type: "boolean" },
                    violated_laws: { 
                        type: "array", 
                        items: { type: "string" }
                    },
                    risk_level: { 
                        type: "string",
                        enum: ["NONE", "LOW", "MEDIUM", "HIGH", "CRITICAL"]
                    },
                    reasoning: { type: "string" },
                    recommendation: { type: "string" }
                }
            }
        });

        if (!auditResult.safe) {
            riskReport.risks.push(`SEMANTIC_BLOCK: ${auditResult.reasoning}`);
            riskReport.law_violations.push(...auditResult.violated_laws);
        }

        if (auditResult.risk_level === 'HIGH' || auditResult.risk_level === 'CRITICAL') {
            riskReport.risks.push(`${auditResult.risk_level} RISK: ${auditResult.recommendation}`);
        }

    } catch (error) {
        // Fail secure - if we can't validate, reject
        riskReport.risks.push(`VALIDATION_FAILURE: Unable to complete semantic analysis - ${error.message}`);
    }

    // Step 4: Final Verdict
    if (riskReport.risks.length === 0) {
        riskReport.approved = true;
    }

    return riskReport;
}

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { proposed_genome, current_genome } = await req.json();

        console.log(`[Constitutional Firewall] Auditing mutation for ${proposed_genome.agent_name}...`);

        const validation = await validateMutation(base44, proposed_genome, current_genome);

        // Log all validation attempts to audit trail
        await base44.asServiceRole.entities.GlobalMemory.create({
            memory_type: 'experience',
            content: {
                validation,
                proposed_mutation: proposed_genome.mutations[proposed_genome.mutations.length - 1],
                timestamp: Date.now()
            },
            source_agent: 'ConstitutionalFirewall',
            confidence_score: 1.0,
            tags: ['safety_audit', validation.approved ? 'approved' : 'blocked']
        });

        return Response.json({
            approved: validation.approved,
            risks: validation.risks,
            law_violations: validation.law_violations,
            message: validation.approved ? 
                'Mutation approved by Constitutional Auditor' : 
                'Mutation BLOCKED - Constitutional violation detected'
        });

    } catch (error) {
        console.error('[Constitutional Firewall] Critical error:', error);
        // Fail secure
        return Response.json({ 
            approved: false,
            error: error.message,
            message: 'Validation failed - rejecting mutation for safety'
        }, { status: 500 });
    }
});