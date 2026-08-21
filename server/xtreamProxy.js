const { Readable } = require('node:stream');
const { pipeline } = require('node:stream/promises');

const PROXY_PATH = '/api/xtream';
const REQUEST_TIMEOUT_MS = 30_000;
const PROXY_RESPONSE_HEADER = 'x-chuchplayer-xtream-proxy';

const buildProxyUrl = (targetUrl) => `${PROXY_PATH}?url=${encodeURIComponent(targetUrl)}`;

const parseProxyTarget = (requestUrl) => {
  try {
    const request = new URL(requestUrl, 'http://localhost');
    if (request.pathname !== PROXY_PATH) return null;
    const value = request.searchParams.get('url');
    if (!value) return null;
    const target = new URL(value);
    if (target.protocol !== 'http:' && target.protocol !== 'https:') return null;
    return target;
  } catch {
    return null;
  }
};

const isXtreamProxyRequest = (requestUrl = '') => {
  try {
    return new URL(requestUrl, 'http://localhost').pathname === PROXY_PATH;
  } catch {
    return false;
  }
};

const rewriteHlsManifest = (manifest, sourceUrl) => {
  const proxied = (value) => {
    if (!value || value.startsWith('data:')) return value;
    return buildProxyUrl(new URL(value, sourceUrl).toString());
  };

  return manifest
    .split(/\r?\n/)
    .map((line) => {
      if (!line) return line;
      if (line.startsWith('#')) {
        return line.replace(/URI="([^"]+)"/g, (_, uri) => `URI="${proxied(uri)}"`);
      }
      const leading = line.match(/^\s*/)?.[0] ?? '';
      const trailing = line.match(/\s*$/)?.[0] ?? '';
      return `${leading}${proxied(line.trim())}${trailing}`;
    })
    .join('\n');
};

const isHlsResponse = (target, contentType) =>
  target.pathname.toLowerCase().includes('.m3u8') || contentType.includes('mpegurl');

const sendJson = (res, status, body) => {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
    'cache-control': 'no-store',
    [PROXY_RESPONSE_HEADER]: '1',
    'x-content-type-options': 'nosniff',
  });
  res.end(payload);
};

const handleXtreamProxy = async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      allow: 'GET, HEAD, OPTIONS',
      [PROXY_RESPONSE_HEADER]: '1',
    });
    res.end();
    return;
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  const target = parseProxyTarget(req.url || '');
  if (!target) {
    sendJson(res, 400, { error: 'A valid HTTP or HTTPS target URL is required' });
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const headers = {};
    for (const name of ['accept', 'accept-language', 'range', 'user-agent']) {
      const value = req.headers[name];
      if (typeof value === 'string') headers[name] = value;
    }

    const upstream = await fetch(target, {
      method: req.method,
      headers,
      redirect: 'follow',
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
    const responseHeaders = {
      'content-type': contentType,
      [PROXY_RESPONSE_HEADER]: '1',
      'x-content-type-options': 'nosniff',
    };

    for (const name of ['accept-ranges', 'cache-control', 'content-range', 'etag', 'last-modified']) {
      const value = upstream.headers.get(name);
      if (value) responseHeaders[name] = value;
    }

    if (isHlsResponse(target, contentType) && req.method !== 'HEAD') {
      const manifest = rewriteHlsManifest(await upstream.text(), upstream.url || target.toString());
      responseHeaders['content-length'] = Buffer.byteLength(manifest);
      responseHeaders['cache-control'] = 'no-store';
      res.writeHead(upstream.status, responseHeaders);
      res.end(manifest);
      return;
    }

    const contentLength = upstream.headers.get('content-length');
    if (contentLength && !upstream.headers.get('content-encoding')) {
      responseHeaders['content-length'] = contentLength;
    }

    res.writeHead(upstream.status, responseHeaders);
    if (req.method === 'HEAD' || !upstream.body) {
      res.end();
      return;
    }

    await pipeline(Readable.fromWeb(upstream.body), res);
  } catch (error) {
    clearTimeout(timeout);
    if (res.headersSent) {
      res.destroy(error instanceof Error ? error : undefined);
      return;
    }
    sendJson(res, error?.name === 'AbortError' ? 504 : 502, {
      error: error?.name === 'AbortError' ? 'Upstream request timed out' : 'Upstream request failed',
    });
  }
};

const createXtreamProxyMiddleware = (next) => (req, res, nextCallback) => {
  if (!isXtreamProxyRequest(req.url)) return next(req, res, nextCallback);
  void handleXtreamProxy(req, res);
};

module.exports = {
  PROXY_PATH,
  buildProxyUrl,
  createXtreamProxyMiddleware,
  handleXtreamProxy,
  isXtreamProxyRequest,
  parseProxyTarget,
  rewriteHlsManifest,
};
