/* Model-agnostic chat adapter.
 *
 * Public call:
 *   APP.API.chat({ messages, onError }) -> Promise<string>
 *
 * Design goals given the user's constraints (free, weak device, providers
 * that hit limits): AUTOMATIC FALLBACK across a list of free models. If the
 * chosen model is busy (429), rate-limited, or errors, we transparently try
 * the next free model in the chain before giving up. This is why "OpenRouter
 * dies after a couple messages" hurts less — we don't depend on one model.
 *
 * To swap to a completely different provider later, you only change this file:
 * keep the same chat() signature and the rest of the app is unaffected. */
(function () {
  const RETRYABLE = new Set([408, 409, 429, 500, 502, 503, 504]);

  // Build the ordered list of model ids to attempt.
  function modelChain() {
    const s = APP.Store.getSettings();
    const all = APP.config.freeModels.map(m => m.id);
    if (s.model && s.model !== 'auto') {
      // Put the user's pick first, then the rest as fallback.
      return [s.model, ...all.filter(id => id !== s.model)];
    }
    return all;
  }

  async function callModel(modelId, messages, settings) {
    const res = await fetch(APP.config.endpoint, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + settings.apiKey,
        'Content-Type': 'application/json',
        // OpenRouter likes these for free-tier attribution; harmless elsewhere.
        'HTTP-Referer': location.origin || 'https://localhost',
        'X-Title': 'Roleplay Chat',
      },
      body: JSON.stringify({
        model: modelId,
        messages,
        max_tokens: settings.maxTokens,
        temperature: settings.temperature,
      }),
    });

    if (!res.ok) {
      let detail = '';
      try { detail = (await res.json())?.error?.message || ''; } catch (e) {}
      const err = new Error(detail || ('HTTP ' + res.status));
      err.status = res.status;
      throw err;
    }

    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content;
    if (!text) {
      const err = new Error('Empty response');
      err.status = 502;
      throw err;
    }
    return text.trim();
  }

  APP.API = {
    hasKey() { return !!APP.Store.getSettings().apiKey; },

    async chat({ messages, onStatus }) {
      const settings = APP.Store.getSettings();
      if (!settings.apiKey) {
        const e = new Error('No API key set. Open Settings and paste your free key.');
        e.code = 'NO_KEY';
        throw e;
      }

      const chain = modelChain();
      let lastErr = null;

      for (let i = 0; i < chain.length; i++) {
        const modelId = chain[i];
        try {
          if (onStatus) {
            const label = shortLabel(modelId);
            onStatus(i === 0 ? '' : 'Model busy — trying ' + label + '…');
          }
          return await callModel(modelId, messages, settings);
        } catch (err) {
          lastErr = err;
          const status = err.status || 0;

          // Auth errors won't be fixed by another model — stop now.
          if (status === 401 || status === 403) {
            err.code = 'AUTH';
            throw err;
          }
          // Non-retryable client error (bad request) on THIS model: try next.
          // Retryable (busy/limit/server): try next model too.
          const canFallback = i < chain.length - 1 &&
            (RETRYABLE.has(status) || status === 400 || status === 404 || status === 0);
          if (!canFallback) throw err;
          // else: loop continues to next model
        }
      }
      throw lastErr || new Error('All models failed');
    },
  };

  function shortLabel(id) {
    const m = APP.config.freeModels.find(x => x.id === id);
    if (m) return m.label.split('(')[0].trim();
    return id.split('/').pop().replace(':free', '');
  }
})();
