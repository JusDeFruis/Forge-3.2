import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { tokenUrlSafe } from './core/crypto';
import { writePrivateFile } from './core/secretFiles';

export const OVERLAY_KEYS: string[] = ['draft_backend', 'draft_model'];

const LEGACY_DIR: string = path.join(os.homedir(), '.forge-3');
let MIGRATED = false;

export function default_data_dir(version = '3.2'): string {
  if (process.platform === 'win32') {
    const roaming = process.env['APPDATA'];
    if (roaming) {
      return path.join(roaming, `Forge-${version}`);
    }
    return path.join(os.homedir(), 'AppData', 'Roaming', `Forge-${version}`);
  }
  const config_home = process.env['XDG_CONFIG_HOME'];
  if (config_home) {
    return path.join(config_home, `forge-${version}`);
  }
  return path.join(os.homedir(), '.config', `forge-${version}`);
}

/** the folders a 3.2 install inherits from, newest first: the 3.1 data
    directory (chats, keys, config, history) then the original ~/.forge-3 */
function legacy_dirs(): string[] {
  const out: string[] = [];
  const previous = default_data_dir('3.1');
  if (path.resolve(previous) !== path.resolve(default_data_dir())) {
    out.push(previous);
  }
  out.push(LEGACY_DIR);
  return out;
}

function copy_dir(from: string, to: string): void {
  if (!fs.existsSync(from)) {
    return;
  }
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.cpSync(from, to, { recursive: true, force: false, errorOnExist: false });
}

function migrate_legacy_dir(target: string): void {
  if (MIGRATED) {
    return;
  }
  MIGRATED = true;
  carry_over_legacy_data(target);
}

/** copy an older install's data (config, keys, chats, history, sandboxes)
    into the current folder the first time 3.2 runs — never overwriting a
    live install, never deleting the old folder.

    Every legacy folder is merged, not just the first one: `cpSync` is called
    with `force: false`, so a file that already exists in the new folder wins
    and everything missing is filled in. Bailing out as soon as a config.json
    was present used to leave the chats, the keys and the sandboxes behind. */
export function carry_over_legacy_data(target: string): void {
  try {
    let reported = false;
    for (const source of legacy_dirs()) {
      if (path.resolve(source) === path.resolve(target)) continue;
      if (!fs.existsSync(source)) continue;
      copy_dir(source, target);
      if (!reported && fs.existsSync(path.join(source, 'config.json'))) {
        console.error(`forge: carried your data over from ${source}`);
        reported = true;
      }
    }
  } catch (error) {
    console.error('forge: failed to migrate an older data folder', error);
  }
}

export function forge_dir(): string {
  const override = process.env['FORGE3_DIR'];
  if (override) {
    /* the override is a test/dev escape hatch — a relative value resolves
       against the working directory instead of landing who-knows-where */
    return path.isAbsolute(override) ? override : path.resolve(override);
  }
  const dir = default_data_dir();
  migrate_legacy_dir(dir);
  return dir;
}

export function forge_config(): string {
  return path.join(forge_dir(), 'config.json');
}

export function forge_chats(): string {
  return path.join(forge_dir(), 'chats');
}

export function history_key_path(): string {
  return path.join(forge_dir(), 'history.key');
}

export function history_secret(): string {
  const file = history_key_path();
  try {
    const existing = fs.readFileSync(file, 'utf8').trim();
    if (existing) {
      return existing;
    }
  } catch {
  }
  const secret = tokenUrlSafe(32);
  writePrivateFile(file, secret);
  return secret;
}

export function drawer_label(): string {
  let folder = forge_dir();
  if (folder === '~') {
    folder = os.homedir();
  } else if (folder.startsWith('~/') || folder.startsWith('~\\')) {
    folder = path.join(os.homedir(), folder.slice(2));
  }
  const relative = path.relative(path.resolve(os.homedir()), path.resolve(folder));
  const outside =
    relative === '..' ||
    relative.startsWith('..' + path.sep) ||
    path.isAbsolute(relative);
  if (outside) {
    return folder;
  }
  return '~/' + (relative === '' ? '.' : relative.split(path.sep).join('/'));
}

export function load_overlay(): Record<string, any> {
  let data: any;
  try {
    data = JSON.parse(fs.readFileSync(forge_config(), 'utf8'));
  } catch {
    return {};
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return {};
  }
  const overlay: Record<string, any> = {};
  for (const key of OVERLAY_KEYS) {
    if (key in data) {
      overlay[key] = data[key];
    }
  }
  return overlay;
}

export function save_overlay(cfg: Record<string, any>): void {
  const folder = forge_dir();
  fs.mkdirSync(folder, { recursive: true });
  const payload: Record<string, any> = {};
  try {
    const parsed = JSON.parse(fs.readFileSync(forge_config(), 'utf8'));
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      Object.assign(payload, parsed);
    }
  } catch {
  }
  for (const key of OVERLAY_KEYS) {
    if (key in cfg) {
      payload[key] = cfg[key];
    }
  }
  fs.writeFileSync(forge_config(), JSON.stringify(payload, null, 2) + '\n', 'utf8');
}