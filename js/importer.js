/* Character-card importer.
 *
 * The popular NSFW character sites (Chub / CharacterHub, JanitorAI, SpicyChat,
 * SillyTavern, TavernAI, Risu…) all export/import the SAME portable format:
 *   - a PNG "character card" with the character JSON embedded in a tEXt/iTXt
 *     chunk under the key "chara" (base64) — and the picture is the avatar; or
 *   - a plain .json file (V1 flat, or V2 { spec, data }).
 *
 * This lets the USER bring in any card they legally obtain from those sites
 * (via the site's Export/Download button) instead of us redistributing other
 * people's content. All imports are still forced to adult (18+) and run under
 * the app's fictional-adult safety baseline. */
(function () {

  function b64ToUtf8(b64) {
    const bin = atob(b64.replace(/\s/g, ''));
    const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
    return new TextDecoder('utf-8').decode(bytes);
  }

  // Extract tEXt/iTXt chunks from a PNG ArrayBuffer -> { keyword: text }.
  function readPngTextChunks(buffer) {
    const bytes = new Uint8Array(buffer);
    const sig = [137, 80, 78, 71, 13, 10, 26, 10];
    for (let i = 0; i < 8; i++) if (bytes[i] !== sig[i]) return null;
    const dv = new DataView(buffer);
    const out = {};
    let off = 8;
    while (off + 8 <= bytes.length) {
      const len = dv.getUint32(off); off += 4;
      const type = String.fromCharCode(bytes[off], bytes[off+1], bytes[off+2], bytes[off+3]); off += 4;
      const data = bytes.subarray(off, off + len); off += len; off += 4; // + crc
      if (type === 'tEXt') {
        const z = data.indexOf(0);
        if (z >= 0) {
          const kw = new TextDecoder('latin1').decode(data.subarray(0, z));
          out[kw] = new TextDecoder('latin1').decode(data.subarray(z + 1));
        }
      } else if (type === 'iTXt') {
        const z = data.indexOf(0);
        if (z >= 0) {
          const kw = new TextDecoder('latin1').decode(data.subarray(0, z));
          const compFlag = data[z + 1];
          let p = z + 3;                       // skip compFlag + compMethod
          p = data.indexOf(0, p) + 1;          // skip language tag
          p = data.indexOf(0, p) + 1;          // skip translated keyword
          if (compFlag !== 1) out[kw] = new TextDecoder('utf-8').decode(data.subarray(p));
        }
      }
      if (type === 'IEND') break;
    }
    return out;
  }

  // Normalise a V1/V2/V3 card object into our character shape.
  function cardToCharacter(card) {
    const d = (card && card.data) ? card.data : card; // V2/V3 nest under data
    if (!d || !(d.name || d.char_name)) throw new Error('This file is not a character card.');

    const name = d.name || d.char_name || 'Imported';
    const description = d.description || d.char_persona || '';
    const personality = d.personality || '';
    const scenario = d.scenario || d.world_scenario || '';
    const greeting = d.first_mes || d.char_greeting || '';
    const example = d.mes_example || d.example_dialogue || '';

    // Preserve the card's persona faithfully in one field.
    const persona = [description, personality && ('Personality: ' + personality),
                     example && ('Example dialogue:\n' + example)]
                    .filter(Boolean).join('\n\n');

    let tags = Array.isArray(d.tags) ? d.tags.filter(Boolean) : [];
    tags = tags.concat('imported');

    // Age: force adult. Try to read a number if the card states one.
    let age = 21;
    const m = String(description + ' ' + personality).match(/\bage[:\s]*([0-9]{1,3})/i);
    if (m) age = parseInt(m[1], 10);
    if (!age || age < 18) age = 18;

    return {
      name,
      age,
      gender: '',
      appearance: '',
      personality: persona || description || personality,
      scenario,
      greeting,
      tags,
      avatarPrompt: '',   // if a PNG, the card art is used as the avatar instead
    };
  }

  const els = {};
  let pendingAvatar = null; // data URL from a PNG card

  function showEditorFor(character) {
    if (pendingAvatar) character.avatarImage = pendingAvatar;
    els.modal.hidden = true;
    APP.Characters.openEditorFromPreset(character);
    pendingAvatar = null;
  }

  function handleJsonText(text) {
    let obj;
    try { obj = JSON.parse(text); }
    catch (e) { APP.toast('That is not valid JSON.'); return; }
    try { showEditorFor(cardToCharacter(obj)); }
    catch (e) { APP.toast(e.message); }
  }

  function handleFile(file) {
    const name = (file.name || '').toLowerCase();
    if (name.endsWith('.json') || file.type === 'application/json') {
      const r = new FileReader();
      r.onload = () => handleJsonText(String(r.result));
      r.readAsText(file);
      return;
    }
    // Assume PNG card.
    const r = new FileReader();
    r.onload = () => {
      const buf = r.result;
      const chunks = readPngTextChunks(buf);
      const raw = chunks && (chunks.ccv3 || chunks.chara);
      if (!raw) { APP.toast('No character data found in this PNG. Is it a character card?'); return; }
      let card;
      try { card = JSON.parse(b64ToUtf8(raw)); }
      catch (e) { APP.toast('Could not read the embedded character data.'); return; }
      // Also keep the picture as the avatar.
      const r2 = new FileReader();
      r2.onload = () => {
        pendingAvatar = String(r2.result);
        try { showEditorFor(cardToCharacter(card)); }
        catch (e) { APP.toast(e.message); }
      };
      r2.readAsDataURL(file);
    };
    r.readAsArrayBuffer(file);
  }

  APP.Importer = {
    init() {
      els.modal   = document.getElementById('import-modal');
      els.file    = document.getElementById('import-file');
      els.paste   = document.getElementById('import-paste');
      els.drop    = document.getElementById('import-drop');

      document.getElementById('import-close').addEventListener('click', () => els.modal.hidden = true);
      document.getElementById('import-paste-btn').addEventListener('click', () => {
        const t = els.paste.value.trim();
        if (t) handleJsonText(t); else APP.toast('Paste some character JSON first.');
      });
      els.file.addEventListener('change', () => { if (els.file.files[0]) handleFile(els.file.files[0]); });

      // Drag & drop
      ['dragover', 'dragenter'].forEach(ev => els.drop.addEventListener(ev, e => {
        e.preventDefault(); els.drop.classList.add('is-drag');
      }));
      ['dragleave', 'drop'].forEach(ev => els.drop.addEventListener(ev, e => {
        e.preventDefault(); els.drop.classList.remove('is-drag');
      }));
      els.drop.addEventListener('drop', e => {
        const f = e.dataTransfer.files[0];
        if (f) handleFile(f);
      });
    },
    open() {
      if (els.paste) els.paste.value = '';
      if (els.file) els.file.value = '';
      pendingAvatar = null;
      els.modal.hidden = false;
    },
  };
})();
