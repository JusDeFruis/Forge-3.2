import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { write_zip, type ZipResult, type ZipSource } from './zip';

const IGNORED_DIRS = new Set([
  '.git',
  '.hg',
  '.svn',
  '.idea',
  '.vscode',
  '.cache',
  '.next',
  '.venv',
  '__pycache__',
  'bin',
  'build',
  'dist',
  'node_modules',
  'obj',
  'target',
  'venv',
]);

const MAX_LIST = 400;
const MAX_READ_BYTES = 48 * 1024;
const MAX_SCAN_FILES = 4000;
const MAX_SCAN_BYTES = 1024 * 1024;
const MAX_HITS = 80;
const MAX_ZIP_FILES = 2000;
const MAX_ZIP_BYTES = 192 * 1024 * 1024;
const MAX_ZIP_ENTRY_BYTES = 48 * 1024 * 1024;

export interface WorkspaceEntry {
  name: string;
  path: string;
  kind: 'dir' | 'file';
}

export interface WorkspaceRead {
  path: string;
  text: string;
  lines: number;
  offset: number;
  truncated: boolean;
}

export function expand_home(target: string): string {
  const raw = String(target ?? '').trim();
  if (raw === '~') return os.homedir();
  if (raw.startsWith('~/') || raw.startsWith('~\\')) return path.join(os.homedir(), raw.slice(2));
  return raw;
}

export function folder_exists(target: string): boolean {
  try {
    return fs.statSync(expand_home(target)).isDirectory();
  } catch {
    return false;
  }
}

/** compress a folder into out_file — shared by the agent tool and the
    delivery bundle, so both honour the same caps and ignore list */
export async function zip_directory(
  root: string,
  out_file: string,
  options: { include?: string[] } = {},
): Promise<ZipResult> {
  const base = path.resolve(root);
  const target = path.resolve(out_file);
  if (fs.existsSync(target)) fs.rmSync(target, { force: true });

  const list: ZipSource[] = [];
  let total = 0;
  const add = (file: string, name: string): void => {
    let stat: fs.Stats;
    try {
      stat = fs.statSync(file);
    } catch {
      return;
    }
    if (!stat.isFile()) return;
    if (path.resolve(file) === target) return;
    if (stat.size > MAX_ZIP_ENTRY_BYTES) return;
    if (total + stat.size > MAX_ZIP_BYTES) return;
    if (list.length >= MAX_ZIP_FILES) return;
    total += stat.size;
    list.push({ name, file, mtime: stat.mtime });
  };

  const walk = (folder: string, prefix: string): void => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(folder, { withFileTypes: true });
    } catch {
      return;
    }
    entries.sort((a, b) => (a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1));
    for (const entry of entries) {
      const full = path.join(folder, entry.name);
      const name = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        if (!IGNORED_DIRS.has(entry.name.toLowerCase())) walk(full, name);
        continue;
      }
      if (entry.isFile()) add(full, name);
    }
  };

  const inside = (candidate: string): boolean => {
    const rel = path.relative(base, path.resolve(candidate));
    return rel === '' || (!rel.startsWith('..' + path.sep) && rel !== '..' && !path.isAbsolute(rel));
  };

  const wanted = (options.include || []).map((item) => String(item ?? '').trim()).filter(Boolean);
  for (const item of wanted.length ? wanted : ['.']) {
    const start = path.resolve(base, item);
    if (!inside(start)) continue;
    let stat: fs.Stats;
    try {
      stat = fs.statSync(start);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      const prefix = path.relative(base, start).split(path.sep).join('/');
      walk(start, prefix);
    } else {
      add(start, path.relative(base, start).split(path.sep).join('/'));
    }
  }

  if (!list.length) throw new Error('nothing to compress — the folder is empty');
  await fs.promises.mkdir(path.dirname(target), { recursive: true });
  return write_zip(target, list);
}

export class Workspace {
  readonly root: string;

  constructor(root: string) {
    this.root = path.resolve(expand_home(String(root ?? '')));
  }

  static open(root: string): Workspace | null {
    const workspace = new Workspace(root);
    return folder_exists(workspace.root) ? workspace : null;
  }

  resolve(relative: string): string {
    const raw = expand_home(String(relative ?? '')).trim();
    const target = path.resolve(this.root, raw || '.');
    const rel = path.relative(this.root, target);
    const inside = rel === '' || (!rel.startsWith('..' + path.sep) && rel !== '..' && !path.isAbsolute(rel));
    if (!inside) {
      throw new Error(`path escapes the workspace: ${raw}`);
    }
    this.assert_real_inside(target, raw);
    return target;
  }

