import { randomBytes, randomUUID } from 'node:crypto';
import {
  appendFileSync,
  existsSync,
  readFileSync,
  statSync,
  unlinkSync,
} from 'node:fs';
import { basename, extname, join } from 'node:path';

import { CryptoError, deriveFernetKey, fernetDecrypt, fernetEncrypt } from './core/crypto';
import { restrictPrivateDir, writePrivateFile } from './core/secretFiles';
import type { SessionRow } from './core/types';

export const _MAGIC = 'FORGE3-HISTORY-1';
export const _ITERATIONS = 600_000;

export class HistoryError extends Error {}

export function _plain(text: any): string {
  let source: string;
  if (text === null || text === undefined || text === false || text === 0 || text === '') {
    source = '';
  } else if (Array.isArray(text)) {
    source = text.length === 0 ? '' : String(text);
  } else if (typeof text === 'object') {
    source = Object.keys(text).length === 0 ? '' : String(text);
  } else {
    source = String(text);
  }
  return source
    .split(/\s+/)
    .filter((piece) => piece !== '')
    .join(' ');
}

export function _primary_turns(payload: Record<string, any>): any[] {
  const chat = payload['chat'] || [];
  if (Array.isArray(chat) && chat.length > 0) {
    return chat;
  }
  const draft = payload['draft'] || [];
  return Array.isArray(draft) ? draft : [];
}

export function _first_user_title(turns: any[]): string {
  for (const item of turns) {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) continue;
    if (String(item['role'] || '') !== 'user') continue;
    const text = _plain(item['content']);
    if (text) {
      return Array.from(text).slice(0, 60).join('');
    }
  }
  return '';
}

export function _preview_text(turns: any[]): string {
  for (let index = turns.length - 1; index >= 0; index -= 1) {
    const item = turns[index];
    if (typeof item !== 'object' || item === null || Array.isArray(item)) continue;
    const text = _plain(item['content']);
    if (text) {
      return Array.from(text).slice(0, 160).join('');
    }
  }
  return '';
}

export class EncryptedHistoryStore {
  directory: string;
  private _passphrase: string;
  private _index_path: string;
  private _key_cache = new Map<string, string>();

  constructor(directory: string, passphrase: string) {
    if (!passphrase) {
      throw new HistoryError('history requires a non-empty vault passphrase');
    }
    this.directory = directory;
    restrictPrivateDir(directory);
    this._passphrase = passphrase;
    this._index_path = join(directory, 'index.forge3');
    if (!existsSync(this._index_path)) {
      this._write_encrypted(this._index_path, { version: 1, sessions: [] });
    } else {
      this._read_index();
    }
  }

  private _derive(salt: Buffer): string {
    const salt_id = salt.toString('base64');
    const cached = this._key_cache.get(salt_id);
    if (cached) return cached;
    const key = deriveFernetKey(this._passphrase, salt);
    if (this._key_cache.size > 64) this._key_cache.clear();
    this._key_cache.set(salt_id, key);
    return key;
  }

  private _encode(payload: Record<string, any>): string {
    /* a fresh salt per file — reusing one salt process-wide would derive
       the same key for every history file until restart */
    const salt = randomBytes(16);
    const token = fernetEncrypt(Buffer.from(JSON.stringify(payload), 'utf8'), this._derive(salt));
    return [_MAGIC, salt.toString('base64'), token].join('\n');
  }

