import * as fs from 'node:fs';
import * as path from 'node:path';

import { CODEX_MODELS, CODEX_URL, CodexRequestError, delta_text, hidden_text, model_leaf, safe_error_detail, to_input } from './codexClient';
import {
  CodexAuthError,
  available,
  session,
  plan as codex_plan,
} from './codexAuth';
import * as opencodeAuth from './opencodeAuth';
import { httpRequest } from './httpTransport';
import { restrictPrivateDir, writePrivateFile } from './secretFiles';
import { OPENROUTER_MODELS, ORCAROUTER_MODELS, VENICE_MODELS, UNCENSORED_MODELS_BY_BACKEND, is_media_only_model } from './modelCatalogs';
import { forge_dir } from '../paths';
import type { ForgeConfig, ChatMessage, Usage, ModelChoice, ToolCall, ToolDef } from './types';

export const FORGE3_HOME: string = forge_dir();
export const FORGE3_ROOT: string = FORGE3_HOME;
export const KEYS_DIRS: string[] = [path.join(FORGE3_HOME, 'keys')];
export const _LEGACY_OR: string[] = [path.join(FORGE3_HOME, 'openrouter_key.txt')];
export const CREDIT_SAFE_OUTPUT_USD = 0.8;
export const MIN_COMPLETION_TOKENS = 256;
export const ASTRA_MAX_COMPLETION_TOKENS = 16000;

export const PRICING: Record<string, [number, number, number]> = {
  'openai/gpt-6-luna': [0.1, 0.5, 0.01],
  'gpt-6-luna': [0.1, 0.5, 0.01],
  'openai/gpt-6-sol': [2.0, 10.0, 0.2],
  'gpt-6-sol': [2.0, 10.0, 0.2],
  'openai/gpt-5.6-luna': [0.2, 1.2, 0.02],
  'gpt-5.6-luna': [0.2, 1.2, 0.02],
  'openai/gpt-5.6-sol': [2.0, 10.0, 0.2],
  'gpt-5.6-sol': [2.0, 10.0, 0.2],
  'openai/gpt-5.6-terra': [2.0, 12.0, 0.2],
  'gpt-5.6-terra': [2.0, 12.0, 0.2],
  'gpt-6-astra': [10.0, 50.0, 1.0],
  'anthropic/claude-opus-5.5': [4.0, 20.0, 0.4],
  'claude-opus-5.5': [4.0, 20.0, 0.4],
  'anthropic/claude-opus-5': [5.0, 25.0, 0.5],
  'claude-opus-5': [5.0, 25.0, 0.5],
  'anthropic/claude-sonnet-5': [2.0, 10.0, 0.2],
  'claude-sonnet-5': [2.0, 10.0, 0.2],
  'anthropic/claude-fable-5.1': [10.0, 50.0, 1.0],
  'claude-fable-5.1': [10.0, 50.0, 1.0],
  'x-ai/grok-4.7': [1.6, 4.8, 0.4],
  'grok-4.7': [1.6, 4.8, 0.4],
  'x-ai/grok-4.6': [2.0, 6.0, 0.5],
  'grok-4.6': [2.0, 6.0, 0.5],
  'x-ai/grok-4.5': [2.0, 6.0, 0.5],
  'grok-4.5': [2.0, 6.0, 0.5],
  'z-ai/glm-5.3-prime': [2.8, 8.8, 0.28],
  'glm-5.3-prime': [2.8, 8.8, 0.28],
  'z-ai/glm-5.3-flashx': [0.37, 1.25, 0.037],
  'glm-5.3-flashx': [0.37, 1.25, 0.037],
  'z-ai/glm-5.3-flash': [0.04, 0.5, 0.004],
  'glm-5.3-flash': [0.04, 0.5, 0.004],
  'z-ai/glm-5.3': [0.3794, 1.1924, 0.038],
  'glm-5.3': [0.3794, 1.1924, 0.038],
  'qwen/qwen3.8-flash': [0.15, 0.47, 0.015],
  'qwen3.8-flash': [0.15, 0.47, 0.015],
  'qwen/qwen3.8-max': [2.0, 6.0, 0.2],
  'qwen3.8-max': [2.0, 6.0, 0.2],
  'qwen/qwen3.8-max-0902': [2.0, 6.0, 0.2],
  'qwen3.8-max-0902': [2.0, 6.0, 0.2],
  'qwen/qwen3.8-omni-flash': [0.15, 0.47, 0.015],
  'qwen3.8-omni-flash': [0.15, 0.47, 0.015],
  'minimax/minimax-m3': [0.3, 1.2, 0.03],
  'minimax-m3': [0.3, 1.2, 0.03],
  'moonshotai/kimi-k3': [3.0, 15.0, 0.3],
  'kimi-k3': [3.0, 15.0, 0.3],
  'moonshotai/kimi-k2.7-code': [0.6562, 3.3, 0.066],
  'kimi-k2.7-code': [0.6562, 3.3, 0.066],
  'moonshotai/kimi-k2.6': [0.95, 4.0, 0.095],
  'kimi-k2.6': [0.95, 4.0, 0.095],
  'moonshotai/kimi-k2': [0.57, 2.3, 0.057],
  'kimi-k2': [0.57, 2.3, 0.057],
  'deepseek/deepseek-v4.1-flash': [0.3, 1.2, 0.03],
  'deepseek-v4.1-flash': [0.3, 1.2, 0.03],
  'google/gemini-3.7-flash': [0.75, 3.75, 0.075],
  'gemini-3.7-flash': [0.75, 3.75, 0.075],
  'google/gemini-3.6-flash': [0.75, 3.75, 0.075],
  'gemini-3.6-flash': [0.75, 3.75, 0.075],
  'xiaomi/mimo-v2.6-flash': [0.14, 0.28, 0.014],
  'mimo-v2.6-flash': [0.14, 0.28, 0.014],
  'xiaomi/mimo-v2.6-pro': [0.435, 0.87, 0.044],
  'mimo-v2.6-pro': [0.435, 0.87, 0.044],
  'stepfun/step-3.7-flash': [0.2, 1.15, 0.02],
  'step-3.7-flash': [0.2, 1.15, 0.02],
  'inclusionai/ling-3.0-flash': [0.021, 0.063, 0.002],
  'ling-3.0-flash': [0.021, 0.063, 0.002],
  'bytedance-seed/seed-1.6-flash': [0.075, 0.3, 0.008],
  'seed-1.6-flash': [0.075, 0.3, 0.008],
  'meituan/longcat-2.0': [0.3, 1.2, 0.03],
  'longcat-2.0': [0.3, 1.2, 0.03],
  'tencent/hy3': [0.132, 0.528, 0.013],
  'hy3': [0.132, 0.528, 0.013],
  'openai/gpt-5.5-pro': [30.0, 180.0, 3.0],
  'openai/gpt-5.4-pro': [30.0, 180.0, 3.0],
  'openai/gpt-5.2-pro': [21.0, 168.0, 2.1],
  'openai/gpt-5-pro': [15.0, 120.0, 1.5],
  'openai/gpt-5.5': [5.0, 30.0, 0.5],
  'gpt-5.5-pro': [30.0, 180.0, 3.0],
  'gpt-5.4-pro': [30.0, 180.0, 3.0],
  'gpt-5.2-pro': [21.0, 168.0, 2.1],
  'gpt-5-pro': [15.0, 120.0, 1.5],
  'gpt-5.5': [5.0, 30.0, 0.5],
  'claude-fable-5': [10.0, 50.0, 1.0],
  'deepseek/deepseek-v4-pro-0813': [0.57948, 1.73844, 0.018438],
  'deepseek/deepseek-v4-pro': [0.87, 1.74, 0.0725],
  'deepseek/deepseek-v4-flash-0731': [0.065, 0.18, 0.016],
  'deepseek/deepseek-v4-flash-latest': [0.065, 0.18, 0.016],
  'deepseek/deepseek-v4-flash': [0.07, 0.14, 0.014],
  'venice-uncensored-1-2': [0.2, 0.9, 0.0],
  'glm-5.1': [1.4, 4.4, 0.26],
  'glm-5': [1.0, 3.2, 0.2],
  'glm-4.7': [0.6, 2.2, 0.11],
  'glm-4.6': [0.6, 2.2, 0.11],
  'google/gemini-3.8-flash': [0.75, 3.75, 0.075],
  'gemini-3.8-flash': [0.75, 3.75, 0.075],
  'meta/muse-spark': [1.25, 4.25, 0.15],
  'claude-opus': [15.0, 75.0, 1.5],
  'claude-sonnet': [3.0, 15.0, 0.3],
  'claude-haiku': [0.8, 4.0, 0.08],
  'claude-fable': [10.0, 50.0, 1.0],
  'anthropic/claude-opus': [15.0, 75.0, 1.5],
  'anthropic/claude-sonnet': [3.0, 15.0, 0.3],
  'anthropic/claude-haiku': [0.8, 4.0, 0.08],
  'anthropic/claude-fable-5': [10.0, 50.0, 1.0],
  'anthropic/claude-fable': [10.0, 50.0, 1.0],
  'gpt-5': [5.0, 20.0, 0.5],
  'gpt-4o-mini': [0.15, 0.6, 0.075],
  'gpt-4o': [2.5, 10.0, 1.25],
  'openai/gpt-5': [5.0, 20.0, 0.5],
  'openai/gpt-4o': [2.5, 10.0, 1.25],
  'google/gemini': [0.5, 2.0, 0.125],
  'gemini': [0.5, 2.0, 0.125],
  'deepseek': [0.14, 0.28, 0.028],
  'x-ai/grok': [5.0, 15.0, 0.5],
  'grok': [5.0, 15.0, 0.5],
  'meta-llama': [0.4, 0.6, 0.08],
  'llama': [0.4, 0.6, 0.08],
  'qwen': [0.3, 1.2, 0.06],
  'mistral': [2.0, 6.0, 0.4],
  'moonshotai': [0.5, 2.5, 0.1],
  'kimi': [0.5, 2.5, 0.1],
  'qwq': [0.29, 0.39, 0.06],
  'qwen3-max': [0.4, 1.2, 0.08],
  'qwen-plus': [0.4, 1.2, 0.08],
  'qwen-turbo': [0.05, 0.2, 0.01],
  'minimax-m2': [0.3, 1.2, 0.03],
  'minimax-text': [0.6, 2.2, 0.06],
  'sonar-reasoning-pro': [1.0, 1.0, 0.1],
  'sonar-pro': [1.0, 1.0, 0.1],
  'sonar': [1.0, 1.0, 0.1],
};
export const _FALLBACK_PRICE: [number, number, number] = [3.0, 15.0, 0.3];

export function price_for(model: string): [number, number, number] {
  const m = String(model || '').toLowerCase();
  const matches: Array<[string, [number, number, number]]> = [];
  for (const entry of Object.entries(PRICING)) {
    if (m.includes(entry[0])) matches.push(entry as [string, [number, number, number]]);
  }
  if (!matches.length) return _FALLBACK_PRICE;
  matches.sort((a, b) => b[0].length - a[0].length);
  return matches[0][1];
}

