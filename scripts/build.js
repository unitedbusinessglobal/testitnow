import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'build');

mkdirSync(outDir, { recursive: true });

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex" />
    <title>TestItNow API</title>
    <style>
      body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; margin: 0; padding: 3rem 1.5rem; background: #0b1020; color: #e6e8ef; }
      main { max-width: 36rem; margin: 0 auto; }
      h1 { font-size: 1.75rem; margin: 0 0 0.5rem; }
      p { line-height: 1.6; color: #b6bdd1; }
      code { background: #161c33; padding: 0.15rem 0.4rem; border-radius: 4px; }
    </style>
  </head>
  <body>
    <main>
      <h1>TestItNow API</h1>
      <p>This deployment hosts the TestItNow backend. There is no public web UI here.</p>
      <p>Health check: <code>/api/health</code></p>
    </main>
  </body>
</html>
`;

writeFileSync(join(outDir, 'index.html'), html);

console.log('Build complete: wrote', outDir);
