/* Browse-premade-characters gallery.
 * Shows APP.presets as cards with generated avatars, searchable + tag-filtered.
 * "Use" opens the character editor prefilled (as a new character) so the user
 * can tweak it before saving — or just save as-is. */
(function () {
  const els = {};
  let activeTag = 'all';
  let query = '';

  /* Concurrency-limited image loader. Generating avatars on-demand is slow, and
   * firing a dozen at once over mobile data makes most time out. This loads a
   * few at a time: when one finishes, the next starts. A new render bumps the
   * generation so stale jobs from a previous view are dropped. */
  const ImgLoader = (function () {
    const MAX = 3;
    let active = 0, gen = 0;
    const queue = [];
    function pump() {
      while (active < MAX && queue.length) {
        const job = queue.shift();
        if (job.gen !== gen) continue;   // from an old view, skip
        active++;
        job.run();
      }
    }
    return {
      reset() { gen++; queue.length = 0; active = 0; },
      load(img, src, done) {
        const myGen = gen;
        queue.push({ gen: myGen, run() {
          img.onload = () => { active--; done && done(true); pump(); };
          img.onerror = () => { active--; done && done(false); pump(); };
          img.src = src;
        }});
        pump();
      },
    };
  })();

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

  function initials(name) {
    return (name || '?').trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
  }

  function card(p) {
    const el = document.createElement('div');
    el.className = 'gcard';

    // Image area with an initials placeholder shown until (and unless) the
    // generated picture loads. One automatic retry with a fresh seed.
    const imgWrap = document.createElement('div');
    imgWrap.className = 'gcard__imgwrap';
    imgWrap.textContent = initials(p.name);
    const img = document.createElement('img');
    img.className = 'gcard__img';
    img.alt = p.name;
    imgWrap.appendChild(img);

    // 1st try: the pre-generated file shipped in the repo (instant, reliable).
    // If missing, fall back to generating live, retrying with a fresh seed.
    const localFile = 'img/avatars/' + APP.Image.slug(p.name) + '.jpg';
    let tries = 0;
    function attempt() {
      let src;
      if (tries === 0) src = localFile;
      else if (tries === 1) src = APP.Image.avatarUrlFor(p);
      else src = APP.Image.avatarUrlFor(Object.assign({}, p, { avatarSeed: Math.floor(Math.random() * 1e9) }));
      ImgLoader.load(img, src, ok => {
        if (ok) { imgWrap.classList.add('is-loaded'); }
        else if (tries++ < 3) { attempt(); }
      });
    }
    attempt();

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

    el.appendChild(imgWrap);
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
    ImgLoader.reset();
    els.grid.innerHTML = '';
    // Featured curated rows when browsing (no search, no tag filter).
    if (activeTag === 'all' && !query && APP.config.featured) {
      els.grid.className = 'gallery__rows';
      APP.config.featured.forEach(row => {
        let items = APP.presets.filter(p => inRow(p, row));
        items = items.slice(0, row.limit || 12);  // cap so mobile isn't flooded
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
