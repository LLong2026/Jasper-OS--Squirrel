import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { action, node, query, connection } = await req.json();

        switch (action) {
            case 'add_node':
                return await addNode(base44, node);
            
            case 'connect_nodes':
                return await connectNodes(base44, connection);
            
            case 'query_graph':
                return await queryGraph(base44, query);
            
            case 'visualize':
                return await generateVisualization(base44);
            
            case 'find_connections':
                return await findConnections(base44, query);
            
            default:
                return Response.json({ error: 'Invalid action' }, { status: 400 });
        }

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});

async function addNode(base44, node) {
    const created = await base44.asServiceRole.entities.KnowledgeNode.create(node);

    return Response.json({
        success: true,
        node_id: created.id,
        node: created
    });
}

async function connectNodes(base44, connection) {
    const { source_node_id, target_node_id, relationship, strength } = connection;

    // Get source node
    const sourceNodes = await base44.asServiceRole.entities.KnowledgeNode.filter({
        id: source_node_id
    });

    if (sourceNodes.length === 0) {
        return Response.json({ error: 'Source node not found' }, { status: 404 });
    }

    const sourceNode = sourceNodes[0];
    const connections = sourceNode.connections || [];

    // Add connection
    connections.push({
        target_node_id,
        relationship,
        strength: strength || 0.5
    });

    // Update source node
    await base44.asServiceRole.entities.KnowledgeNode.update(source_node_id, {
        connections
    });

    return Response.json({
        success: true,
        message: 'Nodes connected',
        connection: { source_node_id, target_node_id, relationship }
    });
}

async function queryGraph(base44, query) {
    let nodes;

    if (query.node_type) {
        nodes = await base44.asServiceRole.entities.KnowledgeNode.filter({
            node_type: query.node_type
        });
    } else if (query.search_term) {
        // Search in name and description
        const allNodes = await base44.asServiceRole.entities.KnowledgeNode.list('-created_date', 500);
        nodes = allNodes.filter(n => 
            n.name.toLowerCase().includes(query.search_term.toLowerCase()) ||
            (n.description && n.description.toLowerCase().includes(query.search_term.toLowerCase()))
        );
    } else {
        nodes = await base44.asServiceRole.entities.KnowledgeNode.list('-created_date', 100);
    }

    return Response.json({
        success: true,
        nodes: nodes,
        count: nodes.length
    });
}

async function generateVisualization(base44) {
    const nodes = await base44.asServiceRole.entities.KnowledgeNode.list('-created_date', 200);

    // Format for visualization (D3.js compatible)
    const graphData = {
        nodes: nodes.map(n => ({
            id: n.id,
            name: n.name,
            type: n.node_type,
            group: n.node_type
        })),
        links: []
    };

    // Extract connections
    for (const node of nodes) {
        if (node.connections && node.connections.length > 0) {
            for (const conn of node.connections) {
                graphData.links.push({
                    source: node.id,
                    target: conn.target_node_id,
                    relationship: conn.relationship,
                    strength: conn.strength || 0.5
                });
            }
        }
    }

    return Response.json({
        success: true,
        graph_data: graphData,
        stats: {
            total_nodes: graphData.nodes.length,
            total_connections: graphData.links.length
        }
    });
}

async function findConnections(base44, query) {
    const { node_id, max_depth } = query;
    const depth = max_depth || 2;

    // Get starting node
    const startNodes = await base44.asServiceRole.entities.KnowledgeNode.filter({ id: node_id });
    
    if (startNodes.length === 0) {
        return Response.json({ error: 'Node not found' }, { status: 404 });
    }

    const visited = new Set();
    const connections = [];

    async function traverse(currentId, currentDepth) {
        if (currentDepth > depth || visited.has(currentId)) return;
        
        visited.add(currentId);
        
        const nodes = await base44.asServiceRole.entities.KnowledgeNode.filter({ id: currentId });
        if (nodes.length === 0) return;
        
        const node = nodes[0];
        
        if (node.connections) {
            for (const conn of node.connections) {
                connections.push({
                    from: node.name,
                    to_id: conn.target_node_id,
                    relationship: conn.relationship,
                    depth: currentDepth
                });
                
                await traverse(conn.target_node_id, currentDepth + 1);
            }
        }
    }

    await traverse(node_id, 1);

    return Response.json({
        success: true,
        starting_node: startNodes[0].name,
        connections: connections,
        total_connected_nodes: visited.size
    });
}