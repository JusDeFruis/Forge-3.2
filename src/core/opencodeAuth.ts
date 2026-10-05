import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { writePrivateFile } from './secretFiles';
import { forge_dir } from '../paths';

/** OpenCode Zen is the gateway behind the OpenCode app: the models it lists are
    served under the account you are already signed in to, so there is nothing
    to paste when that account is on this machine.

    Two things are worth being straight about, because both were measured on
    2026-10-03 rather than assumed:

    Zen's public catalogue carries no pricing at all, so which models are free
    is not something to look up and hard-code. What it does carry is a naming
    convention: every free model ends in `-free`. That is the rule used here,
    against the live list, so a model OpenCode retires disappears on its own and
    a model it adds free shows up by itself.

    And OpenCode restricts its free tier to its own app: an unauthenticated
    call is refused with "Missing API key", and a call carrying a valid key is
    refused with "OpenCode's free tier can only be used from within OpenCode".
    So these models can be listed, and they will answer for the reader whose
    account allows it, but the refusal is theirs to lift, not ours to work
    around. */

export const ZEN_BASE_URL = 'https://opencode.ai/zen/v1';

/** the naming convention the provider itself uses for its free tier */
export function is_free_model(id: string): boolean {
  return /-free$/.test(String(id ?? '').trim());
}

export function auth_path(): string {
  const explicit = (process.env['OPENCODE_CONFIG'] || '').trim();
  if (explicit) return path.join(explicit, 'auth.json');
  const xdg = (process.env['XDG_DATA_HOME'] || '').trim();
  const root = xdg
    ? path.join(xdg, 'opencode')
    : path.join(os.homedir(), '.local', 'share', 'opencode');
  return path.join(root, 'auth.json');
}

export class OpenCodeAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OpenCodeAuthError';
  }
}

function read_auth(): Record<string, any> {
  let raw: string;
  try {
    raw = fs.readFileSync(auth_path(), 'utf8');
  } catch {
    throw new OpenCodeAuthError('no OpenCode credential on this machine');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new OpenCodeAuthError('the OpenCode auth.json is corrupt');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new OpenCodeAuthError('the OpenCode auth.json is not an object');
  }
  return parsed as Record<string, any>;
}

function key_in(auth: Record<string, any>): string {
  const entry = auth['opencode'];
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return '';
  return String((entry as Record<string, any>)['key'] ?? '').trim();
}

/** where a pasted credential is kept: beside the keys, owner-only, and never
    referenced from the config */
export function stored_path(): string {
  return path.join(forge_dir(), 'keys', 'opencode-gateway.json');
}

function read_stored(): string {
  try {
    const parsed = JSON.parse(fs.readFileSync(stored_path(), 'utf8'));
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return String((parsed as Record<string, any>)['key'] ?? '').trim();
    }
  } catch {
    /* nothing pasted, or not readable */
  }
  return '';
}

/** what the app already has on this machine, then what the reader pasted */
export function api_key(): string {
  try {
    const from_app = key_in(read_auth());
    if (from_app) return from_app;
  } catch {
    /* fall through to the pasted one */
  }
  return read_stored();
}

export function available(): boolean {
  return api_key().length > 0;
}

/** the app being installed is a different state from being signed in, and the
    two have different fixes */
export function installed(): boolean {
  try {
    return fs.statSync(auth_path()).isFile();
  } catch {
    return false;
  }
}

export function store_credential(raw: string): void {
  const text = String(raw ?? '').trim();
  if (!text) throw new OpenCodeAuthError('the credential is empty');
  let candidate = text;
  /* pasting the whole auth.json is the natural thing to do, so it is taken
     apart rather than refused for being too helpful */
  if (text.startsWith('{')) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new OpenCodeAuthError('that is not valid JSON — paste the key on its own');
    }
    const bag = parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, any>
      : {};
    const entry = bag['opencode'];
    const inner = entry && typeof entry === 'object' && !Array.isArray(entry)
      ? entry as Record<string, any>
      : bag;
    const found = String(inner['key'] ?? '').trim();
    if (!found) {
      throw new OpenCodeAuthError('no "key" in there — that does not look like an OpenCode credential');
    }
    candidate = found;
  }
  if (candidate.length < 20) {
    throw new OpenCodeAuthError('that is too short to be an OpenCode key');
  }
  writePrivateFile(stored_path(), JSON.stringify({ key: candidate }));
}

export function clear_stored(): void {
  try {
    fs.rmSync(stored_path(), { force: true });
  } catch {
    /* already gone, which is the state wanted */
  }
}

/** Zen's free tier, read live. Nothing is frozen: the list is whatever the
    endpoint serves today, filtered by the provider's own `-free` suffix. */
export async function catalog(): Promise<string[]> {
  try {
    const res = await fetch(`${ZEN_BASE_URL}/models`, { headers: { accept: 'application/json' } });
    if (!res.ok) return [];
    const json: any = await res.json();
    const list = Array.isArray(json?.data) ? json.data : Array.isArray(json?.models) ? json.models : [];
    const out: string[] = [];
    for (const item of list as unknown[]) {
      const id = String((item as Record<string, any>)?.id ?? '').trim();
      if (id && is_free_model(id) && !out.includes(id)) out.push(id);
    }
    return out;
  } catch {
    return [];
  }
}