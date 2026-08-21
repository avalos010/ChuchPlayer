const PROXY_PATH = '/api/xtream';

export const getXtreamProxyUrl = (targetUrl: string): string => {
  if (!targetUrl || targetUrl.startsWith(`${PROXY_PATH}?`)) return targetUrl;

  try {
    const target = new URL(targetUrl);
    if (target.protocol !== 'http:' && target.protocol !== 'https:') return targetUrl;
    return `${PROXY_PATH}?url=${encodeURIComponent(target.toString())}`;
  } catch {
    return targetUrl;
  }
};
