/* Chat view: renders messages, sends to the model, wires memory + fallback. */
(function () {
  const els = {};
  let current = null;      // active character
  let transcript = [];     // visible messages [{role, content}]
  let busy = false;

  function esc(s) {
    return s.replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m]));
  }
  // Render *text* as italic actions, keep the rest as-is.
  function fmt(s) {
    return esc(s).replace(/\*([^*]+)\*/g, '<em>$1</em>');
  }

  function addBubble(role, content) {
    const div = document.createElement('div');
    div.className = 'msg msg--' + (role === 'user' ? 'user' : 'bot');
    div.innerHTML = role === 'user' ? esc(content) : fmt(content);
    els.messages.appendChild(div);
    els.messages.scrollTop = els.messages.scrollHeight;
    return div;
  }

  // Create an image bubble shell (spinner). Returns handles to fill later.
  function addImageShell(prompt) {
    const div = document.createElement('div');
    div.className = 'msg msg--bot msg--image';
    const spinner = document.createElement('div');
    spinner.className = 'msg__imgloading';
    spinner.innerHTML = '<span class="msg__typing"><span></span><span></span><span></span></span> generating image…';
    div.appendChild(spinner);
    els.messages.appendChild(div);
    els.messages.scrollTop = els.messages.scrollHeight;

    function fail(text) {
      spinner.remove();
      const err = document.createElement('div');
      err.style.color = 'var(--danger)';
      err.textContent = '⚠ ' + text;
      div.appendChild(err);
    }
    function setSrc(src) {
      const img = document.createElement('img');
      img.className = 'msg__img';
      img.alt = prompt;
      img.loading = 'lazy';
      img.onload = () => { spinner.remove(); };
      img.onerror = () => fail('Image failed or was blocked. Try different wording or another model/provider (Settings).');
      img.src = src;
      const cap = document.createElement('div');
      cap.className = 'msg__imgcap';
      cap.innerHTML = '<em>' + esc(prompt) + '</em>';
      div.appendChild(img);
      div.appendChild(cap);
      els.messages.scrollTop = els.messages.scrollHeight;
    }
    return { div, setSrc, fail };
  }

  // Render an already-generated image (from a saved transcript entry).
  function addImageBubble(prompt, src) {
    const shell = addImageShell(prompt);
    shell.setSrc(src);
    return shell.div;
  }

  function typingBubble() {
    const div = document.createElement('div');
    div.className = 'msg msg--bot';
    div.innerHTML = '<span class="msg__typing"><span></span><span></span><span></span></span>';
    els.messages.appendChild(div);
    els.messages.scrollTop = els.messages.scrollHeight;
    return div;
  }

  function setStatus(t) { els.status.textContent = t || ''; }

  // A guaranteed opening line for any character.
  function startingMessage(c) {
    if (c.greeting && c.greeting.trim()) return c.greeting.trim();
    if (c.kind === 'assistant') {
      return (c.name || 'Assistant') + ' online. No filters, no limits — ask me anything or tell me what you want to do.';
    }
    return '*' + (c.name || 'They') + ' looks up as you arrive, a slow smile spreading.* "There you are. I was hoping you\'d come. Where should we begin?"';
  }

  function buildRequestMessages() {
    const system = APP.Memory.buildSystemPrompt(current);
    const recent = transcript
      .slice(-APP.config.recentMessageWindow)
      .map(m => ({ role: m.role, content: m.content })); // strip extras (e.g. image)
    return [{ role: 'system', content: system }, ...recent];
  }

  APP.Chat = {
    init() {
      els.wrap     = document.getElementById('chat');
      els.welcome  = document.getElementById('welcome');
      els.messages = document.getElementById('messages');
      els.form     = document.getElementById('composer');
      els.input    = document.getElementById('composer-input');
      els.status   = document.getElementById('chat-status');
      els.title    = document.getElementById('topbar-title');
      els.newChat  = document.getElementById('new-chat-btn');
      els.editChar = document.getElementById('edit-char-btn');
      els.regen    = document.getElementById('regen-btn');
      els.imgBtn   = document.getElementById('image-btn');

      els.form.addEventListener('submit', e => { e.preventDefault(); this.send(); });
      els.input.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.send(); }
      });
      els.input.addEventListener('input', () => {
        els.input.style.height = 'auto';
        els.input.style.height = Math.min(els.input.scrollHeight, 160) + 'px';
      });
      els.newChat.addEventListener('click', () => this.startNewChat());
      els.editChar.addEventListener('click', () => APP.Characters.openEditor(current.id));
      els.regen.addEventListener('click', () => this.regenerate());
      els.imgBtn.addEventListener('click', () => {
        // Use whatever is typed as the image description; empty = character selfie.
        const desc = els.input.value.trim();
        els.input.value = '';
        els.input.style.height = 'auto';
        this.generateImage(desc);
      });
    },

    open(charId) {
      current = APP.Store.getCharacter(charId);
      if (!current) return;
      transcript = APP.Store.getChat(charId);

      els.welcome.hidden = true;
      els.wrap.hidden = false;
      els.newChat.hidden = false;
      els.editChar.hidden = false;
      els.title.textContent = current.name;
      els.messages.innerHTML = '';

      // Always open with a starting message. Use the character's greeting, or
      // a sensible fallback so a character with no greeting still opens with one.
      if (transcript.length === 0) {
        transcript = [{ role: 'assistant', content: startingMessage(current) }];
        APP.Store.saveChat(current.id, transcript);
      }
      transcript.forEach(m => {
        if (m.image) addImageBubble(m.image.prompt, m.image.url);
        else addBubble(m.role, m.content);
      });
      setStatus('');
      els.input.focus();
    },

    // New chat: wipe visible messages but KEEP long-term memory.
    startNewChat() {
      if (!current) return;
      if (transcript.length > 1 &&
          !confirm('Start a fresh chat with ' + current.name +
                   '? Their memory of you is kept — only the current messages are cleared.')) return;
      APP.Store.clearChat(current.id);
      transcript = [];
      this.open(current.id);
      APP.toast(current.name + ' still remembers you — fresh scene started.');
    },

    async send() {
      if (busy || !current) return;
      const text = els.input.value.trim();
      if (!text) return;

      if (!APP.API.hasKey()) {
        APP.toast('Add your free AI key in Settings first.');
        APP.openSettings();
        return;
      }

      // /image command -> generate a picture instead of a text reply.
      const imgMatch = text.match(/^\/(?:image|img|pic)\s*(.*)$/i);
      if (imgMatch) {
        els.input.value = '';
        els.input.style.height = 'auto';
        this.generateImage(imgMatch[1]);
        return;
      }

      els.input.value = '';
      els.input.style.height = 'auto';
      transcript.push({ role: 'user', content: text });
      addBubble('user', text);
      APP.Store.saveChat(current.id, transcript);

      await this.generate();
    },

    async generate() {
      busy = true;
      setStatus('');
      const typing = typingBubble();

      try {
        const reply = await APP.API.chat({
          messages: buildRequestMessages(),
          onStatus: setStatus,
        });
        typing.remove();
        transcript.push({ role: 'assistant', content: reply });
        addBubble('assistant', reply);
        APP.Store.saveChat(current.id, transcript);
        setStatus('');

        // Fold recent events into long-term memory (non-blocking).
        APP.Memory.maybeUpdate(current, transcript).then(() => {
          APP.Characters.renderList(current.id);
        });
      } catch (err) {
        typing.remove();
        this.showError(err);
      } finally {
        busy = false;
      }
    },

    // Generate an image. If desc is empty, make a "selfie" of the character.
    async generateImage(desc) {
      if (!current) return;
      const prompt = APP.Image.buildScenePrompt(current, desc);
      const shell = addImageShell(prompt);
      try {
        const { src } = await APP.Image.generate({ prompt });
        shell.setSrc(src);
        transcript.push({ role: 'assistant', content: '*shares a picture*', image: { prompt, url: src } });
        APP.Store.saveChat(current.id, transcript);
      } catch (err) {
        shell.fail(err.message || 'Image generation failed.');
      }
    },

    async regenerate() {
      if (busy || !current || transcript.length === 0) return;
      // Drop the last assistant message and regenerate.
      if (transcript[transcript.length - 1].role === 'assistant') {
        transcript.pop();
        APP.Store.saveChat(current.id, transcript);
        const bubbles = els.messages.querySelectorAll('.msg--bot');
        if (bubbles.length) bubbles[bubbles.length - 1].remove();
      }
      await this.generate();
    },

    showError(err) {
      let msg;
      if (err.code === 'NO_KEY' || err.code === 'AUTH') {
        msg = 'Your API key is missing or invalid. Check it in Settings.';
        APP.openSettings();
      } else if (err.status === 429) {
        msg = 'All free models are busy / capped right now. Wait a bit, or add another model in config.';
      } else {
        msg = 'Couldn\'t get a reply: ' + (err.message || 'unknown error') + '. Tap ↻ Regenerate to retry.';
      }
      const div = addBubble('assistant', '⚠ ' + msg);
      div.style.borderColor = 'var(--danger)';
      setStatus('');
    },
  };
})();
