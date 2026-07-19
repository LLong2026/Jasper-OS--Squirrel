/**
 * LLM Provider Registry - Unified interface for all LLM providers
 * Makes the system vendor-independent and future-proof
 */

export const providerRegistry = {
    openai: {
        name: 'OpenAI',
        endpoint: 'https://api.openai.com/v1/chat/completions',
        envKey: 'OPENAI_API_KEY',
        models: {
            'gpt-4-turbo': { cost: 9, speed: 6, quality: 10, context: 128000 },
            'gpt-4': { cost: 8, speed: 5, quality: 9, context: 8192 },
            'gpt-3.5-turbo': { cost: 2, speed: 9, quality: 7, context: 16385 },
            'gpt-4o': { cost: 7, speed: 8, quality: 10, context: 128000 },
            'gpt-4o-mini': { cost: 1, speed: 10, quality: 7, context: 128000 }
        },
        formatRequest: (model, prompt, systemMessage, params) => ({
            model,
            messages: [
                ...(systemMessage ? [{ role: 'system', content: systemMessage }] : []),
                { role: 'user', content: prompt }
            ],
            temperature: params.temperature || 0.7,
            max_tokens: params.max_tokens || 4000
        }),
        formatResponse: (data) => data.choices?.[0]?.message?.content,
        headers: (apiKey) => ({
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        })
    },

    anthropic: {
        name: 'Anthropic',
        endpoint: 'https://api.anthropic.com/v1/messages',
        envKey: 'ANTHROPIC_API_KEY',
        models: {
            'claude-3-opus': { cost: 9, speed: 5, quality: 10, context: 200000 },
            'claude-3.5-sonnet': { cost: 7, speed: 8, quality: 10, context: 200000 },
            'claude-3-sonnet': { cost: 6, speed: 7, quality: 9, context: 200000 },
            'claude-3-haiku': { cost: 3, speed: 10, quality: 7, context: 200000 }
        },
        formatRequest: (model, prompt, systemMessage, params) => ({
            model,
            max_tokens: params.max_tokens || 4000,
            temperature: params.temperature || 0.7,
            messages: [{ role: 'user', content: prompt }],
            ...(systemMessage && { system: systemMessage })
        }),
        formatResponse: (data) => data.content?.[0]?.text,
        headers: (apiKey) => ({
            'x-api-key': apiKey,
            'Content-Type': 'application/json',
            'anthropic-version': '2023-06-01'
        })
    },

    google: {
        name: 'Google',
        endpoint: 'https://generativelanguage.googleapis.com/v1beta/models',
        envKey: 'GOOGLE_API_KEY',
        models: {
            'gemini-pro': { cost: 4, speed: 8, quality: 8, context: 32000 },
            'gemini-ultra': { cost: 8, speed: 6, quality: 10, context: 32000 },
            'gemini-1.5-pro': { cost: 6, speed: 7, quality: 9, context: 1000000 },
            'gemini-1.5-flash': { cost: 2, speed: 10, quality: 7, context: 1000000 }
        },
        formatRequest: (model, prompt, systemMessage, params) => ({
            contents: [{
                parts: [{ text: `${systemMessage ? systemMessage + '\n\n' : ''}${prompt}` }]
            }],
            generationConfig: {
                temperature: params.temperature || 0.7,
                maxOutputTokens: params.max_tokens || 4000
            }
        }),
        formatResponse: (data) => data.candidates?.[0]?.content?.parts?.[0]?.text,
        headers: (apiKey) => ({
            'Content-Type': 'application/json'
        }),
        customEndpoint: (model, apiKey) => `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
    },

    perplexity: {
        name: 'Perplexity',
        endpoint: 'https://api.perplexity.ai/chat/completions',
        envKey: 'PERPLEXITY_API_KEY',
        models: {
            'llama-3.1-sonar-large-128k-online': { cost: 7, speed: 7, quality: 9, context: 128000 },
            'llama-3.1-sonar-small-128k-online': { cost: 4, speed: 9, quality: 7, context: 128000 }
        },
        formatRequest: (model, prompt, systemMessage, params) => ({
            model,
            messages: [
                ...(systemMessage ? [{ role: 'system', content: systemMessage }] : []),
                { role: 'user', content: prompt }
            ],
            temperature: params.temperature || 0.7,
            max_tokens: params.max_tokens || 4000
        }),
        formatResponse: (data) => data.choices?.[0]?.message?.content,
        headers: (apiKey) => ({
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        })
    },

    mistral: {
        name: 'Mistral',
        endpoint: 'https://api.mistral.ai/v1/chat/completions',
        envKey: 'MISTRAL_API_KEY',
        models: {
            'mixtral-8x7b-instruct': { cost: 4, speed: 7, quality: 8, context: 32000 },
            'mistral-large': { cost: 7, speed: 6, quality: 9, context: 32000 },
            'mistral-small': { cost: 2, speed: 9, quality: 7, context: 32000 },
            'codestral-latest': { cost: 5, speed: 8, quality: 9, context: 32000 }
        },
        formatRequest: (model, prompt, systemMessage, params) => ({
            model,
            messages: [
                ...(systemMessage ? [{ role: 'system', content: systemMessage }] : []),
                { role: 'user', content: prompt }
            ],
            temperature: params.temperature || 0.7,
            max_tokens: params.max_tokens || 4000
        }),
        formatResponse: (data) => data.choices?.[0]?.message?.content,
        headers: (apiKey) => ({
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        })
    },

    cohere: {
        name: 'Cohere',
        endpoint: 'https://api.cohere.ai/v1/chat',
        envKey: 'COHERE_API_KEY',
        models: {
            'command-r-plus': { cost: 6, speed: 7, quality: 8, context: 128000 },
            'command-r': { cost: 4, speed: 8, quality: 7, context: 128000 },
            'command': { cost: 3, speed: 9, quality: 7, context: 4000 }
        },
        formatRequest: (model, prompt, systemMessage, params) => ({
            model,
            message: prompt,
            ...(systemMessage && { preamble: systemMessage }),
            temperature: params.temperature || 0.7,
            max_tokens: params.max_tokens || 4000
        }),
        formatResponse: (data) => data.text,
        headers: (apiKey) => ({
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        })
    },

    meta: {
        name: 'Meta',
        endpoint: 'https://api.together.xyz/v1/chat/completions',
        envKey: 'TOGETHER_API_KEY',
        models: {
            'llama-2-70b-chat': { cost: 3, speed: 6, quality: 7, context: 4096 },
            'llama-3-70b-instruct': { cost: 4, speed: 7, quality: 8, context: 8192 },
            'llama-3.1-405b-instruct': { cost: 8, speed: 5, quality: 9, context: 32000 }
        },
        formatRequest: (model, prompt, systemMessage, params) => ({
            model: `meta-llama/${model}`,
            messages: [
                ...(systemMessage ? [{ role: 'system', content: systemMessage }] : []),
                { role: 'user', content: prompt }
            ],
            temperature: params.temperature || 0.7,
            max_tokens: params.max_tokens || 4000
        }),
        formatResponse: (data) => data.choices?.[0]?.message?.content,
        headers: (apiKey) => ({
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        })
    }
};

/**
 * Unified LLM caller - works with any provider
 */
export async function callLLM(provider, model, prompt, systemMessage, params = {}) {
    const config = providerRegistry[provider];
    if (!config) {
        throw new Error(`Unknown provider: ${provider}`);
    }

    const apiKey = Deno.env.get(config.envKey);
    if (!apiKey) {
        throw new Error(`${config.name} API key not configured`);
    }

    const endpoint = config.customEndpoint ? config.customEndpoint(model, apiKey) : config.endpoint;
    const requestBody = config.formatRequest(model, prompt, systemMessage, params);

    const response = await fetch(endpoint, {
        method: 'POST',
        headers: config.headers(apiKey),
        body: JSON.stringify(requestBody)
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error?.message || `${config.name} API error`);
    }

    return {
        success: true,
        response: config.formatResponse(data),
        usage: data.usage,
        provider: config.name,
        model
    };
}

/**
 * Get all available models across all providers
 */
export function getAllModels() {
    const allModels = [];
    for (const [provider, config] of Object.entries(providerRegistry)) {
        for (const [modelName, specs] of Object.entries(config.models)) {
            allModels.push({
                provider,
                model: modelName,
                name: `${config.name} ${modelName}`,
                ...specs,
                specialties: getModelSpecialties(modelName, specs)
            });
        }
    }
    return allModels;
}

function getModelSpecialties(modelName, specs) {
    const specialties = [];
    
    // Cost-based
    if (specs.cost <= 3) specialties.push('cost-effective');
    if (specs.cost >= 7) specialties.push('premium');
    
    // Speed-based
    if (specs.speed >= 9) specialties.push('speed', 'fast');
    
    // Quality-based
    if (specs.quality >= 9) specialties.push('reasoning', 'complex');
    
    // Model-specific
    if (modelName.includes('code')) specialties.push('code', 'programming');
    if (modelName.includes('sonar')) specialties.push('research', 'real-time', 'web-search');
    if (modelName.includes('claude')) specialties.push('writing', 'analysis');
    if (modelName.includes('gemini')) specialties.push('multimodal');
    if (modelName.includes('command')) specialties.push('enterprise', 'rag', 'business');
    if (modelName.includes('llama')) specialties.push('open-source');
    
    // General
    specialties.push('general');
    
    return specialties;
}