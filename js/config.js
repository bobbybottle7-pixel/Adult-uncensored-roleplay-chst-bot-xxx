/* Global config: model list, defaults, storage keys.
 * Everything here is safe to edit if you want different free models. */
window.APP = window.APP || {};

APP.config = {
  storagePrefix: 'rpchat_',

  // OpenRouter endpoint (models run on their servers, not your device).
  endpoint: 'https://openrouter.ai/api/v1/chat/completions',

  /* Free uncensored / roleplay-friendly models on OpenRouter.
   * The app tries them TOP-TO-BOTTOM and auto-falls-back to the next one
   * whenever a model is busy (429), rate-limited, or errors — so one model
   * being capped won't stop your chat. All end in ":free" = no cost.
   * If a model id ever stops existing, it's simply skipped. */
  freeModels: [
    { id: 'cognitivecomputations/dolphin-mistral-24b-venice-edition:free', label: 'Dolphin Mistral 24B (uncensored, best for RP)' },
    { id: 'cognitivecomputations/dolphin3.0-mistral-24b:free',            label: 'Dolphin 3.0 Mistral 24B (uncensored)' },
    { id: 'nousresearch/hermes-3-llama-3.1-405b:free',                    label: 'Hermes 3 405B (steerable, large)' },
    { id: 'mistralai/mistral-small-3.2-24b-instruct:free',               label: 'Mistral Small 3.2 24B' },
    { id: 'mistralai/mistral-nemo:free',                                  label: 'Mistral Nemo 12B (fast)' },
    { id: 'meta-llama/llama-3.3-70b-instruct:free',                       label: 'Llama 3.3 70B' },
  ],

  defaults: {
    model: 'auto',        // "auto" = walk the freeModels fallback chain
    maxTokens: 800,
    temperature: 0.9,
  },

  // How many recent messages to send with each request (older ones are
  // covered by the memory summary instead, to save tokens).
  recentMessageWindow: 24,

  // Update the long-term memory summary every N user+bot exchanges.
  summarizeEveryTurns: 8,
};
