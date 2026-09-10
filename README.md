# Shapeshift (18+)

A private, browser-only adult roleplay chat, built around one idea: **you
shape a being, and it changes form while you talk to it.** Not a library of
fixed characters — one continuous fictional consciousness with a wardrobe of
bodies. It stays *itself* underneath every shape it wears, and it
**remembers you across every shift and every new chat**. Everything runs in
your browser — no server to host, nothing installed on your device, all your
data stays on your machine.

> **18+ only.** This app is for fictional adult roleplay between consenting
> adults. Every being and every form it can take is fictional and depicted
> as an adult (18+). An age gate blocks the app until you confirm you're an
> adult, and no form may ever impersonate a real, identifiable person.

---

## How it works (why it runs on a weak device)

Your device only shows the web page. The AI itself runs on a provider's
servers, so a 4GB machine is fine — it never runs the model locally.

---

## Setup (about 2 minutes, no credit card)

### 1. Get a free AI key
1. Go to **https://openrouter.ai** and **Sign in** (Google login works).
2. **No credit card is required.** No payment.
3. Click your avatar → **Keys** → **Create Key** → copy it (starts with `sk-or-`).

### 2. Open the app
- **Easiest:** open `index.html` directly in your browser.
- **Or host it free** (get a shareable link) — see *Hosting* below.

### 3. Paste your key
On first open, confirm you're 18+, then the **Settings** window appears.
Paste your key, pick **Auto** for the model, and **Save**.

### 4. Shape your first being
Click **🌀 New shapeshifter**. Either pick a **Quick start** (a fully
written being with a few forms already chosen) or **build your own**:
choose a starting form from the library, give it a working title and an
essence, and create it. Then just talk.

---

## Shapeshifters 🌀 — the whole app

A being carries a permanent **essence** — its personality, voice, and
history, the part of it that never changes — plus a **wardrobe of forms**
it can wear. You pick the first form when you create it:

- **Quick start** — six fully written beings (Nyx, Fen, Suzume, Echo-7,
  Vale, Rook), each with a few forms already chosen and a scenario and
  first line ready to go. Everything is still editable before you create it.
- **Build your own** — pick a bare form from the library (creatures,
  abstract beings, fictional people, elementals, mythic beasts) or describe
  a form yourself, then write the title, essence, scenario and tags.

In chat, tap **🌀** in the top bar (or type `/shift`) to open the form
picker. Forms it has already worn with you show first, so it can return to
one; pick a new one from the library, or describe a form on the spot. The
app narrates the transformation in the chat, then continues the scene as
the new form — and it remembers everything from every form it has worn,
because memory belongs to the being, not the body.

You also choose **how free its shifting is**: only when you ask or the
scene calls for it, or whenever its own mood calls for it.

---

## About free limits (read this)

Free AI has caps — there is no free source that is truly unlimited. To make it
as painless as possible this app uses **automatic model fallback**: it keeps a
list of free uncensored models and, if one is busy or capped, it silently
tries the next one. So one model dying doesn't stop your chat.

