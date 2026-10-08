import * as fs from 'node:fs';
import * as path from 'node:path';
import { FORGE3_HOME } from './providers';
import { writePrivateFile } from './secretFiles';
import { resolveTheme } from './themes';
import type { ForgeConfig } from './types';

export const _CONFIG = path.join(FORGE3_HOME, 'config.json');

export const _MODEL_MIGRATIONS: Record<string, string> = {
  'deepseek/deepseek-v4': 'deepseek/deepseek-v4-pro-0813',
  'x-ai/grok-4-fast': 'x-ai/grok-4.6',
};

export const _MODEL_FIELDS: string[] = [
  'chat_model',
  'draft_model',
  'test_model',
  'judge_model',
  'chat_fallback',
];

export const _DEFAULTS: ForgeConfig = {
  'chat_backend': 'openrouter',
  'chat_model': 'anthropic/claude-opus-4.8',
  'draft_backend': 'openrouter',
  'draft_model': 'x-ai/grok-4.6',
  'style': 'auto',
  'target': 'general',
  'temp': 0.9,
  'top_p': 1.0,
  'reasoning_effort': 'medium',
  'request_timeout': 180,
  'connect_retries': 4,
  'insecure': false,
  'tls_strict': false,
  'theme': 'ember',
  'hold': true,
  'hold_max': 4,
  'chat_fallback': 'meta/muse-spark-1.3',
  'hold_prefill': true,
  'custom_models': {},
  'test_backend': 'gemini',
  'test_model': 'gemini-flash-latest',
  'judge_backend': 'gemini',
  'judge_model': 'gemini-flash-latest',
  'record_tests': false,
  'anvil_auto_improve': true,
  'anvil_probe_count': 4,
  'anvil_max_versions': 3,
  'anvil_threshold': 6,
  'workspace': '',
  'agent_enabled': false,
  'agent_shell': false,
  'agent_web': false,
  /* seconds a command may stay silent before it is called hung. 0 means the
     default 300s; the old fixed 60s wall clock cut builds off mid-write. */
  'agent_shell_timeout': 0,
  'projects': [],
  /* the user's own instructions, injected in front of every turn when on */
  'custom_prompt_on': false,
  'custom_prompt': '',
  'saved_prompts': [],
  /* providers the reader brings themselves */
  'custom_providers': [],
  /* which gateway models are switched on. A gateway is only usable through a
     subscription that lives elsewhere, so which models it may carry is the
     reader's call, kept here per gateway id. */
  'gateway_models': {},
  /* eco mode: clarify + compress the reader's message before it is sent.
     off leaves every turn untouched; light, standard and ultra squeeze
     greetings, filler, then articles out of the prose — never the code. */
  'eco_mode': 'off',
  /* the welcome setup runs once and never again */
  'setup_done': false,
};

export interface SavedPrompt {
  id: string;
  name: string;
  text: string;
}

export const MAX_SAVED_PROMPTS = 40;

/** the user's prompt library: named entries they can pick from or drop */
export function clean_saved_prompts(raw: any): SavedPrompt[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: SavedPrompt[] = [];
  for (const item of raw) {
    if (out.length >= MAX_SAVED_PROMPTS) break;
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const id = String(item['id'] ?? '').trim().slice(0, 64);
    const name = String(item['name'] ?? '').trim().slice(0, 60);
    const text = typeof item['text'] === 'string' ? item['text'].slice(0, 12000) : '';
    if (!id || !name || !text || seen.has(id)) continue;
    seen.add(id);
    out.push({ id, name, text });
  }
  return out;
}

/** A provider the reader runs or pays for themselves: their own gateway, a
    self-hosted llama.cpp or vLLM box, a colleague's proxy. The key never lives
    here — it is written to the locked keys folder like every other one, under
    the provider's own id. */
export interface CustomProvider {
  id: string;
  label: string;
  base_url: string;
  models: string[];
  dialect: string;
  free: boolean;
}

export const MAX_CUSTOM_PROVIDERS = 12;
export const MAX_CUSTOM_MODELS = 24;

/** a provider id has to survive being a file name in the keys folder and a
    key in the settings payload */
export function clean_provider_id(raw: any): string {
  return String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, 40);
}

/** only http(s) reaches the transport, and only a real host */
export function clean_base_url(raw: any): string {
  const text = String(raw ?? '').trim().slice(0, 300);
  if (!/^https?:\/\/[^\s/]+/i.test(text)) return '';
  return text.replace(/\/+$/, '');
}

