/* Chat sessions UI: keep several separate scenes with the same character.
 * Each session has its own messages; long-term memory is shared, so the
 * character still knows you in every scene. */
(function () {
  const els = {};
  let char = null;

  function fmtDate(ts) {
    const d = new Date(ts || Date.now());
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function render() {
    if (!char) return;
    const list = APP.Store.getSessions(char.id);
    const activeId = APP.Store.getActiveSessionId(char.id);
    els.list.innerHTML = '';
    list.slice().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)).forEach(s => {
      const msgs = APP.Store.getMessages(char.id, s.id);
      const row = document.createElement('div');
      row.className = 'srow' + (s.id === activeId ? ' is-active' : '');

      const main = document.createElement('div');
      main.className = 'srow__main';
      const t = document.createElement('div');
      t.className = 'srow__title';
      t.textContent = s.title;
      const meta = document.createElement('div');
      meta.className = 'srow__meta';
      meta.textContent = msgs.length + ' message' + (msgs.length === 1 ? '' : 's') + ' · ' + fmtDate(s.updatedAt);
      main.appendChild(t); main.appendChild(meta);
      main.addEventListener('click', () => {
        els.modal.hidden = true;
        APP.Chat.open(char.id, s.id);
      });

      const acts = document.createElement('div');
      acts.className = 'srow__acts';
      const ren = document.createElement('button');
      ren.className = 'icon-btn'; ren.textContent = '✎'; ren.title = 'Rename';
      ren.addEventListener('click', e => {
        e.stopPropagation();
        const name = prompt('Rename this chat:', s.title);
        if (name && name.trim()) { APP.Store.renameSession(char.id, s.id, name.trim()); render(); }
      });
      const del = document.createElement('button');
      del.className = 'icon-btn'; del.textContent = '🗑'; del.title = 'Delete';
      del.addEventListener('click', e => {
        e.stopPropagation();
        if (!confirm('Delete "' + s.title + '"? Its messages are gone for good. ' +
                     char.name + '’s long-term memory is kept.')) return;
        APP.Store.deleteSession(char.id, s.id);
        render();
        APP.Chat.open(char.id, APP.Store.getActiveSessionId(char.id));
      });
      acts.appendChild(ren); acts.appendChild(del);

      row.appendChild(main); row.appendChild(acts);
      els.list.appendChild(row);
    });
  }

  APP.Sessions = {
    init() {
      els.modal = document.getElementById('sessions-modal');
      els.list  = document.getElementById('sessions-list');
      els.title = document.getElementById('sessions-title');
      document.getElementById('sessions-close').addEventListener('click', () => els.modal.hidden = true);
      document.getElementById('sessions-new').addEventListener('click', () => {
        if (!char) return;
        const s = APP.Store.createSession(char.id);
        els.modal.hidden = true;
        APP.Chat.open(char.id, s.id);
        APP.toast('New scene started.');
      });
    },
    open(character) {
      char = character;
      if (!char) return;
      els.title.textContent = 'Chats with ' + char.name;
      render();
      els.modal.hidden = false;
    },
  };
})();
