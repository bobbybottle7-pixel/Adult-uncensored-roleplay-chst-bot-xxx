/* Provider adapter: OpenRouter, with automatic model fallback and streaming.
 *
 * Two behaviours matter:
 *  1. FALLBACK — a busy, capped or missing model transparently rolls to the
 *     next one in the chain, so a free-tier limit never kills a generation.
 *  2. JSON MODE — `json()` demands a strict object back and repairs the common
 *     failure modes (fenced code blocks, leading prose, trailing commas)
 *     before giving up. The financial assumptions arrive through this path,
 *     so it has to be robust rather than optimistic.
 *
 * Swapping providers later touches only this file. */
(function (root) {
  'use strict';
  const RETRYABLE = new Set([408, 409, 429, 500, 502, 503, 504]);

  function cfg() { return root.BP.config; }
  function settings() { return root.BP.Store.getSettings(); }

  function modelChain() {
    const s = settings();
    const all = cfg().freeModels.map(m => m.id);
    if (s.model && s.model !== 'auto') return [s.model, ...all.filter(id => id !== s.model)];
    return all;
  }

  function headers(s) {
    return {
      'Authorization': 'Bearer ' + s.apiKey,
      'Content-Type': 'application/json',
      'HTTP-Referer': location.origin || 'https://localhost',
      'X-Title': cfg().appName,
    };
  }

  function shortLabel(id) {
    const m = cfg().freeModels.find(x => x.id === id);
    return m ? m.label : id.split('/').pop().replace(':free', '');
  }

  async function toError(res) {
    let detail = '';
    try { detail = (await res.json())?.error?.message || ''; } catch (e) {}
    const err = new Error(detail || ('HTTP ' + res.status));
    err.status = res.status;
    return err;
  }

  async function callOnce(modelId, messages, opts, signal) {
    const s = settings();
    const res = await fetch(cfg().endpoint, {
      method: 'POST',
      headers: headers(s),
      signal,
      body: JSON.stringify({
        model: modelId,
        messages,
        temperature: opts.temperature ?? s.temperature,
        max_tokens: opts.maxTokens ?? s.maxTokens,
        stream: false,
      }),
    });
    if (!res.ok) throw await toError(res);
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content;
    if (!text || !text.trim()) { const e = new Error('Empty response'); e.status = 502; throw e; }
    return text.trim();
  }

  async function callStream(modelId, messages, opts, onToken, signal) {
    const s = settings();
    const res = await fetch(cfg().endpoint, {
      method: 'POST',
      headers: headers(s),
      signal,
      body: JSON.stringify({
        model: modelId,
        messages,
        temperature: opts.temperature ?? s.temperature,
        max_tokens: opts.maxTokens ?? s.maxTokens,
        stream: true,
      }),
    });
    if (!res.ok) throw await toError(res);
    if (!res.body || !res.body.getReader) return callOnce(modelId, messages, opts, signal);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '', full = '', started = false;

    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let nl;
        while ((nl = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (!line || line.startsWith(':') || !line.startsWith('data:')) continue;
          const payload = line.slice(5).trim();
          if (payload === '[DONE]') { buffer = ''; break; }
          try {
            const delta = JSON.parse(payload)?.choices?.[0]?.delta?.content;
            if (delta) { full += delta; started = true; onToken && onToken(delta, full); }
          } catch (e) { /* partial frame — wait for the rest */ }
        }
      }
    } catch (err) {
      // Once text has started arriving, keep it rather than discarding a
      // half-written section to chase a fallback model.
      if (!started) throw err;
    }
    if (!full.trim()) { const e = new Error('Empty response'); e.status = 502; throw e; }
    return full.trim();
  }

  /* --- JSON repair ---------------------------------------------------- */

  function extractJson(text) {
    let t = String(text).trim();
    // Strip a ```json fence if the model wrapped its answer in one.
    const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence) t = fence[1].trim();
    // Otherwise take the outermost brace pair, dropping any preamble.
    if (!t.startsWith('{')) {
      const first = t.indexOf('{'), lastBrace = t.lastIndexOf('}');
      if (first >= 0 && lastBrace > first) t = t.slice(first, lastBrace + 1);
    }
    try { return JSON.parse(t); } catch (e) {}
    // Last resort: drop trailing commas, the single most common malformation.
    try { return JSON.parse(t.replace(/,\s*([}\]])/g, '$1')); } catch (e) {}
    throw new Error('The model did not return usable JSON.');
  }

  const API = {
    hasKey() { return !!settings().apiKey; },

    /* Free-form completion with fallback; streams when onToken is supplied. */
    async complete({ system, prompt, messages, onToken, onStatus, signal, temperature, maxTokens, stream }) {
      const s = settings();
      if (!s.apiKey) {
        const e = new Error('No API key yet. Open Settings and paste your free OpenRouter key.');
        e.code = 'NO_KEY';
        throw e;
      }
      const msgs = messages || [
        ...(system ? [{ role: 'system', content: system }] : []),
        { role: 'user', content: prompt },
      ];
      const opts = { temperature, maxTokens };
      const wantStream = (stream !== undefined ? stream : s.stream !== false) && !!onToken;

      const chain = modelChain();
      let lastErr = null;

      for (let i = 0; i < chain.length; i++) {
        const modelId = chain[i];
        try {
          if (onStatus) {
            onStatus(i === 0
              ? { text: 'Writing with ' + shortLabel(modelId), model: modelId }
              : { text: shortLabel(chain[i - 1]) + ' was busy — switched to ' + shortLabel(modelId), model: modelId, fellBack: true });
          }
          const out = wantStream
            ? await callStream(modelId, msgs, opts, onToken, signal)
            : await callOnce(modelId, msgs, opts, signal);
          return { text: out, model: modelId };
        } catch (err) {
          if (err && err.name === 'AbortError') throw err;
          lastErr = err;
          const status = err.status || 0;
          if (status === 401 || status === 403) { err.code = 'AUTH'; throw err; }
          const canFallback = i < chain.length - 1 &&
            (RETRYABLE.has(status) || status === 400 || status === 404 || status === 0);
          if (!canFallback) throw err;
        }
      }
      throw lastErr || new Error('Every model in the chain failed.');
    },

    /* Strict-JSON completion. Retries once with a blunter instruction before
     * surfacing a failure, because a single malformed brace should not cost
     * the user their whole financial model. */
    async json({ system, prompt, signal, temperature, maxTokens }) {
      const base = (system || '') +
        '\n\nRespond with a single valid JSON object and nothing else. ' +
        'No markdown fences, no commentary before or after, no trailing commas.';
      let lastErr = null;

      for (let attempt = 0; attempt <= cfg().limits.maxRetries; attempt++) {
        try {
          const { text, model } = await API.complete({
            system: attempt === 0 ? base
              : base + '\n\nYour previous reply could not be parsed. Return ONLY the raw JSON object, starting with { and ending with }.',
            prompt,
            signal,
            temperature: temperature ?? 0.25,   // structure benefits from low temp
            maxTokens: maxTokens ?? 2400,
            stream: false,
          });
          return { data: extractJson(text), model };
        } catch (err) {
          if (err && (err.name === 'AbortError' || err.code === 'NO_KEY' || err.code === 'AUTH')) throw err;
          lastErr = err;
        }
      }
      throw lastErr || new Error('Could not get structured data from the model.');
    },

    extractJson,
    shortLabel,
  };

  root.BP = root.BP || {};
  root.BP.API = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
