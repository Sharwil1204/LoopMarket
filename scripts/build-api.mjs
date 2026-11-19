import { build } from 'esbuild';
import { copyFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

// Clean up any remaining .ts files in api/ to prevent Vercel route collision
await rm(join(root, 'api/index.ts'), { force: true });
await rm(join(root, 'api/[...path].ts'), { force: true });

await build({
  entryPoints: [join(root, 'server/vercel-entry.ts')],
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  external: ['pg', '@vercel/blob'],
  outfile: join(root, 'api/index.js'),
});

await copyFile(join(root, 'api/index.js'), join(root, 'api/[...path].js'));
console.log('✓ API bundled successfully into api/index.js and api/[...path].js');
