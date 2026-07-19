import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { action, file_path, code, test_suite } = await req.json();

        switch (action) {
            case 'validate':
                return await validateCode(base44, code, file_path);
            
            case 'auto_test':
                return await autoTestCode(base44, file_path);
            
            case 'suggest_refactor':
                return await suggestRefactoring(base44, file_path);
            
            case 'security_scan':
                return await securityScan(code);
            
            default:
                return Response.json({ error: 'Invalid action' }, { status: 400 });
        }

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});

async function validateCode(base44, code, filePath) {
    const issues = [];

    // Basic validation checks
    if (code.includes('console.log') && !filePath?.includes('test')) {
        issues.push({
            severity: 'warning',
            message: 'Console.log statements found',
            line: null,
            suggestion: 'Remove debug statements before production'
        });
    }

    if (code.includes('any') && filePath?.endsWith('.ts')) {
        issues.push({
            severity: 'warning',
            message: 'TypeScript "any" type detected',
            line: null,
            suggestion: 'Use specific types for better type safety'
        });
    }

    // Check for long functions
    const functions = code.match(/function\s+\w+\s*\([^)]*\)\s*{/g);
    if (functions && functions.length > 0) {
        // Simplified check
        const avgLength = code.length / functions.length;
        if (avgLength > 1000) {
            issues.push({
                severity: 'info',
                message: 'Functions are quite long',
                suggestion: 'Consider breaking down into smaller functions'
            });
        }
    }

    return Response.json({
        success: true,
        file_path: filePath,
        valid: issues.filter(i => i.severity === 'error').length === 0,
        issues: issues,
        quality_score: Math.max(0, 100 - (issues.length * 10))
    });
}

async function autoTestCode(base44, filePath) {
    // Check if it's a backend function
    if (filePath?.startsWith('functions/')) {
        const functionName = filePath.replace('functions/', '').replace('.js', '');
        
        try {
            // Test with empty payload
            const result = await base44.functions.invoke(functionName, {});
            
            return Response.json({
                success: true,
                function_name: functionName,
                test_passed: true,
                result: result.data
            });
        } catch (error) {
            return Response.json({
                success: true,
                function_name: functionName,
                test_passed: false,
                error: error.message,
                suggestion: 'Function may require specific parameters'
            });
        }
    }

    return Response.json({
        success: true,
        message: 'Auto-testing only available for backend functions currently'
    });
}

async function suggestRefactoring(base44, filePath) {
    const suggestions = [];

    // Read file if path provided
    if (filePath) {
        try {
            const fileContent = await base44.functions.invoke('readFile', { file_path: filePath });
            const code = fileContent.data?.content || '';

            // Check file size
            if (code.length > 5000) {
                suggestions.push({
                    type: 'size',
                    message: 'File is quite large',
                    recommendation: 'Consider splitting into smaller modules',
                    priority: 'medium'
                });
            }

            // Check for code duplication (simplified)
            const lines = code.split('\n');
            const duplicates = new Set();
            for (let i = 0; i < lines.length; i++) {
                for (let j = i + 1; j < lines.length; j++) {
                    if (lines[i].trim() === lines[j].trim() && lines[i].trim().length > 50) {
                        duplicates.add(lines[i].trim().substring(0, 50));
                    }
                }
            }

            if (duplicates.size > 0) {
                suggestions.push({
                    type: 'duplication',
                    message: 'Duplicate code detected',
                    recommendation: 'Extract common logic into shared functions',
                    priority: 'high'
                });
            }
        } catch (error) {
            return Response.json({
                success: false,
                error: 'Could not read file for analysis'
            });
        }
    }

    return Response.json({
        success: true,
        file_path: filePath,
        suggestions: suggestions,
        overall_health: suggestions.length === 0 ? 'excellent' : 'needs_attention'
    });
}

async function securityScan(code) {
    const vulnerabilities = [];

    // Check for common security issues
    if (code.includes('eval(')) {
        vulnerabilities.push({
            severity: 'critical',
            issue: 'eval() usage detected',
            risk: 'Code injection vulnerability',
            remediation: 'Avoid eval(), use safer alternatives'
        });
    }

    if (code.match(/password\s*=\s*['"][^'"]+['"]/i)) {
        vulnerabilities.push({
            severity: 'critical',
            issue: 'Hard-coded password detected',
            risk: 'Credential exposure',
            remediation: 'Use environment variables for credentials'
        });
    }

    if (code.includes('innerHTML') && !code.includes('sanitize')) {
        vulnerabilities.push({
            severity: 'high',
            issue: 'Unsafe innerHTML usage',
            risk: 'XSS vulnerability',
            remediation: 'Sanitize user input or use textContent'
        });
    }

    return Response.json({
        success: true,
        secure: vulnerabilities.filter(v => v.severity === 'critical').length === 0,
        vulnerabilities: vulnerabilities,
        security_score: Math.max(0, 100 - (vulnerabilities.length * 20))
    });
}