/* Memory editor: see and hand-edit exactly what a character remembers about
 * you. The summary is what the model auto-writes every few turns; facts are
 * pinned lines that are always included. Both persist across new chats. */
(function () {
  const els = {};
  let char = null;

  APP.MemoryUI = {
    init() {
      els.modal   = document.getElementById('memory-modal');
      els.title   = document.getElementById('memory-title');
      els.summary = document.getElementById('memory-summary');
      els.facts   = document.getElementById('memory-facts');

      document.getElementById('memory-close').addEventListener('click', () => els.modal.hidden = true);
      document.getElementById('memory-save').addEventListener('click', () => {
        if (!char) return;
        const facts = els.facts.value.split('\n').map(s => s.trim()).filter(Boolean);
        APP.Memory.setMemory(char.id, els.summary.value, facts);
        els.modal.hidden = true;
        APP.toast('Memory updated.');
        APP.Characters.renderList(char.id);
      });
      document.getElementById('memory-forget').addEventListener('click', () => {
        if (!char) return;
        if (!confirm('Make ' + char.name + ' forget everything about you? ' +
                     'Your chats stay, but they will not remember your history.')) return;
        APP.Memory.forget(char.id);
        els.summary.value = '';
        els.facts.value = '';
        APP.toast(char.name + ' has forgotten everything.');
        APP.Characters.renderList(char.id);
      });
    },

    open(character) {
      char = character;
      if (!char) return;
      const mem = APP.Store.getMemory(char.id);
      els.title.textContent = 'What ' + char.name + ' remembers';
      els.summary.value = mem.summary || '';
      els.facts.value = (mem.facts || []).join('\n');
      els.modal.hidden = false;
    },
  };
})();
