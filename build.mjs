import { build, context } from 'esbuild';
import { cp, mkdir, rm } from 'node:fs/promises';
import { existsSync, globSync } from 'node:fs';

const watch = process.argv.includes('--watch');

await rm('dist', { recursive: true, force: true });
await mkdir('dist/web', { recursive: true });

const nodeOptions = {
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  sourcemap: true,
  logLevel: 'info',
  packages: 'external',
};

const webOptions = {
  bundle: true,
  platform: 'browser',
  target: 'chrome120',
  format: 'iife',
  sourcemap: true,
  logLevel: 'info',
};

const testEntryPoints = globSync('tests/**/*.test.ts');

async function runBuild() {
  const jobs = [
    build({ ...nodeOptions, entryPoints: ['./src/main.ts'], outfile: 'dist/main.js' }),
    build({ ...webOptions, entryPoints: ['./web/app.ts'], outfile: 'dist/web/app.js' }),
  ];
  if (testEntryPoints.length) {
    jobs.push(build({ ...nodeOptions, entryPoints: testEntryPoints.map((f) => './' + f), outdir: 'dist/tests', outbase: 'tests' }));
  }
  await Promise.all(jobs);
}

if (watch) {
  const ctxMain = await context({ ...nodeOptions, entryPoints: ['./src/main.ts'], outfile: 'dist/main.js' });
  const ctxWeb = await context({ ...webOptions, entryPoints: ['./web/app.ts'], outfile: 'dist/web/app.js' });
  await Promise.all([ctxMain.watch(), ctxWeb.watch()]);
  console.log('watching…');
} else {
  await runBuild();
}

await cp('web/index.html', 'dist/web/index.html');
await cp('web/style.css', 'dist/web/style.css');
await cp('web/bridge.js', 'dist/web/bridge.js');
if (existsSync('web/forge-sword.svg')) await cp('web/forge-sword.svg', 'dist/web/forge-sword.svg');
console.log('build complete');
