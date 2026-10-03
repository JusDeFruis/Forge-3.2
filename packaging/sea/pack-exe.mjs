import { execFileSync, execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const DIST = path.join(ROOT, 'dist');
const SEA_DIR = path.join(DIST, 'sea');
const RELEASE = path.join(ROOT, 'release');
const EXE_NAME = 'Forge-3.2-windows-x64.exe';
const EXE = path.join(RELEASE, EXE_NAME);
const POSTJECT = 'postject@1.0.0-alpha.6';

function fail(message) {
  console.error(`[pack-exe] ${message}`);
  process.exit(1);
}

function ensure_rcedit() {
  const dir = path.join(HERE, 'tools', 'rcedit');
  const exe = path.join(dir, 'package', 'bin', 'rcedit-x64.exe');
  if (fs.existsSync(exe)) return exe;
  fs.mkdirSync(dir, { recursive: true });
  execSync('npm pack rcedit@5.0.2', { cwd: dir, stdio: 'pipe' });
  const packed = fs.readdirSync(dir).find((name) => name.endsWith('.tgz'));
  if (!packed) throw new Error('rcedit package download failed');
  execSync(`tar -xzf "${packed}"`, { cwd: dir, stdio: 'pipe', shell: true });
  if (!fs.existsSync(exe)) throw new Error('rcedit binary not found in package');
  return exe;
}

function stamp_icon(exe_path, icon, version) {
  const rcedit = ensure_rcedit();
  execFileSync(
    rcedit,
    [
      exe_path,
      '--set-icon', icon,
      '--set-file-version', version,
      '--set-product-version', version,
      '--set-version-string', 'CompanyName', 'twaai',
      '--set-version-string', 'FileDescription', 'FORGE 3.2',
      '--set-version-string', 'ProductName', 'FORGE 3.2',
    ],
    { stdio: 'ignore', timeout: 60000, killSignal: 'SIGKILL' },
  );
}

function find_native_lib() {
  const dir = path.join(ROOT, 'node_modules', '@webviewjs', 'webview-win32-x64-msvc');
  let entries = [];
  try {
    entries = fs.readdirSync(dir);
  } catch {
    fail(`native webview package missing at ${dir} (run npm install first)`);
  }
  const file = entries.find((name) => name.endsWith('.node'));
  if (!file) fail(`no .node library inside ${dir}`);
  return { name: file, file: path.join(dir, file) };
}

// node.exe ships as a console-subsystem binary, so a plain copy of it pops a
// black terminal window next to the app window. Flipping the PE subsystem to
// GUI keeps the exact same binary but starts it windowless.
function set_gui_subsystem(exe_path) {
  const fd = fs.openSync(exe_path, 'r+');
  try {
    const dos = Buffer.alloc(64);
    if (fs.readSync(fd, dos, 0, 64, 0) < 64) throw new Error('truncated DOS header');
    if (dos.toString('latin1', 0, 2) !== 'MZ') throw new Error('missing DOS header');
    const pe_offset = dos.readUInt32LE(0x3c);
    const signature = Buffer.alloc(4);
    if (fs.readSync(fd, signature, 0, 4, pe_offset) < 4) throw new Error('truncated PE header');
    if (signature.toString('latin1') !== 'PE\0\0') throw new Error('missing PE signature');
    const subsystem_offset = pe_offset + 4 + 20 + 68;
    const current = Buffer.alloc(2);
    fs.readSync(fd, current, 0, 2, subsystem_offset);
    const subsystem = current.readUInt16LE(0);
    if (subsystem !== 2) {
      const next = Buffer.alloc(2);
      next.writeUInt16LE(2, 0);
      fs.writeSync(fd, next, 0, 2, subsystem_offset);
    }
    return 2;
  } finally {
    fs.closeSync(fd);
  }
}

function find_fuse(node_binary) {
  const bytes = fs.readFileSync(node_binary);
  const text = bytes.toString('latin1');
  const matches = text.match(/NODE_SEA_FUSE_[0-9a-f]+/g) || [];
  const found = matches.find((value) => value.length > 'NODE_SEA_FUSE_'.length + 8);
  if (!found) fail('could not locate the NODE_SEA_FUSE sentinel inside the node binary');
  return found;
}

const BERLIN = {
  name: 'webview-bindings',
  setup(builder) {
    builder.onResolve({ filter: /^\.\/js-bindings\.js$/ }, (args) => {
      const resolved = args.resolveDir.replace(/\\/g, '/');
      if (resolved.endsWith('@webviewjs/webview')) {
        return { path: path.join(HERE, 'webview-bindings.cjs') };
      }
      return undefined;
    });
  },
};

async function bundle() {
  const outfile = path.join(SEA_DIR, 'app.cjs');
  await build({
    bundle: true,
    platform: 'node',
    target: 'node24',
    format: 'cjs',
    entryPoints: [path.join(ROOT, 'src', 'main.ts')],
    outfile,
    logLevel: 'warning',
    logOverride: { 'empty-import-meta': 'silent' },
    plugins: [BERLIN],
  });
  return outfile;
}

async function main() {
  if (process.platform !== 'win32' || process.arch !== 'x64') {
    fail('pack-exe.mjs targets Windows x64 only on this machine');
  }
  const web_files = ['index.html', 'style.css', 'bridge.js', 'app.js', 'forge-sword.svg'];
  for (const name of web_files) {
    if (!fs.existsSync(path.join(DIST, 'web', name))) {
      fail(`dist/web/${name} is missing, run "npm run build" first`);
    }
  }
  const native = find_native_lib();
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const version = String(pkg.version || '3.2.0');

  fs.mkdirSync(SEA_DIR, { recursive: true });
  fs.mkdirSync(RELEASE, { recursive: true });

  console.log('[pack-exe] bundling the executable payload...');
  await bundle();

  const assets = {};
  for (const name of web_files) {
    assets[`web/${name}`] = `dist/web/${name}`;
  }
  assets[`native/${native.name}`] = path
    .relative(ROOT, native.file)
    .split(path.sep)
    .join('/');

  const config = {
    main: 'dist/sea/app.cjs',
    output: 'dist/sea/blob.bin',
    disableExperimentalSEAWarning: true,
    useCodeCache: false,
    useSnapshot: false,
    assets,
  };
  const config_path = path.join(SEA_DIR, 'sea-config.json');
  fs.writeFileSync(config_path, JSON.stringify(config, null, 2));

  console.log('[pack-exe] generating the SEA blob...');
  execFileSync(process.execPath, ['--experimental-sea-config', config_path], {
    cwd: ROOT,
    stdio: 'inherit',
  });

  console.log('[pack-exe] copying the node runtime...');
  fs.copyFileSync(process.execPath, EXE);

  const icon = path.join(ROOT, 'forge.ico');
  if (fs.existsSync(icon)) {
    try {
      console.log('[pack-exe] stamping icon and version info...');
      stamp_icon(EXE, icon, version);
    } catch (error) {
      console.log(`[pack-exe] icon stamping skipped (${error.message || error})`);
      fs.copyFileSync(process.execPath, EXE);
    }
  }

  console.log('[pack-exe] injecting the blob...');
  const fuse = find_fuse(process.execPath);
  execSync(
    `npx --yes ${POSTJECT} "${EXE}" NODE_SEA_BLOB "${path.join(SEA_DIR, 'blob.bin')}" ` +
      `--sentinel-fuse ${fuse} --overwrite`,
    { cwd: ROOT, stdio: 'inherit', shell: true },
  );

  const subsystem = set_gui_subsystem(EXE);
  console.log(`[pack-exe] PE subsystem ${subsystem} (GUI) — the executable opens no console window`);

  const size = fs.statSync(EXE).size;
  console.log(`[pack-exe] done: ${EXE} (${(size / 1048576).toFixed(1)} MB)`);
  console.log('[pack-exe] note: Windows SmartScreen flags unsigned executables on first run.');
}

main().catch((error) => fail(error && error.stack ? error.stack : String(error)));
