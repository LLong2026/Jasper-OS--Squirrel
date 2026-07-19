import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// ── Cross-Chat Memory ───────────────────────────────────────────────────────
// Gives Jasper persistent memory across conversations:
//   recall      → condense the user's accumulated MemoryBank into a short summary
//   consolidate → extract durable facts from recent messages and store them

const VALID_TYPES = ['fact', 'preference', 'goal', 'relationship', 'project', 'conversation_highlight'];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const action = body.action || 'recall';

    // ── RECALL ──
    if (action === 'recall') {
      const memories = await base44.entities.MemoryBank.list('-created_date', 60).catch(() => []);
      if (!memories || memories.length === 0) {
        return Response.json({ success: true, summary: '', memory_count: 0 });
      }

      const memoryLines = memories.map((m, i) => `${i + 1}. [${m.memory_type}] ${m.content}`);
      const prompt =
        `You are condensing a user's accumulated memory notes into a single concise paragraph (max ~120 words) that an AI assistant named Jasper can use as background context. Preserve key facts, preferences, ongoing projects, goals, relationships, and important decisions. Remove duplicates and trivial detail. Output only the paragraph, no preamble, no headers.\n\nMemory notes:\n${memoryLines.join('\n')}`;

      const summary = await base44.integrations.Core.InvokeLLM({ prompt });
      return Response.json({
        success: true,
        summary: typeof summary === 'string' ? summary.trim() : JSON.stringify(summary),
        memory_count: memories.length,
      });
    }

    // ── CONSOLIDATE ──
    if (action === 'consolidate') {
      const messages = Array.isArray(body.messages) ? body.messages : [];
      if (messages.length === 0) {
        return Response.json({ success: true, stored: 0 });
      }

      const transcript = messages
        .filter((m) => m.content && typeof m.content === 'string')
        .slice(-20)
        .map((m) => `${m.role === 'user' ? 'User' : 'Jasper'}: ${m.content}`)
        .join('\n');

      const extractPrompt =
        `You are extracting durable, reusable facts from a conversation that an AI assistant named Jasper must remember about the user across ALL future conversations. Prioritize and aggressively capture:\n` +
        `1. PATENT WORK — claim drafts, claim numbers, filing status, prior art, inventors, patent IDs, non-provisional/provisional progress, any legal or technical claim language.\n` +
        `2. URIB PROGRESS — pipeline stages reached, settlement IDs, ThreadZero anchors (T*), stack commitments (C*), rails traversed, bridge health, bottlenecks, ISO 20022 message details, settlement outcomes.\n` +
        `3. PROJECTS & MILESTONES — what's being built, current status, blockers, next steps, deadlines.\n` +
        `4. Personal preferences, goals, key decisions, relationships, and important context.\n` +
        `Ignore trivial chatter, greetings, one-off questions, and anything already obvious. Each fact must be a concise standalone statement rich enough to reconstruct context later. Assign importance 8-10 to patent claims and URIB settlement milestones.\n` +
        `Output JSON: { "facts": [ { "memory_type": one of ${VALID_TYPES.join('|')}, "content": "concise statement", "importance": 0-10 } ] }. If nothing durable, return { "facts": [] }.\n\nConversation:\n${transcript}`;

      const res = await base44.integrations.Core.InvokeLLM({
        prompt: extractPrompt,
        response_json_schema: {
          type: 'object',
          properties: {
            facts: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  memory_type: { type: 'string' },
                  content: { type: 'string' },
                  importance: { type: 'number' },
                },
                required: ['memory_type', 'content'],
              },
            },
          },
          required: ['facts'],
        },
      });

      const facts = res?.facts || [];
      if (facts.length === 0) {
        return Response.json({ success: true, stored: 0, extracted: 0 });
      }

      // Dedupe against existing memories
      const existing = await base44.entities.MemoryBank.list('-created_date', 100).catch(() => []);
      const existingContents = existing.map((m) => (m.content || '').toLowerCase().trim());

      const toCreate = [];
      for (const f of facts) {
        const content = String(f.content).trim();
        if (content.length < 5) continue;
        const lower = content.toLowerCase();
        const dup = existingContents.some((c) => {
          if (c === lower) return true;
          if (lower.length >= 25 && c.includes(lower)) return true;
          if (c.length >= 25 && lower.includes(c)) return true;
          return false;
        });
        if (dup) continue;
        const mt = VALID_TYPES.includes(f.memory_type) ? f.memory_type : 'fact';
        toCreate.push({
          memory_type: mt,
          content,
          importance: Math.min(10, Math.max(0, Number(f.importance) || 5)),
          tags: ['cross-chat'],
        });
        existingContents.push(lower);
      }

      let stored = 0;
      if (toCreate.length > 0) {
        const created = await base44.entities.MemoryBank.bulkCreate(toCreate).catch(() => []);
        stored = Array.isArray(created) ? created.length : 0;
      }

      return Response.json({ success: true, stored, extracted: facts.length });
    }

    return Response.json({ error: 'Invalid action. Use: recall | consolidate' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});