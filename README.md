# Roleplay Chat (18+)

A private, browser-only adult roleplay chat app. Create characters, chat with
them, and they **remember you across new chats**. Everything runs in your
browser — no server to host, nothing installed on your device, all your data
stays on your machine.

> **18+ only.** This app is for fictional adult roleplay between consenting
> adults. All characters are fictional and depicted as adults (18+). An age
> gate blocks the app until you confirm you're an adult.

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

### 4. Make a character and chat
Click **+ New character**, fill in name/personality/scenario/greeting, save,
and start chatting.

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
- You can edit the model list in `js/config.js` to add/remove models.

---

## Long-term memory

Memory is stored **per character**, separate from the chat messages:
- **New chat** clears the on-screen messages but **keeps the character's
  memory**, so they still know you and your history.
- Every few turns the app compresses recent events into a memory note, so the
  character stays consistent without resending the whole history each time
  (which also saves your free limits).
- In the sidebar, a character that has memory shows "remembers you".

---

## Hosting (optional, for a shareable link)

This is a static site, so free static hosts work:
- **GitHub Pages:** repo → Settings → Pages → deploy from your branch → root.
- **Netlify / Cloudflare Pages:** drag-and-drop the folder.

Your key is stored in each visitor's own browser, never in the code.

---

## Your data & privacy

- Characters, chats, memory and your key live in your browser's `localStorage`.
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
| `js/storage.js` | localStorage (characters, chats, memory, settings) |
| `js/agegate.js` | 18+ gate |
| `js/api.js` | Model adapter with automatic fallback |
| `js/memory.js` | Long-term memory + safety baseline |
| `js/characters.js` | Character create/edit/list |
| `js/chat.js` | Chat UI + send/regenerate flow |
| `js/app.js` | Bootstrap, settings, sidebar |

---

## Swapping the AI provider later

Only `js/api.js` talks to the provider. Keep the `APP.API.chat()` signature
and you can point it at any other OpenAI-compatible endpoint (or a self-hosted
model) without touching the rest of the app.
