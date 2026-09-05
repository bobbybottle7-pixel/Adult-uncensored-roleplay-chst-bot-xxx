/* Minimal free CORS proxy for keyed image APIs (Cloudflare Worker).
 *
 * Why: a browser-only app can't POST to some keyed image APIs (e.g. Venice)
 * because they don't send CORS headers, so the browser blocks the response.
 * This tiny worker sits in the middle: your app POSTs to the worker, the
 * worker forwards the request to the image API and returns the result WITH
 * CORS headers, so the browser accepts it.
 *
 * It only forwards to the allow-listed target below (not an open proxy), and
 * it passes your Authorization header straight through — your key is never
 * stored here. Deploy it free (see README.md), then paste the worker URL into
 * the app: Settings -> Image provider: Venice -> Image proxy URL.
 */

// The upstream image API this proxy is allowed to forward to.
const TARGET = 'https://api.venice.ai/api/v1/image/generate';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Max-Age': '86400',
};

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS });
    }
    if (request.method !== 'POST') {
      return new Response('Only POST is supported.', { status: 405, headers: CORS });
    }

    let upstream;
    try {
      upstream = await fetch(TARGET, {
        method: 'POST',
        headers: {
          'Authorization': request.headers.get('Authorization') || '',
          'Content-Type': 'application/json',
        },
        body: await request.text(),
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Upstream fetch failed: ' + e.message }),
        { status: 502, headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    const body = await upstream.arrayBuffer();
    const headers = new Headers(CORS);
    headers.set('Content-Type', upstream.headers.get('Content-Type') || 'application/json');
    return new Response(body, { status: upstream.status, headers });
  },
};