  /** refuse paths that leave the workspace through a symbolic link —
      including links on the way to a file that does not exist yet, so a
      write can never be smuggled out through a planted link */
  private assert_real_inside(target: string, raw: string): void {
    let root_real: string;
    try {
      root_real = fs.realpathSync(this.root);
    } catch {
      throw new Error(`workspace is gone: ${this.root}`);
    }
    const inside_real = (real: string): boolean => {
      const rel_real = path.relative(root_real, real);
      return (
        rel_real === '' ||
        (!rel_real.startsWith('..' + path.sep) && rel_real !== '..' && !path.isAbsolute(rel_real))
      );
    };
    let cursor = target;
    for (;;) {
      let real: string;
      try {
        real = fs.realpathSync(cursor);
      } catch {
        const parent = path.dirname(cursor);
        if (parent === cursor) throw new Error(`path escapes the workspace: ${raw}`);
        cursor = parent;
        continue;
      }
      if (!inside_real(real)) throw new Error(`path escapes the workspace: ${raw}`);
      return;
    }
  }

  rel(target: string): string {
    const relative = path.relative(this.root, target);
    if (!relative) return '.';
    return relative.split(path.sep).join('/');
  }

  list(relative = '.'): WorkspaceEntry[] {
    const target = this.resolve(relative);
    const stat = fs.statSync(target);
    if (!stat.isDirectory()) throw new Error(`not a folder: ${this.rel(target)}`);
    const entries: WorkspaceEntry[] = [];
    for (const item of fs.readdirSync(target, { withFileTypes: true })) {
      if (entries.length >= MAX_LIST) break;
      /* symlinks resolve to what they point at; broken ones keep their listing shape */
      let kind: 'dir' | 'file';
      try {
        kind = fs.statSync(path.join(target, item.name)).isDirectory() ? 'dir' : 'file';
      } catch {
        kind = item.isDirectory() ? 'dir' : 'file';
      }
      entries.push({ name: item.name, path: this.rel(path.join(target, item.name)), kind });
    }
    entries.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'dir' ? -1 : 1;
      return a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1;
    });
    return entries;
  }

  read(relative: string, offset = 1, limit = 400): WorkspaceRead {
    const target = this.resolve(relative);
    const stat = fs.statSync(target);
    if (!stat.isFile()) throw new Error(`not a file: ${this.rel(target)}`);
    const wanted = Math.max(1, Math.trunc(Number(limit) || 400));
    const start = Math.max(1, Math.trunc(Number(offset) || 1));
    const handle = fs.openSync(target, 'r');
    let buffer: Buffer;
    try {
      const size = Math.min(stat.size, MAX_READ_BYTES);
      buffer = Buffer.alloc(size);
      const read = fs.readSync(handle, buffer, 0, size, 0);
      buffer = buffer.subarray(0, read);
    } finally {
      fs.closeSync(handle);
    }
    const truncated = stat.size > MAX_READ_BYTES;
    const all = buffer.toString('utf8').replace(/\r\n/g, '\n').split('\n');
    const slice = all.slice(start - 1, start - 1 + wanted);
    const width = String(Math.min(all.length, start + slice.length)).length;
    const text = slice
      .map((line, index) => `${String(start + index).padStart(width, ' ')}| ${line}`)
      .join('\n');
    return {
      path: this.rel(target),
      text,
      lines: all.length,
      offset: start,
      truncated: truncated || start + slice.length < all.length,
    };
  }

  write(relative: string, content: string): string {
    const target = this.resolve(relative);
    const parent = path.dirname(target);
    fs.mkdirSync(parent, { recursive: true });
    const body = String(content ?? '');
    fs.writeFileSync(target, body, 'utf8');
    const lines = body ? body.replace(/\r\n/g, '\n').split('\n').length : 0;
    return `wrote ${this.rel(target)} (${Buffer.byteLength(body, 'utf8')} bytes, ${lines} lines)`;
  }

  replace(relative: string, old_text: string, new_text: string, replace_all = false): string {
    const target = this.resolve(relative);
    const before = fs.readFileSync(target, 'utf8');
    const needle = String(old_text ?? '');
    if (!needle) throw new Error('old_text is empty');
    const count = before.split(needle).length - 1;
    if (!count) throw new Error(`old_text not found in ${this.rel(target)}`);
    if (count > 1 && !replace_all) {
      throw new Error(`old_text matches ${count} times in ${this.rel(target)} — add context or set replace_all`);
    }
    const after = replace_all ? before.split(needle).join(String(new_text ?? '')) : before.replace(needle, String(new_text ?? ''));
    fs.writeFileSync(target, after, 'utf8');
    return `replaced ${count} in ${this.rel(target)}`;
  }

  search(query: string, relative = '.'): string {
    const needle = String(query ?? '').toLowerCase();
    if (!needle) throw new Error('query is empty');
    const root = this.resolve(relative);
    const hits: string[] = [];
    let scanned = 0;
    const walk = (folder: string): void => {
      if (hits.length >= MAX_HITS || scanned >= MAX_SCAN_FILES) return;
      let items: fs.Dirent[];
      try {
        items = fs.readdirSync(folder, { withFileTypes: true });
      } catch {
        return;
      }
      items.sort((a, b) => (a.isDirectory() === b.isDirectory() ? 0 : a.isDirectory() ? -1 : 1));
      for (const item of items) {
        if (hits.length >= MAX_HITS || scanned >= MAX_SCAN_FILES) return;
        const full = path.join(folder, item.name);
        if (item.isDirectory()) {
          if (IGNORED_DIRS.has(item.name.toLowerCase())) continue;
          walk(full);
          continue;
        }
        if (!item.isFile()) continue;
        scanned += 1;
        let stat: fs.Stats;
        try {
          stat = fs.statSync(full);
        } catch {
          continue;
        }
        if (stat.size > MAX_SCAN_BYTES) continue;
        let body: string;
        try {
          body = fs.readFileSync(full, 'utf8');
        } catch {
          continue;
        }
        if (body.includes('\u0000')) continue;
        const lines = body.split('\n');
        for (let index = 0; index < lines.length; index += 1) {
          if (hits.length >= MAX_HITS) break;
          if (lines[index].toLowerCase().includes(needle)) {
            hits.push(`${this.rel(full)}:${index + 1}: ${lines[index].trim().slice(0, 240)}`);
          }
        }
      }
    };
    const stat = fs.statSync(root);
    if (stat.isFile()) {
      return search_file(root, needle, this.rel(root));
    }
    walk(root);
    if (!hits.length) return `no matches for "${query}" (${scanned} files scanned)`;
    const more = hits.length >= MAX_HITS ? `\n… stopped at ${MAX_HITS} matches` : '';
    return `${hits.length} match(es):\n${hits.join('\n')}${more}`;
  }

  /** bundle workspace files into a real .zip the user can download —
      the model can hand over a whole project instead of pasting it */
  async zip(output: string, sources: string[]): Promise<ZipResult & { name: string }> {
    const wanted = (Array.isArray(sources) ? sources : [])
      .map((entry) => String(entry ?? '').trim())
      .filter(Boolean);
    let target = this.resolve(String(output ?? '').trim() || 'forge-output.zip');
    if (!/\.zip$/i.test(target)) target = `${target}.zip`;
    const result = await zip_directory(this.root, target, { include: wanted });
    return { ...result, name: this.rel(target) };
  }

  summary(limit = 60): string {
    let entries: WorkspaceEntry[] = [];
    try {
      entries = this.list('.');
    } catch (error) {
      return `root: ${this.root}\n${error instanceof Error ? error.message : String(error)}`;
    }
    const shown = entries.slice(0, limit).map((entry) => `${entry.kind === 'dir' ? '/' : ''}${entry.name}`);
    const rest = entries.length > shown.length ? `\n… ${entries.length - shown.length} more` : '';
    return `root: ${this.root}\n${shown.join('\n')}${rest}`;
  }
}

function search_file(target: string, needle: string, label: string): string {
  const body = fs.readFileSync(target, 'utf8');
  const hits: string[] = [];
  const lines = body.split('\n');
  for (let index = 0; index < lines.length && hits.length < MAX_HITS; index += 1) {
    if (lines[index].toLowerCase().includes(needle)) {
      hits.push(`${label}:${index + 1}: ${lines[index].trim().slice(0, 240)}`);
    }
  }
  if (!hits.length) return `no matches for "${needle}" in ${label}`;
  return `${hits.length} match(es) in ${label}:\n${hits.join('\n')}`;
}
