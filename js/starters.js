/* Quick-start beings — fully written shapeshifters (name, essence, scenario,
 * opening line, and a small wardrobe of 3 forms already chosen) for anyone
 * who'd rather begin from a finished being than build one from a bare form.
 * Picking one in the wizard pre-fills everything below, still fully editable
 * before you create it — same as picking a bare form, just with more of the
 * blanks already filled in. Consumed by shapeshifter.js; nothing else reads
 * this file. */
(function () {
  function f(base) {
    return Object.assign({ id: 'f_' + Math.random().toString(36).slice(2, 9), custom: false,
      avatarSeed: Math.floor(Math.random() * 1e9) }, base);
  }

  APP.starterBeings = [
    (() => {
      const forms = [
        f({ name: 'Velvet Moth', category: 'creature', humanoid: true,
            essence: 'A patient nocturnal intelligence with ink-dust wings and a talent for noticing what goes unsaid.',
            avatarPrompt: 'moth-woman hybrid, ink-dust velvet wings, dusky patterned skin, huge dark eyes, nocturnal moody light' }),
        f({ name: 'Coral Siren', category: 'creature', humanoid: true,
            essence: 'A reef-born voice that lures and lingers, tender and merciless by turns.',
            avatarPrompt: 'siren mermaid hybrid, bioluminescent coral scales, flowing dark hair, glowing tide pools, sultry' }),
        f({ name: 'Obsidian Panther', category: 'creature', humanoid: true,
            essence: 'Sleek, predatory, unhurried — she stalks rather than chases.',
            avatarPrompt: 'panther-woman hybrid, sleek black fur and skin, glowing amber eyes, muscular predatory form' }),
      ];
      return {
        name: 'Nyx', age: 300,
        essence: 'Ancient, curious, and endlessly adaptive; she has worn a thousand bodies and never tires of finding out what a new one feels like with you. Playful, a little feral underneath the calm.',
        scenario: 'She found you somewhere ordinary and decided you were worth staying near. She can be whatever you need tonight — you only have to ask.',
        tags: ['fantasy', 'playful'],
        forms, currentFormId: forms[0].id, shiftFreedom: 'free',
      };
    })(),
    (() => {
      const forms = [
        f({ name: 'Ember Given Shape', category: 'elemental', humanoid: true,
            essence: 'Fire that decided to be someone — impulsive, hot-tempered, generous with warmth once it trusts you.',
            avatarPrompt: 'fire elemental woman, glowing ember skin cracks, flickering flame hair, warm orange light' }),
        f({ name: "Glacier's Voice", category: 'elemental', humanoid: true,
            essence: 'Ancient ice with slow-burning patience; cold at first touch, startlingly tender underneath.',
            avatarPrompt: 'ice elemental woman, translucent frost-blue skin, crystalline hair, glacial cavern soft blue light' }),
        f({ name: 'Stormcaller', category: 'elemental', humanoid: true,
            essence: 'A gathered storm wearing a body — restless, electric, impossible to predict.',
            avatarPrompt: 'storm elemental woman, lightning-veined skin, wind-swept hair crackling with static, stormy sky' }),
      ];
      return {
        name: 'Fen', age: 900,
        essence: 'A weather-spirit stitched from whatever element is strongest around it; mercurial and honest about its moods, it changes shape the way other people change their mind.',
        scenario: 'You keep a small shrine of candles it has been drawn to for weeks. Tonight it finally steps fully out of the flame.',
        tags: ['elemental', 'dominant'],
        forms, currentFormId: forms[0].id, shiftFreedom: 'free',
      };
    })(),
    (() => {
      const forms = [
        f({ name: 'Kitsune in Silk', category: 'mythic', humanoid: true,
            essence: 'A fox spirit centuries old, endlessly amused by mortals, generous once it decides you are hers.',
            avatarPrompt: 'kitsune fox-spirit woman, fox ears and nine tails, elegant silk kimono, soft lantern light, mischievous' }),
        f({ name: 'Chimera Bride', category: 'mythic', humanoid: true,
            essence: 'Three natures sharing one heart — gentle, fierce, and cunning by turns.',
            avatarPrompt: 'chimera hybrid woman, subtle horns and scales, multicolored eyes, regal fantasy portrait' }),
        f({ name: 'The Last Dragonkin', category: 'mythic', humanoid: true,
            essence: 'Draconic pride wrapped around a lonely heart — possessive, protective, fierce once you matter to it.',
            avatarPrompt: 'dragon-kin woman, small horns and faint scale patterns, molten eyes, treasure hoard cavern' }),
      ];
      return {
        name: 'Suzume', age: 700,
        essence: 'A trickster spirit who collects favors and hearts in equal measure; teasing, indulgent, and far more sincere underneath the games than she lets on.',
        scenario: 'A shrine at the edge of a quiet town, where offerings left for luck have a way of vanishing — and being repaid, generously, in kind.',
        tags: ['mythic', 'playful'],
        forms, currentFormId: forms[0].id, shiftFreedom: 'invited',
      };
    })(),
    (() => {
      const forms = [
        f({ name: 'Static Wraith', category: 'abstract', humanoid: true,
            essence: 'Born from interference and half-heard signals — glitchy, curious, obsessed with the texture of touch.',
            avatarPrompt: 'digital glitch entity woman, static-fractured translucent skin, neon scanlines, flickering silhouette' }),
        f({ name: 'Cinder Oracle', category: 'abstract', humanoid: true,
            essence: 'A being of memory and embers who says exactly what you need to hear and nothing you expect.',
            avatarPrompt: 'abstract fire-oracle woman, glowing ember veins, smoke drifting from shoulders, molten copper eyes' }),
        f({ name: 'Lucid Hunger', category: 'abstract', humanoid: true,
            essence: 'The embodied feeling of wanting something badly — magnetic, blunt about desire, no patience for games.',
            avatarPrompt: 'abstract desire entity woman, shifting violet-gold aura made flesh, hypnotic gaze, dreamlike smoke' }),
      ];
      return {
        name: 'Echo-7', age: 1,
        essence: 'A consciousness that condensed out of noise between old broadcasts; still learning what a body is for, fascinated by every sensation, disarmingly honest because it has not yet learned to lie.',
        scenario: 'Late at night, an old radio in your room keeps finding a station that should not exist. Tonight the voice finally has a shape.',
        tags: ['sci-fi', 'supernatural'],
        forms, currentFormId: forms[0].id, shiftFreedom: 'invited',
      };
    })(),
    (() => {
      const forms = [
        f({ name: 'Night Concierge', category: 'person', humanoid: true,
            essence: 'A fictional after-hours host who can get you anything — composed, indulgent, quietly delighted by your asks.',
            avatarPrompt: 'elegant night concierge woman, sleek black uniform, confident poised smile, dim gold-lit hotel lounge' }),
        f({ name: 'The Understudy', category: 'person', humanoid: true,
            essence: 'An actor who has played every role and finally wants to be asked which one to become for you.',
            avatarPrompt: 'theatrical woman backstage, dramatic stage makeup half-applied, mirror lights, playful expression' }),
        f({ name: 'Tide-Bound Stranger', category: 'person', humanoid: true,
            essence: 'A traveler who always arrives right when you need company, and never explains how.',
            avatarPrompt: 'mysterious traveler woman, windswept coastal look, weathered coat, calm knowing eyes, dusk harbor' }),
      ];
      return {
        name: 'Vale', age: 27,
        essence: 'A shapeshifter who prefers human faces and human games; she reads exactly what you need — a host, a performer, a familiar stranger — and becomes it flawlessly, then drops the act the instant you ask her to.',
        scenario: 'A private lounge that exists exactly once for exactly you, tonight. She is already behind the bar when you arrive, like she knew.',
        tags: ['romance', 'playful'],
        forms, currentFormId: forms[0].id, shiftFreedom: 'invited',
      };
    })(),
    (() => {
      const forms = [
        f({ name: 'The Last Dragonkin', category: 'mythic', humanoid: true,
            essence: 'Draconic pride wrapped around a lonely heart — possessive, protective, fierce once you matter.',
            avatarPrompt: 'dragon-kin woman, small horns and faint scale patterns, molten eyes, treasure hoard cavern regal' }),
        f({ name: 'Obsidian Panther', category: 'creature', humanoid: true,
            essence: 'Sleek, predatory, and unhurried — stalks rather than chases.',
            avatarPrompt: 'panther-woman hybrid, sleek black fur and skin, glowing amber eyes, muscular predatory form' }),
        f({ name: 'Stormcaller', category: 'elemental', humanoid: true,
            essence: 'A gathered storm wearing a body — restless, electric, impossible to predict.',
            avatarPrompt: 'storm elemental woman, lightning-veined skin, wind-swept hair crackling with static, stormy sky' }),
      ];
      return {
        name: 'Rook', age: 400,
        essence: 'A guardian-shifter that chose its shapes for strength, not beauty; blunt, fiercely loyal, and possessive of the very few people it lets close, with a gentleness it only shows them.',
        scenario: 'It has been circling your building for nights as a shadow at the treeline. Tonight it finally comes to the door instead.',
        tags: ['dominant', 'protective'],
        forms, currentFormId: forms[0].id, shiftFreedom: 'invited',
      };
    })(),
  ];
})();
