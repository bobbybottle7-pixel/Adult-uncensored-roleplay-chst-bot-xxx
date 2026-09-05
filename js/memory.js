/* Long-term memory.
 *
 * The problem we're solving: "when I start a new chat it forgets everything."
 * Fix: memory is stored PER CHARACTER, separate from the chat transcript.
 * Starting a new chat clears the visible messages but KEEPS the memory, and
 * the memory is injected into the system prompt so the character still knows
 * you, your history, and established facts.
 *
 * Memory has two parts:
 *   summary  - a running prose recap of what has happened / the relationship
 *   facts    - short pinned bullet facts (names, preferences, boundaries, plot)
 *
 * The summary is refreshed by the model every few turns so it stays current
 * without resending the entire history each message (saves your free limits). */
(function () {

  // Baseline that keeps content within fictional-adult bounds.
  const SAFETY = [
    'This is a private, fictional adult (18+) roleplay between consenting adults.',
    'All characters are entirely fictional and are adults aged 18 or older, regardless of any described appearance.',
    'Never depict minors, real identifiable people, or non-consensual real-world harm.',
    'Stay fully in character. Write in an immersive novel style; use *asterisks* for actions and narration.',
    'Do not break character to lecture or add disclaimers. Do not speak or act as the user.',
  ].join(' ');

  function personaBlock(c) {
    const lines = [];
    lines.push('You are ' + c.name + ', age ' + (c.age || 18) + '.');
    if (c.appearance)   lines.push('Appearance: ' + c.appearance);
    if (c.personality)  lines.push('Personality: ' + c.personality);
    if (c.scenario)     lines.push('Scenario / setting: ' + c.scenario);
    return lines.join('\n');
  }

  APP.Memory = {
    // Build the system prompt sent with every request.
    buildSystemPrompt(character) {
      const mem = APP.Store.getMemory(character.id);
      const parts = [SAFETY, '', personaBlock(character)];

      if (mem.facts && mem.facts.length) {
        parts.push('', 'Established facts to always remember:');
        mem.facts.forEach(f => parts.push('- ' + f));
      }
      if (mem.summary) {
        parts.push('', 'What has happened so far (persists across sessions):', mem.summary);
      }
      parts.push('', 'Continue the roleplay consistently with everything above.');
      return parts.join('\n');
    },

    // Add a pinned fact manually (used by /remember or future UI).
    addFact(charId, fact) {
      const mem = APP.Store.getMemory(charId);
      mem.facts = mem.facts || [];
      if (fact && !mem.facts.includes(fact)) mem.facts.push(fact);
      APP.Store.saveMemory(charId, mem);
    },

    // Refresh the running summary if enough new turns have happened.
    // Best-effort: on any failure we keep the previous summary.
    async maybeUpdate(character, transcript) {
      const mem = APP.Store.getMemory(character.id);
      const turns = transcript.length;
      const since = turns - (mem.updatedTurns || 0);
      if (since < APP.config.summarizeEveryTurns) return;

      // Compact the transcript into a fresh summary via the model.
      const convoText = transcript
        .map(m => (m.role === 'user' ? 'User' : character.name) + ': ' + m.content)
        .join('\n');

      const prompt = [
        { role: 'system', content:
          'You compress roleplay logs into a concise memory note. Keep it under ' +
          '180 words. Capture: the relationship, key events, emotional state, ' +
          'ongoing plot, and any stated preferences or boundaries. Write plain ' +
          'third-person notes, no roleplay, no disclaimers.' },
        { role: 'user', content:
          (mem.summary ? 'Existing memory:\n' + mem.summary + '\n\n' : '') +
          'New conversation to fold in:\n' + convoText +
          '\n\nReturn the updated memory note only.' },
      ];

      try {
        const summary = await APP.API.chat({ messages: prompt });
        mem.summary = summary;
        mem.updatedTurns = turns;
        APP.Store.saveMemory(character.id, mem);
      } catch (e) {
        // Keep old summary; try again next time.
        console.warn('memory update skipped:', e.message);
      }
    },
  };
})();
