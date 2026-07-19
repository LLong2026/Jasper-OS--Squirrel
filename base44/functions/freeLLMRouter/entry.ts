import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// ── Free LLM Router ──────────────────────────────────────────────────────────
// Tries free-tier providers first (Groq, Together AI, HuggingFace), then falls
// back to paid providers if keys are present. Each provider handles a missing
// key gracefully by throwing, which the router catches and moves to the next.

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { prompt, provider_preference, max_tokens, temperature } = await req.json();

    const providers = [
      { name: 'groq_free', free: true, priority: 1 },
      { name: 'together_ai_free', free: true, priority: 2 },
      { name: 'huggingface_inference', free: true, priority: 3 },
      { name: 'ollama_local', free: true, priority: 4 },
      { name: 'openai_paid', free: false, priority: 5 },
      { name: 'anthropic_paid', free: false, priority: 6 },
    ];

    let selectedProvider = null;
    let response = null;
    const tried = [];

    for (const provider of providers) {
      if (provider_preference && provider.name !== provider_preference) continue;
      tried.push(provider.name);
      try {
        response = await invokeProvider(provider.name, prompt, max_tokens, temperature, user);
        if (response.success) {
          selectedProvider = provider;
          break;
        }
      } catch (err) {
        console.log(`Provider ${provider.name} failed: ${err.message}`);
        continue;
      }
    }

    if (!selectedProvider) {
      return Response.json({
        error: 'No available LLM providers. Set a free API key (Groq, Together, or HuggingFace) in Settings → Environment Variables.',
        tried,
      }, { status: 503 });
    }

    return Response.json({
      success: true,
      provider: selectedProvider.name,
      free: selectedProvider.free,
      response: response.data,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function invokeProvider(providerName, prompt, maxTokens, temperature, user) {
  switch (providerName) {
    case 'groq_free':
      return await invokeGroq(prompt, maxTokens, temperature);
    case 'together_ai_free':
      return await invokeTogetherAI(prompt, maxTokens, temperature);
    case 'huggingface_inference':
      return await invokeHuggingFace(prompt, maxTokens, temperature);
    case 'ollama_local':
      return await invokeOllama(prompt, maxTokens, temperature);
    case 'openai_paid': {
      const key = Deno.env.get('OPENAI_API_KEY');
      if (!key) throw new Error('No OpenAI key');
      return await invokeOpenAI(prompt, maxTokens, temperature, key);
    }
    case 'anthropic_paid': {
      const key = Deno.env.get('ANTHROPIC_API_KEY');
      if (!key) throw new Error('No Anthropic key');
      return await invokeAnthropic(prompt, maxTokens, temperature, key);
    }
    default:
      throw new Error('Unknown provider');
  }
}

// ── Groq (free tier, very fast) ──
async function invokeGroq(prompt, maxTokens, temperature) {
  const groqKey = Deno.env.get('GROQ_API_KEY');
  if (!groqKey) throw new Error('No Groq key');
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${groqKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: maxTokens || 1024,
      temperature: temperature || 0.7,
    }),
  });
  if (!response.ok) {
    const txt = await response.text();
    throw new Error(`Groq API error: ${response.status} ${txt}`);
  }
  const data = await response.json();
  return { success: true, data: data.choices?.[0]?.message?.content || '' };
}

// ── Together AI (free tier — Llama 3.3 70B Turbo Free) ──
async function invokeTogetherAI(prompt, maxTokens, temperature) {
  const togetherKey = Deno.env.get('TOGETHER_API_KEY');
  if (!togetherKey) throw new Error('No Together AI key');
  const response = await fetch('https://api.together.xyz/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${togetherKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo-Free',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: maxTokens || 1024,
      temperature: temperature || 0.7,
    }),
  });
  if (!response.ok) {
    const txt = await response.text();
    throw new Error(`Together AI API error: ${response.status} ${txt}`);
  }
  const data = await response.json();
  return { success: true, data: data.choices?.[0]?.message?.content || '' };
}

// ── HuggingFace Inference API (free tier) ──
async function invokeHuggingFace(prompt, maxTokens, temperature) {
  const hfToken = Deno.env.get('HUGGINGFACE_API_KEY');
  if (!hfToken) throw new Error('No HuggingFace token');
  const model = 'meta-llama/Meta-Llama-3-8B-Instruct';
  const response = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${hfToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inputs: prompt,
      parameters: {
        max_new_tokens: maxTokens || 512,
        temperature: temperature || 0.7,
        return_full_text: false,
      },
    }),
  });
  if (!response.ok) {
    const txt = await response.text();
    throw new Error(`HuggingFace API error: ${response.status} ${txt}`);
  }
  const data = await response.json();
  const text = Array.isArray(data) ? data[0]?.generated_text : data?.generated_text;
  return { success: true, data: text || '' };
}

// ── Ollama (local only — won't reach from cloud runtime, kept for completeness) ──
async function invokeOllama(prompt, maxTokens, temperature) {
  const response = await fetch('http://localhost:11434/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'llama2', prompt, stream: false }),
  });
  if (!response.ok) throw new Error('Ollama not available');
  const data = await response.json();
  return { success: true, data: data.response };
}

// ── Paid providers ──
async function invokeOpenAI(prompt, maxTokens, temperature, apiKey) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: maxTokens || 1024,
      temperature: temperature || 0.7,
    }),
  });
  if (!response.ok) throw new Error('OpenAI API error');
  const data = await response.json();
  return { success: true, data: data.choices[0].message.content };
}

async function invokeAnthropic(prompt, maxTokens, temperature, apiKey) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: maxTokens || 1024,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!response.ok) throw new Error('Anthropic API error');
  const data = await response.json();
  return { success: true, data: data.content[0].text };
}