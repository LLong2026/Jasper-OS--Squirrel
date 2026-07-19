import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

/**
 * Token Compliance Validator
 * Ensures all token operations comply with international regulations
 */

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { action, payload } = await req.json();

        if (action === 'validate_compliance') {
            const { token_spec, jurisdictions = ['US', 'EU', 'GLOBAL'] } = payload;

            const violations = [];
            const warnings = [];
            const recommendations = [];

            // Check each jurisdiction
            for (const jurisdiction of jurisdictions) {
                const rules = getJurisdictionRules(jurisdiction);
                const result = checkCompliance(token_spec, rules);
                
                violations.push(...result.violations.map(v => ({ ...v, jurisdiction })));
                warnings.push(...result.warnings.map(w => ({ ...w, jurisdiction })));
                recommendations.push(...result.recommendations.map(r => ({ ...r, jurisdiction })));
            }

            // Check for securities classification risk
            const securitiesRisk = assessSecuritiesRisk(token_spec);
            if (securitiesRisk.is_security) {
                violations.push({
                    severity: 'CRITICAL',
                    code: 'SECURITIES_VIOLATION',
                    message: 'Token may be classified as a security',
                    details: securitiesRisk.reasons,
                    jurisdiction: 'GLOBAL'
                });
            }

            // Check AML/KYC requirements
            const amlCheck = checkAMLCompliance(token_spec);
            if (!amlCheck.compliant) {
                warnings.push({
                    severity: 'HIGH',
                    code: 'AML_WARNING',
                    message: 'Insufficient AML/KYC controls',
                    details: amlCheck.missing_controls,
                    jurisdiction: 'GLOBAL'
                });
            }

            // Check market manipulation safeguards
            const manipulationCheck = checkManipulationSafeguards(token_spec);
            if (!manipulationCheck.sufficient) {
                warnings.push({
                    severity: 'HIGH',
                    code: 'MANIPULATION_RISK',
                    message: 'Insufficient market manipulation safeguards',
                    details: manipulationCheck.risks,
                    jurisdiction: 'GLOBAL'
                });
            }

            return Response.json({
                success: true,
                compliant: violations.length === 0,
                violations,
                warnings,
                recommendations,
                securities_risk: securitiesRisk,
                aml_compliant: amlCheck.compliant,
                manipulation_safeguards: manipulationCheck.sufficient
            });
        }

        if (action === 'generate_compliance_report') {
            const { token_id } = payload;

            const report = {
                token_id,
                generated_at: Date.now(),
                generated_by: user.email,
                jurisdictions_checked: ['US', 'EU', 'UK', 'SG', 'GLOBAL'],
                sections: []
            };

            // Load token spec
            const tokenData = await base44.asServiceRole.entities.GlobalMemory.filter({
                tags: { $contains: token_id },
                memory_type: 'compilation'
            }, '-created_date', 1);

            if (tokenData.length === 0) {
                return Response.json({ error: 'Token not found' }, { status: 404 });
            }

            const token_spec = tokenData[0].content;

            // Generate sections
            report.sections.push({
                title: 'Securities Analysis',
                content: await generateSecuritiesAnalysis(token_spec, base44)
            });

            report.sections.push({
                title: 'AML/KYC Compliance',
                content: await generateAMLAnalysis(token_spec, base44)
            });

            report.sections.push({
                title: 'Market Abuse Prevention',
                content: await generateMarketAbuseAnalysis(token_spec, base44)
            });

            report.sections.push({
                title: 'Jurisdictional Requirements',
                content: await generateJurisdictionalAnalysis(token_spec, base44)
            });

            // Store report
            await base44.asServiceRole.entities.GlobalMemory.create({
                memory_type: 'compliance_report',
                content: report,
                source_agent: 'TokenComplianceValidator',
                confidence_score: 1.0,
                tags: ['tokenomics', 'compliance', token_id]
            });

            return Response.json({
                success: true,
                report
            });
        }

        return Response.json({ error: 'Invalid action' }, { status: 400 });

    } catch (error) {
        console.error('Token Compliance Validator error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});

function getJurisdictionRules(jurisdiction) {
    const rules = {
        US: {
            securities_test: 'howey_test',
            kyc_required: true,
            accredited_investor_only: false,
            max_supply_disclosure: true,
            audit_required: true
        },
        EU: {
            securities_test: 'mifid_ii',
            kyc_required: true,
            gdpr_compliant: true,
            max_supply_disclosure: true,
            audit_required: true
        },
        UK: {
            securities_test: 'fca_guidance',
            kyc_required: true,
            max_supply_disclosure: true,
            audit_required: true
        },
        SG: {
            securities_test: 'mas_guidelines',
            kyc_required: true,
            max_supply_disclosure: true,
            audit_required: true
        },
        GLOBAL: {
            fatf_compliant: true,
            market_manipulation_controls: true,
            transparency_required: true
        }
    };

    return rules[jurisdiction] || rules.GLOBAL;
}

function checkCompliance(token_spec, rules) {
    const violations = [];
    const warnings = [];
    const recommendations = [];

    // Check KYC requirements
    if (rules.kyc_required) {
        const hasKYC = token_spec.compliance?.kyc_required || false;
        if (!hasKYC) {
            violations.push({
                severity: 'CRITICAL',
                code: 'NO_KYC',
                message: 'KYC/AML controls not implemented',
                remediation: 'Implement KYC verification for all participants'
            });
        }
    }

    // Check supply disclosure
    if (rules.max_supply_disclosure) {
        const hasSupplyCap = token_spec.tokens?.some(t => t.properties.supply?.includes('cap'));
        if (!hasSupplyCap) {
            warnings.push({
                severity: 'MEDIUM',
                code: 'NO_SUPPLY_CAP',
                message: 'No maximum supply cap disclosed',
                remediation: 'Define and disclose maximum token supply'
            });
        }
    }

    // Check audit requirements
    if (rules.audit_required) {
        recommendations.push({
            priority: 'HIGH',
            code: 'AUDIT_RECOMMENDED',
            message: 'Independent audit recommended',
            details: 'Obtain third-party audit of smart contracts and tokenomics'
        });
    }

    return { violations, warnings, recommendations };
}

function assessSecuritiesRisk(token_spec) {
    const reasons = [];
    let score = 0;

    // Howey Test factors
    // 1. Investment of money
    reasons.push('Token involves investment of money: +1');
    score += 1;

    // 2. Common enterprise
    const hasGovernance = token_spec.tokens?.some(t => t.properties.type === 'GOVERNANCE');
    if (hasGovernance) {
        reasons.push('Governance token indicates common enterprise: +1');
        score += 1;
    }

    // 3. Expectation of profits
    const hasStaking = token_spec.staking?.length > 0;
    const hasRewards = token_spec.flows?.some(f => f.name?.includes('reward'));
    if (hasStaking || hasRewards) {
        reasons.push('Staking/rewards indicate profit expectation: +2');
        score += 2;
    }

    // 4. Efforts of others
    const hasAutomatedMinting = token_spec.tokens?.some(t => 
        t.properties.mint_rules?.includes('dynamic') || 
        t.properties.mint_rules?.includes('automatic')
    );
    if (hasAutomatedMinting) {
        reasons.push('Automated minting reduces "efforts of others" factor: -1');
        score -= 1;
    }

    // Utility factor (reduces securities risk)
    const hasUtilityToken = token_spec.tokens?.some(t => t.properties.type === 'UTILITY');
    if (hasUtilityToken) {
        reasons.push('Utility token with actual use case: -1');
        score -= 1;
    }

    return {
        is_security: score >= 3,
        risk_score: score,
        reasons,
        recommendation: score >= 3 
            ? 'HIGH RISK: Consult legal counsel. Token likely classified as security.'
            : score >= 2
            ? 'MEDIUM RISK: Consider legal review to minimize securities classification.'
            : 'LOW RISK: Token structure appears to avoid securities classification.'
    };
}

function checkAMLCompliance(token_spec) {
    const missing_controls = [];
    
    if (!token_spec.compliance?.kyc_required) {
        missing_controls.push('KYC verification');
    }
    
    if (!token_spec.compliance?.transaction_monitoring) {
        missing_controls.push('Transaction monitoring');
    }
    
    if (!token_spec.compliance?.suspicious_activity_reporting) {
        missing_controls.push('Suspicious activity reporting (SAR)');
    }
    
    if (!token_spec.compliance?.sanctions_screening) {
        missing_controls.push('OFAC/sanctions screening');
    }

    return {
        compliant: missing_controls.length === 0,
        missing_controls,
        fatf_compliant: missing_controls.length <= 1
    };
}

function checkManipulationSafeguards(token_spec) {
    const risks = [];
    
    // Check for anti-whale mechanisms
    const hasTransferLimits = token_spec.tokens?.some(t => 
        t.properties.transfer_limits || t.properties.max_wallet
    );
    if (!hasTransferLimits) {
        risks.push('No whale protection (max wallet or transfer limits)');
    }

    // Check for liquidity locks
    const hasLiquidityLock = token_spec.flows?.some(f => f.properties.lockup);
    if (!hasLiquidityLock) {
        risks.push('No liquidity lock mechanisms');
    }

    // Check for vesting schedules
    const hasVesting = token_spec.flows?.some(f => f.properties.schedule?.includes('vesting'));
    if (!hasVesting) {
        risks.push('No vesting schedules for team/investors');
    }

    // Check for circuit breakers
    const hasCircuitBreaker = token_spec.compliance?.circuit_breaker;
    if (!hasCircuitBreaker) {
        risks.push('No emergency circuit breaker');
    }

    return {
        sufficient: risks.length <= 1,
        risks,
        score: Math.max(0, 1 - (risks.length / 4))
    };
}

async function generateSecuritiesAnalysis(token_spec, base44) {
    const analysis = assessSecuritiesRisk(token_spec);
    
    return {
        conclusion: analysis.recommendation,
        risk_level: analysis.is_security ? 'HIGH' : 'MEDIUM',
        factors_analyzed: analysis.reasons,
        mitigation_steps: [
            'Ensure token has genuine utility in protocol',
            'Minimize promises of profits',
            'Decentralize governance gradually',
            'Document non-investment purpose'
        ]
    };
}

async function generateAMLAnalysis(token_spec, base44) {
    const aml = checkAMLCompliance(token_spec);
    
    return {
        compliant: aml.compliant,
        missing_controls: aml.missing_controls,
        required_implementations: [
            'KYC/AML verification for all participants',
            'Real-time transaction monitoring',
            'Suspicious Activity Reporting (SAR) procedures',
            'OFAC sanctions screening',
            'Record keeping (5+ years)'
        ]
    };
}

async function generateMarketAbuseAnalysis(token_spec, base44) {
    const manipulation = checkManipulationSafeguards(token_spec);
    
    return {
        safeguards_sufficient: manipulation.sufficient,
        identified_risks: manipulation.risks,
        recommended_controls: [
            'Anti-whale limits (max 2% of supply per wallet)',
            'Liquidity lock (minimum 1 year)',
            'Team vesting (3-4 year schedule with cliff)',
            'Emergency pause function',
            'Price impact limits on DEX',
            'Transparent on-chain monitoring'
        ]
    };
}

async function generateJurisdictionalAnalysis(token_spec, base44) {
    const jurisdictions = ['US', 'EU', 'UK', 'SG'];
    const analysis = {};
    
    for (const j of jurisdictions) {
        const rules = getJurisdictionRules(j);
        const compliance = checkCompliance(token_spec, rules);
        
        analysis[j] = {
            compliant: compliance.violations.length === 0,
            violations: compliance.violations,
            warnings: compliance.warnings
        };
    }
    
    return analysis;
}