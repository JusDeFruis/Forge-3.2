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
    The probe therefore hides refused models instead of listing failures; the
    refusal is theirs to lift, not ours to work around. */

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

/** Each Zen model is served on its own endpoint, and the free ones are not all
    on the same one. This is the table from opencode.ai/docs/zen, copied rather
    than guessed: sending `muse-spark-1.3-contributor-free` to /chat/completions
    is a 403 whatever the credential, because that model is on /responses. An
    unlisted model defaults to /chat/completions, which is what most of the
    catalog uses. */
export const ZEN_ENDPOINTS: Record<string, string> = {
  'muse-spark-1.3-contributor-free': 'responses',
  'muse-spark-1.2-contributor-free': 'responses',
  'jev-1.13-free': 'systemone',
};

export function endpoint_for(model: string): string {
  return ZEN_ENDPOINTS[String(model ?? '').trim()] ?? 'chat/completions';
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

export interface ZenModelState {
  /** the model this is about */
  model: string;
  /** the endpoint answered. Not a promise of a good answer — only that this
      account may ask this question at all. */
  ok: boolean;
  /** why not, in the reader's words. Empty when ok. */
  why: string;
  /** true when we never got an answer. That is our silence, not the provider's
      refusal, so it must not remove the model from the picker. */
  unanswered?: boolean;
  endpoint: string;
  checked: number;
}

const _probe: Map<string, ZenModelState> = new Map();

/** Probe the free tier instead of believing it.

    OpenCode publishes 13 free models and charges nothing for any of them on
    paper, but its server answers only some of them for a third-party client —
    measured 2026-10-03 with a real account key: `space-bunny-free` answered,
    one is country-restricted, and the rest refused with "OpenCode's free tier
    can only be used from within OpenCode" on their own documented endpoint.
    Nothing in the catalogue distinguishes them.

    So the list Forge offers is not the list that answers, and the only honest
    way to tell them apart is to ask. Each model is probed on its own endpoint;
    refused models are hidden, and when OpenCode lifts a restriction the next
    probe shows the model again — no code change, no frozen list of guesses. */
export async function probe_free_tier(
  models: readonly string[],
  budget_ms = 30000,
): Promise<ZenModelState[]> {
  const key = api_key();
  const list = models.map((model) => String(model ?? '').trim()).filter(Boolean);
  if (!key) {
    return list.map((model) => ({
      model,
      ok: false,
      why: 'not connected',
      endpoint: endpoint_for(model),
      checked: Date.now(),
    }));
  }
  const found = new Map<string, ZenModelState>();
  await Promise.all(list.map(async (model) => {
    const endpoint = endpoint_for(model);
    const state: ZenModelState = { model, ok: false, why: '', endpoint, checked: Date.now() };
    found.set(model, state);
    if (endpoint === 'systemone') {
      /* Jev answers questions about a state, it is not a chat turn. Offering it
         as a reply would be offering something that cannot reply. */
      state.why = 'rates a state, it does not answer a chat turn';
      return;
    }
    const body = endpoint === 'responses'
      ? { model, input: 'ready', max_output_tokens: 4 }
      : { model, messages: [{ role: 'user', content: 'ready' }], max_tokens: 4 };
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), Math.max(2000, budget_ms));
      const res = await fetch(`${ZEN_BASE_URL}/${endpoint}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (res.ok) {
        state.ok = true;
      } else {
        const detail = (await res.text()).replace(/\s+/g, ' ');
        if (/within\s+opencode/i.test(detail)) {
          state.why = 'OpenCode serves this one only from inside its own app';
        } else if (/your country/i.test(detail)) {
          state.why = 'not available in your country';
        } else if (/Missing API key/i.test(detail)) {
          state.why = 'the Zen credential was not accepted';
        } else if (/access is disabled/i.test(detail)) {
          state.why = 'disabled on this Zen workspace';
        } else if (/Model is unavailable/i.test(detail)) {
          state.why = 'listed as free, but not served right now';
        } else if (/Endpoint is unavailable/i.test(detail)) {
          state.why = 'its endpoint is down at OpenCode';
        } else {
          state.why = detail.slice(0, 90);
        }
      }
    } catch (error) {
      /* An unanswered probe is not a refusal: the model stays offered, because
         hiding it on a timeout would blame the provider for our own budget. */
      state.why = (error as Error)?.name === 'AbortError'
        ? `no answer in ${Math.round(Math.max(2000, budget_ms) / 1000)}s`
        : 'unreachable';
      state.unanswered = true;
    }
  }));
  const out = list.map((model) => found.get(model)).filter((s): s is ZenModelState => Boolean(s));
  for (const state of out) _probe.set(state.model, state);
  return out;
}

/** What the last probe said, without asking again. A model nobody has probed
    yet is unknown, and unknown is not the same as broken — it stays offered. */
export function probed_state(model: string): ZenModelState | null {
  return _probe.get(String(model ?? '').trim()) ?? null;
}

/** A refused probe is a fact about this account on this server, not a guess.
    The picker hides those models entirely: showing them would only invite a
    request OpenCode has already said it will not answer. */
export function is_refused(model: string): boolean {
  const state = probed_state(model);
  return Boolean(state && !state.ok && !state.unanswered);
}

export function any_probed(): boolean {
  return _probe.size > 0;
}