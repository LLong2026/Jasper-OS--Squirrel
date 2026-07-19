import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const action = body.action;
    const now = Date.now();

    const rand = (n) => Array.from(crypto.getRandomValues(new Uint8Array(n)))
      .map((b) => b.toString(16).padStart(2, '0')).join('');

    // ---------- create_swarm ----------
    if (action === 'create_swarm') {
      const { name, goal, member_dids, topology, coordinator_did, consensus_threshold } = body;
      if (!name || !goal || !Array.isArray(member_dids) || member_dids.length === 0) {
        return Response.json({ error: 'name, goal, and member_dids[] are required' }, { status: 400 });
      }
      const swarm_id = `swarm_${rand(8)}`;
      const swarm = await base44.entities.Swarm.create({
        swarm_id,
        name,
        goal,
        member_dids,
        topology: topology || 'mesh',
        coordinator_did: coordinator_did || member_dids[0],
        status: 'active',
        consensus_threshold: typeof consensus_threshold === 'number' ? consensus_threshold : 0.6,
        created_at: now
      });
      return Response.json({ swarm });
    }

    // ---------- decompose_goal ----------
    if (action === 'decompose_goal') {
      const { swarm_id } = body;
      if (!swarm_id) return Response.json({ error: 'swarm_id is required' }, { status: 400 });
      const swarms = await base44.entities.Swarm.filter({ swarm_id });
      if (!swarms || swarms.length === 0) return Response.json({ error: 'Swarm not found' }, { status: 404 });
      const swarm = swarms[0];

      const llm = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a swarm planner. Break the following goal into 3-5 ordered, concrete sub-tasks that distinct autonomous agents can execute. Goal: "${swarm.goal}". Members: ${JSON.stringify(swarm.member_dids)}.`,
        response_json_schema: {
          type: 'object',
          properties: {
            tasks: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  description: { type: 'string' }
                }
              }
            }
          }
        }
      });

      const tasks = (llm && llm.tasks) ? llm.tasks : [
        { title: 'Gather context', description: `Collect inputs relevant to: ${swarm.goal}` },
        { title: 'Analyze', description: `Process gathered context and derive insights` },
        { title: 'Synthesize result', description: `Combine insights into a final deliverable` }
      ];

      const created = [];
      for (let i = 0; i < tasks.length; i++) {
        const t = tasks[i];
        const task_id = `${swarm_id}_t${i + 1}`;
        const assigned = [swarm.member_dids[i % swarm.member_dids.length]];
        const rec = await base44.entities.SwarmTask.create({
          swarm_id,
          task_id,
          title: t.title,
          description: t.description,
          assigned_dids: assigned,
          status: 'assigned',
          proposals: [],
          consensus_reached: false,
          order: i,
          created_at: now
        });
        created.push(rec);
      }
      await base44.entities.Swarm.update(swarm.id, { status: 'executing' });
      return Response.json({ swarm_id, tasks: created });
    }

    // ---------- dispatch_tasks ----------
    if (action === 'dispatch_tasks') {
      const { swarm_id } = body;
      if (!swarm_id) return Response.json({ error: 'swarm_id is required' }, { status: 400 });
      const tasks = await base44.entities.SwarmTask.filter({ swarm_id }, 'order');
      const updated = [];
      for (const t of tasks) {
        const u = await base44.entities.SwarmTask.update(t.id, { status: 'in_progress' });
        updated.push(u);
      }
      return Response.json({ swarm_id, tasks: updated });
    }

    // ---------- collect_results ----------
    if (action === 'collect_results') {
      const { swarm_id } = body;
      if (!swarm_id) return Response.json({ error: 'swarm_id is required' }, { status: 400 });
      const tasks = await base44.entities.SwarmTask.filter({ swarm_id }, 'order');
      const updated = [];
      for (const t of tasks) {
        // Simulate each assigned agent submitting a proposal, then "executing"
        const proposals = (t.assigned_dids || []).map((did) => ({
          did,
          submitted_at: Date.now(),
          summary: `${t.title} -> draft output from ${did}`
        }));
        const result = { task_id: t.task_id, output: `Completed: ${t.title}`, submitted_by: t.assigned_dids };
        const u = await base44.entities.SwarmTask.update(t.id, {
          status: 'completed',
          proposals,
          consensus_reached: true,
          result
        });
        updated.push(u);
      }
      return Response.json({ swarm_id, tasks: updated });
    }

    // ---------- reach_consensus ----------
    if (action === 'reach_consensus') {
      const { swarm_id } = body;
      if (!swarm_id) return Response.json({ error: 'swarm_id is required' }, { status: 400 });
      const swarms = await base44.entities.Swarm.filter({ swarm_id });
      if (!swarms || swarms.length === 0) return Response.json({ error: 'Swarm not found' }, { status: 404 });
      const swarm = swarms[0];
      const tasks = await base44.entities.SwarmTask.filter({ swarm_id }, 'order');
      const completed = tasks.filter((t) => t.status === 'completed' && t.consensus_reached);
      const consensus = tasks.length > 0 ? completed.length / tasks.length : 0;
      const reached = consensus >= (swarm.consensus_threshold || 0.6);
      const result_summary = reached
        ? `Swarm reached consensus (${Math.round(consensus * 100)}% of tasks). ${completed.length}/${tasks.length} tasks completed.`
        : `Swarm failed to reach consensus (${Math.round(consensus * 100)}% vs ${(swarm.consensus_threshold || 0.6) * 100}% threshold).`;
      const updated = await base44.entities.Swarm.update(swarm.id, {
        status: reached ? 'completed' : 'failed',
        result_summary
      });
      return Response.json({ swarm: updated, consensus, reached, completed_count: completed.length, total_count: tasks.length });
    }

    // ---------- list ----------
    if (action === 'list') {
      const swarms = await base44.entities.Swarm.list('-created_date', 50);
      return Response.json({ swarms });
    }

    if (action === 'list_tasks') {
      const { swarm_id } = body;
      if (!swarm_id) return Response.json({ error: 'swarm_id is required' }, { status: 400 });
      const tasks = await base44.entities.SwarmTask.filter({ swarm_id }, 'order');
      return Response.json({ swarm_id, tasks });
    }

    return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});