import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

/**
 * Advanced Healing Playbooks - MIT-Grade System Recovery
 * Integrates with reasoning engine and knowledge base for intelligent healing
 */

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { action, payload } = await req.json();

        if (action === 'diagnose_and_heal') {
            const { issue_type, issue_details, affected_component } = payload;

            // Step 1: Multi-hop reasoning to diagnose root cause
            const diagnosis = await base44.functions.invoke('reasoningEngine', {
                action: 'multi_hop_reasoning',
                agent_name: 'AegisHealer',
                payload: {
                    query: `Diagnose this system issue:
Type: ${issue_type}
Details: ${JSON.stringify(issue_details)}
Component: ${affected_component}

What is the root cause? What symptoms indicate this? What should be checked?`,
                    max_hops: 4,
                    require_validation: true
                }
            });

            // Step 2: Retrieve relevant healing playbooks from knowledge base
            const playbooks = await base44.functions.invoke('reasoningEngine', {
                action: 'query_knowledge_base',
                agent_name: 'AegisHealer',
                payload: {
                    query: `Healing strategy for: ${diagnosis.data.final_conclusion}`,
                    top_k: 5,
                    content_type_filter: 'troubleshooting'
                }
            });

            // Step 3: Select and adapt best playbook
            const healingPlan = await base44.integrations.Core.InvokeLLM({
                prompt: `Create a healing plan for this diagnosed issue.

Root Cause: ${diagnosis.data.final_conclusion}
Confidence: ${diagnosis.data.confidence}

Available Playbooks:
${playbooks.data.results.map((p, i) => `[${i+1}] ${p.title}\n${p.content}`).join('\n\n')}

Create a step-by-step healing plan that:
1. Addresses the root cause
2. Minimizes downtime
3. Prevents recurrence
4. Has clear validation steps
5. Includes rollback procedures`,
                response_json_schema: {
                    type: "object",
                    properties: {
                        healing_steps: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    step_number: { type: "number" },
                                    action: { type: "string" },
                                    command: { type: "string" },
                                    expected_result: { type: "string" },
                                    validation: { type: "string" },
                                    rollback_if_failed: { type: "string" }
                                }
                            }
                        },
                        prevention_measures: { type: "array", items: { type: "string" } },
                        monitoring_required: { type: "array", items: { type: "string" } }
                    }
                }
            });

            // Step 4: Decompose healing plan into executable tasks
            const decomposition = await base44.functions.invoke('taskDecomposer', {
                action: 'decompose_goal',
                agent_name: 'AegisHealer',
                payload: {
                    abstract_goal: `Heal system issue: ${issue_type}`,
                    max_depth: 2,
                    available_agents: ['AegisHealer', 'SystemArchitect', 'CodeForge']
                }
            });

            // Step 5: Execute healing
            const execution = await base44.functions.invoke('taskDecomposer', {
                action: 'execute_decomposition',
                agent_name: 'AegisHealer',
                payload: {
                    decomposition_id: decomposition.data.decomposition_id
                }
            });

            // Step 6: Validate healing success
            const validation = await validateHealing(issue_details, base44);

            // Step 7: Learn from this healing attempt
            if (validation.success) {
                await base44.functions.invoke('reasoningEngine', {
                    action: 'learn_from_reasoning',
                    agent_name: 'AegisHealer',
                    payload: {
                        chain_id: diagnosis.data.chain_id
                    }
                });

                // Store successful healing as new playbook
                await base44.functions.invoke('reasoningEngine', {
                    action: 'add_knowledge',
                    agent_name: 'AegisHealer',
                    payload: {
                        title: `Healing: ${issue_type} - ${affected_component}`,
                        content: JSON.stringify({
                            issue: issue_type,
                            diagnosis: diagnosis.data.final_conclusion,
                            healing_plan: healingPlan,
                            execution_result: execution.data,
                            success: true
                        }),
                        content_type: 'troubleshooting',
                        tags: ['healing', issue_type, affected_component, 'validated'],
                        source: 'successful_healing'
                    }
                });
            }

            return Response.json({
                success: validation.success,
                diagnosis: diagnosis.data,
                healing_plan: healingPlan,
                execution_result: execution.data,
                validation,
                knowledge_updated: validation.success
            });
        }

        if (action === 'seed_playbooks') {
            // Seed MIT-grade healing playbooks
            const playbooks = getMITGradePlaybooks();
            
            for (const playbook of playbooks) {
                await base44.functions.invoke('reasoningEngine', {
                    action: 'add_knowledge',
                    agent_name: 'System',
                    payload: {
                        title: playbook.title,
                        content: playbook.content,
                        content_type: 'troubleshooting',
                        tags: playbook.tags,
                        source: 'mit_playbooks'
                    }
                });
            }

            return Response.json({
                success: true,
                playbooks_seeded: playbooks.length,
                message: 'MIT-grade healing playbooks loaded'
            });
        }

        if (action === 'auto_heal') {
            // Autonomous healing without human intervention
            const { monitored_issues } = payload;

            const healingResults = [];
            
            for (const issue of monitored_issues) {
                const result = await base44.functions.invoke('healingPlaybooks', {
                    action: 'diagnose_and_heal',
                    payload: issue
                });
                
                healingResults.push({
                    issue: issue.issue_type,
                    healed: result.data.success
                });
            }

            return Response.json({
                success: true,
                healing_attempts: healingResults.length,
                successful_heals: healingResults.filter(r => r.healed).length,
                results: healingResults
            });
        }

        return Response.json({ error: 'Invalid action' }, { status: 400 });

    } catch (error) {
        console.error('Healing playbooks error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});

async function validateHealing(issueDetails, base44) {
    // Check if issue is resolved
    const validation = await base44.integrations.Core.InvokeLLM({
        prompt: `Validate if this issue is resolved:

Original Issue: ${JSON.stringify(issueDetails)}

Check:
1. Are symptoms gone?
2. Is system stable?
3. Are metrics normal?
4. Any side effects?`,
        response_json_schema: {
            type: "object",
            properties: {
                success: { type: "boolean" },
                symptoms_resolved: { type: "boolean" },
                system_stable: { type: "boolean" },
                side_effects: { type: "array", items: { type: "string" } },
                confidence: { type: "number" }
            }
        }
    });

    return validation;
}

function getMITGradePlaybooks() {
    return [
        // Database & Storage Issues
        {
            title: "Database Connection Pool Exhaustion",
            content: `Root Cause: Connection pool exhausted due to connection leaks or insufficient pool size.
            
Diagnosis:
- Check active connections vs pool max
- Identify long-running queries
- Check for unclosed connections
- Monitor connection wait time

Healing Steps:
1. Increase connection pool size temporarily (2x current)
2. Kill idle connections > 5 minutes
3. Identify and terminate blocking queries
4. Enable connection timeout enforcement
5. Add connection leak detection

Prevention:
- Implement connection pooling best practices
- Add connection lifecycle monitoring
- Set aggressive connection timeouts
- Use connection health checks

Validation:
- New connections succeed
- Query latency returns to normal
- No connection wait timeout errors`,
            tags: ['database', 'connections', 'performance', 'critical']
        },
        {
            title: "Memory Leak Detection and Mitigation",
            content: `Root Cause: Heap memory continuously growing, eventual OOM crash.

Diagnosis:
- Monitor heap usage over time
- Check for object retention patterns
- Identify large object allocations
- Analyze GC behavior

Healing Steps:
1. Trigger immediate garbage collection
2. Dump heap for analysis
3. Identify leak source (event listeners, caches, closures)
4. Restart affected service with higher memory limit
5. Deploy fix for leak source

Prevention:
- Implement memory monitoring alerts
- Add object lifecycle tracking
- Use WeakMaps for caches
- Regular heap profiling

Validation:
- Memory usage stabilizes
- GC cycles normalize
- No further growth trend`,
            tags: ['memory', 'performance', 'critical', 'oom']
        },
        {
            title: "Deadlock Detection and Resolution",
            content: `Root Cause: Circular dependency in resource locks causing system hang.

Diagnosis:
- Identify waiting threads/processes
- Build lock dependency graph
- Detect circular wait conditions
- Check lock timeout configurations

Healing Steps:
1. Identify deadlock participants
2. Force release oldest lock holder
3. Retry failed operations
4. Implement lock ordering
5. Add deadlock detection timeout

Prevention:
- Enforce consistent lock ordering
- Use lock timeout mechanisms
- Implement deadlock detection algorithms
- Avoid nested locks when possible

Validation:
- Threads no longer waiting
- Operations complete successfully
- Lock acquisition succeeds`,
            tags: ['concurrency', 'locks', 'deadlock', 'critical']
        },

        // Network & API Issues
        {
            title: "API Rate Limit Cascade Failure",
            content: `Root Cause: Upstream API rate limiting causing request queue buildup and service degradation.

Diagnosis:
- Check 429 response rate
- Monitor request queue depth
- Identify retry storm patterns
- Check circuit breaker state

Healing Steps:
1. Enable circuit breaker immediately
2. Clear request queue (fail fast)
3. Implement exponential backoff
4. Add request throttling
5. Cache responses where possible

Prevention:
- Implement adaptive rate limiting
- Use token bucket algorithm
- Add request prioritization
- Implement graceful degradation

Validation:
- Request queue cleared
- Error rate decreased
- Response time normalized`,
            tags: ['api', 'rate-limiting', 'network', 'high']
        },
        {
            title: "DNS Resolution Failure",
            content: `Root Cause: DNS server unreachable or misconfigured, causing service discovery failures.

Diagnosis:
- Test DNS resolution manually
- Check DNS server reachability
- Verify DNS cache state
- Check /etc/resolv.conf configuration

Healing Steps:
1. Switch to backup DNS servers
2. Clear local DNS cache
3. Add static host entries for critical services
4. Restart DNS resolver service
5. Update DNS server configuration

Prevention:
- Configure multiple DNS servers
- Implement DNS caching
- Use service mesh for service discovery
- Monitor DNS query success rate

Validation:
- DNS queries succeed
- Service discovery works
- Network latency normal`,
            tags: ['dns', 'network', 'service-discovery', 'high']
        },

        // Resource Exhaustion
        {
            title: "CPU Throttling Under Load",
            content: `Root Cause: CPU utilization at 100%, causing request timeouts and system degradation.

Diagnosis:
- Profile CPU usage by process
- Identify hot code paths
- Check for infinite loops
- Monitor thread count

Healing Steps:
1. Identify and kill runaway processes
2. Scale up compute resources
3. Enable request load shedding
4. Implement worker thread limits
5. Deploy CPU optimization patches

Prevention:
- Implement auto-scaling policies
- Add CPU usage alerts
- Profile code regularly
- Use asynchronous processing

Validation:
- CPU usage below 80%
- Request latency acceptable
- No timeout errors`,
            tags: ['cpu', 'performance', 'scaling', 'high']
        },
        {
            title: "Disk Space Exhaustion",
            content: `Root Cause: Disk space at capacity, causing write failures and service crashes.

Diagnosis:
- Check disk usage (df -h)
- Identify large files/directories
- Check log file sizes
- Monitor inode usage

Healing Steps:
1. Clear old log files immediately
2. Delete temp files and caches
3. Compress large files
4. Move data to external storage
5. Expand disk volume

Prevention:
- Implement log rotation
- Add disk space monitoring
- Automate cleanup jobs
- Use log aggregation services

Validation:
- Disk usage below 80%
- Write operations succeed
- Services running normally`,
            tags: ['disk', 'storage', 'critical']
        },

        // Application-Level Issues
        {
            title: "Cascading Service Failure",
            content: `Root Cause: Failure in one service causing dependent services to fail (cascade effect).

Diagnosis:
- Map service dependency graph
- Identify initial failure point
- Check circuit breaker states
- Monitor error propagation

Healing Steps:
1. Enable circuit breakers on all dependencies
2. Isolate failed service
3. Enable fallback responses
4. Implement bulkhead pattern
5. Restart services in dependency order

Prevention:
- Implement fault isolation
- Use circuit breakers everywhere
- Add health check endpoints
- Design for graceful degradation

Validation:
- Dependent services stabilized
- Circuit breakers open/closed correctly
- Error rate decreased`,
            tags: ['microservices', 'cascading-failure', 'resilience', 'critical']
        },
        {
            title: "Message Queue Backlog",
            content: `Root Cause: Consumer lag increasing, messages piling up, eventual system degradation.

Diagnosis:
- Check queue depth
- Monitor consumer lag
- Identify slow consumers
- Check for poison messages

Healing Steps:
1. Scale up consumer count
2. Move poison messages to DLQ
3. Increase consumer processing speed
4. Implement message prioritization
5. Add backpressure mechanisms

Prevention:
- Monitor queue metrics continuously
- Implement auto-scaling for consumers
- Add message TTL
- Use competing consumers pattern

Validation:
- Queue depth decreasing
- Consumer lag acceptable
- Message processing rate normal`,
            tags: ['messaging', 'queue', 'performance', 'high']
        },

        // Security Issues
        {
            title: "Brute Force Attack Mitigation",
            content: `Root Cause: Automated brute force attack on authentication endpoints causing service degradation.

Diagnosis:
- Analyze login attempt patterns
- Check failed authentication rate
- Identify attack source IPs
- Monitor authentication latency

Healing Steps:
1. Enable rate limiting on auth endpoints
2. Block attacking IP addresses
3. Implement CAPTCHA challenges
4. Add account lockout policies
5. Enable geographic restrictions

Prevention:
- Implement progressive delays
- Use WAF rules
- Enable MFA
- Monitor for anomalous patterns

Validation:
- Attack traffic blocked
- Legitimate users can login
- Auth service stable`,
            tags: ['security', 'auth', 'ddos', 'critical']
        },

        // Data Consistency Issues
        {
            title: "Split Brain Resolution",
            content: `Root Cause: Network partition causing multiple nodes to act as primary, data inconsistency.

Diagnosis:
- Identify network partition
- Check consensus protocol state
- Verify data divergence
- Check quorum requirements

Healing Steps:
1. Force new leader election
2. Identify correct data version
3. Reconcile divergent data
4. Restore cluster quorum
5. Validate data consistency

Prevention:
- Use proper consensus algorithms (Raft, Paxos)
- Implement fencing mechanisms
- Monitor cluster health
- Use odd number of nodes

Validation:
- Single leader elected
- Data consistent across nodes
- Cluster health normal`,
            tags: ['distributed', 'consensus', 'data-consistency', 'critical']
        },

        // Configuration Issues
        {
            title: "Configuration Drift Correction",
            content: `Root Cause: System configuration drifted from desired state, causing unexpected behavior.

Diagnosis:
- Compare current vs desired config
- Identify changed parameters
- Check configuration version
- Review change logs

Healing Steps:
1. Backup current configuration
2. Apply desired configuration
3. Restart affected services
4. Validate configuration
5. Monitor for issues

Prevention:
- Use configuration management tools
- Implement GitOps workflows
- Add configuration validation
- Monitor configuration drift

Validation:
- Configuration matches desired state
- Services behaving correctly
- No unexpected errors`,
            tags: ['configuration', 'drift', 'gitops', 'medium']
        },

        // Add more playbooks...
        {
            title: "Thread Pool Exhaustion",
            tags: ['threading', 'performance', 'high'],
            content: `Thread pool saturated, requests queuing indefinitely. Increase pool size, identify blocking operations, implement async patterns.`
        },
        {
            title: "Cache Stampede",
            tags: ['cache', 'performance', 'high'],
            content: `Cache invalidation causing thundering herd. Implement cache warming, use probabilistic early expiration, add request coalescing.`
        },
        {
            title: "SSL Certificate Expiration",
            tags: ['ssl', 'security', 'critical'],
            content: `SSL cert expired causing service unavailability. Auto-renew certificates, monitor expiration dates, use Let's Encrypt automation.`
        },
        {
            title: "Log File Rotation Failure",
            tags: ['logging', 'disk', 'medium'],
            content: `Log files not rotating, disk filling up. Fix logrotate config, force rotation, compress old logs, adjust retention policies.`
        },
        {
            title: "Database Index Missing",
            tags: ['database', 'performance', 'high'],
            content: `Slow queries due to missing indexes. Analyze query patterns, create missing indexes, update statistics, monitor query performance.`
        }
    ];
}