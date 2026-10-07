/* The Windows entry point. `npm run pack:exe` builds exactly what it always
   built; cross-platform work lives in pack.mjs next to it. */
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const res = spawnSync(
  process.execPath,
  [path.join(HERE, 'pack.mjs'), '--target=win32-x64'],
  { stdio: 'inherit' },
);
process.exit(res.status ?? 1);
