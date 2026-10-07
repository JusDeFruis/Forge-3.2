import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { FORGE_PROFILE } from '../src/core/publicDefaults.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const read_source = (...parts: string[]): string => fs.readFileSync(path.join(ROOT, ...parts), 'utf8');

test('source shell uses package web', () => {
  const found = path.join(ROOT, 'web', 'index.html');
  assert.ok(fs.statSync(found).isFile());
});

test('frozen shell uses meipass forge3 web', () => {
  const found = path.join(ROOT, 'dist', 'web', 'index.html');
  assert.ok(fs.statSync(found).isFile());
});

test('forge prompt assets are encoded at rest', () => {
  const sealed = read_source('src', 'core', 'prompts', 'sealedPrompts.ts');
  const strength = read_source('src', 'strength.ts');
  assert.ok(!sealed.includes('You are Forge'));
  assert.ok(!sealed.includes('You are FORGE'));
  assert.ok(!strength.includes('FORGE_3_PROFILE = """'));
  assert.ok(FORGE_PROFILE.length > 300);
});

test('distribution uses only forge branding', () => {
  const retired = 'ob' + 'sidian';
  const extensions = new Set(['.ts', '.js', '.mjs', '.html', '.css', '.md', '.bat', '.sh']);
  const skip = new Set(['node_modules', 'dist', 'forge3']);
  const walk = (dir: string): string[] => {
    const found: string[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (skip.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        found.push(...walk(full));
      } else if (entry.isFile() && extensions.has(path.extname(entry.name))) {
        found.push(full);
      }
    }
    return found;
  };
  const files: string[] = [];
  for (const dir of ['src', 'web', 'tests']) {
    files.push(...walk(path.join(ROOT, dir)));
  }
  for (const name of ['build.mjs', 'README.md', 'forge.bat', 'forge.sh']) {
    files.push(path.join(ROOT, name));
  }
  for (const file of files) {
    assert.ok(!fs.readFileSync(file, 'utf8').toLowerCase().includes(retired), file);
  }
});

test('windows launcher bootstraps or downloads', () => {
  const launcher = read_source('forge.bat');
  assert.ok(launcher.includes('where node.exe'));
  assert.ok(launcher.includes('LSS 20'));
  assert.ok(launcher.includes('npm install'));
  assert.ok(launcher.includes('npm run build'));
  assert.ok(launcher.includes('dist\\main.js'));
  assert.ok(launcher.includes('--setup-only'));
  assert.ok(!launcher.includes('Forge-3.0'));
  assert.ok(!launcher.includes('-m venv'));
});

test('readme lists forge32 release assets', () => {
  const readme = read_source('README.md');
  for (const asset of [
    'Forge-3.2-windows-x64.exe',
    'Forge-3.2-linux-x64',
    'Forge-3.2-macos-arm64',
    'Forge-3.2-macos-x64',
  ]) {
    assert.ok(readme.includes(asset));
  }
});

test('every screenshot the readme shows exists and is in english', () => {
  const readme = read_source('README.md');
  const shown = [...readme.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)].map((match) => match[1]);
  assert.ok(shown.length >= 2, `the readme shows the app: ${shown.length} image(s)`);
  for (const reference of shown) {
    const file = path.join(ROOT, reference);
    assert.ok(fs.existsSync(file), `the readme references a missing file: ${reference}`);
    assert.ok(fs.statSync(file).size > 5000, `${reference} looks empty`);
  }
  /* the interface is English: a French capture on the front page is a bug */
  for (const reference of shown) {
    assert.ok(reference.includes('forge-3-2'), `${reference} is a current capture`);
  }
});

test('api key settings list scrolls', () => {
  const stylesheet = read_source('web', 'style.css');
  const keylist = stylesheet.split('.keylist {')[1].split('}')[0];
  assert.ok(keylist.includes('overflow-y: auto'));
  assert.ok(keylist.includes('max-height:'));
  assert.ok(keylist.includes('scrollbar-width: thin'));
  for (const pseudo of ['::-webkit-scrollbar', '::-webkit-scrollbar-track', '::-webkit-scrollbar-thumb']) {
    assert.ok(stylesheet.includes(`.keylist${pseudo}`));
  }
});

test('node build sanity', () => {
  const pkg = JSON.parse(read_source('package.json'));
  assert.ok(pkg['scripts']['build']);
  assert.ok(pkg['scripts']['typecheck']);
  assert.ok(pkg['scripts']['test']);
  assert.ok(pkg['scripts']['start']);
  const build = read_source('build.mjs');
  assert.ok(build.includes("cp('web/index.html', 'dist/web/index.html')"));
  assert.ok(build.includes("cp('web/style.css', 'dist/web/style.css')"));
  assert.ok(build.includes("cp('web/bridge.js', 'dist/web/bridge.js')"));
  assert.ok(fs.statSync(path.join(ROOT, 'dist', 'web', 'app.js')).isFile());
});

test('forge bridge is not lites', () => {
  const bridge = read_source('src', 'bridge.ts');
  assert.ok(bridge.includes('class Api'));
  const shell = read_source('dist', 'web', 'app.js');
  assert.ok(shell.includes('forge3Event'));
  assert.ok(!shell.includes('assistantLiteEvent'));
  assert.ok(shell.includes('bindScroller'));
  assert.ok(shell.includes('scrollThreadBy'));
  const html = read_source('web', 'index.html');
  assert.ok(html.includes('id="forgeSword"'));
  assert.ok(!html.includes('M52.8 24.84'));
  assert.ok(!html.includes('assistantSweep'));
  assert.ok(!shell.includes('M52.8 24.84'));
  assert.ok(shell.includes('#forgeSword'));
  assert.ok(html.includes('will not leave that job'));
  assert.ok(html.includes('Compile, review, or revise a prompt'));
  assert.ok(html.includes('New chat'));
  assert.ok(html.includes('Search saved chats'));
  assert.ok(shell.includes('sessionTurns'));
  assert.ok(shell.includes('payload.draft'));
  assert.ok(shell.includes('saved chats land here after you send'));
});

test('the shipped window and the shell stay console-free', () => {
  const pack = read_source('packaging', 'sea', 'pack-exe.mjs');
  assert.ok(pack.includes('function set_gui_subsystem'));
  assert.ok(pack.includes('next.writeUInt16LE(2, 0)'));
  assert.ok(pack.includes('subsystem_offset = pe_offset + 4 + 20 + 68'));
  const shell = read_source('src', 'agent', 'shell.ts');
  assert.ok(shell.includes('windowsHide: true'));
  assert.ok(shell.includes("'-WindowStyle', 'Hidden'"));
  assert.ok(!shell.includes('detached: true'));
  const exe = path.join(ROOT, 'release', 'Forge-3.2-windows-x64.exe');
  if (!fs.existsSync(exe)) return;
  const handle = fs.openSync(exe, 'r');
  try {
    const dos = Buffer.alloc(64);
    fs.readSync(handle, dos, 0, 64, 0);
    assert.strictEqual(dos.toString('latin1', 0, 2), 'MZ');
    const pe_offset = dos.readUInt32LE(0x3c);
    const subsystem = Buffer.alloc(2);
    fs.readSync(handle, subsystem, 0, 2, pe_offset + 4 + 20 + 68);
    assert.strictEqual(subsystem.readUInt16LE(0), 2, 'release exe must be GUI subsystem');
  } finally {
    fs.closeSync(handle);
  }
});
