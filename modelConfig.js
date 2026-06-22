export const DEFAULT_MODEL = 'gpt-5.4-nano';
export const PRICING_AS_OF = '23 June 2026';

export const MODEL_OPTIONS = [
  {
    id: 'gpt-5.4-nano',
    name: 'GPT-5.4 nano',
    badge: 'Recommended',
    inputPrice: 0.20,
    outputPrice: 1.25,
    description: 'Best balance for compact summaries: current, fast, and still inexpensive.',
    supportsTemperature: false,
    reasoningEffort: 'none',
    verbosity: 'low'
  },
  {
    id: 'gpt-5-nano',
    name: 'GPT-5 nano',
    badge: 'Cheapest',
    inputPrice: 0.05,
    outputPrice: 0.40,
    description: 'Lowest cost. Good for straightforward summaries, but may miss more nuance.',
    supportsTemperature: false,
    reasoningEffort: 'minimal'
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o mini',
    badge: 'Legacy',
    inputPrice: 0.15,
    outputPrice: 0.60,
    description: 'Your previous default. Cheap and reliable, but older than the GPT-5 options.',
    supportsTemperature: true
  },
  {
    id: 'gpt-5.4-mini',
    name: 'GPT-5.4 mini',
    badge: 'Higher quality',
    inputPrice: 0.75,
    outputPrice: 4.50,
    description: 'Use when nano omits important details in long or difficult material.',
    supportsTemperature: false,
    reasoningEffort: 'none',
    verbosity: 'low'
  },
  {
    id: 'gpt-5-mini',
    name: 'GPT-5 mini',
    badge: 'Previous generation',
    inputPrice: 0.25,
    outputPrice: 2.00,
    description: 'Kept for existing users. GPT-5.4 nano is the better default for this extension.',
    supportsTemperature: false,
    reasoningEffort: 'minimal'
  }
];

export function getModelConfig(modelId) {
  return MODEL_OPTIONS.find((model) => model.id === modelId) || null;
}

export function isGpt5Model(modelId) {
  return typeof modelId === 'string' && modelId.toLowerCase().startsWith('gpt-5');
}

export function formatTokenPrice(price) {
  return `$${price.toFixed(2)} / 1M`;
}

export function applyModelRequestParameters(body, modelId, maxTokens, temperature) {
  const modelConfig = getModelConfig(modelId);

  if (isGpt5Model(modelId)) {
    body.max_completion_tokens = maxTokens;
    // Always constrain reasoning for summarisation. Otherwise older GPT-5
    // models can spend the whole output allowance on hidden reasoning and
    // return an empty visible message.
    body.reasoning_effort = modelConfig?.reasoningEffort || 'minimal';
    if (modelConfig?.verbosity) {
      body.verbosity = modelConfig.verbosity;
    }
  } else {
    body.max_tokens = maxTokens;
    if (modelConfig?.supportsTemperature !== false) {
      body.temperature = temperature;
    }
  }

  return body;
}