export function credit_safe_completion_tokens(model: string, requested: number): number {
  const tokens = Math.max(1, Math.trunc(Number(requested || 0)));
  const price_out = Number(price_for(model)[1] || 0);
  if (price_out <= 0) return tokens;
  const affordable = Math.max(MIN_COMPLETION_TOKENS, Math.trunc((CREDIT_SAFE_OUTPUT_USD * 1000000) / price_out));
  return Math.min(tokens, affordable);
}

/* ── reply token budget, per model ──────────────────────────────────
   the provider is asked first (live /models metadata); these family
   rules are the offline fallback when it has nothing to say. */

export const MAX_OUTPUT_FALLBACK = 16384;
export const MAX_OUTPUT_CEILING = 131072;

const _MAX_OUTPUT_RULES: Array<[RegExp, number]> = [
  /* openai — gpt-5/6 era write up to 128k */
  [/gpt-6|gpt-5/, 128000],
  [/gpt-oss/, 16384],
  [/(^|[^a-z0-9])o[134]([\-.:_]|$)/, 100000],
  [/gpt-4\.1/, 32768],
  [/gpt-4o/, 16384],
  [/gpt-4|gpt-3\.5/, 4096],
  /* anthropic — claude, newest first (ids come dotted and dashed) */
  [/claude.*(sonnet-5|opus-5|fable)/, 128000],
  [/claude.*opus-4[.-][6-9]/, 128000],
  [/claude.*haiku-4[.-]5/, 64000],
  [/claude.*sonnet-4[.-][5-9]/, 64000],
  [/claude.*opus-4[.-]5/, 64000],
  [/claude.*sonnet-4/, 64000],
  [/claude.*opus-4/, 32000],
  [/claude.*haiku/, 8192],
  [/claude/, 64000],
  /* google — gemini 2.5+ write 65,536; the older ones 8,192 */
  [/gemini.*(2\.5|3[.-]|flash-latest|pro-latest)/, 65536],
  [/gemini/, 8192],
  /* deepseek — v3.x/v4 open the output window wide */
  [/deepseek/, 65536],
  /* qwen */
  [/qwen3\.[5-9]|qwen3-max|qwen-max/, 65536],
  [/qwen/, 32768],
  /* xai — grok-4 accepts 256k; stay under our ceiling */
  [/grok/, 65536],
  /* z.ai glm */
  [/glm-5|glm-6/, 65536],
  [/glm/, 16384],
  /* moonshot kimi — k3 defaults to a 32,768 budget */
  [/kimi|moonshot/, 32768],
  [/mistral|codestral|ministral|magistral/, 16384],
  [/llama/, 32768],
  [/nemotron/, 16384],
  [/gemma/, 16384],
  [/minimax/, 32768],
  [/command/, 16384],
  [/sonar/, 8192],
];

export function max_output_tokens_for(model: string): number {
  const key = String(model || '').toLowerCase();
  for (const [pattern, cap] of _MAX_OUTPUT_RULES) {
    if (pattern.test(key)) return cap;
  }
  return MAX_OUTPUT_FALLBACK;
}

/* ask the provider how much room this model has; cached, best effort */
export async function resolve_max_output_tokens(
  client: Client,
  model: string,
  fallback?: number,
): Promise<number> {
  const table = max_output_tokens_for(model);
  /* an explicit caller budget is a ceiling, never a raise above the model */
  const base = Number(fallback) > 0 ? Math.min(Math.trunc(Number(fallback)), table) : table;
  try {
    const live = await client.live_max_output_tokens(model);
    if (live && Number.isFinite(live) && live >= 256) {
      return Math.min(MAX_OUTPUT_CEILING, Math.trunc(live));
    }
  } catch {
    /* metadata is a bonus, never a blocker */
  }
  return Math.min(MAX_OUTPUT_CEILING, Math.max(256, base));
}

export const THINKING_MODEL_MARKERS: string[] = [
  'claude', 'gpt-6-astra', 'gpt-oss', 'deepseek-v4', 'deepseek-flash', 'deepseek-reasoner',
  'grok-4.7', 'grok-4.6', 'gemini-3.8', 'gemini-3.7', 'gemini-3.6', 'gemini-3.5', 'muse-spark',
  'muse-glimmer', 'nemotron-3', 'gemma-4', 'glm-5',
  'qwen3.8', 'qwen3.7', 'reasoner', 'thinking',
  'kimi-k3', 'kimi-k2-thinking', 'space-bunny',
];
export const REASONING_BUDGET_RATIO = 0.5;
export const MIN_REASONING_TOKENS = 1024;
export const MIN_VISIBLE_TOKENS = 1024;

/* generic effort steps for the Think button. Every family maps them to
   its own native control (OpenRouter maps a token budget to effort or
   thinking level per model), so one scale drives Claude, GPT, Gemini,
   DeepSeek, Grok and the rest without per-vendor knobs. */
export const REASONING_EFFORTS: string[] = ['off', 'low', 'medium', 'high', 'max'];
export const REASONING_EFFORT_RATIOS: Record<string, number> = {
  off: 0,
  low: 0.15,
  medium: 0.5,
  high: 0.75,
  max: 0.9,
};

/** how long a request may go without a single byte before it is called dead.
    Some hosted endpoints accept the request and then never answer — waiting
    the full request timeout leaves the reader staring at a frozen turn. The
    transport resets this on every chunk, so it guards the first byte and any
    later silence alike. */
export const SILENCE_SECONDS = 60;
export const SILENCE_SECONDS_DEEP = 150;

/** NVIDIA queues some of its models for minutes and says nothing whatsoever
    while it waits — not a keepalive, not a byte. Read as silence, the default
    budget calls that dead at 60s and cuts the turn off while it is still in
    the queue. Measured on 2026-10-02 against a live account: the z-ai GLM
    models sat silent for 79s, 80s and 131s before their first byte, while
    Nemotron on the same key answered in 1-3s. The gateway gives up on its own
    at roughly 300s, so the ceiling sits below that rather than pretending the
    request can still be saved at the end. */
export const NVIDIA_QUEUE_SECONDS = 240;

export function silence_budget(effort: unknown, base_url?: unknown): number {
  const level = normalize_effort(effort);
  const usual = level === 'high' || level === 'max' ? SILENCE_SECONDS_DEEP : SILENCE_SECONDS;
  if (String(base_url ?? '').toLowerCase().includes('integrate.api.nvidia.com')) {
    return Math.max(usual, NVIDIA_QUEUE_SECONDS);
  }
  return usual;
}

export function normalize_effort(value: unknown): string {
  const key = String(value ?? 'medium').trim().toLowerCase();
  return key in REASONING_EFFORT_RATIOS ? key : 'medium';
}

/* models that reason by nature — their thinking can't be switched off */
const ALWAYS_THINKING: RegExp[] = [
  /deepseek-reasoner/,
  /glm-5\.3/,
  /(^|[^a-z0-9])o[134]([\-.:_]|$)/,
];

/* the levels a model can actually honour: everything that has no thinking
   support only knows 'off', models that always reason know every level
   except 'off' */
export function effort_levels_for(model: string): string[] {
  const key = String(model ?? '').toLowerCase();
  if (!is_thinking_model(model)) return ['off'];
  if (ALWAYS_THINKING.some((pattern) => pattern.test(key))) {
    return REASONING_EFFORTS.filter((level) => level !== 'off');
  }
  return [...REASONING_EFFORTS];
}

export interface EffortChoice {
  requested: string;
  level: string;
  clamped: boolean;
  message: string | null;
}

/* turn the asked-for level into one the model can take — the nearest
   notch down when the ask is above it, the nearest notch up when the
   model can't go as low as asked — and say so when it had to move */
export function clamp_effort(model: string, requested: unknown): EffortChoice {
  const want = normalize_effort(requested);
  const levels = effort_levels_for(model);
  const name = String(model || '').split('/').pop() || String(model || '');
  if (levels.includes(want)) {
    return { requested: want, level: want, clamped: false, message: null };
  }
  const target = REASONING_EFFORTS.indexOf(want);
  let best = levels[0];
  let gap = Number.MAX_SAFE_INTEGER;
  for (const level of levels) {
    const distance = Math.abs(REASONING_EFFORTS.indexOf(level) - target);
    if (distance < gap) {
      best = level;
      gap = distance;
    }
  }
  let message: string;
  if (levels.length === 1) {
    message = `${name} has no thinking — thinking off`;
  } else if (want === 'off') {
    message = `${name} always thinks — using ${best}`;
  } else {
    message = `${name} can't use ${want} thinking — using ${best}`;
  }
  return { requested: want, level: best, clamped: true, message };
}

export function is_thinking_model(model: string): boolean {
  const key = String(model ?? '').toLowerCase();
  return THINKING_MODEL_MARKERS.some((marker) => key.includes(marker));
}

export function reasoning_budget_for(model: string, completion_tokens: number, effort: unknown = 'medium'): number | null {
  const choice = clamp_effort(model, effort);
  /* a model with nothing to switch off only gets an explicit off when the
     user actually asked for one — otherwise there is no field to send */
  if (choice.level === 'off') {
    return choice.requested === 'off' || is_thinking_model(model) ? 0 : null;
  }
  const tokens = Math.max(1, Math.trunc(Number(completion_tokens || 0)));
  if (tokens < MIN_REASONING_TOKENS + MIN_VISIBLE_TOKENS) return 0;
  const ratio = REASONING_EFFORT_RATIOS[choice.level] ?? REASONING_BUDGET_RATIO;
  const budget = Math.trunc(tokens * ratio);
  return Math.max(MIN_REASONING_TOKENS, Math.min(budget, tokens - MIN_VISIBLE_TOKENS));
}

export function estimate_cost(model: string, input_tokens: number, output_tokens: number, cached_input = 0): number {
  const [p_in, p_out, p_cache] = price_for(model);
  const non_cached = Math.max(0, Math.trunc(Number(input_tokens || 0)) - Math.trunc(Number(cached_input || 0)));
  return (non_cached / 1e6) * p_in + (Math.trunc(Number(cached_input || 0)) / 1e6) * p_cache + (Math.trunc(Number(output_tokens || 0)) / 1e6) * p_out;
}

export function format_tokens(count: number): string {
  const n = Math.max(0, Math.trunc(Number(count || 0)));
  if (n >= 1000) {
    if (n % 1000 === 0) return `${(n / 1000).toFixed(0)}k`;
    const scaled = (n / 1000) * 10;
    const floor = Math.floor(scaled);
    const frac = scaled - floor;
    const rounded = frac > 0.5 ? floor + 1 : frac < 0.5 ? floor : floor % 2 === 0 ? floor : floor + 1;
    return `${(rounded / 10).toFixed(1)}k`;
  }
  return String(n);
}

export function format_usd(amount: number): string {
  const value = Math.max(0, Number(amount || 0));
  if (value < 0.0005) return 'free';
  const digits = value < 0.01 ? 3 : 2;
  const scale = 10 ** digits;
  const scaled = value * scale;
  const floor = Math.floor(scaled);
  const frac = scaled - floor;
  const rounded = frac > 0.5 ? floor + 1 : frac < 0.5 ? floor : floor % 2 === 0 ? floor : floor + 1;
  return `$${(rounded / scale).toFixed(digits)}`;
}

export function _cost_label(amount: number, backend_name: string): string {
  const backend = BACKENDS[backend_name];
  if (backend && backend.free) return 'free';
  return format_usd(amount);
}

