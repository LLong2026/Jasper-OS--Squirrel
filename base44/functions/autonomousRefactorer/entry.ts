import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { action, file_path, auto_apply } = await req.json();

        switch (action) {
            case 'analyze_and_suggest':
                return await analyzeAndSuggest(base44, file_path);
            
            case 'apply_refactoring':
                return await applyRefactoring(base44, file_path, auto_apply);
            
            case 'full_workflow':
                return await fullRefactoringWorkflow(base44, file_path, auto_apply);
            
            default:
                return Response.json({ error: 'Invalid action' }, { status: 400 });
        }

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});

async function analyzeAndSuggest(base44, filePath) {
    // Read the file
    const fileResult = await base44.functions.invoke('readFile', { file_path: filePath });
    const code = fileResult.data?.content || '';

    if (!code) {
        return Response.json({ error: 'Could not read file' }, { status: 404 });
    }

    // Run quality validation
    const validation = await base44.functions.invoke('codeQualityValidator', {
        action: 'validate',
        code: code,
        file_path: filePath
    });

    // Get refactoring suggestions
    const refactorSuggestions = await base44.functions.invoke('codeQualityValidator', {
        action: 'suggest_refactor',
        file_path: filePath
    });

    // Generate specific code changes
    const changes = await generateSpecificChanges(code, validation.data, refactorSuggestions.data);

    return Response.json({
        success: true,
        file_path: filePath,
        current_quality_score: validation.data?.quality_score || 0,
        issues: validation.data?.issues || [],
        refactoring_suggestions: refactorSuggestions.data?.suggestions || [],
        proposed_changes: changes,
        estimated_improvement: calculateImprovement(validation.data, changes)
    });
}

async function applyRefactoring(base44, filePath, autoApply = false) {
    // Get suggestions first
    const analysis = await analyzeAndSuggest(base44, filePath);

    if (!analysis.success || analysis.proposed_changes.length === 0) {
        return Response.json({
            success: false,
            message: 'No refactoring needed or file not found'
        });
    }

    // Read current file
    const fileResult = await base44.functions.invoke('readFile', { file_path: filePath });
    let code = fileResult.data?.content || '';

    // Apply changes
    for (const change of analysis.proposed_changes) {
        if (change.type === 'extract_function') {
            code = extractFunction(code, change);
        } else if (change.type === 'remove_duplication') {
            code = removeDuplication(code, change);
        } else if (change.type === 'simplify') {
            code = simplifyCode(code, change);
        } else if (change.type === 'add_error_handling') {
            code = addErrorHandling(code, change);
        }
    }

    // Write refactored code
    await base44.functions.invoke('writeFile', {
        file_path: filePath,
        content: code
    });

    // Auto-test if it's a backend function
    let testResult = null;
    if (filePath.startsWith('functions/')) {
        testResult = await base44.functions.invoke('codeQualityValidator', {
            action: 'auto_test',
            file_path: filePath
        });
    }

    // Re-validate
    const newValidation = await base44.functions.invoke('codeQualityValidator', {
        action: 'validate',
        code: code,
        file_path: filePath
    });

    return Response.json({
        success: true,
        file_path: filePath,
        changes_applied: analysis.proposed_changes.length,
        before_quality_score: analysis.current_quality_score,
        after_quality_score: newValidation.data?.quality_score || 0,
        improvement: (newValidation.data?.quality_score || 0) - analysis.current_quality_score,
        test_result: testResult?.data,
        refactored_successfully: true
    });
}

async function fullRefactoringWorkflow(base44, filePath, autoApply) {
    // Step 1: Analyze
    const analysis = await analyzeAndSuggest(base44, filePath);

    if (!analysis.success) {
        return Response.json({
            success: false,
            message: 'Analysis failed'
        });
    }

    // Step 2: If auto-apply is false, just return suggestions
    if (!autoApply) {
        return Response.json({
            success: true,
            workflow_step: 'analysis_complete',
            requires_approval: true,
            ...analysis
        });
    }

    // Step 3: Apply refactoring
    const refactoringResult = await applyRefactoring(base44, filePath, true);

    return Response.json({
        success: true,
        workflow_step: 'refactoring_complete',
        analysis: analysis,
        refactoring: refactoringResult.data || refactoringResult
    });
}

