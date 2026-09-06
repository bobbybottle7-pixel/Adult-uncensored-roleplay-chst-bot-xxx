/* Model-agnostic chat adapter.
 *
 * Public:
 *   APP.API.chat({ messages, onStatus, onToken, stream }) -> Promise<string>
 *
 * Two behaviours matter here:
 *  1. AUTOMATIC FALLBACK across a list of free models. If a model is busy
 *     (429), rate-limited, or errors, we transparently try the next one.
 *  2. STREAMING. When onToken is supplied and streaming is enabled, tokens are
 *     delivered as they arrive so replies appear live instead of all at once.
 *     If a model fails BEFORE any token arrives we can still fall back; once
 *     text has started we keep what we got rather than throwing it away.
 *
 * To swap provider later, only this file changes — keep the chat() signature. */
(function () {
  const RETRYABLE = new Set([408, 409, 429, 500, 502, 503, 504]);

  function modelChain() {
    const s = APP.Store.getSettings();
    const all = APP.config.freeModels.map(m => m.id);
    if (s.model && s.model !== 'auto') {
      return [s.model, ...all.filter(id => id !== s.model)];
    }
    return all;
  }

  function headers(settings) {
    return {
      'Authorization': 'Bearer ' + settings.apiKey,
      'Content-Type': 'application/json',
      'HTTP-Referer': location.origin || 'https://localhost',
      'X-Title': 'Roleplay Chat',
    };
  }

  function body(modelId, messages, settings, stream) {
    return JSON.stringify({
      model: modelId,
      messages,
      max_tokens: settings.maxTokens,
      temperature: settings.temperature,
      stream: !!stream,
    });
  }

  async function toError(res) {
    let detail = '';
    try { detail = (await res.json())?.error?.message || ''; } catch (e) {}
    const err = new Error(detail || ('HTTP ' + res.status));
    err.status = res.status;
    return err;
  }

  // --- Non-streaming call ---
  async function callModel(modelId, messages, settings, signal) {
    const res = await fetch(APP.config.endpoint, {
      method: 'POST', headers: headers(settings),
      body: body(modelId, messages, settings, false), signal,
    });
    if (!res.ok) throw await toError(res);
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content;
    if (!text) { const e = new Error('Empty response'); e.status = 502; throw e; }
    return text.trim();
  }

  // --- Streaming call (Server-Sent Events) ---
  async function callModelStream(modelId, messages, settings, onToken, signal) {
    const res = await fetch(APP.config.endpoint, {
      method: 'POST', headers: headers(settings),
      body: body(modelId, messages, settings, true), signal,
    });
    if (!res.ok) throw await toError(res);
    if (!res.body || !res.body.getReader) {
      // Browser can't stream — fall back to a normal call.
      return await callModel(modelId, messages, settings, signal);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '', full = '', started = false;

    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // SSE frames are separated by blank lines; each carries "data: ..."
        let nl;
        while ((nl = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (!line || line.startsWith(':')) continue;      // keep-alive comment
          if (!line.startsWith('data:')) continue;
          const payload = line.slice(5).trim();
          if (payload === '[DONE]') { buffer = ''; break; }
          try {
            const json = JSON.parse(payload);
            const delta = json?.choices?.[0]?.delta?.content;
            if (delta) {
              full += delta;
              started = true;
              onToken && onToken(delta, full);
            }
          } catch (e) { /* partial frame — wait for more */ }
        }
      }
    } catch (err) {
      if (!started) throw err;      // nothing salvageable: let fallback happen
    }

    if (!full.trim()) { const e = new Error('Empty response'); e.status = 502; throw e; }
    return full.trim();
  }

  APP.API = {
    hasKey() { return !!APP.Store.getSettings().apiKey; },

    async chat({ messages, onStatus, onToken, stream, signal }) {
      const settings = APP.Store.getSettings();
      if (!settings.apiKey) {
        const e = new Error('No API key set. Open Settings and paste your free key.');
        e.code = 'NO_KEY';
        throw e;
      }
      const wantStream = (stream !== undefined ? stream : settings.stream !== false) && !!onToken;

      const chain = modelChain();
      let lastErr = null;

      for (let i = 0; i < chain.length; i++) {
        const modelId = chain[i];
        try {
          if (onStatus) onStatus(i === 0 ? '' : 'Model busy — trying ' + shortLabel(modelId) + '…');
          return wantStream
            ? await callModelStream(modelId, messages, settings, onToken, signal)
            : await callModel(modelId, messages, settings, signal);
        } catch (err) {
          if (err && err.name === 'AbortError') throw err;   // user stopped it
          lastErr = err;
          const status = err.status || 0;
          if (status === 401 || status === 403) { err.code = 'AUTH'; throw err; }
          const canFallback = i < chain.length - 1 &&
            (RETRYABLE.has(status) || status === 400 || status === 404 || status === 0);
          if (!canFallback) throw err;
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