export function typical_jobs(cfg?: ForgeConfig | null): Record<string, Record<string, any>> {
  const options: ForgeConfig = cfg || {};
  const probe_raw = options['anvil_probe_count'] !== undefined ? options['anvil_probe_count'] : 4;
  const probes = Math.max(2, Math.min(6, Math.trunc(Number(probe_raw || 4))));
  const version_raw = options['anvil_max_versions'] !== undefined ? options['anvil_max_versions'] : 3;
  const versions = Math.max(1, Math.min(3, Math.trunc(Number(version_raw || 3))));
  const auto = options['anvil_auto_improve'] !== undefined ? Boolean(options['anvil_auto_improve']) : true;
  const target_in = probes * versions * 4500;
  const target_out = probes * versions * 2200;
  return {
    assistant: {
      input: 24000,
      output: 10000,
      label: 'full chat · ~12 turns',
    },
    forge: {
      input: 5000,
      output: 6000,
      label: 'one system prompt',
    },
    anvil: {
      input: target_in,
      output: target_out,
      label: `${probes} probes × ${versions} versions · target`,
      probes,
      versions,
      auto_improve: auto,
      judge_input: versions * (4000 + probes * 2500) + 3000,
      judge_output: versions * 1800 + 800,
      revise_input: auto && versions > 1 ? (versions - 1) * 8000 : 0,
      revise_output: auto && versions > 1 ? (versions - 1) * 6000 : 0,
    },
  };
}

export function _blend_cost(parts: Array<Record<string, any>>): string {
  let paid_sum = 0;
  const free_names: string[] = [];
  for (const part of parts) {
    if (part['cost_label'] === 'free') {
      free_names.push(String(part['name']));
    } else {
      paid_sum += Number(part['cost']);
    }
  }
  if (paid_sum <= 0) return 'free';
  let label = format_usd(paid_sum);
  if (free_names.length) label += ' + ' + free_names.join('/') + ' free';
  return label;
}

export function _leg(model: string, backend: string, input_tokens: number, output_tokens: number, name: string): Record<string, any> {
  const cost = estimate_cost(model, input_tokens, output_tokens);
  return {
    name,
    backend,
    model,
    input_tokens,
    output_tokens,
    cost,
    cost_label: _cost_label(cost, backend),
    use: `${format_tokens(input_tokens)} in / ${format_tokens(output_tokens)} out`,
  };
}

export function room_estimates(cfg?: ForgeConfig | null): Record<string, Record<string, any>> {
  const options: ForgeConfig = cfg || {};
  const jobs = typical_jobs(options);
  const assistant = _leg(
    String(options['chat_model'] || ''),
    String(options['chat_backend'] || ''),
    jobs['assistant']['input'],
    jobs['assistant']['output'],
    'assistant',
  );
  assistant['label'] = jobs['assistant']['label'];
  const forge = _leg(
    String(options['draft_model'] || ''),
    String(options['draft_backend'] || ''),
    jobs['forge']['input'],
    jobs['forge']['output'],
    'forge',
  );
  forge['label'] = jobs['forge']['label'];
  const anvil_job = jobs['anvil'];
  const target = _leg(
    String(options['test_model'] || ''),
    String(options['test_backend'] || ''),
    anvil_job['input'],
    anvil_job['output'],
    'target',
  );
  const judge = _leg(
    String(options['judge_model'] || ''),
    String(options['judge_backend'] || 'gemini'),
    anvil_job['judge_input'],
    anvil_job['judge_output'],
    'judge',
  );
  const parts = [target, judge];
  let total_in = target['input_tokens'] + judge['input_tokens'];
  let total_out = target['output_tokens'] + judge['output_tokens'];
  let total_cost = target['cost'] + judge['cost'];
  if (anvil_job['revise_input']) {
    const revise = _leg(
      String(options['draft_model'] || ''),
      String(options['draft_backend'] || ''),
      anvil_job['revise_input'],
      anvil_job['revise_output'],
      'revise',
    );
    parts.push(revise);
    total_in += revise['input_tokens'];
    total_out += revise['output_tokens'];
    total_cost += revise['cost'];
  }
  const anvil: Record<string, any> = {
    name: 'anvil',
    backend: target['backend'],
    model: `${String(target['model'] || 'target').split('/').pop()} + ${String(judge['model'] || 'judge').split('/').pop()}`,
    input_tokens: total_in,
    output_tokens: total_out,
    cost: total_cost,
    cost_label: _blend_cost(parts),
    use: `${format_tokens(total_in)} in / ${format_tokens(total_out)} out`,
    label: String(anvil_job['label']).replace(' · target', ' · target + judge'),
    parts,
  };
  if (anvil_job['auto_improve'] && anvil_job['revise_input']) anvil['label'] += ' + revise';
  return { assistant, forge, anvil };
}

export interface BackendOptions {
  dialect?: string;
  cascade?: string[];
  models?: string[];
  env_keys?: string[];
  request_body?: Record<string, object>;
  free?: boolean;
  blurb?: string;
  /** A gateway is not a provider you hold a key for. It is something you
      already pay for, or already have signed in to on this machine, that Forge
      connects to as a bridge. Codex is the first: the login lives in
      ~/.codex/auth.json and the plan is readable from it, so no key exists to
      paste. Listed apart from providers for that reason. */
  gateway?: boolean;
}

export class Backend {
  name: string;
  base_url: string;
  default_model: string;
  dialect: string;
  cascade: string[];
  models: string[];
  env_keys: string[];
  request_body: Record<string, object>;
  free: boolean;
  blurb: string;
  gateway: boolean;

  constructor(name: string, base_url: string, default_model: string, options: BackendOptions = {}) {
    this.name = name;
    this.base_url = base_url;
    this.default_model = default_model;
    this.dialect = options.dialect ?? 'openai';
    this.cascade = [...(options.cascade ?? [])];
    this.models = [...(options.models ?? [])];
    this.env_keys = [...(options.env_keys ?? [])];
    this.request_body = { ...(options.request_body ?? {}) };
    this.free = options.free ?? false;
    this.blurb = options.blurb ?? '';
    this.gateway = options.gateway ?? false;
    if (!this.cascade.length) this.cascade = [this.default_model];
    if (!this.models.length) this.models = [...this.cascade];
  }

  get kind(): 'gateway' | 'provider' {
    return this.gateway ? 'gateway' : 'provider';
  }

  get tag(): 'free' | 'paid' {
    return this.free ? 'free' : 'paid';
  }

  load_key(): string | null {
    if (this.dialect === 'codex') {
      return available() ? 'codex-login' : null;
    }
    /* A gateway keeps its credential where its own app keeps it, not in the
       keys folder: reading it from here is what stops the settings screen from
       saying "connected" while every request fails for want of a key that was
       never going to be there. */
    if (this.name === 'opencode') {
      return opencodeAuth.api_key() || null;
    }
    const read_file = (pathname: string): string => {
      try {
        if (!fs.statSync(pathname).isFile()) return '';
      } catch {
        return '';
      }
      return fs.readFileSync(pathname, 'utf8').trim();
    };
    for (const directory of KEYS_DIRS) {
      const key = read_file(path.join(directory, `${this.name}.txt`));
      if (key) return key;
    }
    if (this.name === 'openrouter') {
      for (const legacy of _LEGACY_OR) {
        const key = read_file(legacy);
        if (key) return key;
      }
    }
    for (const env of this.env_keys) {
      const value = process.env[env];
      if (value && !value.includes('paste-your-key')) return value.trim();
    }
    return null;
  }

  save_key(k: string): void {
    if (this.dialect === 'codex') {
      throw new Error('Codex uses `codex login` on this machine, not a pasted key');
    }
    const secret = String(k ?? '').trim();
    if (!secret) throw new Error('key is empty');
    const directory = KEYS_DIRS[0];
    restrictPrivateDir(directory);
    const target = path.join(directory, `${this.name}.txt`);
    writePrivateFile(target, secret);
  }

  delete_key(): void {
    if (this.dialect === 'codex') {
      throw new Error('log out with `codex logout`, not Remove');
    }
    try {
      fs.unlinkSync(path.join(KEYS_DIRS[0], `${this.name}.txt`));
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code !== 'ENOENT') throw error;
    }
  }

  has_key(): boolean {
    return this.load_key() !== null;
  }
}

export const ANTHROPIC_MODELS: string[] = [
  'claude-fable-5.1', 'claude-fable-5', 'claude-opus-5.5', 'claude-opus-5', 'claude-sonnet-5.5',
  'claude-sonnet-5', 'claude-opus-4-8', 'claude-sonnet-4-6', 'claude-haiku-4-5',
];
export const GEMINI_MODELS: string[] = [
  'gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash',
  'gemini-3.5-flash-lite', 'gemini-3.1-pro-preview', 'gemini-flash-latest',
];
export const ZAI_MODELS: string[] = [
  'glm-5.3-prime', 'glm-5.3-flashx', 'glm-5.3-flash', 'glm-5.3', 'glm-5.1', 'glm-5', 'glm-4.7', 'glm-4.6',
];
/* NVIDIA advertises 81 ids on /v1/models, but most of them are embeddings,
   rerank, OCR, ASR, image, biology and weather NIMs that answer 404 on
   /chat/completions. Probed on 2026-09-29 against a live account: these are
   the ones that actually serve a text completion. Keep this list and
   CHEAP_BY_BACKEND['nvidia'] in step. */
export const NVIDIA_MODELS: string[] = [
  'nvidia/nemotron-3-ultra-550b-a55b',
  'nvidia/nemotron-3-super-120b-a12b',
  /* was pulled when it looked dead: it had sat through a queue that the 60s
     idle limit mistook for a hang. Re-probed 2026-10-03, four calls in a row,
     all answering — 318ms to 16s depending on the queue. */
  'nvidia/nemotron-3.5-lightning-30b-a3b',
  'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning',
  'meta/muse-glimmer-30b',
  'moonshotai/kimi-k3',
  'z-ai/glm-5.3',
  'z-ai/glm-5.3-flash',
  'deepseek-ai/deepseek-v4.1-flash',
  'google/gemma-4-31b-it',
  'openai/gpt-oss-20b',
  'poolside/laguna-xs-2.1',
  'google/diffusiongemma-26b-a4b-it',
  'meta/llama-3.2-90b-vision-instruct',
  'meta/llama-3.2-11b-vision-instruct',
];
export const SAMBANOVA_MODELS: string[] = [
  'DeepSeek-V3.2', 'DeepSeek-V3.1', 'MiniMax-M3', 'MiniMax-M2.7', 'gpt-oss-120b',
  'gemma-4-31B-it', 'Meta-Llama-3.3-70B-Instruct',
];
export const FIREWORKS_MODELS: string[] = [
  'accounts/fireworks/models/deepseek-v4.1-flash', 'accounts/fireworks/models/kimi-k3',
];
export const HUGGINGFACE_MODELS: string[] = [
  'openai/gpt-oss-120b', 'moonshotai/Kimi-K3', 'deepseek-ai/DeepSeek-V4-Pro', 'Qwen/Qwen3.5-397B-A17B',
];
export const MOONSHOT_MODELS: string[] = [
  'kimi-k3', 'kimi-k2.7-code', 'kimi-k2.6', 'kimi-k2.5',
];
export const DASHSCOPE_MODELS: string[] = [
  'qwen3.8-max', 'qwen3.7-plus', 'qwen3.8-flash', 'qwen-plus', 'qwen-turbo',
];
export const MINIMAX_MODELS: string[] = [
  'MiniMax-M3', 'MiniMax-M2.7', 'MiniMax-M2.5',
];
export const PERPLEXITY_MODELS: string[] = [
  'sonar-pro', 'sonar-reasoning-pro', 'sonar-deep-research', 'sonar',
];