  private _decode(raw: string): Record<string, any> {
    try {
      const lines = raw.trim().split(/\r?\n|\r/);
      if (lines.length < 3) {
        throw new HistoryError('conversation history is corrupt');
      }
      const magic = lines[0];
      const encoded_salt = lines[1];
      const token = lines[2];
      if (magic !== _MAGIC) {
        throw new HistoryError('unsupported history format');
      }
      const cleaned = encoded_salt.replace(/[^A-Za-z0-9+/=]/g, '');
      const pad_at = cleaned.indexOf('=');
      const data_part = pad_at === -1 ? cleaned : cleaned.slice(0, pad_at);
      const pad_part = pad_at === -1 ? '' : cleaned.slice(pad_at);
      const aligned = /^=*$/.test(pad_part);
      const remainder = data_part.length % 4;
      if (!aligned || (remainder !== 0 && !(remainder === 2 && pad_part.length === 2))) {
        throw new HistoryError('conversation history is corrupt');
      }
      const salt = Buffer.from(cleaned, 'base64');
      const clear = fernetDecrypt(token, this._derive(salt));
      const value = JSON.parse(clear.toString('utf8'));
      if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        throw new HistoryError('history payload is not an object');
      }
      return value as Record<string, any>;
    } catch (err) {
      if (err instanceof HistoryError) throw err;
      if (err instanceof CryptoError) {
        throw new HistoryError('wrong vault passphrase for conversation history');
      }
      throw new HistoryError('conversation history is corrupt');
    }
  }

  private _write_encrypted(path: string, payload: Record<string, any>): void {
    /* private from the first byte: history holds ciphertext, but file names
       and sizes alone help an offline brute-force */
    writePrivateFile(path, this._encode(payload));
  }

  private _read_encrypted(path: string): Record<string, any> {
    let present = false;
    try {
      present = statSync(path).isFile();
    } catch {
      present = false;
    }
    if (!present) {
      throw new HistoryError(`conversation does not exist: ${basename(path, extname(path))}`);
    }
    return this._decode(readFileSync(path, 'utf8'));
  }

  private _read_index(): Record<string, any> {
    const value = this._read_encrypted(this._index_path);
    if (!('version' in value)) value['version'] = 1;
    if (!('sessions' in value)) value['sessions'] = [];
    return value;
  }

  private _write_index(value: Record<string, any>): void {
    this._write_encrypted(this._index_path, value);
  }

  private _path(session_id: string): string {
    const safe = session_id.replace(/[^A-Za-z0-9_-]/g, '');
    if (!safe || safe !== session_id) {
      throw new HistoryError('invalid conversation id');
    }
    return join(this.directory, `${safe}.forge3`);
  }

  list_sessions(): SessionRow[] {
    const sessions = [...(this._read_index()['sessions'] as any[])];
    sessions.sort(
      (a, b) => Number(b['updated_at'] ?? 0) - Number(a['updated_at'] ?? 0),
    );
    return sessions as SessionRow[];
  }

  create_session(title: string = 'New chat'): string {
    const session_id = randomUUID().replace(/-/g, '');
    const now = Date.now() / 1000;
    const payload: Record<string, any> = {
      version: 1,
      id: session_id,
      title: title.trim() || 'New chat',
      created_at: now,
      updated_at: now,
      chat: [],
      draft: [],
      anvil: [],
      anvil_reports: [],
      last_draft: null,
      last_goal: null,
      draft_version: 0,
    };
    this._write_encrypted(this._path(session_id), payload);
    const index = this._read_index();
    (index['sessions'] as any[]).push(this._metadata(payload));
    this._write_index(index);
    return session_id;
  }

  private _metadata(payload: Record<string, any>): SessionRow {
    const turns = _primary_turns(payload);
    return {
      id: payload['id'],
      title: payload['title'] || 'New chat',
      created_at: Number(payload['created_at'] ?? Date.now() / 1000),
      updated_at: Number(payload['updated_at'] ?? Date.now() / 1000),
      message_count: turns.length,
      preview: _preview_text(turns),
      workspace: String(payload['workspace'] || ''),
      project_id: String(payload['project_id'] || ''),
    };
  }

  load_session(session_id: string): Record<string, any> {
    return this._read_encrypted(this._path(session_id));
  }

  save_session(session_id: string, content: Record<string, any>): void {
    let current: Record<string, any>;
    try {
      current = this.load_session(session_id);
    } catch (err) {
      if (!(err instanceof HistoryError)) throw err;
      current = {
        version: 1,
        id: session_id,
        title: 'New chat',
        created_at: Date.now() / 1000,
      };
    }
    Object.assign(current, content);
    current['id'] = session_id;
    current['updated_at'] = Date.now() / 1000;
    if ((current['title'] || 'New chat') === 'New chat') {
      const title = _first_user_title(_primary_turns(current));
      if (title) current['title'] = title;
    }
    this._write_encrypted(this._path(session_id), current);
    const index = this._read_index();
    const metadata = this._metadata(current);
    const sessions = (index['sessions'] as any[]).filter((item) => item['id'] !== session_id);
    sessions.push(metadata);
    index['sessions'] = sessions;
    this._write_index(index);
  }

  rename_session(session_id: string, title: string): void {
    const cleaned = title.trim();
    if (!cleaned) {
      throw new HistoryError('conversation title cannot be empty');
    }
    const payload = this.load_session(session_id);
    payload['title'] = Array.from(cleaned).slice(0, 100).join('');
    this.save_session(session_id, payload);
  }

  delete_session(session_id: string): void {
    const target = this._path(session_id);
    try {
      unlinkSync(target);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    }
    const index = this._read_index();
    index['sessions'] = (index['sessions'] as any[]).filter(
      (item) => item['id'] !== session_id,
    );
    this._write_index(index);
  }
}
