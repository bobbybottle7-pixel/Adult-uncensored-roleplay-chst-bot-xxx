/* Image generation adapter (model-agnostic, mirrors js/api.js).
 *
 * Public:
 *   APP.Image.buildScenePrompt(character, userText) -> string
 *   APP.Image.urlFor(prompt) -> string        (for <img src>)
 *
 * Default provider = Pollinations: keyless + free, the image is produced by
 * simply loading a URL, which is why it works on a weak device with no signup.
 * To use a keyed NSFW provider instead, set image.provider = 'custom' and a
 * customUrlTemplate in js/config.js (or via Settings). Everything else in the
 * app stays the same. */
(function () {

  function imgSettings() {
    // Merge stored image settings over the config defaults.
    const stored = APP.Store.getSettings().image || {};
    return Object.assign({}, APP.config.image, stored);
  }
  APP.Image = { getSettings: imgSettings };

  // Build a good image prompt from a character + optional user description.
  APP.Image.buildScenePrompt = function (character, userText) {
    const s = imgSettings();
    const bits = [];
    if (userText && userText.trim()) {
      bits.push(userText.trim());
    } else {
      // "Selfie" of the character from their own description.
      bits.push('portrait of ' + (character.name || 'a person'));
      if (character.age) bits.push('adult, ' + character.age + ' years old');
      if (character.appearance) bits.push(character.appearance);
    }
    // Always reinforce fictional-adult framing in the image prompt too.
    bits.push('adult, 18+, fictional character');
    if (s.styleSuffix) bits.push(s.styleSuffix);
    return bits.join(', ');
  };

  // Small stable hash so a given character always gets the same avatar.
  function hashSeed(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) { h = (h * 31 + str.charCodeAt(i)) | 0; }
    return Math.abs(h);
  }

  // Return a URL that renders the image for the given prompt.
  // opts: { seed, width, height }
  APP.Image.urlFor = function (prompt, opts) {
    opts = opts || {};
    const s = imgSettings();
    const enc = encodeURIComponent(prompt);

    if (s.provider === 'custom' && s.customUrlTemplate) {
      let url = s.customUrlTemplate.replace('{prompt}', enc);
      if (s.customApiKey && url.indexOf('{key}') >= 0) url = url.replace('{key}', encodeURIComponent(s.customApiKey));
      return url;
    }

    // Pollinations (default, keyless).
    const params = new URLSearchParams({
      width: opts.width || s.width,
      height: opts.height || s.height,
      model: s.model || 'flux',
      seed: String(opts.seed != null ? opts.seed : Math.floor(Math.random() * 1e9)),
      nologo: 'true',
    });
    return 'https://image.pollinations.ai/prompt/' + enc + '?' + params.toString();
  };

  // A consistent square portrait avatar for a character (preset or custom).
  APP.Image.avatarUrlFor = function (character) {
    const s = imgSettings();
    const base = character.avatarPrompt || character.appearance ||
                 ('portrait of ' + (character.name || 'a person'));
    const prompt = base + ', upper body portrait, face focus, adult, 18+, ' +
                   (s.styleSuffix || 'highly detailed');
    const seed = hashSeed(String(character.id || character.name || base));
    return APP.Image.urlFor(prompt, { seed, width: 384, height: 384 });
  };
})();
