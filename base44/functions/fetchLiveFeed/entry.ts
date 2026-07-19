import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

// Note: This is a placeholder. A real implementation would need API keys for specific services.
// For a public feed like arXiv, no key is needed for basic access.

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { feed_name, query } = await req.json();

        let url;
        switch (feed_name) {
            case 'arXiv':
                // Example: Fetch recent papers in 'cs.AI' category
                url = `http://export.arxiv.org/api/query?search_query=cat:cs.AI&sortBy=lastUpdatedDate&sortOrder=descending&max_results=10`;
                break;
            case 'PubMed':
                 // PubMed requires a more complex API interaction, often using E-utilities.
                 // This is a simplified example.
                 url = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query || 'latest')}&retmode=json&retmax=10`;
                 break;
            default:
                return Response.json({ error: 'Unsupported feed name' }, { status: 400 });
        }
        
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch from ${feed_name}: ${response.statusText}`);
        }

        const data = await response.text(); // arXiv returns XML, PubMed can return JSON

        return Response.json({
            success: true,
            feed: feed_name,
            raw_data: data.substring(0, 5000) + '...' // Truncate for brevity
        });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});