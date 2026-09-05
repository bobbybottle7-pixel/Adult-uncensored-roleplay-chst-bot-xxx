/* Thin wrapper over localStorage. Everything the app keeps lives here:
 * settings, characters, per-character chats, and per-character memory.
 * All data stays in THIS browser only. */
(function () {
  const P = APP.config.storagePrefix;

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(P + key);
      return raw == null ? fallback : JSON.parse(raw);
    } catch (e) { return fallback; }
  }
  function write(key, value) {
    try { localStorage.setItem(P + key, JSON.stringify(value)); return true; }
    catch (e) { console.error('storage write failed', e); return false; }
  }
  function remove(key) { try { localStorage.removeItem(P + key); } catch (e) {} }

  const Store = {
    // ---- Settings ----
    getSettings() {
      return Object.assign({
        apiKey: '',
        model: APP.config.defaults.model,
        maxTokens: APP.config.defaults.maxTokens,
        temperature: APP.config.defaults.temperature,
      }, read('settings', {}));
    },
    saveSettings(s) { write('settings', s); },

    // ---- Age gate ----
    isAgeConfirmed() { return read('age_ok', false) === true; },
    confirmAge() { write('age_ok', true); },

    // ---- Characters ----
    getCharacters() { return read('characters', []); },
    getCharacter(id) { return this.getCharacters().find(c => c.id === id) || null; },
    saveCharacter(char) {
      const list = this.getCharacters();
      const i = list.findIndex(c => c.id === char.id);
      if (i >= 0) list[i] = char; else list.push(char);
      write('characters', list);
    },
    deleteCharacter(id) {
      write('characters', this.getCharacters().filter(c => c.id !== id));
      remove('chat_' + id);
      remove('memory_' + id);
    },

    // ---- Chat transcript (current active chat per character) ----
    getChat(charId) { return read('chat_' + charId, []); },
    saveChat(charId, messages) { write('chat_' + charId, messages); },
    clearChat(charId) { remove('chat_' + charId); },

    // ---- Long-term memory (persists across new chats) ----
    getMemory(charId) {
      return read('memory_' + charId, { summary: '', facts: [], updatedTurns: 0 });
    },
    saveMemory(charId, mem) { write('memory_' + charId, mem); },

    // ---- Bulk ----
    exportAll() {
      const out = {};
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(P)) out[k] = localStorage.getItem(k);
      }
      return out;
    },
    wipeAll() {
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(P)) keys.push(k);
      }
      keys.forEach(k => localStorage.removeItem(k));
    },
  };

  APP.Store = Store;
})();