Tips if you still hit limits:
- Keep the model set to **Auto** (uses the whole fallback list).
- Free OpenRouter accounts have a low daily request cap. Putting **$10 into
  OpenRouter once** (optional, you don't have to) raises the free-model limit
  roughly 20× — you still use the free models, you just get far more of them.
- You can edit the model list in `js/config.js` to add/remove models. The
  current list was vetted directly against the live OpenRouter API (checked
  each model both resolves *and* actually complies with in-character adult
  content instead of silently refusing) — free lineups rotate, so re-check
  periodically if replies start looking off.

---

## Image generation providers

In **Settings → Image provider** you can pick:

- **Pollinations** (default) — free, no key, works everywhere. Filters some
  content, so very explicit images aren't guaranteed.
- **Venice** — keyed and **uncensored**. Get a key at
  [venice.ai](https://venice.ai) → API, paste it in, and images are generated
  with `safe_mode: false`. Default model `venice-sd35` (try `lustify-sdxl`).
- **Custom endpoint** — any image URL that returns a picture from a `GET`,
  using `{prompt}` and optional `{key}` placeholders.

> **Browser/CORS note:** `<img>`-URL providers (Pollinations, custom GET)
> always work. A keyed POST API like Venice only works if it allows browser
> (CORS) requests; if it doesn't, you'll see a clear error. Fix it with the
> free proxy in **[`proxy/`](proxy/README.md)** (a ~3-minute Cloudflare Worker
> deploy), then paste its URL into Settings → Image proxy URL. Pollinations
> never needs one.

Avatars in the sidebar always use the free keyless path and follow the
being's **current form** — shift, and its portrait changes too.

## Advanced chat features

- **Streaming replies** — text appears as it's written instead of all at once.
  The **Send** button becomes **Stop** so you can cut a reply short.
- **Swipes** — tap **↻** and you get another version of the same reply. Old
  versions are kept: swipe between them with **‹ 2/3 ›**.
- **Continue (⏩)** — a reply stopped too early? Extend it seamlessly.
- **Edit any message** — tap **✎** on yours *or* theirs to rewrite it, then
  carry on. Also **⧉** copy and **🗑** delete per message.
- **Multiple scenes per being (💬)** — keep several separate chats with the
  same being. Each has its own messages; memory is shared, so it knows you —
  and every form it's worn — in all of them. Rename or delete any scene.
- **Memory editor (🧠)** — see and hand-edit exactly what a being remembers,
  including pinned facts that are always included. Or make it forget.
- **Your persona** — Settings lets you say who *you* are (name + description),
  and every being will know it, in every form.
- **Read aloud** — replies can be spoken using your device's built-in voices.
  Free, offline, with voice and speed pickers. Tap 🔊 on any message.
- **Backup & restore** — export everything to a file, restore it later.

### Slash commands

| Command | What it does |
|---------|--------------|
| `/image a description` | Generate a picture (also `/img`, `/pic`) — no description uses the being's current form |
| `/remember something` | Pin a fact the being always remembers |
| `/continue` | Extend the last reply |
| `/shift` | Open the form picker |
| `/shift a description` | Shift into a form you describe on the spot |

## Long-term memory

Memory is stored **per being**, separate from the chat messages, and shared
across every form it has ever worn:
- **New chat** clears the on-screen messages but **keeps the being's
  memory**, so it still knows you and your history.
- Every few turns the app compresses recent events (including any shifts)
  into a memory note, so the being stays consistent without resending the
  whole history each time (which also saves your free limits).
- In the sidebar, a being that has memory shows "remembers you".

---

## Hosting (optional, for a shareable link)

This is a static site, so free static hosts work:
- **GitHub Pages:** repo → Settings → Pages → deploy from your branch → root.
- **Netlify / Cloudflare Pages:** drag-and-drop the folder.

Your key is stored in each visitor's own browser, never in the code. Note
that a GitHub Pages URL is publicly reachable by anyone who has the link,
even from a private repo — the age gate is a click-through, not real access
control.

---

## Your data & privacy

- Beings, chats, memory and your key live in your browser's `localStorage`.
- Nothing is sent anywhere except the AI provider when generating a reply.
- **Settings → Export all data** makes a backup file.
- **Settings → Erase everything** wipes it all from this browser.

---

## Files

| File | Purpose |
|------|---------|
| `index.html` | Page structure: age gate, app, modals |
| `css/style.css` | All styling (dark theme, mobile-friendly) |
| `js/config.js` | Model list + defaults — **edit models here** |
| `js/starters.js` | Quick-start beings data (used by the wizard) |
| `js/shapeshifter.js` | The whole being lifecycle: form library, sidebar list, creation/edit wizard, in-chat shift picker |
| `js/storage.js` | localStorage (beings, chats, memory, settings) |
| `js/agegate.js` | 18+ gate |
| `js/api.js` | Model adapter with automatic fallback |
| `js/memory.js` | Long-term memory + safety baseline |
| `js/sessions.js` | Multiple chat scenes per being |
| `js/memoryui.js` | Memory editor |
| `js/tts.js` | Read-aloud (text to speech) |
| `js/image.js` | Avatar + scene image generation |
| `js/chat.js` | Chat UI + send/regenerate/shift flow |
| `js/app.js` | Bootstrap, settings, sidebar |

---

## Swapping the AI provider later

Only `js/api.js` talks to the provider. Keep the `APP.API.chat()` signature
and you can point it at any other OpenAI-compatible endpoint (or a self-hosted
model) without touching the rest of the app.
