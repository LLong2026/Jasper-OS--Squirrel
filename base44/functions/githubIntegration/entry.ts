import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { action, payload } = await req.json();
        const githubToken = Deno.env.get('GITHUB_TOKEN');

        const githubHeaders = {
            'Authorization': `Bearer ${githubToken}`,
            'Accept': 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28'
        };

        if (action === 'create_issue') {
            const { owner, repo, title, body, labels, assignees } = payload;
            
            const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues`, {
                method: 'POST',
                headers: githubHeaders,
                body: JSON.stringify({
                    title,
                    body,
                    labels,
                    assignees
                })
            });

            const result = await response.json();
            
            return Response.json({
                success: true,
                issue_number: result.number,
                url: result.html_url
            });
        }

        if (action === 'create_pull_request') {
            const { owner, repo, title, head, base, body } = payload;
            
            const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls`, {
                method: 'POST',
                headers: githubHeaders,
                body: JSON.stringify({
                    title,
                    head,
                    base,
                    body
                })
            });

            const result = await response.json();
            
            return Response.json({
                success: true,
                pr_number: result.number,
                url: result.html_url
            });
        }

        if (action === 'trigger_workflow') {
            const { owner, repo, workflow_id, ref, inputs } = payload;
            
            const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflow_id}/dispatches`, {
                method: 'POST',
                headers: githubHeaders,
                body: JSON.stringify({
                    ref,
                    inputs
                })
            });

            return Response.json({
                success: response.ok,
                status: response.status
            });
        }

        if (action === 'get_repository_stats') {
            const { owner, repo } = payload;
            
            const [repoData, contributors, languages] = await Promise.all([
                fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers: githubHeaders }).then(r => r.json()),
                fetch(`https://api.github.com/repos/${owner}/${repo}/contributors`, { headers: githubHeaders }).then(r => r.json()),
                fetch(`https://api.github.com/repos/${owner}/${repo}/languages`, { headers: githubHeaders }).then(r => r.json())
            ]);

            return Response.json({
                success: true,
                stars: repoData.stargazers_count,
                forks: repoData.forks_count,
                open_issues: repoData.open_issues_count,
                contributors: contributors.length,
                languages
            });
        }

        return Response.json({ error: 'Invalid action' }, { status: 400 });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});