export const BACKENDS: Record<string, Backend> = {
  anthropic: new Backend(
    'anthropic', '', 'claude-opus-5-5',
    {
      dialect: 'anthropic',
      cascade: ['claude-opus-5-5', 'claude-sonnet-5-5'],
      models: ANTHROPIC_MODELS,
      env_keys: ['ANTHROPIC_API_KEY'],
      blurb: 'native · Claude direct · real classifier + cache · TEST TARGET',
    },
  ),
  openrouter: new Backend(
    'openrouter', 'https://openrouter.ai/api/v1', 'x-ai/grok-4.6',
    {
      cascade: ['x-ai/grok-4.6', 'deepseek/deepseek-v4-pro-0813', 'moonshotai/kimi-k3', 'nousresearch/hermes-4-405b'],
      models: OPENROUTER_MODELS,
      env_keys: ['OPENROUTER_API_KEY'],
      blurb: 'paid · every model · strongest drafters + Claude targets',
    },
  ),
  orcarouter: new Backend(
    'orcarouter', 'https://api.orcarouter.ai/v1', 'orcarouter/auto',
    {
      cascade: ['orcarouter/auto', 'qwen/qwen3.8-max', 'qwen/qwen3.8-27b'],
      models: ORCAROUTER_MODELS,
      env_keys: ['ORCAROUTER_API_KEY', 'ORCA_API_KEY'],
      blurb: 'paid · 149 chat models · auto router + flexible FORGE 3.0 models',
    },
  ),
  zai: new Backend(
    'zai', 'https://api.z.ai/api/paas/v4/', 'glm-5.3',
    {
      cascade: ['glm-5.3', 'glm-5.1', 'glm-4.7'],
      models: ZAI_MODELS,
      env_keys: ['ZAI_API_KEY', 'Z_AI_API_KEY'],
      blurb: 'paid · GLM direct · OpenAI-compatible',
    },
  ),
  venice: new Backend(
    'venice', 'https://api.venice.ai/api/v1', 'venice-uncensored-1-2',
    {
      cascade: ['venice-uncensored-1-2', 'qwen-3-8-27b', 'qwen-3-6-plus'],
      models: VENICE_MODELS,
      env_keys: ['VENICE_API_KEY'],
      free: true,
      request_body: { venice_parameters: { include_venice_system_prompt: false } },
      blurb: 'free · 128 models · uncensored, abliterated and Qwen · FORGE 3.0 prompt authoritative',
    },
  ),
  gemini: new Backend(
    'gemini', 'https://generativelanguage.googleapis.com/v1beta/openai/', 'gemini-flash-latest',
    {
      cascade: ['gemini-flash-latest', 'gemini-3.8-flash'],
      models: GEMINI_MODELS,
      env_keys: ['GEMINI_API_KEY'],
      free: true,
      blurb: 'FREE tier · Gemini · soft target + cheap judge',
    },
  ),
  groq: new Backend(
    'groq', 'https://api.groq.com/openai/v1', 'openai/gpt-oss-120b',
    {
      cascade: ['openai/gpt-oss-120b', 'qwen/qwen3.8-27b'],
      models: ['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'qwen/qwen3.8-27b'],
      env_keys: ['GROQ_API_KEY'],
      free: true,
      blurb: 'FREE · ~500 tok/s',
    },
  ),
  deepseek: new Backend(
    'deepseek', 'https://api.deepseek.com', 'deepseek-flash',
    {
      cascade: ['deepseek-flash', 'deepseek-v4-pro'],
      models: ['deepseek-flash', 'deepseek-v4-pro'],
      env_keys: ['DEEPSEEK_API_KEY'],
      blurb: '$0.14/M in · pennies per prompt',
    },
  ),
  cerebras: new Backend(
    'cerebras', 'https://api.cerebras.ai/v1', 'gpt-oss-120b',
    {
      cascade: ['gpt-oss-120b'],
      models: ['gpt-oss-120b', 'zai-glm-4.7'],
      env_keys: ['CEREBRAS_API_KEY'],
      free: true,
      blurb: 'FREE · fastest inference',
    },
  ),
  xai: new Backend(
    'xai', 'https://api.x.ai/v1', 'grok-4.6',
    {
      cascade: ['grok-4.6'],
      models: ['grok-4.6', 'grok-4.5', 'grok-4.3', 'grok-build-0.1'],
      env_keys: ['XAI_API_KEY'],
      blurb: 'paid · Grok direct',
    },
  ),
  openai: new Backend(
    'openai', 'https://api.openai.com/v1', 'gpt-6.1-sol',
    {
      cascade: ['gpt-6.1-sol', 'gpt-6-astra'],
      models: ['gpt-6.1-sol', 'gpt-6-astra', 'gpt-6-sol', 'gpt-6-luna', 'gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-5.6-luna', 'gpt-4o', 'gpt-4o-mini'],
      env_keys: ['OPENAI_API_KEY'],
      blurb: 'paid · OpenAI direct',
    },
  ),
codex: new Backend(
    'codex', 'https://chatgpt.com/backend-api/codex', 'gpt-6-sol',
    {
      dialect: 'codex',
      gateway: true,
      cascade: ['gpt-6-sol', 'gpt-6-luna'],
      models: [...CODEX_MODELS],
      blurb: 'your ChatGPT/Codex login · ~/.codex/auth.json · no key to paste',
    },
  ),
  opencode: new Backend(
    'opencode', opencodeAuth.ZEN_BASE_URL, 'space-bunny-free',
    {
      dialect: 'openai',
      gateway: true,
      /* only the free tier, and only what the endpoint serves today: Zen's
         free models are the ones whose id ends in `-free`, and a frozen copy
         would keep offering what OpenCode has retired. */
      models: await opencodeAuth.catalog(),
      cascade: ['space-bunny-free', 'nemotron-3-ultra-free', 'deepseek-v4-flash-free'],
      blurb: 'the OpenCode app account · the free tier only · ~/.local/share/opencode/auth.json',
    },
  ),
  mistral: new Backend(
    'mistral', 'https://api.mistral.ai/v1', 'mistral-large-latest',
    {
      cascade: ['mistral-large-latest', 'mistral-medium-latest'],
      models: ['mistral-large-latest', 'mistral-medium-latest', 'mistral-small-latest'],
      env_keys: ['MISTRAL_API_KEY'],
      blurb: 'paid · Mistral',
    },
  ),
  together: new Backend(
    'together', 'https://api.together.xyz/v1', 'moonshotai/Kimi-K3',
    {
      cascade: ['moonshotai/Kimi-K3'],
      models: ['moonshotai/Kimi-K3', 'MiniMaxAI/MiniMax-M3', 'deepseek-ai/DeepSeek-V4-Pro'],
      env_keys: ['TOGETHER_API_KEY'],
      blurb: 'paid · open models',
    },
  ),
  nvidia: new Backend(
    'nvidia', 'https://integrate.api.nvidia.com/v1', 'nvidia/nemotron-3-ultra-550b-a55b',
    {
      cascade: ['nvidia/nemotron-3-ultra-550b-a55b', 'nvidia/nemotron-3-super-120b-a12b', 'openai/gpt-oss-20b'],
      models: NVIDIA_MODELS,
      env_keys: ['NVIDIA_API_KEY'],
      free: true,
      blurb: 'FREE tier · NVIDIA NIM · Nemotron, Kimi, GLM, DeepSeek',
    },
  ),
  sambanova: new Backend(
    'sambanova', 'https://api.sambanova.ai/v1', 'DeepSeek-V3.2',
    {
      cascade: ['DeepSeek-V3.2', 'MiniMax-M3', 'Meta-Llama-3.3-70B-Instruct'],
      models: SAMBANOVA_MODELS,
      env_keys: ['SAMBANOVA_API_KEY'],
      free: true,
      blurb: 'FREE tier · fast open models',
    },
  ),
  fireworks: new Backend(
    'fireworks', 'https://api.fireworks.ai/inference/v1', 'accounts/fireworks/models/deepseek-v4.1-flash',
    {
      cascade: ['accounts/fireworks/models/deepseek-v4.1-flash', 'accounts/fireworks/models/kimi-k3'],
      models: FIREWORKS_MODELS,
      env_keys: ['FIREWORKS_API_KEY'],
      blurb: 'paid · open weights · fastest serving',
    },
  ),
  huggingface: new Backend(
    'huggingface', 'https://router.huggingface.co/v1', 'openai/gpt-oss-120b',
    {
      cascade: ['openai/gpt-oss-120b', 'moonshotai/Kimi-K3'],
      models: HUGGINGFACE_MODELS,
      env_keys: ['HF_TOKEN', 'HUGGINGFACE_API_KEY'],
      blurb: 'paid · Hugging Face router · one token',
    },
  ),
  moonshot: new Backend(
    'moonshot', 'https://api.moonshot.ai/v1', 'kimi-k3',
    {
      cascade: ['kimi-k3', 'kimi-k2.7-code'],
      models: MOONSHOT_MODELS,
      env_keys: ['MOONSHOT_API_KEY'],
      blurb: 'paid · Kimi direct · long context',
    },
  ),
  dashscope: new Backend(
    'dashscope', 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1', 'qwen3.8-max',
    {
      cascade: ['qwen3.8-max', 'qwen3.7-plus'],
      models: DASHSCOPE_MODELS,
      env_keys: ['DASHSCOPE_API_KEY'],
      blurb: 'paid · Alibaba Qwen direct',
    },
  ),
  minimax: new Backend(
    'minimax', 'https://api.minimaxi.com/v1', 'MiniMax-M3',
    {
      cascade: ['MiniMax-M3', 'MiniMax-M2.7'],
      models: MINIMAX_MODELS,
      env_keys: ['MINIMAX_API_KEY'],
      blurb: 'paid · MiniMax M3 agentic',
    },
  ),
  perplexity: new Backend(
    'perplexity', 'https://api.perplexity.ai', 'sonar-pro',
    {
      cascade: ['sonar-pro', 'sonar'],
      models: PERPLEXITY_MODELS,
      env_keys: ['PERPLEXITY_API_KEY'],
      blurb: 'paid · Sonar with live web search',
    },
  ),
};

export const DEFAULT_BACKEND = 'openrouter';

export function get_backend(name: string): Backend {
  return Object.prototype.hasOwnProperty.call(BACKENDS, name) ? BACKENDS[name] : BACKENDS[DEFAULT_BACKEND];
}

export const _PROVIDER_LABELS: Record<string, string> = {
  openrouter: 'OpenRouter',
  orcarouter: 'OrcaRouter',
  zai: 'Z.AI',
  venice: 'Venice',
  xai: 'xAI',
  openai: 'OpenAI',
  codex: 'Codex',
  anthropic: 'Anthropic',
  gemini: 'Gemini',
  groq: 'Groq',
  deepseek: 'DeepSeek',
  cerebras: 'Cerebras',
  mistral: 'Mistral',
  together: 'Together',
  nvidia: 'NVIDIA',
  sambanova: 'SambaNova',
  fireworks: 'Fireworks',
  huggingface: 'Hugging Face',
  moonshot: 'Moonshot',
  dashscope: 'Alibaba DashScope',
  minimax: 'MiniMax',
  perplexity: 'Perplexity',
};

/** Some endpoints accept the request, answer 200, and only then report the
    failure *inside* the event stream (`data: {"error": {...}}`). Read as a
    normal chunk it looks like an empty answer, so the turn dies with nothing
    to show and no reason to show. Turn it into the same error a non-2xx would
    have produced, so the retry rules and the message the user reads both
    work. */
function _describe_stream_failure(detail: Record<string, any>): Error {
  const message = String(detail['message'] ?? detail['msg'] ?? 'the provider failed mid-stream').trim();
  const code = detail['code'] ?? detail['status'] ?? detail['status_code'];
  const numeric = Number(code);
  const prefix = Number.isFinite(numeric) && numeric >= 100 && numeric <= 599
    ? `Error code: ${Math.trunc(numeric)} - `
    : '';
  const kind = detail['type'] ? String(detail['type']).trim() : '';
  const tail = kind && !message.toLowerCase().includes(kind.toLowerCase()) ? ` (${kind})` : '';
  return new Error(`${prefix}${message}${tail}`);
}

export function _stream_error(chunk: unknown): Error | null {
  if (!chunk || typeof chunk !== 'object') return null;
  const bag = chunk as Record<string, any>;
  const raw = bag['error'];
  /* Anthropic wraps the refusal: {"type":"error","error":{"type":...,"message":...}},
     where the payload inside is the error itself and carries no `error` of its
     own. Everyone else puts it straight on the chunk. */
  if (bag['type'] === 'error') {
    if (raw && typeof raw === 'object') return _describe_stream_failure(raw as Record<string, any>);
    if (typeof raw === 'string' && raw.trim()) return new Error(raw.trim());
    return _describe_stream_failure(bag);
  }
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'string') {
    const text = raw.trim();
    return text ? new Error(text) : null;
  }
  if (typeof raw !== 'object') return null;
  return _describe_stream_failure(raw as Record<string, any>);
}

