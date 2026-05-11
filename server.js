import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT) || 8080;
const distDir = path.join(__dirname, 'dist');
const indexHtml = path.join(distDir, 'index.html');

// Fail fast if the build output is missing — surfaces a real error in logs
// instead of silently serving index.html for everything.
if (!fs.existsSync(indexHtml)) {
  console.error(`[startup] FATAL: ${indexHtml} not found. Did 'npm run build' run?`);
  console.error(`[startup] dist contents:`, fs.existsSync(distDir) ? fs.readdirSync(distDir) : '(no dist dir)');
  process.exit(1);
}

const app = express();

app.get('/healthz', (_req, res) => res.status(200).send('ok'));

app.use(
  express.static(distDir, {
    maxAge: '1h',
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('index.html')) {
        res.setHeader('Cache-Control', 'no-cache');
      }
    },
  })
);

// SPA fallback — only for paths that look like routes, not for missing assets.
// If a request has a file extension other than .html and we got here, the
// asset is missing from dist/. Return 404 instead of index.html so the
// browser doesn't try to parse HTML as JS/CSS.
app.get('*', (req, res) => {
  const ext = path.extname(req.path);
  if (ext && ext !== '.html') {
    return res.status(404).type('text/plain').send(`Not found: ${req.path}`);
  }
  res.sendFile(indexHtml);
});

app.listen(port, () => {
  console.log(`WatchMate listening on :${port}`);
  console.log(`Serving ${distDir}`);
  console.log(`dist/ contents:`, fs.readdirSync(distDir));
});
