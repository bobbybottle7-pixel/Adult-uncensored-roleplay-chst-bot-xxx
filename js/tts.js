/* Text-to-speech: read character replies aloud.
 * Uses the browser's built-in Web Speech API — free, no key, works offline.
 * Handy for hands-free use; auto-read can be toggled in Settings. */
(function () {
  const synth = window.speechSynthesis;
  let voices = [];

  function loadVoices() {
    if (!synth) return;
    voices = synth.getVoices() || [];
  }
  if (synth) {
    loadVoices();
    if (typeof synth.onvoiceschanged !== 'undefined') synth.onvoiceschanged = loadVoices;
  }

  // Strip roleplay markup so it reads naturally.
  function clean(text) {
    return String(text || '')
      .replace(/!\[[^\]]*\]\([^)]*\)/g, '')     // images
      .replace(/[*_~`#>]/g, ' ')                // markdown / action asterisks
      .replace(/\s+/g, ' ')
      .trim();
  }

  APP.TTS = {
    supported() { return !!synth; },
    voices() { loadVoices(); return voices; },

    settings() {
      const s = APP.Store.getSettings();
      return Object.assign({ enabled: false, voice: '', rate: 1, pitch: 1 }, s.tts || {});
    },

    speak(text, force) {
      if (!synth) return;
      const cfg = this.settings();
      if (!cfg.enabled && !force) return;
      const body = clean(text);
      if (!body) return;
      this.stop();
      const u = new SpeechSynthesisUtterance(body.slice(0, 4000));
      loadVoices();
      const v = voices.find(x => x.name === cfg.voice);
      if (v) u.voice = v;
      u.rate = Number(cfg.rate) || 1;
      u.pitch = Number(cfg.pitch) || 1;
      try { synth.speak(u); } catch (e) {}
    },

    stop() { try { synth && synth.cancel(); } catch (e) {} },
    speaking() { return !!(synth && synth.speaking); },
  };
})();
