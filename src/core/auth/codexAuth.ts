import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { httpRequest } from '../httpTransport';
import type { HttpResponse } from '../httpTransport';
import { restrictPrivateFile, writePrivateFile } from '../secretFiles';
import { forge_dir } from '../../paths';

export const _CLIENT_ID = 'app_EMoamEEZ73f0CkXaXp7hrann';
export const _TOKEN_URL = 'https://auth.openai.com/oauth/token';

export class CodexAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CodexAuthError';
  }
}

export function auth_path(): string {
  const home = (process.env['CODEX_HOME'] || '').trim();
  let root: string;
  if (home === '~') {
    root = os.homedir();
  } else if (home.startsWith('~/') || home.startsWith('~\\')) {
    root = path.join(os.homedir(), home.slice(2));
  } else if (home) {
    root = home;
  } else {
    root = path.join(os.homedir(), '.codex');
  }
  return path.join(root, 'auth.json');
}

/** What plan the local ChatGPT login is actually on, read from the id token the
    login already stores. `codex login status` only says "Logged in using
    ChatGPT", so the claim is the honest source.

    This is what the reader complained about: a gateway that reports `free`
    cannot carry the models a paid plan carries, and the app used to offer them
    anyway. */
export function plan(): { plan: string | null; mode: string | null; until: string | null } {
  let data: Record<string, any>;
  try {
    data = _read();
  } catch {
    return { plan: null, mode: null, until: null };
  }
  const mode = String(data['auth_mode'] || '').trim() || null;
  const raw = data['tokens'];
  const tokens = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const id = String(tokens['id_token'] || '').trim();
  if (!id) return { plan: null, mode, until: null };
  const claims = _jwt_claims(id);
  const auth = claims['https://api.openai.com/auth'];
  const bag = auth && typeof auth === 'object' && !Array.isArray(auth) ? auth : {};
  return {
    plan: String(bag['chatgpt_plan_type'] || '').trim().toLowerCase() || null,
    mode,
    until: String(bag['chatgpt_subscription_active_until'] || '').trim() || null,
  };
}

/** decode a JWT payload without verifying it: nothing here is trusted for an
    access decision, the token is only read for the claim names it carries */
