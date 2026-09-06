/* Thin wrapper over localStorage. Everything the app keeps lives here:
 * settings, characters, chat sessions, memory, and your persona.
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
  function uid(p) { return (p || 's_') + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  const Store = {
    // ---- Settings ----
    getSettings() {
      return Object.assign({
        apiKey: '',
        model: APP.config.defaults.model,
        maxTokens: APP.config.defaults.maxTokens,
        temperature: APP.config.defaults.temperature,
        stream: true,
      }, read('settings', {}));
    },
    saveSettings(s) { write('settings', s); },

    // ---- Age gate ----
    isAgeConfirmed() { return read('age_ok', false) === true; },
    confirmAge() { write('age_ok', true); },

    // ---- Your persona (who the character is talking to) ----
    getPersona() {
      return Object.assign({ enabled: false, name: '', description: '' }, read('persona', {}));
    },
    savePersona(p) { write('persona', p); },

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
      this.getSessions(id).forEach(s => remove('msgs_' + id + '_' + s.id));
      remove('sessions_' + id);
      remove('active_' + id);
      remove('chat_' + id);
      remove('memory_' + id);
    },

    /* ---- Chat sessions (multiple separate scenes per character) ----
     * sessions_<charId>  : [{id,title,createdAt,updatedAt}]
     * msgs_<charId>_<sid>: message array
     * active_<charId>    : id of the session currently open
     * Old single-chat data under chat_<charId> is migrated on first read. */
    getSessions(charId) {
      let list = read('sessions_' + charId, null);
      if (!list) {
        list = [];
        const legacy = read('chat_' + charId, null);
        const first = { id: uid(), title: 'Chat 1', createdAt: Date.now(), updatedAt: Date.now() };
        list.push(first);
        write('sessions_' + charId, list);
        write('active_' + charId, first.id);
        if (legacy && legacy.length) write('msgs_' + charId + '_' + first.id, legacy);
        remove('chat_' + charId);
      }
      return list;
    },
    saveSessions(charId, list) { write('sessions_' + charId, list); },

    getActiveSessionId(charId) {
      const list = this.getSessions(charId);
      let id = read('active_' + charId, null);
      if (!id || !list.some(s => s.id === id)) { id = list[0].id; write('active_' + charId, id); }
      return id;
    },
    setActiveSessionId(charId, sid) { write('active_' + charId, sid); },

    createSession(charId, title) {
      const list = this.getSessions(charId);
      const s = {
        id: uid(),
        title: title || ('Chat ' + (list.length + 1)),
        createdAt: Date.now(), updatedAt: Date.now(),
      };
      list.push(s);
      this.saveSessions(charId, list);
      this.setActiveSessionId(charId, s.id);
      return s;
    },
    renameSession(charId, sid, title) {
      const list = this.getSessions(charId);
      const s = list.find(x => x.id === sid);
      if (s) { s.title = title; this.saveSessions(charId, list); }
    },
    deleteSession(charId, sid) {
      let list = this.getSessions(charId).filter(s => s.id !== sid);
      remove('msgs_' + charId + '_' + sid);
      if (!list.length) {
        this.saveSessions(charId, []);
        remove('sessions_' + charId);
        list = this.getSessions(charId);          // recreates a fresh one
      } else {
        this.saveSessions(charId, list);
      }
      this.setActiveSessionId(charId, list[0].id);
    },

    getMessages(charId, sid) { return read('msgs_' + charId + '_' + sid, []); },
    saveMessages(charId, sid, msgs) {
      write('msgs_' + charId + '_' + sid, msgs);
      const list = this.getSessions(charId);
      const s = list.find(x => x.id === sid);
      if (s) { s.updatedAt = Date.now(); this.saveSessions(charId, list); }
    },

    // ---- Long-term memory (per character, shared across all its sessions) ----
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
    importAll(obj) {
      Object.keys(obj || {}).forEach(k => {
        if (k.startsWith(P)) localStorage.setItem(k, obj[k]);
      });
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
