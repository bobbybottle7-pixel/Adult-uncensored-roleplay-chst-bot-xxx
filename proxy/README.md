# Image proxy (optional, free)

You only need this if you use a **keyed image provider** (like Venice) and get
a **CORS error** in the app. Pollinations (the free default) never needs it.

This is a tiny [Cloudflare Worker](https://workers.cloudflare.com) that forwards
your image requests and adds the CORS headers the browser needs. Cloudflare's
free plan is plenty (100,000 requests/day). Your API key is passed straight
through and is **not** stored in the worker.

## Deploy in ~3 minutes (no command line)

1. Make a free account at <https://dash.cloudflare.com>.
2. Left menu → **Workers & Pages** → **Create** → **Create Worker**.
3. Give it a name, click **Deploy**, then **Edit code**.
4. Delete the sample code, paste the entire contents of **`worker.js`**, and
   click **Deploy** again.
5. Copy your worker URL (looks like `https://rpchat-image-proxy.<you>.workers.dev`).
6. In the app: **Settings → Image provider → Venice → Image proxy URL** →
   paste that URL → **Save**.

That's it. Image requests now go through the proxy and CORS is solved.

## Deploy with the command line (alternative)

```bash
cd proxy
npx wrangler login
npx wrangler deploy
```

## Using a different image API

The worker only forwards to the URL in the `TARGET` constant at the top of
`worker.js` (Venice by default). To use another keyed image API, change
`TARGET` to that API's image-generation endpoint and redeploy.
