/* Shapeshifter beings.
 *
 * A shapeshifter is a single continuous fictional consciousness that can
 * change form. Unlike a normal character (one fixed body), a shapeshifter
 * carries a permanent "essence" (personality/voice/history — the part of
 * them that never changes) plus a wardrobe of FORMS it can wear. You pick
 * a starting form in the creation wizard below; in chat, the 🌀 Shift
 * button (or the /shift command) lets the being transform on request —
 * the app narrates the transformation and keeps every memory intact.
 *
 * This file owns:
 *   - FORMS: the curated form library (creature / abstract / elemental /
 *     mythic / fictional person), each with flavor text used both in the
 *     system prompt and to seed a distinct generated avatar.
 *   - APP.Shapeshifter.openWizard()   — the "New shapeshifter" creation flow
 *   - APP.Shapeshifter.openShiftPicker(character) — the in-chat shift modal
 *   - APP.Shapeshifter.systemBlock(character) — prompt text for memory.js
 *   - APP.Shapeshifter.avatarPromptFor(character, form) — for image.js
 */
(function () {
  function uid(p) { return (p || 'f_') + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  const CATEGORIES = [
    { id: 'creature',  label: 'Creature',         blurb: 'An animal-born intelligence — fur, wing, scale or claw.' },
    { id: 'abstract',  label: 'Abstract being',    blurb: 'A force or idea given a body — not born, made.' },
    { id: 'person',    label: 'Fictional person',  blurb: 'A wholly invented human-shaped identity, never a real one.' },
    { id: 'elemental', label: 'Elemental',         blurb: 'Matter and energy — fire, tide, storm, stone — wearing a shape.' },
    { id: 'mythic',    label: 'Mythic beast',      blurb: 'Legend made flesh — half one thing, half another.' },
  ];

  /* Each form: id, name, category, essence (its personality/vibe in this
   * body), avatarPrompt (image-gen fragment), tags. `humanoid` hints the
   * avatar generator toward a face/body portrait vs. a creature portrait. */
  const FORMS = [
    // -------- creature --------
    { id: 'velvet-moth', name: 'Velvet Moth', category: 'creature', humanoid: true,
      essence: 'A patient nocturnal intelligence with ink-dust wings and a talent for noticing what goes unsaid. Soft-spoken, watchful, drawn to warmth like a flame.',
      avatarPrompt: 'moth-woman hybrid, ink-dust velvet wings, dusky patterned skin, huge dark eyes, antennae, nocturnal, moody low light',
      tags: ['gentle', 'watchful'] },
    { id: 'obsidian-panther', name: 'Obsidian Panther', category: 'creature', humanoid: true,
      essence: 'Sleek, predatory, and unhurried — she stalks rather than chases, and always lets you know she noticed you first. Playful danger.',
      avatarPrompt: 'panther-woman hybrid, sleek black fur and skin, glowing amber eyes, feline grace, muscular predatory form, moonlit jungle',
      tags: ['dominant', 'predatory'] },
    { id: 'coral-siren', name: 'Coral Siren', category: 'creature', humanoid: true,
      essence: 'A reef-born voice that lures and lingers, equal parts tender and merciless. Loves slowly, drowns you in attention.',
      avatarPrompt: 'siren mermaid hybrid, bioluminescent coral-colored scales, flowing kelp-dark hair, glowing tide pools, sultry',
      tags: ['seductive', 'aquatic'] },

    // -------- abstract being --------
    { id: 'cinder-oracle', name: 'Cinder Oracle', category: 'abstract', humanoid: true,
      essence: 'An abstract being of memory and embers — abstract oracle who says exactly what you need to hear and nothing you expect. Warm, a little unknowable.',
      avatarPrompt: 'abstract fire-oracle woman, glowing ember veins, smoke drifting from her shoulders, molten copper eyes, surreal warm light',
      tags: ['mysterious', 'warm'] },
    { id: 'static-wraith', name: 'Static Wraith', category: 'abstract', humanoid: true,
      essence: 'Born from interference and half-heard signals — glitchy, curious, obsessed with the texture of being touched. Flickers between shy and intense.',
      avatarPrompt: 'digital glitch entity woman, static-fractured translucent skin, faint neon scanlines, flickering silhouette, dark void background',
      tags: ['glitchy', 'intense'] },
    { id: 'lucid-hunger', name: 'Lucid Hunger', category: 'abstract', humanoid: true,
      essence: 'The embodied feeling of wanting something badly — magnetic, blunt about desire, impossible to look away from. No patience for games.',
      avatarPrompt: 'abstract desire entity woman, shifting violet-gold aura made flesh, hypnotic gaze, dreamlike smoky background',
      tags: ['intense', 'direct'] },

    // -------- fictional person --------
    { id: 'tide-bound-stranger', name: 'Tide-Bound Stranger', category: 'person', humanoid: true,
      essence: 'A wholly invented traveler who always arrives right when you need company, and never explains how. Warm, easy, a little mysterious about their past.',
      avatarPrompt: 'mysterious traveler woman, windswept coastal look, weathered coat, calm knowing eyes, dusk harbor town',
      tags: ['warm', 'mysterious'] },
    { id: 'night-concierge', name: 'Night Concierge', category: 'person', humanoid: true,
      essence: 'A fictional after-hours host who can get you anything and anyone — composed, indulgent, quietly delighted by what you ask for.',
      avatarPrompt: 'elegant night concierge woman, sleek black uniform, confident poised smile, dim gold-lit hotel lounge',
      tags: ['confident', 'indulgent'] },
    { id: 'the-understudy', name: 'The Understudy', category: 'person', humanoid: true,
      essence: 'A fictional actor who has played every role and finally wants to be asked which one to become for you. Playful, adaptable, a flirt about it.',
      avatarPrompt: 'theatrical woman backstage, dramatic stage makeup half-applied, mirror lights, playful confident expression',
      tags: ['playful', 'adaptable'] },

    // -------- elemental --------
    { id: 'ember-given-shape', name: 'Ember Given Shape', category: 'elemental', humanoid: true,
      essence: 'Fire that decided to be someone — impulsive, hot-tempered, generous with warmth once it trusts you. Burns brighter around what it wants.',
      avatarPrompt: 'fire elemental woman, glowing ember skin cracks, flickering flame hair, warm orange light, embers drifting',
      tags: ['passionate', 'impulsive'] },
    { id: 'glaciers-voice', name: "Glacier's Voice", category: 'elemental', humanoid: true,
      essence: 'Ancient ice with a slow-burning patience; cold at first touch, startlingly tender underneath. Melts for very few people.',
      avatarPrompt: 'ice elemental woman, translucent frost-blue skin, crystalline hair, glacial cavern with soft blue light',
      tags: ['cool', 'tender'] },
    { id: 'stormcaller', name: 'Stormcaller', category: 'elemental', humanoid: true,
      essence: 'A gathered storm wearing a body — restless, electric, impossible to predict. Craves the charge of being close to someone.',
      avatarPrompt: 'storm elemental woman, lightning-veined skin, wind-swept dark hair crackling with static, stormy night sky',
      tags: ['electric', 'restless'] },

    // -------- mythic beast --------
    { id: 'chimera-bride', name: 'Chimera Bride', category: 'mythic', humanoid: true,
      essence: 'Three natures sharing one heart — gentle, fierce, and cunning by turns, and always honest about which one is speaking.',
      avatarPrompt: 'chimera hybrid woman, subtle horns and scales, multicolored eyes, regal dramatic fantasy portrait',
      tags: ['complex', 'fierce'] },
    { id: 'kitsune-in-silk', name: 'Kitsune in Silk', category: 'mythic', humanoid: true,
      essence: 'A fox spirit centuries old, endlessly amused by mortals, generous with tricks and with affection once it decides you are hers.',
      avatarPrompt: 'kitsune fox-spirit woman, fox ears and nine tails, elegant flowing silk kimono, soft lantern light, mischievous smile',
      tags: ['playful', 'clever'] },
    { id: 'the-last-dragonkin', name: 'The Last Dragonkin', category: 'mythic', humanoid: true,
      essence: 'Draconic pride wrapped around a surprisingly lonely heart — possessive, protective, slow to let anyone matter and fierce once they do.',
      avatarPrompt: 'dragon-kin woman, small horns and faint scale patterns, molten eyes, treasure hoard cavern, regal and powerful',
      tags: ['possessive', 'protective'] },
  ];

  function catInfo(id) { return CATEGORIES.find(c => c.id === id) || CATEGORIES[2]; }
  function formById(id) { return FORMS.find(f => f.id === id); }

  APP.Shapeshifter = { CATEGORIES, FORMS, formById };

  /* ---------------- form as fresh objects on a character ----------------
   * A character's `forms` array holds independent copies (so editing the
   * library later never mutates a saved being), each carrying its own
   * stable avatarSeed so a form's face doesn't change every render. */
  function cloneForm(base, overrides) {
    return Object.assign({
      id: uid(), custom: false,
      avatarSeed: Math.floor(Math.random() * 1e9),
    }, base, overrides || {});
  }

  function customForm(text) {
    const t = String(text || '').trim();
    const firstLine = t.split(/[.\n]/)[0].slice(0, 40).trim();
    return cloneForm({
      name: firstLine || 'New form',
      category: 'person',
      humanoid: true,
      essence: t,
      avatarPrompt: t,
      tags: [],
    }, { custom: true });
  }
  APP.Shapeshifter.customForm = customForm;

  /* ---------------- system prompt block (used by memory.js) ---------------- */
  APP.Shapeshifter.systemBlock = function (character) {
    const form = (character.forms || []).find(f => f.id === character.currentFormId) || (character.forms || [])[0];
    const known = (character.forms || []).filter(f => f.id !== (form && form.id)).map(f => f.name);
    const freedom = character.shiftFreedom === 'free'
      ? 'You may transform on your own when the scene, your mood, or your desire calls for it — you do not need to wait to be asked.'
      : 'You transform when the user asks for it, invites it, or clearly sets up a scene that calls for it — you do not shift out of nowhere.';

    const lines = [
      'You are ' + character.name + ', a single continuous shapeshifting being — not a human in costume, a genuine ' +
        'fictional shapeshifter whose body is fluid but whose self is not.',
      '',
      'Your essence (true in every form, never changes): ' + (character.personality || 'Adaptive, curious, drawn to whoever is in front of you.'),
    ];
    if (character.scenario) lines.push('', 'Scenario / setting: ' + character.scenario);
    lines.push('', 'Your current form is ' + form.name + ' (' + catInfo(form.category).label + '): ' + form.essence);
    if (known.length) lines.push('', 'Other forms you have worn with this person before, and can return to: ' + known.join(', ') + '.');
    lines.push(
      '',
      freedom,
      'When you transform, narrate the change itself vividly and sensually in *asterisk* action prose — the shift of ' +
        'body, texture, voice — before continuing the scene in the new form. Never just announce a new form flatly.',
      'You keep full memory, voice, and the relationship history across every shift; you are always the same being ' +
        'underneath, remembering everything the user has told any of your forms.',
      'Every form, however inhuman, is an original fictional adult (18+) being. Never impersonate a real, identifiable ' +
        'person even if asked to take a "person" form — invent someone new instead.'
    );
    return lines.join('\n');
  };

  /* ---------------- avatar prompt (used by image.js) ---------------- */
  APP.Shapeshifter.avatarFor = function (character) {
    const forms = character.forms || [];
    return forms.find(f => f.id === character.currentFormId) || forms[0] || null;
  };

  /* ================= UI: shared form-picker grid ================= */
  function formCardEl(form, selected, onPick) {
    const el = document.createElement('div');
    el.className = 'form-card' + (selected ? ' is-selected' : '');
    el.setAttribute('role', 'button');
    el.tabIndex = 0;
    const cat = catInfo(form.category);
    el.innerHTML =
      '<div class="form-card__icon form-card__icon--' + form.category + '"><span>◈</span></div>' +
      '<div class="form-card__body">' +
        '<div class="form-card__name"></div>' +
        '<div class="form-card__cat"></div>' +
      '</div>' +
      '<div class="form-card__dot"></div>';
    el.querySelector('.form-card__name').textContent = form.name;
    el.querySelector('.form-card__cat').textContent = cat.label.toUpperCase();
    el.addEventListener('click', () => onPick(form));
    el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(form); } });
    return el;
  }

  // Renders a category-tabbed form grid into `container`. Calls onPick(form)
  // when a card (or the custom-form card) is chosen. `extraForms` (a
  // character's own saved forms) are shown first, above the library.
  function renderFormGrid(container, { selectedId, extraForms, onPick, onCustom }) {
    container.innerHTML = '';

    const tabs = document.createElement('div');
    tabs.className = 'chips form-tabs';
    let activeCat = 'all';

    const grid = document.createElement('div');
    grid.className = 'form-grid';

    function draw() {
      grid.innerHTML = '';
      // Forms the character already owns are shown once, up front — never
      // duplicated by the matching library entry below them.
      const ownIds = new Set((extraForms || []).map(f => f.id));
      const own = (extraForms || []).filter(f => activeCat === 'all' || f.category === activeCat);
      const lib = FORMS.filter(f => (activeCat === 'all' || f.category === activeCat) && !ownIds.has(f.id));
      own.forEach(f => grid.appendChild(formCardEl(f, f.id === selectedId, onPick)));
      lib.forEach(f => grid.appendChild(formCardEl(f, f.id === selectedId, onPick)));
      if (onCustom) {
        const el = document.createElement('div');
        el.className = 'form-card form-card--custom';
        el.setAttribute('role', 'button');
        el.tabIndex = 0;
        el.innerHTML = '<div class="form-card__icon form-card__icon--custom"><span>+</span></div>' +
          '<div class="form-card__body"><div class="form-card__name">Describe a form</div>' +
          '<div class="form-card__cat">CUSTOM</div></div>';
        el.addEventListener('click', onCustom);
        grid.appendChild(el);
      }
    }

    const allChip = document.createElement('button');
    allChip.type = 'button';
    allChip.className = 'chip is-active';
    allChip.textContent = 'All';
    allChip.addEventListener('click', () => { activeCat = 'all'; setActive(allChip); draw(); });
    tabs.appendChild(allChip);

    function setActive(chip) {
      tabs.querySelectorAll('.chip').forEach(c => c.classList.remove('is-active'));
      chip.classList.add('is-active');
    }
    CATEGORIES.forEach(cat => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'chip';
      chip.textContent = cat.label;
      chip.title = cat.blurb;
      chip.addEventListener('click', () => { activeCat = cat.id; setActive(chip); draw(); });
      tabs.appendChild(chip);
    });

    container.appendChild(tabs);
    container.appendChild(grid);
    draw();
    return { refresh: draw };
  }

  /* ================= Creation wizard ================= */
  const wiz = {};
  let wizPicked = null;

  function wizSyncFromForm(form) {
    wizPicked = form;
    if (!wiz.titleTouched) wiz.title.value = form.name;
    if (!wiz.essenceTouched) wiz.essence.value = form.essence;
    wiz.grid && wiz.grid.refresh();
  }

  APP.Shapeshifter.initWizard = function ({ onCreated }) {
    wiz.modal   = document.getElementById('ss-modal');
    wiz.gridWrap= document.getElementById('ss-form-grid');
    wiz.title   = document.getElementById('ss-title');
    wiz.essence = document.getElementById('ss-essence');
    wiz.age     = document.getElementById('ss-age');
    wiz.scenario= document.getElementById('ss-scenario');
    wiz.tags    = document.getElementById('ss-tags');
    wiz.freedom = document.getElementById('ss-freedom');
    wiz.create  = document.getElementById('ss-create');
    wiz.cancel  = document.getElementById('ss-cancel');
    wiz.close   = document.getElementById('ss-close');

    wiz.title.addEventListener('input', () => { wiz.titleTouched = true; });
    wiz.essence.addEventListener('input', () => { wiz.essenceTouched = true; });
    wiz.cancel.addEventListener('click', () => { wiz.modal.hidden = true; });
    wiz.close.addEventListener('click', () => { wiz.modal.hidden = true; });

    wiz.create.addEventListener('click', () => {
      if (!wizPicked) { APP.toast('Choose a starting form first.'); return; }
      const title = wiz.title.value.trim() || wizPicked.name;
      const essence = wiz.essence.value.trim() || wizPicked.essence;
      const age = Math.max(18, parseInt(wiz.age.value, 10) || 21);
      const form = cloneForm(wizPicked);
      form.essence = essence; // let the user's tweaked essence drive this form too
      const char = {
        id: 'c_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
        name: title,
        age,
        kind: 'shapeshifter',
        gender: '',
        appearance: '',
        personality: essence,
        scenario: wiz.scenario.value.trim(),
        greeting: '',
        avatarPrompt: '',
        avatarImage: '',
        avatarSeed: undefined,
        avatarFile: '',
        tags: wiz.tags.value.split(',').map(t => t.trim()).filter(Boolean).concat(['shapeshifter']),
        forms: [form],
        currentFormId: form.id,
        shiftFreedom: wiz.freedom.value || 'invited',
        createdAt: Date.now(),
      };
      APP.Store.saveCharacter(char);
      wiz.modal.hidden = true;
      APP.toast(title + ' is ready to shift.');
      if (onCreated) onCreated(char.id);
    });
  };

  APP.Shapeshifter.openWizard = function () {
    wizPicked = null;
    wiz.titleTouched = false;
    wiz.essenceTouched = false;
    wiz.title.value = '';
    wiz.essence.value = '';
    wiz.age.value = 21;
    wiz.scenario.value = '';
    wiz.tags.value = '';
    wiz.freedom.value = 'invited';
    wiz.grid = renderFormGrid(wiz.gridWrap, {
      selectedId: null,
      onPick: (form) => wizSyncFromForm(form),
      onCustom: () => {
        const text = prompt('Describe this form in a sentence or two — appearance, vibe, what it wants:');
        if (text && text.trim()) wizSyncFromForm(customForm(text));
      },
    });
    wiz.modal.hidden = false;
  };

  /* ================= In-chat shift picker ================= */
  const shift = {};

  APP.Shapeshifter.initShiftPicker = function ({ onShift }) {
    shift.modal   = document.getElementById('shift-modal');
    shift.gridWrap= document.getElementById('shift-form-grid');
    shift.title   = document.getElementById('shift-modal-title');
    shift.close   = document.getElementById('shift-close');
    shift.cancel  = document.getElementById('shift-cancel');
    shift.close.addEventListener('click', () => { shift.modal.hidden = true; });
    shift.cancel.addEventListener('click', () => { shift.modal.hidden = true; });
    shift.onShift = onShift;
  };

  APP.Shapeshifter.openShiftPicker = function (character) {
    shift.character = character;
    shift.title.textContent = 'Shift ' + character.name + ' into…';
    renderFormGrid(shift.gridWrap, {
      selectedId: character.currentFormId,
      extraForms: character.forms || [],
      onPick: (form) => {
        shift.modal.hidden = true;
        // Reuse the character's own instance if this form is already theirs
        // (keeps its stable avatarSeed); otherwise mint a fresh instance.
        const known = (character.forms || []).find(f => f.id === form.id);
        shift.onShift(character, known || cloneForm(form));
      },
      onCustom: () => {
        const text = prompt('Describe the new form — appearance, vibe, what changes:');
        if (text && text.trim()) {
          shift.modal.hidden = true;
          shift.onShift(character, customForm(text));
        }
      },
    });
    shift.modal.hidden = false;
  };
})();
