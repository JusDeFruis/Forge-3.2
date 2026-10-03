'use strict';

const fs = require('node:fs');
const Module = require('node:module').Module;
const os = require('node:os');
const path = require('node:path');

function native_lib_name() {
  const platform = process.platform;
  const arch = process.arch;
  if (platform === 'win32' && arch === 'x64') return 'webview.win32-x64-msvc.node';
  if (platform === 'win32' && arch === 'arm64') return 'webview.win32-arm64-msvc.node';
  if (platform === 'win32' && arch === 'ia32') return 'webview.win32-ia32-msvc.node';
  if (platform === 'darwin' && arch === 'arm64') return 'webview.darwin-arm64.node';
  if (platform === 'darwin' && arch === 'x64') return 'webview.darwin-x64.node';
  if (platform === 'linux' && arch === 'x64') return 'webview.linux-x64-gnu.node';
  if (platform === 'linux' && arch === 'arm64') return 'webview.linux-arm64-gnu.node';
  throw new Error(`unsupported platform for the FORGE 3.2 executable: ${platform}-${arch}`);
}

function bin_dir() {
  const local = process.env.LOCALAPPDATA;
  if (local) return path.join(local, 'Forge-3.2', 'bin');
  return path.join(os.tmpdir(), 'forge-3.2', 'bin');
}

function sea_bytes(name) {
  let sea = null;
  try {
    sea = require('node:sea');
  } catch (error) {
    void error;
    return null;
  }
  if (!sea || typeof sea.isSea !== 'function' || !sea.isSea()) return null;
  const data = sea.getAsset(name);
  if (data instanceof ArrayBuffer) return Buffer.from(data);
  if (typeof data === 'string') return Buffer.from(data, 'utf8');
  return null;
}

function prune(dir, keep) {
  let entries = [];
  try {
    entries = fs.readdirSync(dir);
  } catch (error) {
    void error;
    return;
  }
  for (const entry of entries) {
    if (entry === keep || entry === `${keep}.new`) continue;
    if (entry.startsWith('webview.') && entry.endsWith('.node')) {
      try {
        fs.unlinkSync(path.join(dir, entry));
      } catch (error) {
        void error;
      }
    }
  }
}

function materialize(name, bytes) {
  const dir = bin_dir();
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, name);
  try {
    const stat = fs.statSync(file);
    if (stat.isFile() && stat.size === bytes.length) return file;
  } catch (error) {
    void error;
  }
  const pending = `${file}.new`;
  fs.writeFileSync(pending, bytes);
  try {
    fs.renameSync(pending, file);
    prune(dir, name);
    return file;
  } catch (error) {
    void error;
  }
  const alt = path.join(dir, `webview.${process.pid}.node`);
  try {
    fs.renameSync(pending, alt);
    prune(dir, name);
    return alt;
  } catch (error) {
    void error;
    return file;
  }
}

function dlopen_file(file) {
  const holder = new Module('forge3-webview-native', null);
  holder.filename = file;
  holder.paths = [];
  process.dlopen(holder, file);
  return holder.exports;
}

function load_native() {
  const override = process.env.FORGE3_NATIVE || process.env.NAPI_RS_NATIVE_LIBRARY_PATH;
  if (override) {
    return dlopen_file(override);
  }
  const name = native_lib_name();
  const asset = sea_bytes(`native/${name}`);
  if (asset) {
    return dlopen_file(materialize(name, asset));
  }
  throw new Error(
    `FORGE 3.2 cannot start: the webview native library is missing (expected embedded asset native/${name}). ` +
      'Set FORGE3_NATIVE to a webview .node file or rebuild with packaging/sea/pack-exe.mjs.',
  );
}

module.exports = load_native();
