import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { action, platform, repository, branch, commit_message, workflow_id, environment } = await req.json();
        
        const startTime = Date.now();
        let result = {};

        switch (platform) {
            case 'github': {
                result = await handleGitHubAction({
                    action, repository, branch, commit_message, workflow_id
                });
                break;
            }
                
            case 'gitlab': {
                result = await handleGitLabAction({
                    action, repository, branch, commit_message, workflow_id
                });
                break;
            }
                
            case 'vercel': {
                result = await handleVercelDeployment({
                    action, repository, environment
                });
                break;
            }
                
            case 'netlify': {
                result = await handleNetlifyDeployment({
                    action, repository, environment
                });
                break;
            }
                
            case 'aws': {
                result = await handleAWSDeployment({
                    action, repository, environment
                });
                break;
            }
                
            case 'docker': {
                result = await handleDockerAction({
                    action, repository, environment
                });
                break;
            }
                
            default:
                throw new Error(`Unsupported DevOps platform: ${platform}`);
        }

        return Response.json({
            success: true,
            platform: platform,
            action: action,
            result: result,
            processing_time_ms: Date.now() - startTime,
            proof: {
                source: 'DevOps Integration',
                platform: platform,
                action: action
            }
        });
        
    } catch (error) {
        return Response.json({
            success: false,
            error: error.message,
            platform: platform || 'unknown'
        }, { status: 500 });
    }
});

async function handleGitHubAction({ action, repository, branch, commit_message, workflow_id }) {
    const githubToken = Deno.env.get("GITHUB_TOKEN");
    
    switch (action) {
        case 'trigger_workflow': {
            // Trigger GitHub Actions workflow
            const response = await fetch(`https://api.github.com/repos/${repository}/actions/workflows/${workflow_id}/dispatches`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${githubToken}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    ref: branch || 'main'
                })
            });
            
            return {
                status: response.status === 204 ? 'triggered' : 'failed',
                workflow_id: workflow_id,
                repository: repository
            };
        }
            
        case 'get_status': {
            // Get workflow run status
            const statusResponse = await fetch(`https://api.github.com/repos/${repository}/actions/runs`, {
                headers: {
                    'Authorization': `Bearer ${githubToken}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });
            
            const runs = await statusResponse.json();
            return {
                latest_runs: runs.workflow_runs?.slice(0, 5) || [],
                repository: repository
            };
        }
            
        default:
            throw new Error(`Unsupported GitHub action: ${action}`);
    }
}

async function handleGitLabAction({ action, repository, branch, workflow_id }) {
    const gitlabToken = Deno.env.get("GITLAB_TOKEN");
    
    switch (action) {
        case 'trigger_pipeline': {
            const response = await fetch(`https://gitlab.com/api/v4/projects/${encodeURIComponent(repository)}/pipeline`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${gitlabToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    ref: branch || 'main'
                })
            });
            
            const result = await response.json();
            return {
                pipeline_id: result.id,
                status: result.status,
                repository: repository
            };
        }
            
        default:
            throw new Error(`Unsupported GitLab action: ${action}`);
    }
}

async function handleVercelDeployment({ action, repository, environment }) {
    const vercelToken = Deno.env.get("VERCEL_TOKEN");
    
    switch (action) {
        case 'deploy': {
            // Trigger Vercel deployment
            const response = await fetch('https://api.vercel.com/v1/deployments', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${vercelToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: repository.split('/')[1],
                    gitSource: {
                        type: 'github',
                        repo: repository,
                        ref: 'main'
                    }
                })
            });
            
            const deployment = await response.json();
            return {
                deployment_id: deployment.id,
                url: deployment.url,
                status: deployment.readyState
            };
        }
            
        default:
            throw new Error(`Unsupported Vercel action: ${action}`);
    }
}

async function handleNetlifyDeployment({ action, repository, environment }) {
    // Placeholder - will be implemented when Netlify API key is available
    await Promise.resolve();
    
    return {
        message: 'Netlify integration ready for configuration',
        repository: repository,
        environment: environment,
        status: 'awaiting_api_key'
    };
}

async function handleAWSDeployment({ action, repository, environment }) {
    // Placeholder - will be implemented when AWS credentials are available
    await Promise.resolve();
    
    return {
        message: 'AWS integration ready for configuration',
        repository: repository,
        environment: environment,
        status: 'awaiting_credentials'
    };
}

async function handleDockerAction({ action, repository, environment }) {
    // Placeholder - will be implemented when Docker registry access is configured
    await Promise.resolve();
    
    return {
        message: 'Docker integration ready for configuration',
        repository: repository,
        environment: environment,
        status: 'awaiting_registry_config'
    };
}