export function _provider_status(error: unknown): number | null {
  const owners: unknown[] = [error];
  if (error !== null && error !== undefined) owners.push((error as { response?: unknown }).response);
  for (const owner of owners) {
    const value = owner === null || owner === undefined ? undefined : (owner as { status_code?: unknown }).status_code;
    if (value !== undefined && value !== null) {
      try {
        if (typeof value === 'string' && value.trim() === '') throw new Error();
        const parsed = Number(value);
        if (Number.isNaN(parsed)) throw new Error();
        return Math.trunc(parsed);
      } catch {
        continue;
      }
    }
  }
  const text = error instanceof Error ? error.message : String(error);
  const match = /(?:error\s+code|status|code)[^0-9]{0,12}([1-5][0-9]{2})/i.exec(text);
  return match ? Math.trunc(Number(match[1])) : null;
}

export function format_provider_error(error: unknown, backend_name: string): string {
  const backend_key = String(backend_name || 'provider').trim().toLowerCase();
  const to_title = (value: string): string => {
    let out = '';
    let previous_cased = false;
    for (const character of value) {
      const cased = /[A-Za-z]/.test(character);
      if (cased) out += previous_cased ? character.toLowerCase() : character.toUpperCase();
      else out += character;
      previous_cased = cased;
    }
    return out;
  };
  const mapped = Object.prototype.hasOwnProperty.call(_PROVIDER_LABELS, backend_key) ? _PROVIDER_LABELS[backend_key] : undefined;
  const label = mapped ?? (to_title(backend_key) || 'Provider');
  const raw = (error instanceof Error ? error.message : String(error)).split(/\s+/).join(' ').trim().toLowerCase();
  const status = _provider_status(error);
  const key_action = `Press Ctrl+P, choose ${backend_key.toUpperCase()}, click it, and paste a fresh key.`;
  if (backend_key === 'codex') {
    const login_failure = status === 401 || ['codex login expired', 'no codex login', 'run `codex login`', 'auth.json is corrupt', 'missing an account id'].some((token) => raw.includes(token));
    if (login_failure) return 'Codex login expired — run `codex login`.';
    if ((status === 400 || status === 404) && ['model is not supported', 'model not supported', 'not supported when using codex', 'invalid model', 'unknown model', 'model not found'].some((token) => raw.includes(token))) {
      return 'Codex does not currently offer the selected model on this ChatGPT login. Pin another Codex model with Ctrl+M.';
    }
    if (status === 400) return 'Codex rejected the request (HTTP 400). Check the selected Codex model and retry.';
    if (status === 403) return 'Codex denied this ChatGPT login or model. Check the subscription permissions.';
    if (status === 429) return 'Codex rate limit reached. Wait briefly, then retry.';
    if (status !== null && status >= 500) return `Codex is temporarily unavailable (HTTP ${status}). Retry shortly.`;
  }
  if (status === 401) {
    const reason = raw.includes('expired') ? 'API key expired' : 'API key was rejected';
    return `${label} ${reason}. ${key_action}`;
  }
  if (status === 402) return `${label} credits are depleted. Add provider credits, then retry.`;
  if (raw.includes('free tier') || raw.includes('fre[eé]tier')) {
    /* OpenCode restricts its free tier to its own app. Saying so plainly is
       the only honest thing to say: retrying cannot get past it, and a bare
       403 would look like a fault in Forge. */
    if (backend_key === 'opencode') {
      return 'OpenCode only serves its free tier from inside the OpenCode app. ' +
        'This model answers there and nowhere else for now.';
    }
  }
  if (raw.includes('within opencode') || raw.includes('from within')) {
    return backend_key === 'opencode'
      ? 'OpenCode only serves this model from inside the OpenCode app.'
      : `${label} refused this request.`;
  }
  if (status === 403) return `${label} denied access for this key or model. Check its provider permissions — NVIDIA also answers 403 when a free endpoint is briefly busy, so retrying is worth it.`;
  if (status === 404 || raw.includes('model not found')) return `${label} does not currently offer the selected model. Pin another model with Ctrl+M.`;
  if (status === 400) {
    if (['invalid model', 'unknown model', 'model not found', 'no endpoints', 'not a valid model', 'model id', 'does not exist'].some((token) => raw.includes(token))) {
      return `${label} does not currently offer the selected model. Pin a live model with Ctrl+M.`;
    }
    if (raw.includes('reasoning_content') || raw.includes('reasoning content')) {
      return `${label} rejected missing reasoning state. Start a new chat or retry with the same reasoning model.`;
    }
    if (['unsupported parameter', 'unknown parameter', 'not supported', 'temperature', 'max_tokens', 'max completion tokens'].some((token) => raw.includes(token))) {
      return `${label} rejected a request parameter for this model. Update the model profile or pin another model.`;
    }
    return `${label} rejected the request (HTTP 400). Check the pinned model and its request settings.`;
  }
  if (status === 429) {
    /* a gateway is throttled by the subscription behind it, so the plan is
       named: "rate limit" on its own reads like a fault in the app rather
       than what it is, which is the tier the login is on */
    if (backend_key === 'codex') {
      const tier = codex_plan().plan;
      if (tier === 'free') {
        return 'Codex rate limit reached, and this login is on the free plan. ' +
          'Free Codex is throttled hard — wait a minute, use another model, or upgrade the plan.';
      }
      if (tier) {
        return `Codex rate limit reached on the ${tier} plan. Wait briefly, then retry.`;
      }
    }
    return `${label} rate limit reached. Wait briefly, then retry.`;
  }
  if (status !== null && status >= 500) return `${label} is temporarily unavailable (HTTP ${status}). Retry shortly.`;
  if (raw.includes('timed out') || raw.includes('timeout')) return `${label} request timed out. Check the connection, then retry.`;
  if (raw.includes('connection') || raw.includes('network')) return `${label} connection failed. Check the network, then retry.`;
  const suffix = status !== null ? ` (HTTP ${status})` : '';
  return `${label} request failed${suffix}. Check the provider key, model, and connection.`;
}

/** true when retrying (same model or another) can never succeed: dead key,
    dead model, or a request the provider will always reject */
export function is_permanent_provider_error(error: unknown): boolean {
  const status = _provider_status(error);
  if (status === 401 || status === 402 || status === 403 || status === 404) return true;
  const raw = (error instanceof Error ? error.message : String(error)).toLowerCase();
  if (
    [
      'model not found',
      'unknown model',
      'invalid model',
      'does not exist',
      'no longer exists',
      'model_not_found',
      'model_not_supported',
      'unknown_model',
    ].some((token) => raw.includes(token))
  ) {
    return true;
  }
  if (
    status === 400 &&
    ['not supported', 'no endpoints', 'not a valid model', 'model id'].some((token) => raw.includes(token))
  ) {
    return true;
  }
  return false;
}

export function model_choices(overlays?: Record<string, string[]> | null): ModelChoice[] {
  const out: ModelChoice[] = [];
  for (const [name, be] of Object.entries(BACKENDS)) {
    /* A gateway has no key to hold — it reaches its models through a
       subscription and a local login. Demanding a key there was telling the
       reader to go and paste something that does not exist, so what decides
       usability is the login being present, not a file in the keys folder. */
    const keyed = be.gateway ? gateway_reader(name).connected : be.has_key();
    const extra = overlays && !Array.isArray(overlays) ? (overlays[name] ?? []) : [];
    const seen = new Set<string>();
    let catalog: string[] = [];
    for (const model of [...be.models, ...extra]) {
      if (seen.has(model)) continue;
      seen.add(model);
      catalog.push(model);
    }
    catalog = catalog.filter((model) => !is_media_only_model(model));
    for (const model of catalog) {
      const uncensored = UNCENSORED_MODELS_BY_BACKEND[name];
      const traits: string[] = uncensored && uncensored.has(model) ? ['uncensored'] : [];
      /* Asked of the provider, not assumed: a gateway that is signed in can
         still have some of its models refused, and a row that says it can be
         used while the server says otherwise is the row that wastes the
         reader's afternoon. */
      const note = name === 'opencode' ? opencodeAuth.probed_state(model)?.why ?? '' : '';
      out.push({
        backend: name,
        model,
        tag: be.tag,
        keyed,
        gateway: be.gateway || undefined,
        is_default: model === be.default_model,
        label: `${name} · ${model}`,
        traits,
        search: `${name} ${model} ${traits.join(' ')} ${note}`.toLowerCase(),
        price_in: price_for(model)[0],
        price_out: price_for(model)[1],
        ...(note ? { note } : {}),
      });
    }
  }
  return out;
}

export abstract class Client {
  protected _last_usage: Usage | null = null;
  protected _last_finish_reason: string | null = null;
  protected _hidden_text = '';
  /** optional sink for reasoning deltas, set by the caller for the length of
      one stream so an agent turn can interleave thinking with its answer */
  on_reasoning?: (text: string) => void;
  protected _last_visible = '';
  protected _last_hidden = '';
  protected _last_refusal = '';
  protected _last_tool_calls: ToolCall[] = [];