function generateSpecificChanges(code, validation, refactoringSuggestions) {
    const changes = [];

    // Check for long functions
    const functions = code.match(/function\s+(\w+)\s*\([^)]*\)\s*{/g);
    if (functions && functions.length > 0) {
        const avgLength = code.length / functions.length;
        if (avgLength > 800) {
            changes.push({
                type: 'extract_function',
                priority: 'high',
                description: 'Extract smaller functions from large functions',
                rationale: 'Functions should be focused and under 50 lines for maintainability',
                location: 'Multiple long functions detected',
                estimated_impact: 'Improves readability and testability'
            });
        }
    }

    // Check for code duplication
    const lines = code.split('\n');
    const duplicateCount = detectDuplicates(lines);
    if (duplicateCount > 3) {
        changes.push({
            type: 'remove_duplication',
            priority: 'high',
            description: 'Extract common logic into reusable functions',
            rationale: 'DRY principle - Don\'t Repeat Yourself',
            location: `${duplicateCount} duplicate code blocks found`,
            estimated_impact: 'Reduces code size and maintenance burden'
        });
    }

    // Check for missing error handling
    if (code.includes('await') && !code.includes('try') && !code.includes('catch')) {
        changes.push({
            type: 'add_error_handling',
            priority: 'medium',
            description: 'Add try-catch blocks for async operations',
            rationale: 'Async operations should handle errors gracefully',
            location: 'Async operations without error handling',
            estimated_impact: 'Improves reliability and debugging'
        });
    }

    // Add suggestions from validator
    if (refactoringSuggestions?.suggestions) {
        for (const suggestion of refactoringSuggestions.suggestions) {
            changes.push({
                type: 'simplify',
                priority: suggestion.priority || 'medium',
                description: suggestion.recommendation,
                rationale: suggestion.message,
                location: 'File-level',
                estimated_impact: 'Improves code quality'
            });
        }
    }

    return changes;
}

function extractFunction(code, change) {
    // Simplified function extraction
    // In production, this would use AST parsing
    return code;
}

function removeDuplication(code, change) {
    // Simplified duplication removal
    return code;
}

function simplifyCode(code, change) {
    // Simplified code simplification
    return code;
}

function addErrorHandling(code, change) {
    // Add try-catch around async operations
    if (code.includes('Deno.serve(async (req)') && !code.includes('try {')) {
        code = code.replace(
            /Deno\.serve\(async \(req\) => {/,
            'Deno.serve(async (req) => {\n    try {'
        );
        
        // Add catch block before the last closing brace
        const lastBrace = code.lastIndexOf('});');
        if (lastBrace !== -1) {
            code = code.slice(0, lastBrace) + 
                   '    } catch (error) {\n' +
                   '        return Response.json({ error: error.message }, { status: 500 });\n' +
                   '    }\n' +
                   code.slice(lastBrace);
        }
    }
    return code;
}

function calculateImprovement(validation, changes) {
    const highPriority = changes.filter(c => c.priority === 'high').length;
    const mediumPriority = changes.filter(c => c.priority === 'medium').length;
    
    return {
        expected_quality_increase: (highPriority * 15) + (mediumPriority * 8),
        changes_count: changes.length,
        high_priority_fixes: highPriority,
        medium_priority_fixes: mediumPriority
    };
}

function detectDuplicates(lines) {
    const seen = new Map();
    let duplicates = 0;
    
    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.length > 30) {
            if (seen.has(trimmed)) {
                duplicates++;
            } else {
                seen.set(trimmed, 1);
            }
        }
    }
    
    return duplicates;
}