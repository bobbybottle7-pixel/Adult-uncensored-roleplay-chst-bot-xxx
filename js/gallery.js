/* Browse-premade-characters gallery.
 * Shows APP.presets as cards with generated avatars, searchable + tag-filtered.
 * "Use" opens the character editor prefilled (as a new character) so the user
 * can tweak it before saving — or just save as-is. */
(function () {
  const els = {};
  let activeTag = 'all';
  let query = '';

  function allTags() {
    const set = new Set();
    APP.presets.forEach(p => (p.tags || []).forEach(t => set.add(t)));
    return ['all', ...Array.from(set).sort()];
  }

  function matches(p) {
    const tagOk = activeTag === 'all' || (p.tags || []).includes(activeTag);
    if (!tagOk) return false;
    if (!query) return true;
    const hay = (p.name + ' ' + (p.tags || []).join(' ') + ' ' +
                 (p.personality || '') + ' ' + (p.scenario || '')).toLowerCase();
    return hay.split(query).length > 1; // substring match
  }

  function card(p) {
    const el = document.createElement('div');
    el.className = 'gcard';
    const img = document.createElement('img');
    img.className = 'gcard__img';
    img.loading = 'lazy';
    img.alt = p.name;
    img.src = APP.Image.avatarUrlFor(p);
    img.onerror = () => { img.style.display = 'none'; };

    const body = document.createElement('div');
    body.className = 'gcard__body';
    body.innerHTML =
      '<div class="gcard__name"></div>' +
      '<div class="gcard__meta"></div>' +
      '<div class="gcard__desc"></div>' +
      '<div class="gcard__tags"></div>';
    body.querySelector('.gcard__name').textContent = p.name;
    body.querySelector('.gcard__meta').textContent = 'age ' + p.age + ' · ' + (p.gender || '');
    body.querySelector('.gcard__desc').textContent = p.personality || p.scenario || '';
    body.querySelector('.gcard__tags').textContent = (p.tags || []).join(' · ');

    const use = document.createElement('button');
    use.className = 'btn btn--primary btn--block';
    use.textContent = 'Use this character';
    use.addEventListener('click', () => {
      els.modal.hidden = true;
      APP.Characters.openEditorFromPreset(p);
    });

    el.appendChild(img);
    el.appendChild(body);
    el.appendChild(use);
    return el;
  }

  function inRow(p, row) {
    if (row.kind) return p.kind === row.kind;
    if (row.tags) return (p.tags || []).some(t => row.tags.includes(t));
    return false;
  }

  function render() {
    els.grid.innerHTML = '';
    // Featured curated rows when browsing (no search, no tag filter).
    if (activeTag === 'all' && !query && APP.config.featured) {
      els.grid.className = 'gallery__rows';
      APP.config.featured.forEach(row => {
        let items = APP.presets.filter(p => inRow(p, row));
        if (row.limit) items = items.slice(0, row.limit);
        if (!items.length) return;
        const section = document.createElement('div');
        section.className = 'grow';
        const h = document.createElement('div');
        h.className = 'grow__title';
        h.textContent = row.title;
        const track = document.createElement('div');
        track.className = 'grow__track';
        items.forEach(p => { const c = card(p); c.classList.add('gcard--row'); track.appendChild(c); });
        section.appendChild(h);
        section.appendChild(track);
        els.grid.appendChild(section);
      });
      return;
    }
    // Flat grid for search / tag filter.
    els.grid.className = 'gallery__grid';
    const list = APP.presets.filter(matches);
    if (!list.length) {
      els.grid.innerHTML = '<p class="hint" style="padding:20px">No characters match. Try another search or tag.</p>';
      return;
    }
    list.forEach(p => els.grid.appendChild(card(p)));
  }

  function renderTags() {
    els.tags.innerHTML = '';
    allTags().forEach(t => {
      const chip = document.createElement('button');
      chip.className = 'chip' + (t === activeTag ? ' is-active' : '');
      chip.textContent = t;
      chip.addEventListener('click', () => { activeTag = t; renderTags(); render(); });
      els.tags.appendChild(chip);
    });
  }

  APP.Gallery = {
    init() {
      els.modal = document.getElementById('gallery-modal');
      els.grid  = document.getElementById('gallery-grid');
      els.tags  = document.getElementById('gallery-tags');
      els.search= document.getElementById('gallery-search');

      document.getElementById('gallery-close').addEventListener('click', () => els.modal.hidden = true);
      els.search.addEventListener('input', () => { query = els.search.value.trim().toLowerCase(); render(); });
    },
    open() {
      activeTag = 'all'; query = '';
      if (els.search) els.search.value = '';
      renderTags();
      render();
      els.modal.hidden = false;
    },
  };
})();
