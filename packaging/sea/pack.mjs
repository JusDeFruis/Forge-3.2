/* Cross-platform SEA packer for Forge 3.2.
 *
 * One runner per OS builds its own binary natively (GitHub Actions matrix):
 * the Node runtime is copied, the JS payload injected with postject, and the
 * platform webview library embedded as an asset. macOS binaries are ad-hoc
 * signed after injection, because postject breaks Apple's signature.
 *
 *   node packaging/sea/pack.mjs [--target win32-x64|linux-x64|darwin-arm64|darwin-x64]
 *
 * With no --target the host platform is used. `npm run pack:exe` keeps
 * building the Windows binary exactly as before.
 */
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
const POSTJECT = 'postject@1.0.0-alpha.6';

const TARGETS = {
  'win32-x64': {
    platform: 'win32',
    npm_pkg: '@webviewjs/webview-win32-x64-msvc',
    bin: 'Forge-3.2-windows-x64.exe',
  },
  'linux-x64': {
    platform: 'linux',
    npm_pkg: '@webviewjs/webview-linux-x64-gnu',
    bin: 'Forge-3.2-linux-x64',
  },
  'darwin-arm64': {
    platform: 'darwin',
    npm_pkg: '@webviewjs/webview-darwin-arm64',
    bin: 'Forge-3.2-macos-arm64',
  },
  'darwin-x64': {
    platform: 'darwin',
    npm_pkg: '@webviewjs/webview-darwin-x64',
    bin: 'Forge-3.2-macos-x64',
  },
};

function fail(message) {
  console.error(`[pack] ${message}`);
  process.exit(1);
}

function target_name() {
  const flag = process.argv.find((arg) => arg.startsWith('--target='));
  if (flag) return flag.slice('--target='.length);
  return `${process.platform}-${process.arch}`;
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

function find_native_lib(npm_pkg) {
  const dir = path.join(ROOT, 'node_modules', npm_pkg);
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
// GUI keeps the exact same binary but starts it windowless. Windows only.
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
  const name = target_name();
  const target = TARGETS[name];
  if (!target) fail(`unknown target ${name} (want one of ${Object.keys(TARGETS).join(', ')})`);
  if (target.platform !== process.platform) {
    fail(`target ${name} needs a ${target.platform} runner — refusing to cross-build`);
  }
  /* The SEA bundle targets node24: an older runtime cannot generate it, and
     failing late (at blob injection) wastes a full build. Say so up front. */
  const major = Number(String(process.versions.node || '').split('.')[0]);
  if (!Number.isFinite(major) || major < 24) {
    fail(`pack needs Node 24 or newer (running ${process.versions.node || 'unknown'})`);
  }
  const web_files = ['index.html', 'style.css', 'bridge.js', 'app.js', 'forge-sword.svg'];
  for (const file of web_files) {
    if (!fs.existsSync(path.join(DIST, 'web', file))) {
      fail(`dist/web/${file} is missing, run "npm run build" first`);
    }
  }
  const native = find_native_lib(target.npm_pkg);
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const version = String(pkg.version || '3.2.0');
  const EXE = path.join(RELEASE, target.bin);

  fs.mkdirSync(SEA_DIR, { recursive: true });
  fs.mkdirSync(RELEASE, { recursive: true });

  console.log(`[pack] bundling the executable payload for ${name}...`);
  await bundle();

  const assets = {};
  for (const file of web_files) {
    assets[`web/${file}`] = `dist/web/${file}`;
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

  console.log('[pack] generating the SEA blob...');
  execFileSync(process.execPath, ['--experimental-sea-config', config_path], {
    cwd: ROOT,
    stdio: 'inherit',
  });

  console.log('[pack] copying the node runtime...');
  fs.copyFileSync(process.execPath, EXE);

  if (target.platform === 'win32') {
    const icon = path.join(ROOT, 'forge.ico');
    if (fs.existsSync(icon)) {
      try {
        console.log('[pack] stamping icon and version info...');
        stamp_icon(EXE, icon, version);
      } catch (error) {
        console.log(`[pack] icon stamping skipped (${error.message || error})`);
        fs.copyFileSync(process.execPath, EXE);
      }
    }

    console.log('[pack] injecting the blob...');
    const fuse = find_fuse(process.execPath);
    execSync(
      `npx --yes ${POSTJECT} "${EXE}" NODE_SEA_BLOB "${path.join(SEA_DIR, 'blob.bin')}" ` +
        `--sentinel-fuse ${fuse} --overwrite`,
      { cwd: ROOT, stdio: 'inherit', shell: true },
    );

    const subsystem = set_gui_subsystem(EXE);
    console.log(`[pack] PE subsystem ${subsystem} (GUI) — the executable opens no console window`);
  } else {
    console.log('[pack] injecting the blob...');
    const fuse = find_fuse(process.execPath);
    execSync(
      `npx --yes ${POSTJECT} "${EXE}" NODE_SEA_BLOB "${path.join(SEA_DIR, 'blob.bin')}" ` +
        `--sentinel-fuse ${fuse} --overwrite`,
      { cwd: ROOT, stdio: 'inherit', shell: true },
    );
    fs.chmodSync(EXE, 0o755);
    if (target.platform === 'darwin') {
      /* postject rewrites the binary, which invalidates Apple's signature;
         an ad-hoc signature makes it launchable (Gatekeeper still asks on
         first download — that needs a paid Developer ID, which we don't have) */
      console.log('[pack] ad-hoc signing the macOS binary...');
      execFileSync('codesign', ['--force', '-s', '-', EXE], { stdio: 'inherit' });
    }
  }

  const size = fs.statSync(EXE).size;
  console.log(`[pack] done: ${EXE} (${(size / 1048576).toFixed(1)} MB)`);
  if (target.platform === 'win32') {
    console.log('[pack] note: Windows SmartScreen flags unsigned executables on first run.');
  }
  if (target.platform === 'linux') {
    console.log('[pack] note: needs a WebKitGTK runtime on the target machine (libwebkit2gtk).');
  }
}

main().catch((error) => fail(error && error.stack ? error.stack : String(error)));
