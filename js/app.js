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
    els.stream.checked = s.stream !== false;
    const persona = APP.Store.getPersona();
    els.personaOn.checked   = !!persona.enabled;
    els.personaName.value   = persona.name || '';
    els.personaDesc.value   = persona.description || '';
    fillTtsSettings();
    fillImageSettings(s.image || {});
    updateModelHint();
    els.settingsModal.hidden = false;
  }

  function fillTtsSettings() {
    const cfg = APP.TTS.settings();
    els.ttsOn.checked = !!cfg.enabled;
    els.ttsRate.value = cfg.rate || 1;
    els.ttsRateVal.textContent = cfg.rate || 1;
    const voices = APP.TTS.voices();
    els.ttsVoice.innerHTML = '';
    const auto = document.createElement('option');
    auto.value = ''; auto.textContent = voices.length ? 'Default voice' : 'No voices available';
    els.ttsVoice.appendChild(auto);
    voices.forEach(v => {
      const o = document.createElement('option');
      o.value = v.name; o.textContent = v.name + ' (' + v.lang + ')';
      els.ttsVoice.appendChild(o);
    });
    els.ttsVoice.value = cfg.voice || '';
    els.ttsOn.disabled = !APP.TTS.supported();
  }

  function fillImageSettings(img) {
    // Provider select
    els.imgProvider.innerHTML = '';
    APP.config.imageProviders.forEach(p => {
      const o = document.createElement('option');
      o.value = p.id; o.textContent = p.label;
      els.imgProvider.appendChild(o);
    });
    els.imgProvider.value = img.provider || APP.config.image.provider;

    // Pollinations model select
    els.imgModel.innerHTML = '';
    APP.config.pollinationsModels.forEach(m => {
      const o = document.createElement('option');
      o.value = m.id; o.textContent = m.label;
      els.imgModel.appendChild(o);
    });
    els.imgModel.value = img.model || APP.config.image.model;

    els.imgSize.value    = String(img.width || APP.config.image.width);
    els.veniceKey.value  = img.veniceKey || '';
    els.veniceModel.value= img.veniceModel || APP.config.image.veniceModel;
    els.imgProxy.value   = img.imageProxyUrl || '';
    els.imgCustom.value  = img.customUrlTemplate || '';
    els.imgKey.value     = img.customApiKey || '';
    updateProviderVisibility();
  }

  function updateProviderVisibility() {
    const p = els.imgProvider.value;
    document.querySelectorAll('.prov').forEach(el => { el.hidden = true; });
    const active = document.querySelector('.prov--' + p);
    if (active) active.hidden = false;
    const hints = {
      pollinations: 'Free, no key, works everywhere. Some content is filtered.',
      venice: 'Keyed and uncensored. Called directly from your browser.',
      custom: 'Advanced: any GET image endpoint. Use {prompt} and optional {key}.',
    };
    els.imgProviderHint.textContent = hints[p] || '';
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
    s.stream = !!els.stream.checked;
    s.tts = {
      enabled: !!els.ttsOn.checked,
      voice: els.ttsVoice.value,
      rate: parseFloat(els.ttsRate.value) || 1,
      pitch: 1,
    };
    APP.Store.savePersona({
      enabled: !!els.personaOn.checked,
      name: els.personaName.value.trim(),
      description: els.personaDesc.value.trim(),
    });
    const size = parseInt(els.imgSize.value, 10) || 768;
    s.image = Object.assign({}, s.image, {
      provider: els.imgProvider.value,
      model: els.imgModel.value,
      width: size,
      height: size,
      veniceKey: els.veniceKey.value.trim(),
      veniceModel: els.veniceModel.value.trim() || 'venice-sd35',
      imageProxyUrl: els.imgProxy.value.trim(),
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
    els.stream       = document.getElementById('set-stream');
    els.personaOn    = document.getElementById('set-persona-on');
    els.personaName  = document.getElementById('set-persona-name');
    els.personaDesc  = document.getElementById('set-persona-desc');
    els.ttsOn        = document.getElementById('set-tts-on');
    els.ttsVoice     = document.getElementById('set-tts-voice');
    els.ttsRate      = document.getElementById('set-tts-rate');
    els.ttsRateVal   = document.getElementById('tts-rate-val');
    els.imgProvider  = document.getElementById('set-imgprovider');
    els.imgProviderHint = document.getElementById('imgprovider-hint');
    els.imgModel     = document.getElementById('set-imgmodel');
    els.imgSize      = document.getElementById('set-imgsize');
    els.veniceKey    = document.getElementById('set-venicekey');
    els.veniceModel  = document.getElementById('set-venicemodel');
    els.imgProxy     = document.getElementById('set-imgproxy');
    els.imgCustom    = document.getElementById('set-imgcustom');
    els.imgKey       = document.getElementById('set-imgkey');

    APP.Chat.init();
    APP.Characters.init({
      onOpenCharacter: openCharacter,
      onListChanged: refreshKeyHint,
    });
    APP.Gallery.init();
    APP.Importer.init();
    APP.Sessions.init();
    APP.MemoryUI.init();

    document.getElementById('browse-btn').addEventListener('click', () => APP.Gallery.open());
    document.getElementById('welcome-browse-btn').addEventListener('click', () => APP.Gallery.open());
    document.getElementById('import-btn').addEventListener('click', () => APP.Importer.open());

    // Settings wiring
    document.getElementById('settings-btn').addEventListener('click', openSettings);
    document.getElementById('settings-modal-close').addEventListener('click', () => els.settingsModal.hidden = true);
    document.getElementById('settings-save').addEventListener('click', saveSettings);
    document.getElementById('welcome-open-settings').addEventListener('click', openSettings);
    els.setModel.addEventListener('change', updateModelHint);
    els.imgProvider.addEventListener('change', updateProviderVisibility);
    els.ttsRate.addEventListener('input', () => els.ttsRateVal.textContent = els.ttsRate.value);

    // Restore a previously exported backup.
    const importFile = document.getElementById('import-data-file');
    document.getElementById('import-data').addEventListener('click', () => importFile.click());
    importFile.addEventListener('change', () => {
      const f = importFile.files[0];
      if (!f) return;
      const r = new FileReader();
      r.onload = () => {
        try {
          const obj = JSON.parse(String(r.result));
          if (!confirm('Restore this backup? It overwrites characters, chats and settings in this browser.')) return;
          APP.Store.importAll(obj);
          location.reload();
        } catch (e) { APP.toast('That file is not a valid backup.'); }
      };
      r.readAsText(f);
    });
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