function _jwt_claims(token: string): Record<string, any> {
  const parts = token.split('.');
  if (parts.length < 2) return {};
  try {
    const raw = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = raw + '='.repeat((4 - (raw.length % 4)) % 4);
    const json = Buffer.from(padded, 'base64').toString('utf8');
    const parsed = JSON.parse(json);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function available(): boolean {
  let data: Record<string, any>;
  try {
    data = _read();
  } catch (exc) {
    if (exc instanceof CodexAuthError) return false;
    throw exc;
  }
  const raw = data['tokens'];
  const tokens = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  return Boolean(String(tokens['access_token'] || '').trim() || String(tokens['refresh_token'] || '').trim());
}

/** A gateway credential the reader pasted in, stored beside the keys. Used when
    there is no `~/.codex/auth.json` on this machine — a second machine, a
    colleague's login, a container — so the gateway is not limited to whatever
    happened to be logged in locally. Owner-only, and never in config.json. */
export function stored_path(): string {
  return path.join(forge_dir(), 'keys', 'codex-gateway.json');
}

function _read_stored(): Record<string, any> | null {
  try {
    const raw = fs.readFileSync(stored_path(), 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function store_credential(raw: string): void {
  const text = String(raw ?? '').trim();
  if (!text) throw new CodexAuthError('the credential is empty');
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new CodexAuthError('that is not valid JSON — paste the whole auth.json');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new CodexAuthError('a gateway credential has to be a JSON object');
  }
  const bag = parsed as Record<string, any>;
  const tokens = bag['tokens'];
  const inner = tokens && typeof tokens === 'object' && !Array.isArray(tokens) ? tokens : {};
  if (!String(inner['access_token'] ?? '').trim() && !String(inner['refresh_token'] ?? '').trim()) {
    throw new CodexAuthError('no access or refresh token in there — this does not look like an auth.json');
  }
  if (!String(inner['account_id'] ?? '').trim()) {
    throw new CodexAuthError('no account id in there — run `codex login` on the machine it came from');
  }
  writePrivateFile(stored_path(), text);
}

export function clear_stored(): void {
  try {
    fs.rmSync(stored_path(), { force: true });
  } catch {
    /* a credential that is already gone is the state we wanted */
  }
}

/** the login already on this machine first, then the one the reader pasted */
export function _read(): Record<string, any> {
  const stored = _read_stored();
  try {
    return _read_local();
  } catch (exc) {
    if (stored) return stored;
    throw exc;
  }
}

export function _read_local(): Record<string, any> {
  const file = auth_path();
  let raw: string;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch (exc) {
    const error = new CodexAuthError('no Codex login on this machine — run `codex login`');
    error.cause = exc;
    throw error;
  }
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch (exc) {
    const error = new CodexAuthError('Codex auth.json is corrupt');
    error.cause = exc;
    throw error;
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new CodexAuthError('Codex auth.json is not an object');
  }
  return data as Record<string, any>;
}

export function _write(data: Record<string, any>): void {
  const file = auth_path();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.${randomUUID().replace(/-/g, '')}.tmp`;
  try {
    const encoded = JSON.stringify(data, null, 2).replace(/[\u007f-\uffff]/g, (character) => {
      return `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`;
    });
    const eol = process.platform === 'win32' ? '\r\n' : '\n';
    fs.writeFileSync(temp, `${encoded.replace(/\n/g, eol)}${eol}`, 'utf8');
    restrictPrivateFile(temp);
    fs.renameSync(temp, file);
    restrictPrivateFile(file);
  } finally {
    fs.rmSync(temp, { force: true });
  }
}

export function _jwt_exp(token: string): number | null {
  const parts = String(token || '').split('.');
  if (parts.length < 2) return null;
  const payload = parts[1] + '='.repeat((4 - (parts[1].length % 4)) % 4);
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    const exp = data['exp'];
    if (typeof exp === 'number' && Number.isFinite(exp)) return Math.trunc(exp);
    if (typeof exp === 'string' && /^[-+]?\d+$/.test(exp.trim())) return Number.parseInt(exp.trim(), 10);
    return null;
  } catch {
    return null;
  }
}

export function _fresh(access: string): boolean {
  const exp = _jwt_exp(access);
  if (exp === null) return Boolean(access);
  return exp > Math.floor(Date.now() / 1000) + 60;
}

export async function session(): Promise<[string, string]> {
  const data = _read();
  const raw = data['tokens'];
  const tokens: Record<string, any> = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  let access = String(tokens['access_token'] || '').trim();
  const refresh = String(tokens['refresh_token'] || '').trim();
  let account = String(tokens['account_id'] || '').trim();
  if (!account) {
    throw new CodexAuthError('Codex login is missing an account id — run `codex login` again');
  }
  if (access && _fresh(access)) {
    return [access, account];
  }
  if (!refresh) {
    throw new CodexAuthError('Codex login expired — run `codex login`');
  }
  const refreshed = await _refresh(refresh, account);
  access = refreshed[0];
  account = refreshed[2];
  tokens['access_token'] = access;
  tokens['refresh_token'] = refreshed[1];
  tokens['account_id'] = account;
  data['tokens'] = tokens;
  data['last_refresh'] = new Date().toISOString().slice(0, 19) + 'Z';
  _write(data);
  return [access, account];
}

export async function _refresh(refresh_token: string, account_id: string): Promise<[string, string, string]> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refresh_token,
    client_id: _CLIENT_ID,
  }).toString();
  let response: HttpResponse;
  try {
    response = await httpRequest(_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body,
      verify: true,
      timeout: 30,
    });
  } catch (exc) {
    const error = new CodexAuthError('Codex token refresh failed');
    error.cause = exc;
    throw error;
  }
  if (response.status >= 400) {
    throw new CodexAuthError('Codex login expired — run `codex login`');
  }
  let payload: any;
  try {
    payload = await response.json();
  } catch (exc) {
    const error = new CodexAuthError('Codex token refresh returned non-JSON');
    error.cause = exc;
    throw error;
  }
  const access = String((payload && payload['access_token']) || '').trim();
  const new_refresh = String((payload && payload['refresh_token']) || refresh_token).trim();
  if (!access) {
    throw new CodexAuthError('Codex token refresh returned no access token');
  }
  return [access, new_refresh, account_id];
}
