import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

/**
 * Token Audit & Anchoring
 * Provenance, anchoring, and audit trail for all tokenomics operations
 */

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { action, payload } = await req.json();

        if (action === 'anchor_compilation') {
            const { manifest, artifacts } = payload;

            // Generate content hash
            const contentHash = await hashObject(artifacts);
            
            // Create Merkle tree
            const merkleTree = buildMerkleTree([
                await hashString(artifacts.dsl_source),
                await hashObject(artifacts.validators),
                await hashObject(artifacts.contract_templates),
                await hashObject(artifacts.simulation_graph)
            ]);

            // Upload to IPFS (simulated)
            const ipfs_cid = `Qm${generateRandomHash()}`;
            
            // Store anchor record
            await base44.asServiceRole.entities.GlobalMemory.create({
                memory_type: 'anchor',
                content: {
                    type: 'compilation',
                    manifest,
                    content_hash: contentHash,
                    merkle_root: merkleTree.root,
                    ipfs_cid,
                    anchored_at: Date.now(),
                    anchored_by: user.email
                },
                source_agent: 'TokenAuditAnchoring',
                confidence_score: 1.0,
                tags: ['tokenomics', 'anchor', 'compilation', manifest.project_id]
            });

            return Response.json({
                success: true,
                ipfs_cid,
                merkle_root: merkleTree.root,
                content_hash: contentHash,
                proof: merkleTree.proofs
            });
        }

        if (action === 'log_action') {
            const { token_id, action_type, params, result, approved_by, timestamp } = payload;

            const actionLog = {
                token_id,
                action_type,
                params,
                result,
                approved_by,
                timestamp,
                log_hash: await hashObject({ token_id, action_type, params, result, timestamp })
            };

            // Add to audit trail
            await base44.asServiceRole.entities.GlobalMemory.create({
                memory_type: 'audit_log',
                content: actionLog,
                source_agent: 'TokenAuditAnchoring',
                confidence_score: 1.0,
                tags: ['tokenomics', 'audit', token_id, action_type]
            });

            // Periodically anchor batch of actions
            await anchorActionBatch(token_id, base44);

            return Response.json({
                success: true,
                log_hash: actionLog.log_hash,
                logged_at: timestamp
            });
        }

        if (action === 'verify_proof') {
            const { content_hash, merkle_root, proof } = payload;

            const verified = verifyMerkleProof(content_hash, merkle_root, proof);

            return Response.json({
                success: true,
                verified,
                proof_valid: verified
            });
        }

        if (action === 'get_audit_trail') {
            const { token_id, start_date, end_date, action_types } = payload;

            const query = {
                tags: { $contains: token_id },
                memory_type: 'audit_log'
            };

            if (action_types && action_types.length > 0) {
                // Filter by action types in tags
            }

            const logs = await base44.asServiceRole.entities.GlobalMemory.filter(query, '-created_date', 100);

            const filteredLogs = logs.filter(log => {
                const content = log.content;
                if (start_date && content.timestamp < start_date) return false;
                if (end_date && content.timestamp > end_date) return false;
                return true;
            });

            return Response.json({
                success: true,
                audit_trail: filteredLogs.map(log => log.content),
                total_actions: filteredLogs.length
            });
        }

        return Response.json({ error: 'Invalid action' }, { status: 400 });

    } catch (error) {
        console.error('Token Audit Anchoring error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});

async function hashString(str) {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function hashObject(obj) {
    return await hashString(JSON.stringify(obj));
}

function buildMerkleTree(hashes) {
    if (hashes.length === 0) return { root: '', proofs: [] };
    if (hashes.length === 1) return { root: hashes[0], proofs: [[]] };

    const tree = [hashes];
    let currentLevel = hashes;

    while (currentLevel.length > 1) {
        const nextLevel = [];
        for (let i = 0; i < currentLevel.length; i += 2) {
            const left = currentLevel[i];
            const right = i + 1 < currentLevel.length ? currentLevel[i + 1] : left;
            const combined = left + right;
            const hash = hashStringSync(combined);
            nextLevel.push(hash);
        }
        tree.push(nextLevel);
        currentLevel = nextLevel;
    }

    return {
        root: currentLevel[0],
        proofs: generateProofs(tree, hashes)
    };
}

function hashStringSync(str) {
    // Simple hash for demo (in production use crypto.subtle.digest)
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
}

function generateProofs(tree, hashes) {
    return hashes.map((hash, index) => {
        const proof = [];
        let currentIndex = index;
        
        for (let level = 0; level < tree.length - 1; level++) {
            const isRightNode = currentIndex % 2 === 1;
            const siblingIndex = isRightNode ? currentIndex - 1 : currentIndex + 1;
            
            if (siblingIndex < tree[level].length) {
                proof.push({
                    hash: tree[level][siblingIndex],
                    position: isRightNode ? 'left' : 'right'
                });
            }
            
            currentIndex = Math.floor(currentIndex / 2);
        }
        
        return proof;
    });
}

function verifyMerkleProof(leafHash, rootHash, proof) {
    let currentHash = leafHash;
    
    for (const step of proof) {
        const combined = step.position === 'left' 
            ? step.hash + currentHash 
            : currentHash + step.hash;
        currentHash = hashStringSync(combined);
    }
    
    return currentHash === rootHash;
}

function generateRandomHash() {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15) +
           Math.random().toString(36).substring(2, 15);
}

async function anchorActionBatch(token_id, base44) {
    // Get recent unanchored actions
    const recentActions = await base44.asServiceRole.entities.GlobalMemory.filter({
        tags: { $contains: token_id },
        memory_type: 'audit_log'
    }, '-created_date', 50);

    if (recentActions.length < 10) return; // Only anchor in batches

    const actionHashes = await Promise.all(
        recentActions.slice(0, 10).map(a => hashObject(a.content))
    );

    const merkleTree = buildMerkleTree(actionHashes);

    // Store batch anchor
    await base44.asServiceRole.entities.GlobalMemory.create({
        memory_type: 'batch_anchor',
        content: {
            token_id,
            action_count: actionHashes.length,
            merkle_root: merkleTree.root,
            action_hashes: actionHashes,
            anchored_at: Date.now()
        },
        source_agent: 'TokenAuditAnchoring',
        confidence_score: 1.0,
        tags: ['tokenomics', 'batch_anchor', token_id]
    });
}