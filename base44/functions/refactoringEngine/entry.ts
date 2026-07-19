import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { action, file_path, proposal_id } = await req.json();

        if (action === 'analyze') {
            // Read current file
            const fileContent = await base44.functions.invoke('readFile', {
                file_path
            });

            // Use LLM to analyze code quality and suggest refactorings
            const analysis = await base44.integrations.Core.InvokeLLM({
                prompt: `Analyze this code file for refactoring opportunities:

File: ${file_path}
\`\`\`
${fileContent.content}
\`\`\`

Identify:
1. Code smells and anti-patterns
2. Performance bottlenecks
3. Security vulnerabilities
4. Maintainability issues
5. Opportunities for optimization

For each issue, provide:
- Issue type (optimization/security/maintainability/performance/bug_fix)
- Specific problem description
- Proposed solution
- Expected improvements
- Risk level
- Priority (1-10)`,
                response_json_schema: {
                    type: "object",
                    properties: {
                        issues: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    type: { type: "string" },
                                    problem: { type: "string" },
                                    solution: { type: "string" },
                                    improvements: { type: "string" },
                                    risk: { type: "string" },
                                    priority: { type: "number" }
                                }
                            }
                        }
                    }
                }
            });

            // Create refactoring proposals for each issue
            const proposals = [];
            for (const issue of analysis.issues) {
                const proposal = await base44.asServiceRole.entities.RefactoringProposal.create({
                    file_path,
                    proposal_type: issue.type,
                    current_issues: [issue.problem],
                    proposed_changes: issue.solution,
                    expected_improvements: { description: issue.improvements },
                    risk_assessment: issue.risk,
                    priority_score: issue.priority,
                    status: 'proposed'
                });
                proposals.push(proposal);
            }

            return Response.json({
                success: true,
                file_path,
                analysis,
                proposals_created: proposals.length,
                proposals
            });
        }

        if (action === 'apply_refactor') {
            // Get proposal
            const proposal = await base44.entities.RefactoringProposal.filter({
                id: proposal_id
            })[0];

            if (!proposal) {
                return Response.json({ error: 'Proposal not found' }, { status: 404 });
            }

            if (proposal.status !== 'approved') {
                return Response.json({
                    error: 'Proposal must be approved before applying'
                }, { status: 400 });
            }

            // Read current file
            const currentFile = await base44.functions.invoke('readFile', {
                file_path: proposal.file_path
            });

            // Generate refactored code
            const refactored = await base44.integrations.Core.InvokeLLM({
                prompt: `Apply this refactoring to the code:

Current Code:
\`\`\`
${currentFile.content}
\`\`\`

Refactoring Instructions:
${proposal.proposed_changes}

Provide the complete refactored code. Maintain all functionality while applying the improvements.`,
            });

            // Write refactored code with version control
            const versionResult = await base44.functions.invoke('versionControl', {
                action: 'commit',
                file_path: proposal.file_path,
                content: refactored,
                change_description: `Applied refactoring: ${proposal.proposal_type}`,
                modified_by: 'wednesday',
                modification_reason: proposal.current_issues.join('; ')
            });

            // Update proposal status
            await base44.asServiceRole.entities.RefactoringProposal.update(proposal_id, {
                status: 'applied',
                applied_version_id: versionResult.version.id
            });

            // Capture performance snapshot
            await base44.functions.invoke('performanceMonitor', {
                action: 'capture_snapshot',
                code_version_id: versionResult.version.id,
                file_path: proposal.file_path,
                snapshot_type: 'post_refactor'
            });

            return Response.json({
                success: true,
                message: `Refactoring applied to ${proposal.file_path}`,
                version: versionResult.version,
                proposal
            });
        }

        if (action === 'list_proposals') {
            const proposals = await base44.entities.RefactoringProposal.filter({
                file_path,
                status: 'proposed'
            });

            return Response.json({
                success: true,
                file_path,
                proposals: proposals.sort((a, b) => b.priority_score - a.priority_score)
            });
        }

        if (action === 'approve_proposal') {
            await base44.asServiceRole.entities.RefactoringProposal.update(proposal_id, {
                status: 'approved'
            });

            return Response.json({
                success: true,
                message: 'Proposal approved'
            });
        }

        return Response.json({ error: 'Invalid action' }, { status: 400 });

    } catch (error) {
        console.error('Refactoring engine error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});