  abstract stream(model: string, system: string | null, messages: ChatMessage[], max_tokens?: number, temperature?: number, json_mode?: boolean, top_p?: number, tools?: ToolDef[] | null, signal?: AbortSignal, effort?: string, onActivity?: () => void): AsyncIterable<string>;

  protected _reset_tools(): void {
    this._last_tool_calls = [];
  }

  protected _note_tool_call(index: number, id: string, name: string, args: string): void {
    let slot = this._last_tool_calls[index];
    if (!slot) {
      slot = { id: '', name: '', arguments: '' };
      this._last_tool_calls[index] = slot;
    }
    if (id) slot.id = String(id);
    if (name) slot.name = String(name);
    if (args) slot.arguments += String(args);
  }

  private async _join(source: AsyncIterable<string>): Promise<string> {
    let text = '';
    for await (const piece of source) text += piece;
    return text.trim();
  }

  async complete(model: string, system: string | null, messages: ChatMessage[], max_tokens = 4000, temperature = 0.9, json_mode = false, top_p = 1, tools: ToolDef[] | null = null, signal?: AbortSignal): Promise<string> {
    this._last_visible = '';
    this._last_hidden = '';
    let text: string;
    try {
      text = await this._join(this.stream(model, system, messages, max_tokens, temperature, json_mode, top_p, tools, signal));
    } catch (error) {
      if (!(error instanceof TypeError)) throw error;
      text = await this._join(this.stream(model, system, messages, max_tokens, temperature, false, top_p, tools, signal));
    }
    const hidden = String(this._hidden_text ?? '').trim();
    this._last_visible = text;
    this._last_hidden = hidden;
    return text || hidden;
  }

  async list_models(): Promise<string[]> {
    return [];
  }

  /* how many output tokens this model accepts, straight from the
     provider's /models metadata — null when it doesn't publish one */
  async live_max_output_tokens(_model: string): Promise<number | null> {
    return null;
  }

  last_usage(): Usage | null {
    return this._last_usage;
  }

  last_finish_reason(): string | null {
    return this._last_finish_reason;
  }

  last_reasoning_content(): string {
    return String(this._hidden_text ?? '').trim();
  }

  last_refusal(): string {
    return String(this._last_refusal ?? '').trim();
  }

  last_tool_calls(): ToolCall[] {
    return this._last_tool_calls.filter((call) => Boolean(call && call.name));
  }
}

export class AnthropicClient extends Client {
  private readonly _key: string;
  private readonly _verify: boolean;

  constructor(key: string, verify = true) {
    super();
    this._key = key;
    this._verify = verify;
  }

