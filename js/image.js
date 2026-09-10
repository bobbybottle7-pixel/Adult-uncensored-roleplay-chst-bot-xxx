/* Image generation adapter (multi-provider).
 *
 * Providers:
 *   pollinations : keyless, free, GET-URL (works everywhere, some filtering)
 *   venice       : keyed, uncensored (safe_mode:false), POST returning base64
 *   custom       : your own GET URL template with {prompt}/{key} placeholders
 *
 * Public:
 *   APP.Image.generate({prompt, seed, width, height}) -> Promise<{src}>
 *       src is either a remote URL (GET providers) or a data: URL (POST).
 *   APP.Image.buildScenePrompt(character, userText) -> string
 *   APP.Image.avatarUrlFor(character) -> string   (always keyless/GET, cheap)
 *
 * CORS note: <img> URLs (pollinations / custom GET) always work from a browser.
 * A keyed POST provider (venice) only works if it allows browser CORS; if it
 * doesn't, generate() rejects with a clear message and you'd need a tiny proxy.
 */
(function () {

  function imgSettings() {
    const stored = APP.Store.getSettings().image || {};
    return Object.assign({}, APP.config.image, stored);
  }
  APP.Image = { getSettings: imgSettings };

  function hashSeed(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) { h = (h * 31 + str.charCodeAt(i)) | 0; }
    return Math.abs(h);
  }

  APP.Image.buildScenePrompt = function (character, userText) {
    const s = imgSettings();
    const bits = [];
    if (userText && userText.trim()) {
      bits.push(userText.trim());
    } else {
      const form = APP.Shapeshifter.avatarFor(character);
      bits.push('portrait of ' + (character.name || 'a being') + ' in its current form');
      if (character.age) bits.push('adult, ' + character.age + ' years old');
      if (form) bits.push(form.avatarPrompt || form.essence);
    }
    bits.push('adult, 18+, fictional character');
    if (s.styleSuffix) bits.push(s.styleSuffix);
    return bits.join(', ');
  };

  // ---- Pollinations GET URL (also used for custom GET + avatars) ----
  function pollinationsUrl(prompt, opts, s) {
    const params = new URLSearchParams({
      width: opts.width || s.width,
      height: opts.height || s.height,
      model: s.model || 'flux',
      seed: String(opts.seed != null ? opts.seed : Math.floor(Math.random() * 1e9)),
      nologo: 'true',
    });
    return 'https://image.pollinations.ai/prompt/' + encodeURIComponent(prompt) + '?' + params.toString();
  }

  function customUrl(prompt, s) {
    let url = s.customUrlTemplate.replace('{prompt}', encodeURIComponent(prompt));
    if (s.customApiKey) url = url.replace('{key}', encodeURIComponent(s.customApiKey));
    return url;
  }

  // Back-compat sync URL (GET providers only).
  APP.Image.urlFor = function (prompt, opts) {
    opts = opts || {};
    const s = imgSettings();
    if (s.provider === 'custom' && s.customUrlTemplate) return customUrl(prompt, s);
    return pollinationsUrl(prompt, opts, s);
  };

  // ---- Venice keyed POST (uncensored) ----
  async function veniceGenerate(prompt, opts, s) {
    if (!s.veniceKey) throw new Error('Add your Venice API key in Settings.');
    // Route through the free proxy if configured (fixes browser CORS).
    const endpoint = s.imageProxyUrl && s.imageProxyUrl.trim()
      ? s.imageProxyUrl.trim()
      : 'https://api.venice.ai/api/v1/image/generate';
    let res;
    try {
      res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + s.veniceKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: s.veniceModel || 'venice-sd35',
          prompt: prompt.slice(0, 7500),
          width: opts.width || s.width,
          height: opts.height || s.height,
          safe_mode: false,          // uncensored
          format: 'png',
          hide_watermark: true,
          seed: opts.seed != null ? (opts.seed % 999999999) : Math.floor(Math.random() * 999999999),
          negative_prompt: 'low quality, blurry, deformed, extra limbs, watermark, text',
        }),
      });
    } catch (e) {
      throw new Error('Could not reach the image API from the browser (likely CORS). Set an Image proxy URL in Settings — see proxy/README.md.');
    }
    if (!res.ok) {
      let msg = 'HTTP ' + res.status;
      try { msg = (await res.json())?.error || msg; } catch (e) {}
      if (res.status === 401 || res.status === 403) msg = 'Venice key invalid or not authorized.';
      throw new Error(msg);
    }
    const data = await res.json();
    const b64 = data && data.images && data.images[0];
    if (!b64) throw new Error('Venice returned no image.');
    return { src: 'data:image/png;base64,' + b64 };
  }

  // ---- Unified generate ----
  APP.Image.generate = function (opts) {
    opts = opts || {};
    const s = imgSettings();
    const prompt = opts.prompt || '';
    if (s.provider === 'venice') return veniceGenerate(prompt, opts, s);
    // GET-URL providers resolve immediately.
    const src = (s.provider === 'custom' && s.customUrlTemplate)
      ? customUrl(prompt, s) : pollinationsUrl(prompt, opts, s);
    return Promise.resolve({ src });
  };

  // Avatars: always keyless GET so browsing dozens of cards is cheap and never
  // spends a paid key. Uses a stable seed so a character keeps the same face.
  APP.Image.slug = function (name) {
    return String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  };

  // Category -> avatar flavor for shapeshifter forms. Humanoid-leaning
  // categories get the same glamour treatment as normal characters;
  // creature/abstract/elemental lean into a dramatic portrait instead.
  const SHIFT_FLAVOR = {
    person:    'extremely sexy, alluring, seductive pose, curvy body, skimpy lingerie, lace, cleavage, boudoir, glamour lighting, full body, ',
    mythic:    'extremely sexy, alluring hybrid form, curvy body, fantasy glamour, dramatic lighting, full body, ',
    creature:  'striking creature portrait, sensual pose, dramatic cinematic lighting, full body, ',
    elemental: 'glowing elemental being, sensual pose, dramatic cinematic lighting, full body, ',
    abstract:  'surreal abstract entity, sensual pose, dreamlike glow, dramatic lighting, full body, ',
  };

  APP.Image.avatarUrlFor = function (character) {
    const s = imgSettings();
    const form = APP.Shapeshifter.avatarFor(character);
    const base = (form && (form.avatarPrompt || form.essence || form.name)) ||
                 character.name || 'a shifting being';
    const flavor = (form && SHIFT_FLAVOR[form.category]) || SHIFT_FLAVOR.person;
    const prompt = base + ', ' + flavor + 'adult, 18+, ' + (s.styleSuffix || 'highly detailed');
    // A form's own seed keeps its face stable across renders; falls back to
    // a stable hash so even a brand-new being gets a consistent portrait.
    const seed = (form && form.avatarSeed != null && form.avatarSeed !== '')
      ? form.avatarSeed
      : hashSeed(String((form && form.id) || character.id || base));
    // Force pollinations for avatars, and use the fast 'turbo' model — on
    // mobile, generating many avatars must be quick or they time out.
    return pollinationsUrl(prompt, { seed, width: 384, height: 384 },
                           Object.assign({}, s, { model: 'turbo' }));
  };
})();
