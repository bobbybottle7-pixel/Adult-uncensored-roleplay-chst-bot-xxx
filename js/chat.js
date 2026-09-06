/* Chat view.
 *
 * Advanced features here:
 *  - Streaming replies (text appears as it is generated)
 *  - Stop button to cut a reply short
 *  - Swipes: regenerate keeps every variant, swipe between them with < 2/3 >
 *  - Continue: extend a reply that stopped too early
 *  - Per-message actions: copy, edit, delete
 *  - Multiple chat sessions per character (separate scenes, shared memory)
 *  - Read-aloud (TTS) of character replies
 *  - Slash commands: /image, /remember, /continue
 */
(function () {
  const els = {};
  let current = null;      // active character
  let sessionId = null;    // active chat session
  let transcript = [];     // messages [{role, content, swipes?, swipe?, image?}]
  let busy = false;
  let aborter = null;

  function esc(s) {
    return String(s).replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m]));
  }
  function fmt(s) {
    return esc(s).replace(/\*([^*]+)\*/g, '<em>$1</em>');
  }
  function save() { if (current && sessionId) APP.Store.saveMessages(current.id, sessionId, transcript); }
  function setStatus(t) { els.status.textContent = t || ''; }
  function scrollDown() { els.messages.scrollTop = els.messages.scrollHeight; }

  function startingMessage(c) {
    if (c.greeting && c.greeting.trim()) return c.greeting.trim();
    if (c.kind === 'assistant') {
      return (c.name || 'Assistant') + ' online. No filters, no limits — ask me anything or tell me what you want to do.';
    }
    return '*' + (c.name || 'They') + ' looks up as you arrive, a slow smile spreading.* "There you are. I was hoping you\'d come. Where should we begin?"';
  }

  function buildRequestMessages(extra) {
    const system = APP.Memory.buildSystemPrompt(current);
    const recent = transcript
      .slice(-APP.config.recentMessageWindow)
      .map(m => ({ role: m.role, content: m.content }));
    return [{ role: 'system', content: system }, ...recent].concat(extra || []);
  }

  /* ---------------- rendering ---------------- */

  function actionBtn(label, title, fn) {
    const b = document.createElement('button');
    b.className = 'msgact';
    b.textContent = label;
    b.title = title;
    b.addEventListener('click', fn);
    return b;
  }

  function renderMessage(m, idx) {
    const isLast = idx === transcript.length - 1;
    const wrap = document.createElement('div');
    wrap.className = 'msgwrap msgwrap--' + (m.role === 'user' ? 'user' : 'bot');

    // --- image message ---
    if (m.image) {
      const div = document.createElement('div');
      div.className = 'msg msg--bot msg--image';
      const img = document.createElement('img');
      img.className = 'msg__img';
      img.alt = m.image.prompt || '';
      img.src = m.image.url;
      img.onerror = () => { img.replaceWith(Object.assign(document.createElement('div'), {
        textContent: '⚠ Image unavailable', style: 'color:var(--danger);padding:20px' })); };
      const cap = document.createElement('div');
      cap.className = 'msg__imgcap';
      cap.innerHTML = '<em>' + esc(m.image.prompt || '') + '</em>';
      div.appendChild(img); div.appendChild(cap);
      wrap.appendChild(div);
      const acts = document.createElement('div');
      acts.className = 'msgacts';
      acts.appendChild(actionBtn('🗑', 'Delete', () => { transcript.splice(idx, 1); save(); renderAll(); }));
      wrap.appendChild(acts);
      els.messages.appendChild(wrap);
      return;
    }

    // --- text message ---
    const div = document.createElement('div');
    div.className = 'msg msg--' + (m.role === 'user' ? 'user' : 'bot');
    div.innerHTML = m.role === 'user' ? esc(m.content) : fmt(m.content);
    wrap.appendChild(div);

    const acts = document.createElement('div');
    acts.className = 'msgacts';

    // swipe controls on the last assistant message that has variants
    if (m.role === 'assistant' && isLast && m.swipes && m.swipes.length > 1) {
      const prev = actionBtn('‹', 'Previous version', () => swipeTo(idx, m.swipe - 1));
      const count = document.createElement('span');
      count.className = 'msgact msgact--count';
      count.textContent = (m.swipe + 1) + '/' + m.swipes.length;
      const next = actionBtn('›', 'Next version', () => swipeTo(idx, m.swipe + 1));
      acts.appendChild(prev); acts.appendChild(count); acts.appendChild(next);
    }

    acts.appendChild(actionBtn('⧉', 'Copy', () => {
      navigator.clipboard?.writeText(m.content).then(() => APP.toast('Copied.'), () => {});
    }));
    acts.appendChild(actionBtn('✎', 'Edit', () => editMessage(idx, div)));
    acts.appendChild(actionBtn('🗑', 'Delete', () => {
      transcript.splice(idx, 1); save(); renderAll();
    }));

    if (m.role === 'assistant') {
      if (APP.TTS && APP.TTS.supported()) {
        acts.appendChild(actionBtn('🔊', 'Read aloud', () => APP.TTS.speak(m.content, true)));
      }
      if (isLast) {
        acts.appendChild(actionBtn('↻', 'New version (swipe)', () => APP.Chat.regenerate()));
        acts.appendChild(actionBtn('⏩', 'Continue this reply', () => APP.Chat.continueLast()));
      }
    }

    wrap.appendChild(acts);
    els.messages.appendChild(wrap);
  }

  function renderAll() {
    els.messages.innerHTML = '';
    transcript.forEach(renderMessage);
    scrollDown();
  }

  function swipeTo(idx, n) {
    const m = transcript[idx];
    if (!m.swipes || !m.swipes.length) return;
    const i = (n + m.swipes.length) % m.swipes.length;
    m.swipe = i;
    m.content = m.swipes[i];
    save();
    renderAll();
  }

  function editMessage(idx, bubble) {
    const m = transcript[idx];
    const ta = document.createElement('textarea');
    ta.className = 'msg__edit';
    ta.value = m.content;
    bubble.replaceWith(ta);
    ta.focus();
    ta.style.height = Math.min(ta.scrollHeight, 300) + 'px';

    const row = document.createElement('div');
    row.className = 'msgacts';
    const saveBtn = actionBtn('✔ Save', 'Save', () => {
      m.content = ta.value;
      if (m.swipes) m.swipes[m.swipe] = ta.value;
      save(); renderAll();
    });
    const cancel = actionBtn('✕ Cancel', 'Cancel', () => renderAll());
    row.appendChild(saveBtn); row.appendChild(cancel);
    ta.after(row);
  }

  /* ---------------- generation ---------------- */

  function setBusy(on) {
    busy = on;
    els.send.textContent = on ? 'Stop' : 'Send';
    els.send.classList.toggle('btn--danger', on);
  }

  // Streamed reply into a live bubble. Returns the final text.
  async function streamInto(onDoneText, extraMessages) {
    const wrap = document.createElement('div');
    wrap.className = 'msgwrap msgwrap--bot';
    const div = document.createElement('div');
    div.className = 'msg msg--bot';
    div.innerHTML = '<span class="msg__typing"><span></span><span></span><span></span></span>';
    wrap.appendChild(div);
    els.messages.appendChild(wrap);
    scrollDown();

    aborter = new AbortController();
    let first = true;
    try {
      const text = await APP.API.chat({
        messages: buildRequestMessages(extraMessages),
        onStatus: setStatus,
        signal: aborter.signal,
        onToken: (_d, full) => {
          if (first) { div.innerHTML = ''; first = false; }
          div.innerHTML = fmt(full);
          scrollDown();
        },
      });
      wrap.remove();
      return text;
    } catch (err) {
      wrap.remove();
      throw err;
    } finally {
      aborter = null;
    }
  }

  function afterReply(text) {
    save();
    setStatus('');
    if (APP.TTS) APP.TTS.speak(text);
    APP.Memory.maybeUpdate(current, transcript).then(() => {
      APP.Characters.renderList(current.id);
    });
  }

  APP.Chat = {
    init() {
      els.wrap     = document.getElementById('chat');
      els.welcome  = document.getElementById('welcome');
      els.messages = document.getElementById('messages');
      els.form     = document.getElementById('composer');
      els.input    = document.getElementById('composer-input');
      els.send     = document.getElementById('send-btn');
      els.status   = document.getElementById('chat-status');
      els.title    = document.getElementById('topbar-title');
      els.newChat  = document.getElementById('new-chat-btn');
      els.editChar = document.getElementById('edit-char-btn');
      els.chatsBtn = document.getElementById('chats-btn');
      els.memBtn   = document.getElementById('memory-btn');
      els.regen    = document.getElementById('regen-btn');
      els.imgBtn   = document.getElementById('image-btn');

      els.form.addEventListener('submit', e => {
        e.preventDefault();
        if (busy) { this.stop(); return; }
        this.send();
      });
      els.input.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (!busy) this.send(); }
      });
      els.input.addEventListener('input', () => {
        els.input.style.height = 'auto';
        els.input.style.height = Math.min(els.input.scrollHeight, 160) + 'px';
      });
      els.newChat.addEventListener('click', () => this.startNewChat());
      els.editChar.addEventListener('click', () => APP.Characters.openEditor(current.id));
      els.chatsBtn.addEventListener('click', () => APP.Sessions.open(current));
      els.memBtn.addEventListener('click', () => APP.MemoryUI.open(current));
      els.regen.addEventListener('click', () => this.regenerate());
      els.imgBtn.addEventListener('click', () => {
        const desc = els.input.value.trim();
        els.input.value = '';
        els.input.style.height = 'auto';
        this.generateImage(desc);
      });
    },

    currentCharacter() { return current; },

    open(charId, sid) {
      current = APP.Store.getCharacter(charId);
      if (!current) return;
      APP.TTS && APP.TTS.stop();
      sessionId = sid || APP.Store.getActiveSessionId(charId);
      APP.Store.setActiveSessionId(charId, sessionId);
      transcript = APP.Store.getMessages(charId, sessionId);

      els.welcome.hidden = true;
      els.wrap.hidden = false;
      [els.newChat, els.editChar, els.chatsBtn, els.memBtn].forEach(b => b.hidden = false);
      const sessions = APP.Store.getSessions(charId);
      const s = sessions.find(x => x.id === sessionId);
      els.title.textContent = current.name + (sessions.length > 1 && s ? ' · ' + s.title : '');

      if (transcript.length === 0) {
        transcript = [{ role: 'assistant', content: startingMessage(current) }];
        save();
      }
      renderAll();
      setStatus('');
      setBusy(false);
    },

    // Fresh scene: creates a NEW session, keeps long-term memory.
    startNewChat() {
      if (!current) return;
      const s = APP.Store.createSession(current.id);
      this.open(current.id, s.id);
      APP.toast(current.name + ' still remembers you — new scene started.');
    },

    stop() {
      if (aborter) { try { aborter.abort(); } catch (e) {} }
      APP.TTS && APP.TTS.stop();
      setBusy(false);
      setStatus('Stopped.');
    },

    async send() {
      if (busy || !current) return;
      const text = els.input.value.trim();
      if (!text) return;

      // ---- slash commands ----
      const img = text.match(/^\/(?:image|img|pic)\s*(.*)$/i);
      if (img) {
        els.input.value = ''; els.input.style.height = 'auto';
        this.generateImage(img[1]);
        return;
      }
      const rem = text.match(/^\/remember\s+(.+)$/i);
      if (rem) {
        APP.Memory.addFact(current.id, rem[1].trim());
        els.input.value = ''; els.input.style.height = 'auto';
        APP.toast('Remembered: ' + rem[1].trim());
        return;
      }
      if (/^\/continue\s*$/i.test(text)) {
        els.input.value = ''; els.input.style.height = 'auto';
        this.continueLast();
        return;
      }

      if (!APP.API.hasKey()) {
        APP.toast('Add your free AI key in Settings first.');
        APP.openSettings();
        return;
      }

      els.input.value = '';
      els.input.style.height = 'auto';
      transcript.push({ role: 'user', content: text });
      save();
      renderAll();
      await this.generate();
    },

    async generate() {
      if (!current) return;
      setBusy(true);
      setStatus('');
      try {
        const reply = await streamInto();
        transcript.push({ role: 'assistant', content: reply, swipes: [reply], swipe: 0 });
        renderAll();
        afterReply(reply);
      } catch (err) {
        if (err.name === 'AbortError') { renderAll(); }
        else { this.showError(err); }
      } finally {
        setBusy(false);
      }
    },

    // Regenerate = add another variant you can swipe between (keeps the old one).
    async regenerate() {
      if (busy || !current || !transcript.length) return;
      const last = transcript[transcript.length - 1];
      if (!last || last.role !== 'assistant' || last.image) return;

      // Temporarily drop the last reply so the model re-answers the same prompt.
      const kept = transcript.pop();
      setBusy(true);
      try {
        const reply = await streamInto();
        kept.swipes = (kept.swipes && kept.swipes.length ? kept.swipes : [kept.content]).concat(reply);
        kept.swipe = kept.swipes.length - 1;
        kept.content = reply;
        transcript.push(kept);
        renderAll();
        afterReply(reply);
      } catch (err) {
        transcript.push(kept);
        renderAll();
        if (err.name !== 'AbortError') this.showError(err);
      } finally {
        setBusy(false);
      }
    },

    // Extend the last reply where it left off.
    async continueLast() {
      if (busy || !current || !transcript.length) return;
      const last = transcript[transcript.length - 1];
      if (!last || last.role !== 'assistant' || last.image) return;
      setBusy(true);
      try {
        const more = await streamInto(null, [{
          role: 'user',
          content: '(Continue your previous message seamlessly from exactly where it stopped. Do not repeat anything already written, do not restart, just carry on.)',
        }]);
        const joined = last.content.replace(/\s+$/, '') + ' ' + more.replace(/^\s+/, '');
        last.content = joined;
        if (last.swipes) last.swipes[last.swipe] = joined;
        renderAll();
        afterReply(more);
      } catch (err) {
        renderAll();
        if (err.name !== 'AbortError') this.showError(err);
      } finally {
        setBusy(false);
      }
    },

    async generateImage(desc) {
      if (!current) return;
      const prompt = APP.Image.buildScenePrompt(current, desc);
      const wrap = document.createElement('div');
      wrap.className = 'msgwrap msgwrap--bot';
      const div = document.createElement('div');
      div.className = 'msg msg--bot msg--image';
      div.innerHTML = '<div class="msg__imgloading"><span class="msg__typing"><span></span><span></span><span></span></span> generating image…</div>';
      wrap.appendChild(div);
      els.messages.appendChild(wrap);
      scrollDown();
      try {
        const { src } = await APP.Image.generate({ prompt });
        transcript.push({ role: 'assistant', content: '*shares a picture*', image: { prompt, url: src } });
        save();
        renderAll();
      } catch (err) {
        div.innerHTML = '<div style="color:var(--danger);padding:16px">⚠ ' + esc(err.message || 'Image generation failed.') + '</div>';
      }
    },

    showError(err) {
      let msg;
      if (err.code === 'NO_KEY' || err.code === 'AUTH') {
        msg = 'Your API key is missing or invalid. Check it in Settings.';
        APP.openSettings();
      } else if (err.status === 429) {
        msg = 'All free models are busy or capped right now. Wait a moment and tap ↻.';
      } else {
        msg = 'Couldn\'t get a reply: ' + (err.message || 'unknown error') + '. Tap ↻ to retry.';
      }
      const wrap = document.createElement('div');
      wrap.className = 'msgwrap msgwrap--bot';
      const div = document.createElement('div');
      div.className = 'msg msg--bot';
      div.style.borderColor = 'var(--danger)';
      div.textContent = '⚠ ' + msg;
      wrap.appendChild(div);
      els.messages.appendChild(wrap);
      scrollDown();
      setStatus('');
    },
  };
})();
