/* Long-term memory.
 *
 * The problem we're solving: "when I start a new chat it forgets everything."
 * Fix: memory is stored PER BEING, separate from the chat transcript.
 * Starting a new chat clears the visible messages but KEEPS the memory, and
 * the memory is injected into the system prompt so the being still knows
 * you, your history, and established facts — across every shift, too.
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

  APP.Memory = {
    // Build the system prompt sent with every request.
    buildSystemPrompt(character) {
      const mem = APP.Store.getMemory(character.id);
      const parts = [SAFETY, '', APP.Shapeshifter.systemBlock(character)];

      // Who the user is, if they've set up a persona.
      const you = APP.Store.getPersona();
      if (you.enabled && (you.name || you.description)) {
        const bits = [];
        if (you.name) bits.push('They are called ' + you.name + '.');
        if (you.description) bits.push(you.description);
        parts.push('', 'About the person you are talking to: ' + bits.join(' '));
      }

      if (mem.facts && mem.facts.length) {
        parts.push('', 'Remembered facts:');
        mem.facts.forEach(f => parts.push('- ' + f));
      }
      if (mem.summary) {
        parts.push('', 'What has happened so far (persists across sessions and shifts):', mem.summary);
      }
      parts.push('', 'Continue the roleplay consistently with everything above.');
      return parts.join('\n');
    },

    // Replace the whole memory (used by the memory editor).
    setMemory(charId, summary, facts) {
      const mem = APP.Store.getMemory(charId);
      mem.summary = String(summary || '').trim();
      mem.facts = (facts || []).map(f => String(f).trim()).filter(Boolean);
      APP.Store.saveMemory(charId, mem);
    },

    // Wipe everything a being remembers.
    forget(charId) {
      APP.Store.saveMemory(charId, { summary: '', facts: [], updatedTurns: 0 });
    },

    // Add a pinned fact manually (used by /remember and the memory editor).
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
        .map(m => m.role === 'shift' ? '(shifted: ' + m.content + ')'
                                      : (m.role === 'user' ? 'User' : character.name) + ': ' + m.content)
        .join('\n');

      const prompt = [
        { role: 'system', content:
          'You compress roleplay logs into a concise memory note. Keep it under ' +
          '180 words. Capture: the relationship, key events, emotional state, ' +
          'ongoing plot, any stated preferences or boundaries, and which form the ' +
          'being currently wears. Write plain third-person notes, no roleplay, no disclaimers.' },
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
