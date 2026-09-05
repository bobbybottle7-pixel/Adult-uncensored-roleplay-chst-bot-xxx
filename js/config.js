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
    { id: 'z-ai/glm-5.2:free',                        label: 'GLM 5.2 (capable, permissive — best for RP)' },
    { id: 'minimax/minimax-m3:free',                  label: 'MiniMax M3 (creative, permissive)' },
    { id: 'minimax/minimax-m2.7:free',                label: 'MiniMax M2.7' },
    { id: 'nvidia/nemotron-3-ultra-550b-a55b:free',   label: 'Nemotron 3 Ultra 550B (large)' },
    { id: 'nvidia/nemotron-3-super-120b-a12b:free',   label: 'Nemotron 3 Super 120B' },
    { id: 'google/gemma-4-31b-it:free',               label: 'Gemma 4 31B (reliable, more filtered)' },
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

  /* ---------- Image generation ----------
   * Default is Pollinations: keyless, free, generates straight from a URL,
   * so it works on a weak device with no signup. It is fairly permissive but
   * has some content filtering, so very explicit results are not guaranteed.
   * The "custom" provider lets advanced users point at any keyed provider
   * that returns an image from a GET/POST for more reliable NSFW output. */
  image: {
    provider: 'pollinations',     // 'pollinations' | 'venice' | 'custom'
    model: 'flux',                // pollinations model
    width: 768,
    height: 768,
    // Appended to every image prompt to push quality/detail.
    styleSuffix: 'highly detailed, best quality, sharp focus',

    // Venice (keyed, uncensored). Get a key at venice.ai -> API.
    veniceKey: '',
    veniceModel: 'venice-sd35',   // uncensored SD3.5; also try 'lustify-sdxl'

    // Optional proxy for keyed POST providers that block browser CORS.
    // Deploy the free worker in proxy/ and paste its URL here.
    imageProxyUrl: '',

    // Custom GET provider (advanced). {prompt} and {key} are URL-encoded in.
    customUrlTemplate: '',        // e.g. https://your-endpoint/gen?prompt={prompt}&key={key}
    customApiKey: '',
  },

  // Curated rows shown in the gallery when not searching/filtering.
  // Each row picks characters by kind or tag, in order.
  featured: [
    { title: '🤖 AI assistants',     kind: 'assistant' },
    { title: '🔥 Popular',            tags: ['romance', 'flirty', 'dominant'], limit: 12 },
    { title: '💕 Romance',            tags: ['romance'] },
    { title: '😈 Dominant',           tags: ['dominant', 'femdom'] },
    { title: '🐉 Fantasy',            tags: ['fantasy', 'elf', 'orc', 'dragon', 'witch'] },
    { title: '👻 Supernatural',       tags: ['supernatural', 'vampire', 'demon', 'monster'] },
    { title: '🚀 Sci-fi',             tags: ['sci-fi', 'cyberpunk', 'alien', 'android'] },
    { title: '🏠 Slice of life',      tags: ['slice of life', 'cozy', 'roommate'] },
    { title: '🎀 Playful & flirty',   tags: ['playful', 'flirty', 'tsundere'] },
    { title: '💋 Mature',             tags: ['mature', 'milf', 'dilf'] },
  ],

  imageProviders: [
    { id: 'pollinations', label: 'Pollinations (free, no key, some filtering)' },
    { id: 'venice',       label: 'Venice (keyed, uncensored)' },
    { id: 'custom',       label: 'Custom endpoint (advanced)' },
  ],

  pollinationsModels: [
    { id: 'flux',          label: 'Flux (balanced, recommended)' },
    { id: 'flux-realism',  label: 'Flux Realism (photoreal)' },
    { id: 'any-dark',      label: 'Any Dark (moody / artistic)' },
    { id: 'turbo',         label: 'Turbo (fastest, lower quality)' },
  ],
};
