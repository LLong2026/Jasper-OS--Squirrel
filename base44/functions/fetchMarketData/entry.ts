import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

// NOTE: This is a placeholder function. Real financial data APIs (e.g., Alpha Vantage, Polygon.io)
// would require API keys passed as secrets.

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { data_type, symbol } = await req.json();

        // This simulates fetching data from different sources.
        let mockData;
        switch (data_type) {
            case 'stock_price':
                mockData = {
                    symbol: symbol || 'AI_INDEX',
                    price: (Math.random() * 500 + 100).toFixed(2),
                    change: (Math.random() * 20 - 10).toFixed(2),
                    volume: Math.floor(Math.random() * 10000000)
                };
                break;
            case 'news_sentiment':
                mockData = {
                    topic: symbol || 'AI Industry',
                    sentiment_score: (Math.random() * 1 - 0.5).toFixed(3), // -0.5 to +0.5
                    key_headlines: [
                        "New AI Model Shatters Benchmarks",
                        "Regulators Scrutinize AI Market Dominance",
                        "Venture Capital Pours Billions into AI Startups"
                    ]
                };
                break;
            default:
                return Response.json({ error: 'Invalid data type' }, { status: 400 });
        }

        return Response.json({
            success: true,
            data_type: data_type,
            data: mockData,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});