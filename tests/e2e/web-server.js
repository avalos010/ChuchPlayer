const { createServer } = require('node:http');
const { spawnSync } = require('node:child_process');
const { existsSync, createReadStream, statSync } = require('node:fs');
const { join, extname } = require('node:path');
const { tmpdir } = require('node:os');

const port = Number(process.argv[2] || process.env.E2E_PORT || 19006);
const expoPublicE2E = process.env.EXPO_PUBLIC_E2E ?? '1';
const outputDir = join(tmpdir(), expoPublicE2E === '1' ? 'chuchplayer-e2e-web' : 'chuchplayer-live-e2e-web');

const exportResult = spawnSync(
  'pnpm',
  ['exec', 'expo', 'export', '--platform', 'web', '--output-dir', outputDir],
  {
    cwd: join(__dirname, '..', '..'),
    env: { ...process.env, EXPO_PUBLIC_E2E: expoPublicE2E },
    stdio: 'inherit',
  },
);

if (exportResult.status !== 0) {
  process.exit(exportResult.status ?? 1);
}

const contentTypes = {
  '.css': 'text/css',
  '.html': 'text/html',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

const resolveFile = (url) => {
  const pathname = decodeURIComponent(new URL(url, `http://127.0.0.1:${port}`).pathname);
  const directPath = join(outputDir, pathname);

  if (existsSync(directPath) && statSync(directPath).isFile()) {
    return directPath;
  }

  return join(outputDir, 'index.html');
};

createServer((req, res) => {
  const filePath = resolveFile(req.url || '/');
  const type = contentTypes[extname(filePath)] || 'application/octet-stream';

  res.writeHead(200, { 'content-type': type });
  createReadStream(filePath).pipe(res);
}).listen(port, '127.0.0.1', () => {
  console.log(`E2E web server listening on http://127.0.0.1:${port}`);
});
