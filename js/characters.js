/* Character CRUD + the editor modal + the sidebar list. */
(function () {
  function uid() { return 'c_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function initials(name) {
    return (name || '?').trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
  }

  const els = {};
  let editingId = null;
  let presetSeed = null;  // set when creating from a premade preset

  APP.Characters = {
    init({ onOpenCharacter, onListChanged }) {
      this.onOpenCharacter = onOpenCharacter;
      this.onListChanged = onListChanged;

      els.list       = document.getElementById('character-list');
      els.modal      = document.getElementById('char-modal');
      els.title      = document.getElementById('char-modal-title');
      els.name       = document.getElementById('cf-name');
      els.age        = document.getElementById('cf-age');
      els.appearance = document.getElementById('cf-appearance');
      els.personality= document.getElementById('cf-personality');
      els.scenario   = document.getElementById('cf-scenario');
      els.greeting   = document.getElementById('cf-greeting');
      els.tags       = document.getElementById('cf-tags');
      els.deleteBtn  = document.getElementById('cf-delete');

      document.getElementById('new-character-btn').addEventListener('click', () => this.openEditor());
      document.getElementById('welcome-new-btn').addEventListener('click', () => this.openEditor());
      document.getElementById('char-modal-close').addEventListener('click', () => this.closeEditor());
      document.getElementById('cf-cancel').addEventListener('click', () => this.closeEditor());
      document.getElementById('cf-save').addEventListener('click', () => this.save());
      els.deleteBtn.addEventListener('click', () => this.remove());

      this.renderList();
    },

    renderList(activeId) {
      const chars = APP.Store.getCharacters();
      els.list.innerHTML = '';
      chars.forEach(c => {
        const item = document.createElement('div');
        item.className = 'char-item' + (c.id === activeId ? ' is-active' : '');
        const av = document.createElement('div');
        av.className = 'char-item__avatar';
        av.textContent = initials(c.name);
        // Show a generated avatar image, falling back to initials on error.
        const img = document.createElement('img');
        img.className = 'char-item__avatarimg';
        img.alt = '';
        img.loading = 'lazy';
        img.onload = () => { av.textContent = ''; av.appendChild(img); };
        img.onerror = () => {};
        img.src = APP.Image.avatarUrlFor(c);
        item.appendChild(av);
        const info = document.createElement('div');
        info.innerHTML = '<div class="char-item__name"></div><div class="char-item__meta"></div>';
        item.appendChild(info);
        item.querySelector('.char-item__name').textContent = c.name || 'Unnamed';
        const mem = APP.Store.getMemory(c.id);
        item.querySelector('.char-item__meta').textContent =
          (c.tags && c.tags.length ? c.tags.join(', ') : 'age ' + (c.age || 18)) +
          (mem.summary ? ' · remembers you' : '');
        item.addEventListener('click', () => this.onOpenCharacter(c.id));
        els.list.appendChild(item);
      });
    },

    // Open the editor prefilled from a premade preset (as a NEW character).
    openEditorFromPreset(preset) {
      this.openEditor(null);
      presetSeed = preset;
      els.title.textContent = 'New character (from ' + preset.name + ')';
      els.name.value        = preset.name || '';
      els.age.value         = preset.age || 21;
      els.appearance.value  = preset.appearance || '';
      els.personality.value = preset.personality || '';
      els.scenario.value    = preset.scenario || '';
      els.greeting.value    = preset.greeting || '';
      els.tags.value        = (preset.tags || []).join(', ');
      els.name.focus();
    },

    openEditor(id) {
      editingId = id || null;
      presetSeed = null;
      const c = id ? APP.Store.getCharacter(id) : null;
      els.title.textContent = c ? 'Edit ' + c.name : 'New character';
      els.name.value        = c?.name || '';
      els.age.value         = c?.age || 21;
      els.appearance.value  = c?.appearance || '';
      els.personality.value = c?.personality || '';
      els.scenario.value    = c?.scenario || '';
      els.greeting.value    = c?.greeting || '';
      els.tags.value        = (c?.tags || []).join(', ');
      els.deleteBtn.hidden  = !c;
      els.modal.hidden = false;
      els.name.focus();
    },

    closeEditor() { els.modal.hidden = true; editingId = null; },

    save() {
      const name = els.name.value.trim();
      if (!name) { APP.toast('Give your character a name.'); return; }
      const age = Math.max(18, parseInt(els.age.value, 10) || 18);
      if (parseInt(els.age.value, 10) < 18) APP.toast('Age set to 18 (minimum).');

      const existing = editingId ? APP.Store.getCharacter(editingId) : null;
      const char = {
        id: editingId || uid(),
        name, age,
        gender:      existing?.gender || presetSeed?.gender || '',
        appearance:  els.appearance.value.trim(),
        personality: els.personality.value.trim(),
        scenario:    els.scenario.value.trim(),
        greeting:    els.greeting.value.trim(),
        // Keep the preset's tuned avatar prompt if we started from one.
        avatarPrompt: existing?.avatarPrompt || presetSeed?.avatarPrompt || '',
        tags: els.tags.value.split(',').map(t => t.trim()).filter(Boolean),
        createdAt: existing?.createdAt || Date.now(),
      };
      APP.Store.saveCharacter(char);
      this.closeEditor();
      this.renderList(char.id);
      if (this.onListChanged) this.onListChanged();
      this.onOpenCharacter(char.id);
    },

    remove() {
      if (!editingId) return;
      const c = APP.Store.getCharacter(editingId);
      if (!confirm('Delete ' + (c?.name || 'this character') + ' and all their chats/memory? This cannot be undone.')) return;
      APP.Store.deleteCharacter(editingId);
      this.closeEditor();
      this.renderList();
      if (this.onListChanged) this.onListChanged();
    },
  };
})();