  async *stream(model: string, system: string | null, messages: ChatMessage[], max_tokens = 4000, temperature = 0.9, json_mode = false, top_p = 1, tools: ToolDef[] | null = null, signal?: AbortSignal, effort: string = 'medium', onActivity?: () => void): AsyncIterable<string> {
    void effort; /* the native Anthropic path carries no thinking block — effort applies to OpenAI-compatible backends */
    this._last_usage = null;
    this._last_finish_reason = null;
    this._reset_tools();
    const sys_block = system ? [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }] : undefined;
    const portable_messages: Array<Record<string, any>> = [];
    for (const message of messages) {
      const role = String(message.role ?? 'user');
      if (role === 'assistant' && message.tool_calls && message.tool_calls.length) {
        const blocks: Array<Record<string, any>> = [];
        if (String(message.content || '').trim()) blocks.push({ type: 'text', text: String(message.content) });
        message.tool_calls.forEach((call, index) => {
          let input: any = {};
          try {
            input = JSON.parse(call.arguments || '{}');
          } catch {
            input = { raw: String(call.arguments || '') };
          }
          if (!input || typeof input !== 'object' || Array.isArray(input)) input = { value: input };
          blocks.push({ type: 'tool_use', id: call.id || `toolu_${index}`, name: call.name, input });
        });
        portable_messages.push({ role: 'assistant', content: blocks });
        continue;
      }
      if (role === 'tool') {
        const block = {
          type: 'tool_result',
          tool_use_id: String(message.tool_call_id || ''),
          content: String(message.content ?? ''),
        };
        const previous = portable_messages[portable_messages.length - 1];
        const grouped =
          previous &&
          previous['role'] === 'user' &&
          Array.isArray(previous['content']) &&
          (previous['content'] as Array<Record<string, any>>).some((entry) => entry && entry['type'] === 'tool_result');
        if (grouped) {
          (previous['content'] as Array<Record<string, any>>).push(block);
        } else {
          portable_messages.push({ role: 'user', content: [block] });
          continue;
        }
        continue;
      }
      const tail = portable_messages[portable_messages.length - 1];
      if (tail && tail['role'] === 'user' && role === 'user') {
        const tail_content = tail['content'];
        const blocks = Array.isArray(tail_content)
          ? [...(tail_content as Array<Record<string, any>>)]
          : [{ type: 'text', text: String(tail_content ?? '') }];
        blocks.push({ type: 'text', text: String(message.content ?? '') });
        tail['content'] = blocks;
        continue;
      }
      portable_messages.push({ role, content: message.content ?? '' });
    }
    const body: Record<string, any> = {
      model,
      max_tokens: credit_safe_completion_tokens(model, max_tokens),
      temperature,
      system: sys_block,
      messages: portable_messages,
      stream: true,
    };
    if (tools && tools.length) {
      body['tools'] = tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        input_schema: tool.parameters,
      }));
    }
    if (top_p > 0 && top_p < 1) body['top_p'] = top_p;
    const response = await httpRequest('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': this._key,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body,
      verify: this._verify,
      signal,
      onActivity,
      timeout: silence_budget(effort),
    });
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Error code: ${response.status} - ${detail}`);
    }
    let input_tokens = 0;
    let output_tokens = 0;
    let cache_read_input_tokens = 0;
    let saw_usage = false;
    for await (const raw of response.events()) {
      let payload: Record<string, any>;
      try {
        payload = JSON.parse(raw);
      } catch {
        continue;
      }
      if (!payload || typeof payload !== 'object') continue;
      const streamed_failure = _stream_error(payload);
      if (streamed_failure) throw streamed_failure;
      const kind = String(payload['type'] ?? '');
      if (kind === 'content_block_start') {
        const block = payload['content_block'];
        if (block && typeof block === 'object' && block['type'] === 'tool_use') {
          const raw_index = Number(payload['index']);
          const index = Number.isFinite(raw_index) ? Math.trunc(raw_index) : this._last_tool_calls.length;
          this._note_tool_call(index, String(block['id'] ?? ''), String(block['name'] ?? ''), '');
        }
        continue;
      }
      if (kind === 'content_block_delta') {
        const delta = payload['delta'] ?? {};
        if (delta['type'] === 'input_json_delta') {
          const partial = String(delta['partial_json'] ?? '');
          if (partial) {
            const raw_index = Number(payload['index']);
            const index = Number.isFinite(raw_index) ? Math.trunc(raw_index) : this._last_tool_calls.length - 1;
            this._note_tool_call(index, '', '', partial);
          }
          continue;
        }
        const piece = delta['text'];
        if (piece) yield String(piece);
        continue;
      }
      try {
        if (kind === 'message_start') {
          const usage = payload['message'] && payload['message']['usage'];
          if (usage && typeof usage === 'object') {
            input_tokens = Math.trunc(Number(usage['input_tokens'] ?? 0));
            output_tokens = Math.trunc(Number(usage['output_tokens'] ?? 0));
            cache_read_input_tokens = Math.trunc(Number(usage['cache_read_input_tokens'] ?? 0));
            saw_usage = true;
          }
        } else if (kind === 'message_delta') {
          const stop_reason = payload['delta'] && payload['delta']['stop_reason'];
          if (stop_reason) this._last_finish_reason = String(stop_reason);
          const usage = payload['usage'];
          if (usage && typeof usage === 'object') {
            if (usage['input_tokens'] !== undefined && usage['input_tokens'] !== null) input_tokens = Math.trunc(Number(usage['input_tokens']));
            if (usage['output_tokens'] !== undefined && usage['output_tokens'] !== null) output_tokens = Math.trunc(Number(usage['output_tokens']));
            if (usage['cache_read_input_tokens'] !== undefined && usage['cache_read_input_tokens'] !== null) cache_read_input_tokens = Math.trunc(Number(usage['cache_read_input_tokens']));
            saw_usage = true;
          }
          if (saw_usage) {
            this._last_usage = {
              input_tokens,
              output_tokens,
              cache_read_input_tokens,
            };
          }
        }
      } catch {
      }
    }
  }

  override async list_models(): Promise<string[]> {
    return [...ANTHROPIC_MODELS];
  }
}

export const _EXTRA: Record<string, string> = { 'HTTP-Referer': 'https://localhost/forge3', 'X-Title': 'forge3' };

export class OpenAICompatClient extends Client {
  static readonly _EXTRA: Record<string, string> = _EXTRA;

  private readonly _key: string;
  private readonly _base_url: string;
  private readonly _request_body: Record<string, any>;
  private readonly _verify: boolean;

  constructor(base_url: string, key: string, verify = true, request_body?: Record<string, object> | null) {
    super();
    this._base_url = base_url;
    this._key = key;
    this._request_body = { ...(request_body ?? {}) };
    this._verify = verify;
  }

  _gemini_endpoint(model: string): boolean {
    const blob = `${this._base_url} ${model}`.toLowerCase();
    return blob.includes('gemini') || blob.includes('generativelanguage');
  }

  /** NVIDIA has no reasoning knob. Sent one anyway, it does not answer with a
      status: it replies HTTP 200 and puts the refusal *inside* the stream, so
      the turn looks empty and the provider error is never seen. Nemotron and
      the GLM models served there reason on their own, so the parameter is
      simply never built for this endpoint. */
  _takes_reasoning_param(): boolean {
    return !/integrate\.api\.nvidia\.com/.test(String(this._base_url || '').toLowerCase());
  }

  static _model_leaf(model: string): string {
    return String(model || '').split('/').pop()?.toLowerCase() ?? '';
  }

  static _astra_model(model: string): boolean {
    return OpenAICompatClient._model_leaf(model).startsWith('gpt-6-astra');
  }

  static _openai_modern_model(model: string): boolean {
    const leaf = OpenAICompatClient._model_leaf(model).split(':')[0] ?? '';
    return (
      OpenAICompatClient._astra_model(model) ||
      leaf.startsWith('gpt-5') ||
      leaf.startsWith('o1') ||
      leaf.startsWith('o3') ||
      leaf.startsWith('o4')
    );
  }

  static _fable_model(model: string): boolean {
    return OpenAICompatClient._model_leaf(model).startsWith('claude-fable');
  }

  _developer_instruction_model(model: string): boolean {
    return OpenAICompatClient._openai_modern_model(model);
  }

  _msgs(system: string | null, messages: ChatMessage[], model = '', role: string | null = null): Array<Record<string, any>> {
    const resolved_role = role ?? (this._developer_instruction_model(model) ? 'developer' : 'system');
    const prepared: Array<Record<string, any>> = [];
    for (const message of messages) {
      const item: Record<string, any> = {
        role: message.role ?? 'user',
        content: message.content ?? '',
      };
      const reasoning = message.reasoning_content;
      const reasoning_model = String(message.reasoning_model || '');
      if (reasoning && (!reasoning_model || reasoning_model === model)) item['reasoning_content'] = reasoning;
      const calls = message.tool_calls;
      if (calls && calls.length) {
        item['tool_calls'] = calls.map((call) => ({
          id: call.id || '',
          type: 'function',
          function: { name: call.name, arguments: call.arguments || '{}' },
        }));
        if (!String(message.content || '').trim()) item['content'] = null;
      }
      if (message.tool_call_id) item['tool_call_id'] = message.tool_call_id;
      prepared.push(item);
    }
    const messages_with_system: Array<Record<string, any>> = system ? [{ role: resolved_role, content: system }] : [];
    return messages_with_system.concat(prepared);
  }

  async *stream(model: string, system: string | null, messages: ChatMessage[], max_tokens = 4000, temperature = 0.9, json_mode = false, top_p = 1, tools: ToolDef[] | null = null, signal?: AbortSignal, effort: string = 'medium', onActivity?: () => void): AsyncIterable<string> {
    this._last_usage = null;
    this._last_finish_reason = null;
    this._hidden_text = '';
    this._last_refusal = '';
    this._reset_tools();
    const hidden: string[] = [];
    const developer_instruction = this._developer_instruction_model(model);
    const completion_tokens = credit_safe_completion_tokens(model, max_tokens);
    const create_kwargs: Record<string, any> = {
      model,
      messages: this._msgs(system, messages, model),
      stream: true,
      stream_options: { include_usage: true },
    };
    if (tools && tools.length) {
      create_kwargs['tools'] = tools.map((tool) => ({
        type: 'function',
        function: { name: tool.name, description: tool.description, parameters: tool.parameters },
      }));
      create_kwargs['tool_choice'] = 'auto';
    }
    const send_top_p = top_p > 0 && top_p < 1;
    if (developer_instruction) {
      create_kwargs['max_completion_tokens'] = completion_tokens;
    } else {
      create_kwargs['max_tokens'] = completion_tokens;
      create_kwargs['temperature'] = temperature;
      if (send_top_p) create_kwargs['top_p'] = top_p;
    }
    const provider_body: Record<string, any> = { ...this._request_body };
    const extra_body: Record<string, any> = { ...provider_body };
    const gemini_endpoint = this._gemini_endpoint(model);
    if (json_mode) {
      create_kwargs['response_format'] = { type: 'json_object' };
      if (gemini_endpoint) extra_body['google'] = { thinking_config: { thinking_budget: 0 } };
    }
    const reasoning_budget = gemini_endpoint || !this._takes_reasoning_param()
      ? null
      : reasoning_budget_for(model, completion_tokens, effort);
    if (reasoning_budget !== null) {
      extra_body['reasoning'] = reasoning_budget ? { max_tokens: reasoning_budget } : { enabled: false };
    }
    if (Object.keys(extra_body).length) create_kwargs['extra_body'] = extra_body;
    const attempts: Array<Record<string, any>> = [{ ...create_kwargs }];
    if (json_mode) {
      if (gemini_endpoint) {
        const portable: Record<string, any> = { ...create_kwargs };
        if (Object.keys(provider_body).length) portable['extra_body'] = provider_body;
        else delete portable['extra_body'];
        attempts.push(portable);
      }
      const bare: Record<string, any> = { ...attempts[attempts.length - 1] };
      delete bare['response_format'];
      attempts.push(bare);
    }
    if (reasoning_budget !== null) {
      const plain: Record<string, any> = { ...attempts[attempts.length - 1] };
      const plain_body: Record<string, any> = {};
      for (const [key, value] of Object.entries({ ...(plain['extra_body'] ?? {}) })) {
        if (key !== 'reasoning') plain_body[key] = value;
      }
      if (Object.keys(plain_body).length) plain['extra_body'] = plain_body;
      else delete plain['extra_body'];
      attempts.push(plain);
    }
    if (OpenAICompatClient._fable_model(model) && developer_instruction) {
      const classic: Record<string, any> = { ...attempts[attempts.length - 1] };
      classic['messages'] = this._msgs(system, messages, model, 'system');
      delete classic['max_completion_tokens'];
      classic['max_tokens'] = completion_tokens;
      classic['temperature'] = temperature;
      if (send_top_p) classic['top_p'] = top_p;
      attempts.push(classic);
    }
    let response: Awaited<ReturnType<typeof httpRequest>> | undefined;
    let lastError: unknown = null;
    for (const kwargs of attempts) {
      try {
        const { extra_body: body_extra, ...rest } = kwargs;
        const res = await httpRequest(`${this._base_url.replace(/\/+$/, '')}/chat/completions`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this._key}`,
            'Content-Type': 'application/json',
            ..._EXTRA,
          },
          body: { ...rest, ...(body_extra ?? {}) },
          verify: this._verify,
          signal,
          onActivity,
          timeout: silence_budget(effort, this._base_url),
        });
        if (res.ok) {
          response = res;
          break;
        }
        const detail = await res.text();
        lastError = new Error(`Error code: ${res.status} - ${detail}`);
      } catch (error) {
        /* a dead network fails every payload shape the same way — the
           request already retried with backoff inside httpRequest, so fail
           fast instead of replaying the call per variant (and let a user
           Stop surface immediately) */
        throw error;
      }
    }
    if (!response) {
      if (lastError) throw lastError;
      throw new Error('judge stream failed');
    }
    try {
      for await (const raw of response.events()) {
        let chunk: Record<string, any>;
        try {
          chunk = JSON.parse(raw);
        } catch {
          continue;
        }
        if (!chunk || typeof chunk !== 'object') continue;
        const streamed_failure = _stream_error(chunk);
        if (streamed_failure) throw streamed_failure;
        const usage = chunk['usage'];
        if (usage && typeof usage === 'object') {
          const details = usage['prompt_tokens_details'];
          const cached = details && typeof details === 'object' ? Math.trunc(Number(details['cached_tokens'] ?? 0)) : 0;
          this._last_usage = {
            input_tokens: Math.trunc(Number(usage['prompt_tokens'] ?? 0)),
            output_tokens: Math.trunc(Number(usage['completion_tokens'] ?? 0)),
            cache_read_input_tokens: cached,
          };
        }
        const choices = chunk['choices'];
        if (!Array.isArray(choices) || !choices.length) continue;
        const choice = choices[0] ?? {};
        const finish_reason = choice['finish_reason'];
        if (finish_reason) this._last_finish_reason = String(finish_reason);
        const delta = choice['delta'] ?? {};
        const refused = delta['refusal'];
        if (refused) this._last_refusal += String(refused);
        const calls = delta['tool_calls'];
        if (Array.isArray(calls)) {
          for (const entry of calls) {
            if (!entry || typeof entry !== 'object') continue;
            const raw_index = Number((entry as any).index);
            const index = Number.isFinite(raw_index) ? Math.trunc(raw_index) : this._last_tool_calls.length;
            const fn = (entry as any).function && typeof (entry as any).function === 'object' ? (entry as any).function : {};
            this._note_tool_call(
              index,
              (entry as any).id ? String((entry as any).id) : '',
              fn.name ? String(fn.name) : '',
              fn.arguments ? String(fn.arguments) : '',
            );
          }
        }
        const piece = delta['content'];
        if (piece) {
          yield String(piece);
          continue;
        }
        for (const attr of ['reasoning', 'reasoning_content']) {
          const hidden_piece = delta[attr];
          if (hidden_piece) {
            const text = String(hidden_piece);
            hidden.push(text);
            /* reasoning arrives while the answer is being written: handing it
               over as it comes is what lets a turn read as
               thinking → text → tool → thinking instead of one lump at the end */
            try {
              this.on_reasoning?.(text);
            } catch {
              /* a listener that throws must not break the stream */
            }
            break;
          }
        }
      }
    } finally {
      this._hidden_text = hidden.join('');
    }
  }

  private static readonly _cap_cache = new Map<string, { cap: number; at: number; ttl: number }>();

  override async live_max_output_tokens(model: string): Promise<number | null> {
    const key = `${this._base_url}|${model}`;
    const now = Date.now();
    const hit = OpenAICompatClient._cap_cache.get(key);
    /* hits are good for hours, misses only for a minute — a single
       transient must not pin the table fallback for half a day */
    if (hit && now - hit.at < hit.ttl) {
      return hit.cap > 0 ? hit.cap : null;
    }
    let cap = 0;
    try {
      const response = await httpRequest(`${this._base_url.replace(/\/+$/, '')}/models`, {
        headers: {
          'Authorization': `Bearer ${this._key}`,
        },
        verify: this._verify,
        timeout: 6,
      });
      if (response.ok) {
        const payload = await response.json<{ data?: Array<Record<string, any>> }>();
        const rows = payload && Array.isArray(payload.data) ? payload.data : [];
        const leaf = String(model).split('/').pop() ?? '';
        const leaf_low = leaf.toLowerCase();
        const entry = rows.find(
          (row) =>
            row &&
            typeof row.id === 'string' &&
            (row.id === model ||
              (leaf_low.length > 0 && row.id.split('/').pop()?.toLowerCase() === leaf_low)),
        );
        if (entry) {
          const top =
            entry['top_provider'] && typeof entry['top_provider'] === 'object'
              ? entry['top_provider']
              : null;
          cap =
            Math.trunc(Number(top && top['max_completion_tokens'])) ||
            Math.trunc(Number(entry['max_output_tokens'])) ||
            Math.trunc(Number(entry['max_completion_tokens'])) ||
            0;
          if (!Number.isFinite(cap) || cap < 0) cap = 0;
        }
      }
    } catch {
      cap = 0;
    }
    OpenAICompatClient._cap_cache.set(key, { cap, at: now, ttl: cap > 0 ? 6 * 3600 * 1000 : 60 * 1000 });
    return cap > 0 ? cap : null;
  }

  override async list_models(): Promise<string[]> {
    try {
      const response = await httpRequest(`${this._base_url.replace(/\/+$/, '')}/models`, {
        headers: {
          'Authorization': `Bearer ${this._key}`,
        },
        verify: this._verify,
      });
      if (!response.ok) return [];
      const payload = await response.json<{ data?: Array<{ id?: string }> }>();
      const ids: string[] = [];
    for (const entry of payload && Array.isArray(payload.data) ? payload.data : []) {
      if (!entry || typeof entry.id !== 'string') continue;
      ids.push(entry.id);
    }
      return ids.map((id) => (id.startsWith('models/') ? id.slice('models/'.length) : id)).sort();
    } catch {
      return [];
    }
  }
}

export class CodexClient extends Client {
  private readonly _verify: boolean;

  constructor(verify = true) {
    super();
    this._verify = verify;
  }

