/* App bootstrap: age gate -> app, settings modal, sidebar, toast. */
(function () {
  const els = {};
  let toastTimer = null;

  APP.toast = function (msg) {
    const t = els.toast || document.getElementById('toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 2600);
  };

  APP.openSettings = function () { openSettings(); };

  // ---------- Settings ----------
  function fillModelSelect(selected) {
    const sel = els.setModel;
    sel.innerHTML = '';
    const auto = document.createElement('option');
    auto.value = 'auto';
    auto.textContent = 'Auto (try all free models, best reliability)';
    sel.appendChild(auto);
    APP.config.freeModels.forEach(m => {
      const o = document.createElement('option');
      o.value = m.id; o.textContent = m.label;
      sel.appendChild(o);
    });
    sel.value = selected || 'auto';
  }

  function openSettings() {
    const s = APP.Store.getSettings();
    els.setKey.value = s.apiKey || '';
    fillModelSelect(s.model);
    els.setMax.value = s.maxTokens;
    els.setTemp.value = s.temperature;
    els.tempVal.textContent = s.temperature;
    fillImageSettings(s.image || {});
    updateModelHint();
    els.settingsModal.hidden = false;
  }

  function fillImageSettings(img) {
    const sel = els.imgModel;
    sel.innerHTML = '';
    APP.config.pollinationsModels.forEach(m => {
      const o = document.createElement('option');
      o.value = m.id; o.textContent = m.label;
      sel.appendChild(o);
    });
    sel.value = img.model || APP.config.image.model;
    els.imgSize.value = String(img.width || APP.config.image.width);
    els.imgCustom.value = img.customUrlTemplate || '';
    els.imgKey.value = img.customApiKey || '';
  }

  function updateModelHint() {
    els.modelHint.textContent = els.setModel.value === 'auto'
      ? 'Recommended. If one model is busy or capped, the app automatically tries the next free one.'
      : 'Fixed model. If it\'s busy the app still falls back to the others as backup.';
  }

  function saveSettings() {
    const s = APP.Store.getSettings();
    s.apiKey = els.setKey.value.trim();
    s.model = els.setModel.value;
    s.maxTokens = Math.max(128, Math.min(4096, parseInt(els.setMax.value, 10) || 800));
    s.temperature = parseFloat(els.setTemp.value);
    const size = parseInt(els.imgSize.value, 10) || 768;
    s.image = Object.assign({}, s.image, {
      provider: els.imgCustom.value.trim() ? 'custom' : 'pollinations',
      model: els.imgModel.value,
      width: size,
      height: size,
      customUrlTemplate: els.imgCustom.value.trim(),
      customApiKey: els.imgKey.value.trim(),
    });
    APP.Store.saveSettings(s);
    els.settingsModal.hidden = true;
    APP.toast('Settings saved.');
    refreshKeyHint();
  }

  function refreshKeyHint() {
    const hint = document.getElementById('welcome-key-hint');
    if (hint) hint.hidden = APP.API.hasKey();
  }

  // ---------- Sidebar (mobile) ----------
  function openCharacter(id) {
    APP.Chat.open(id);
    APP.Characters.renderList(id);
    els.sidebar.classList.remove('is-open');
  }

  // ---------- Boot ----------
  function boot() {
    els.toast        = document.getElementById('toast');
    els.sidebar      = document.getElementById('sidebar');
    els.settingsModal= document.getElementById('settings-modal');
    els.setKey       = document.getElementById('set-key');
    els.setModel     = document.getElementById('set-model');
    els.setMax       = document.getElementById('set-maxtokens');
    els.setTemp      = document.getElementById('set-temp');
    els.tempVal      = document.getElementById('temp-val');
    els.modelHint    = document.getElementById('model-hint');
    els.imgModel     = document.getElementById('set-imgmodel');
    els.imgSize      = document.getElementById('set-imgsize');
    els.imgCustom    = document.getElementById('set-imgcustom');
    els.imgKey       = document.getElementById('set-imgkey');

    APP.Chat.init();
    APP.Characters.init({
      onOpenCharacter: openCharacter,
      onListChanged: refreshKeyHint,
    });

    // Settings wiring
    document.getElementById('settings-btn').addEventListener('click', openSettings);
    document.getElementById('settings-modal-close').addEventListener('click', () => els.settingsModal.hidden = true);
    document.getElementById('settings-save').addEventListener('click', saveSettings);
    document.getElementById('welcome-open-settings').addEventListener('click', openSettings);
    els.setModel.addEventListener('change', updateModelHint);
    els.setTemp.addEventListener('input', () => els.tempVal.textContent = els.setTemp.value);

    // Data controls
    document.getElementById('export-data').addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(APP.Store.exportAll(), null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'roleplay-backup.json';
      a.click();
      APP.toast('Backup downloaded.');
    });
    document.getElementById('wipe-data').addEventListener('click', () => {
      if (confirm('Erase ALL characters, chats, memory and settings from this browser? This cannot be undone.')) {
        APP.Store.wipeAll();
        location.reload();
      }
    });

    // Sidebar toggles (mobile)
    document.getElementById('sidebar-open').addEventListener('click', () => els.sidebar.classList.add('is-open'));
    document.getElementById('sidebar-close').addEventListener('click', () => els.sidebar.classList.remove('is-open'));

    refreshKeyHint();
    if (!APP.API.hasKey()) openSettings();
  }

  APP.AgeGate.init(boot);
})();