export function clean_custom_providers(raw: any): CustomProvider[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: CustomProvider[] = [];
  for (const item of raw) {
    if (out.length >= MAX_CUSTOM_PROVIDERS) break;
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const id = clean_provider_id((item as Record<string, any>)['id']);
    if (!id || seen.has(id)) continue;
    const base_url = clean_base_url((item as Record<string, any>)['base_url']);
    /* without an address there is nothing to call, so the entry is dropped
       rather than shown as a provider that cannot work */
    if (!base_url) continue;
    const models: string[] = [];
    const wanted = (item as Record<string, any>)['models'];
    for (const model of Array.isArray(wanted) ? wanted : []) {
      const name = String(model ?? '').trim().slice(0, 160);
      if (!name || models.length >= MAX_CUSTOM_MODELS || models.includes(name)) continue;
      models.push(name);
    }
    if (!models.length) continue;
    const dialect = (item as Record<string, any>)['dialect'] === 'anthropic' ? 'anthropic' : 'openai';
    const label = String((item as Record<string, any>)['label'] ?? '').trim().slice(0, 40) || id;
    seen.add(id);
    out.push({ id, label, base_url, models, dialect, free: Boolean((item as Record<string, any>)['free']) });
  }
  return out;
}

/** gateway id -> the models kept switched on. An empty or absent entry means
    the gateway offers everything it can, which is the right default: it is the
    subscription that limits it, not this list. */
export function clean_gateway_models(raw: any): Record<string, string[]> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, string[]> = {};
  for (const [id, value] of Object.entries(raw as Record<string, any>)) {
    const key = clean_provider_id(id);
    if (!key || !Array.isArray(value)) continue;
    const models: string[] = [];
    for (const model of value.slice(0, 64)) {
      /* only a real string: coercing a number would leave a name in the config
         that no gateway can ever carry */
      if (typeof model !== 'string') continue;
      const name = model.trim().slice(0, 160);
      if (name && !models.includes(name)) models.push(name);
    }
    out[key] = models;
  }
  return out;
}

export interface Project {
  id: string;
  name: string;
  folder: string;
  created_at: number;
}

export function clean_projects(raw: any): Project[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: Project[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const id = typeof item['id'] === 'string' ? item['id'].trim() : '';
    const folder = typeof item['folder'] === 'string' ? item['folder'].trim() : '';
    if (!id || !folder || seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      name: String(item['name'] || '').trim().slice(0, 60) || folder,
      folder,
      created_at: Number(item['created_at']) || 0,
    });
  }
  return out;
}

export function load(): ForgeConfig {
  const cfg: ForgeConfig = { ..._DEFAULTS };
  try {
    const parsed = JSON.parse(fs.readFileSync(_CONFIG, 'utf8'));
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      Object.assign(cfg, parsed);
    }
  } catch {
  }
  /* retired settings never linger: the file is rewritten without them */
  let pruned = false;
  for (const dead of ['chat_max_tokens']) {
    if (dead in cfg) {
      delete cfg[dead];
      pruned = true;
    }
  }
  let migrated = false;
  cfg['theme'] = resolveTheme(cfg['theme']);
  cfg['tls_strict'] = Boolean(cfg['tls_strict']);
  cfg['workspace'] = typeof cfg['workspace'] === 'string' ? cfg['workspace'].trim() : '';
  for (const key of ['agent_enabled', 'agent_shell', 'agent_web', 'custom_prompt_on', 'setup_done']) {
    cfg[key] = Boolean(cfg[key]);
  }
  cfg['custom_prompt'] = typeof cfg['custom_prompt'] === 'string' ? cfg['custom_prompt'] : '';
  cfg['saved_prompts'] = clean_saved_prompts(cfg['saved_prompts']);
  cfg['custom_providers'] = clean_custom_providers(cfg['custom_providers']);
  cfg['gateway_models'] = clean_gateway_models(cfg['gateway_models']);
  cfg['projects'] = clean_projects(cfg['projects']);
  for (const field of _MODEL_FIELDS) {
    const value = cfg[field];
    const current = value ? String(value) : '';
    const replacement = _MODEL_MIGRATIONS[current];
    if (replacement) {
      cfg[field] = replacement;
      migrated = true;
    }
  }
  if (migrated || pruned) {
    try {
      save(cfg);
    } catch (error) {
      console.error('forge: failed to persist migrated config', error);
    }
  }
  return cfg;
}

export function save(cfg: ForgeConfig): void {
  try {
    /* owner-only like every other local secret: the config carries provider
       definitions and folder paths, and must never be world-readable */
    writePrivateFile(_CONFIG, JSON.stringify(cfg, null, 2));
  } catch (error) {
    console.error('forge: failed to write config.json', error);
    throw error;
  }
}

export function update(fields: Record<string, any>): ForgeConfig {
  const cfg = load();
  Object.assign(cfg, fields);
  save(cfg);
  return cfg;
}

export function tls_verify(cfg: ForgeConfig): boolean {
  if (cfg['tls_strict']) {
    return true;
  }
  return !cfg['insecure'];
}