  async *stream(model: string, system: string | null, messages: ChatMessage[], max_tokens = 4000, temperature = 0.9, json_mode = false, top_p = 1, tools: ToolDef[] | null = null, signal?: AbortSignal, effort: string = 'medium', onActivity?: () => void): AsyncIterable<string> {
    void tools;
    void effort; /* the Anthropic body carries no reasoning knob here */
    this._last_usage = null;
    this._last_finish_reason = null;
    this._hidden_text = '';
    this._last_refusal = '';
    this._reset_tools();
    const hidden: string[] = [];
    const body: Record<string, any> = {
      model: model_leaf(model),
      instructions: String(system ?? ''),
      input: to_input([...(messages ?? [])]),
      stream: true,
      store: false,
      /* the Responses API budget field — without it the turn ignores the
         per-model reply budget entirely */
      max_output_tokens: Math.max(1, Math.trunc(Number(max_tokens) || 4000)),
    };
    if (!body['input']) {
      body['input'] = [{ type: 'message', role: 'user', content: [{ type: 'input_text', text: ' ' }] }];
    }
    try {
      yield* this._stream_once(CODEX_URL, body, hidden, signal, onActivity);
    } finally {
      this._hidden_text = hidden.join('');
    }
  }

  private async *_stream_once(url: string, body: Record<string, any>, hidden: string[], signal?: AbortSignal, onActivity?: () => void): AsyncIterable<string> {
    const [access, account] = await session();
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${access}`,
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream',
      'chatgpt-account-id': account,
      'OpenAI-Beta': 'responses=experimental',
      'originator': 'codex_cli_rs',
    };
    const response = await httpRequest(url, {
      method: 'POST',
      headers,
      body,
      verify: this._verify,
      signal,
      onActivity,
    });
    if (response.status === 401) {
      throw new CodexAuthError('Codex login expired — run `codex login`');
    }
    if (response.status >= 400) {
      const raw = await response.text();
      const detail = safe_error_detail(raw);
      const suffix = detail ? ` ${detail}` : '';
      throw new CodexRequestError(`Codex request failed (HTTP ${response.status}).${suffix}`, response.status);
    }
    for await (const raw of response.events()) {
      let payload: Record<string, any>;
      try {
        payload = JSON.parse(raw);
      } catch {
        continue;
      }
      if (!payload || typeof payload !== 'object') continue;
      const kind = String(payload['type'] ?? '');
      if (kind === 'response.failed' || kind === 'error') {
        const detail = safe_error_detail(payload);
        const suffix = detail ? ` ${detail}` : '';
        throw new CodexRequestError(`Codex request failed.${suffix}`);
      }
      const piece = delta_text(payload);
      if (piece) yield piece;
      const hid = hidden_text(payload);
      if (hid) hidden.push(hid);
      if (kind === 'response.completed') {
        let usage: any = null;
        const nested = payload['response'];
        if (nested && typeof nested === 'object' && !Array.isArray(nested)) usage = nested['usage'];
        if (!usage || typeof usage !== 'object' || Array.isArray(usage)) usage = payload['usage'];
        if (usage && typeof usage === 'object' && !Array.isArray(usage)) {
          this._last_usage = {
            input_tokens: Math.trunc(Number(usage['input_tokens'] ?? 0)),
            output_tokens: Math.trunc(Number(usage['output_tokens'] ?? 0)),
            cache_read_input_tokens: Math.trunc(Number(usage['cache_read_input_tokens'] ?? 0)),
          };
        }
        this._last_finish_reason = 'stop';
      }
    }
  }

  override async list_models(): Promise<string[]> {
    return [...CODEX_MODELS];
  }
}

/** Providers the reader brings themselves. They live in BACKENDS like any
    other, so the model picker, the settings panes, the cascade and the retry
    rules all pick them up without knowing they were added at runtime. The key
    is not here: `Backend.load_key` already reads `keys/<id>.txt`, which is where
    `save_key` puts it. Rebuilt from scratch on every call so an edit or a
    removal cannot leave a ghost behind. */
const _custom_ids = new Set<string>();

function _host_of(base_url: string): string {
  try {
    return new URL(base_url).host;
  } catch {
    return base_url.slice(0, 40);
  }
}

export function register_custom_providers(entries: unknown): string[] {
  for (const id of _custom_ids) delete BACKENDS[id];
  _custom_ids.clear();
  const list = Array.isArray(entries) ? entries : [];
  const names: string[] = [];
  for (const raw of list) {
    if (!raw || typeof raw !== 'object') continue;
    const entry = raw as Record<string, any>;
    const id = String(entry['id'] ?? '').trim();
    const base_url = String(entry['base_url'] ?? '').trim();
    const models = Array.isArray(entry['models'])
      ? entry['models'].map((model: unknown) => String(model ?? '').trim()).filter(Boolean)
      : [];
    /* a custom provider may never shadow a shipped one: the shipped tables,
       the cascade and the tests all assume those names mean what they say */
    if (!id || !base_url || !models.length) continue;
    if (Object.prototype.hasOwnProperty.call(BACKENDS, id)) continue;
    BACKENDS[id] = new Backend(id, base_url, models[0], {
      dialect: entry['dialect'] === 'anthropic' ? 'anthropic' : 'openai',
      cascade: [...models],
      models: [...models],
      env_keys: [`${id.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}_API_KEY`],
      free: Boolean(entry['free']),
      blurb: `yours · ${models.length} model${models.length > 1 ? 's' : ''} · ${_host_of(base_url)}`,
    });
    _custom_ids.add(id);
    names.push(id);
  }
  return names;
}

export interface GatewayStatus {
  id: string;
  label: string;
  connected: boolean;
  /** the plan the local login reports, e.g. `free`, `plus`, `pro`. null when
      there is no login to read */
  plan: string | null;
  mode: string | null;
  renews: string | null;
  /** every model the gateway could carry */
  offered: string[];
  /** the ones the reader kept switched on */
  selected: string[];
  blurb: string;
  /** plain words for why this gateway cannot work, or '' when it can */
  blocked: string;
  /** true when the thing itself is on this machine, whether or not it is
      signed in. "Not installed" and "installed but not signed in" are
      different problems with different fixes. */
  installed: boolean;
  /** model id -> what the provider's own server said when asked, for the ones
      it refused. Empty when nothing has been refused. */
  model_notes?: Record<string, string>;
}

/** Which gateways are switched on, and what the local login actually allows.
    A gateway is never listed as working on the strength of a key the reader
    pasted: it works or it does not depending on a subscription that lives
    somewhere else, so the honest state is reported rather than assumed. */
/** how to read one gateway's login, without this file knowing the details of
    any of them */
interface GatewayReader {
  connected: boolean;
  installed: boolean;
  plan: string | null;
  mode: string | null;
  until: string | null;
  not_connected: string;
}

const GATEWAY_READERS: Record<string, () => GatewayReader> = {
  codex: () => {
    const info = codex_plan();
    return {
      connected: available(),
      installed: available(),
      plan: info.plan,
      mode: info.mode,
      until: info.until,
      not_connected: 'no ChatGPT login found — run \`codex login\` on this machine',
    };
  },
  opencode: () => {
    const connected = opencodeAuth.available();
    return {
      connected,
      installed: opencodeAuth.installed(),
      /* Zen publishes no tier and no pricing, so there is no plan to read.
         "free tier" is not a guess about an account: it is what these ids are
         called and all this gateway offers. */
      plan: connected ? 'free tier' : null,
      mode: 'account',
      until: null,
      not_connected: opencodeAuth.installed()
        ? 'the OpenCode app is here but holds no Zen credential — sign in to Zen in it'
        : 'no OpenCode account on this machine — install the app and sign in',
    };
  },
};

function gateway_reader(name: string): GatewayReader {
  const read = GATEWAY_READERS[name];
  if (read) return read();
  return {
    connected: false,
    installed: false,
    plan: null,
    mode: null,
    until: null,
    not_connected: 'not connected',
  };
}

export function gateway_status(selected: Record<string, string[]> | null | undefined): GatewayStatus[] {
  const out: GatewayStatus[] = [];
  for (const [name, backend] of Object.entries(BACKENDS)) {
    if (!backend.gateway) continue;
    const info = gateway_reader(name);
    const connected = info.connected;
    const offered = [...backend.models];
    const keep = selected && typeof selected === 'object' && Array.isArray(selected[name])
      ? selected[name].filter((model): model is string => typeof model === 'string' && offered.includes(model))
      : offered;
let blocked = '';
    if (!connected) {
      blocked = info.not_connected;
    } else if (!keep.length) {
      blocked = 'every model is switched off for this gateway';
    }
    /* What the provider's own server said when Forge asked it, per model. A
       model it refuses is still listed — it may be lifted tomorrow, and hiding
       it would hide that too — but the picker says so rather than letting the
       reader pick it and meet the same refusal a second time. */
    const model_notes: Record<string, string> = {};
    if (name === 'opencode') {
      for (const model of offered) {
        const state = opencodeAuth.probed_state(model);
        if (state && !state.ok && state.why) model_notes[model] = state.why;
      }
    }
    out.push({
      id: name,
      label: name === 'codex' ? 'Codex (ChatGPT)' : name === 'opencode' ? 'OpenCode Zen' : name,
      connected,
      plan: info.plan,
      mode: info.mode,
      renews: info.until,
      offered,
      selected: keep.length ? keep : offered,
blurb: backend.blurb,
      blocked,
      installed: info.installed,
      model_notes,
    });
  }
  return out;
}

export function is_gateway(name: string): boolean {
  return Boolean(BACKENDS[String(name ?? '')]?.gateway);
}

/** gateway id -> the models the reader left switched on. Absent means the
    gateway offers everything it can, which is the right default: the
    subscription behind it is the limit, not this list. */
let _gateway_models: Record<string, string[]> = {};

export function set_gateway_models(selection: Record<string, string[]> | null | undefined): void {
  _gateway_models = selection && typeof selection === 'object' && !Array.isArray(selection)
    ? { ...selection }
    : {};
}

export function gateway_model_on(backend: string, model: string): boolean {
  const keep = _gateway_models[String(backend ?? '')];
  if (!Array.isArray(keep) || !keep.length) return true;
  return keep.includes(String(model ?? ''));
}

export function custom_provider_ids(): string[] {
  return [..._custom_ids];
}

export function is_custom_provider(name: string): boolean {
  return _custom_ids.has(String(name ?? ''));
}

export function open_client(backend: Backend, key?: string | null, verify = true): Client {
  if (backend.dialect === 'codex') {
    if (!backend.has_key()) throw new Error('no Codex login on this machine — run `codex login`');
    return new CodexClient(verify);
  }
  const resolved = key || backend.load_key();
  if (!resolved) {
    /* the same message as a provider would give here sends the reader after a
       key that does not exist for a gateway */
    if (backend.gateway) {
      const how = backend.name === 'opencode'
        ? 'sign in to Zen in the OpenCode app, or connect it in Settings → Gateways'
        : `connect it in Settings → Gateways`;
      throw new Error(`${backend.name} is not connected — ${how}`);
    }
    const env_keys = `[${backend.env_keys.map((name) => `'${name}'`).join(', ')}]`;
    throw new Error(`no key for backend '${backend.name}' — set one (${path.join(KEYS_DIRS[0], `${backend.name}.txt`)}) or via env ${env_keys}`);
  }
  if (backend.dialect === 'anthropic') return new AnthropicClient(resolved, verify);
  return new OpenAICompatClient(backend.base_url, resolved, verify, backend.request_body);
}
