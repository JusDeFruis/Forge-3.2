import * as P from './core/providers';
import type { ModelChoice } from './core/types';

export const DEFAULT_BACKEND = "openrouter";
export const DEFAULT_MODEL = "x-ai/grok-4.6";

export const CHEAP_BY_BACKEND: Record<string, string[]> = {
  "openrouter": [
    "x-ai/grok-4.5",
    "x-ai/grok-4.6",
    "deepseek/deepseek-v4-flash",
    "deepseek/deepseek-v4-pro-0813",
    "z-ai/glm-5.3-flash",
    "z-ai/glm-5.3",
    "moonshotai/kimi-k2",
    "moonshotai/kimi-k2.6",
    "moonshotai/kimi-k2.7-code",
    "moonshotai/kimi-k3",
    "minimax/minimax-m3",
    "qwen/qwen3.8-flash",
    "qwen/qwen3.8-max-0902",
    "stepfun/step-3.7-flash",
    "inclusionai/ling-3.0-flash",
    "bytedance-seed/seed-1.6-flash",
    "meituan/longcat-2.0",
    "tencent/hy3",
    "xiaomi/mimo-v2.5",
    "xiaomi/mimo-v2.6-flash",
    "x-ai/grok-4.7",
    "deepseek/deepseek-v4.1-flash",
    "z-ai/glm-5.3-flashx",
    "qwen/qwen3.8-omni-flash",
    "openai/gpt-6-luna",
    "openai/gpt-6.1-sol",
    "anthropic/claude-sonnet-5.5",
  ],
  "orcarouter": [
    "deepseek/deepseek-v4-flash",
    "deepseek/deepseek-v4-pro-0813",
    "z-ai/glm-5.3-flash",
    "z-ai/glm-5.3",
    "kimi/kimi-k2.5",
    "kimi/kimi-k2.6",
    "kimi/kimi-k2.7-code",
    "kimi/kimi-k3",
    "minimax/minimax-m3",
    "qwen/qwen3.8-flash",
    "qwen/qwen3.8-max",
    "grok/grok-4.5",
    "grok/grok-4.6",
    "grok/grok-4.7",
    "tencent/hy3",
  ],
  "zai": ["glm-5.3-flash", "glm-5.3", "glm-5.3-flashx"],
  "deepseek": ["deepseek-flash", "deepseek-v4-pro"],
  "groq": ["openai/gpt-oss-120b", "openai/gpt-oss-20b"],
  "xai": ["grok-4.6", "grok-4.5", "grok-4.3", "grok-build-0.1"],
  /* NVIDIA lists 81 entries on /v1/models, but most are embeddings, rerank,
     OCR, ASR, image and biology NIMs that answer 404 on /chat/completions.
     These are the ones with a live free text endpoint. */
"nvidia": [
    "nvidia/nemotron-3-ultra-550b-a55b",
    "nvidia/nemotron-3-super-120b-a12b",
    /* back in the cheap floor with the catalogue: it answers, it is free, and
       it is one of the models people arrive looking for */
    "nvidia/nemotron-3.5-lightning-30b-a3b",
    "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",
    "meta/muse-glimmer-30b",
    "moonshotai/kimi-k3",
    "z-ai/glm-5.3",
    "z-ai/glm-5.3-flash",
    "deepseek-ai/deepseek-v4.1-flash",
    "google/gemma-4-31b-it",
    "openai/gpt-oss-20b",
    "poolside/laguna-xs-2.1",
    "google/diffusiongemma-26b-a4b-it",
    "meta/llama-3.2-90b-vision-instruct",
    "meta/llama-3.2-11b-vision-instruct",
  ],
  "sambanova": [
    "DeepSeek-V3.2",
    "MiniMax-M3",
    "gpt-oss-120b",
    "gemma-4-31B-it",
    "Meta-Llama-3.3-70B-Instruct",
    "DeepSeek-V3.1",
    "MiniMax-M2.7",
  ],
  "fireworks": [
    "accounts/fireworks/models/deepseek-v4.1-flash",
    "accounts/fireworks/models/kimi-k3",
  ],
  "huggingface": ["openai/gpt-oss-120b", "moonshotai/Kimi-K3", "deepseek-ai/DeepSeek-V4-Pro"],
  "moonshot": ["kimi-k3", "kimi-k2.7-code", "kimi-k2.6"],
  "dashscope": ["qwen3.8-max", "qwen3.7-plus", "qwen-plus", "qwen-turbo"],
  /* Venice answers free with no card: 128 live models, and the only place the
     abliterated and uncensored builds are served. It was absent from this
     table entirely, so every one of them was configured and invisible. */
  "venice": [
    "venice-uncensored-1-2",
    "venice-uncensored-role-play",
    "abliteration-abliterated-model-large-v2",
    "aion-labs-aion-3-5",
    "gemma-4-uncensored",
    "olafangensan-glm-4.7-flash-heretic",
    "qwen-3-8-27b",
    "qwen-3-8-max",
    "qwen-3-8-flash",
    "qwen3-6-27b",
    "qwen3-6-35b-a3b",
    "qwen3-5-9b",
    "qwen3-5-397b-a17b",
    "qwen-3-6-plus",
    "qwen-3-7-plus",
    "qwen3-next-80b",
    "z-ai-glm-5-3",
    "z-ai-glm-5-3-flash",
    "deepseek-v4-1-flash",
    "kimi-k3",
    "grok-4-7",
    "nvidia-nemotron-3-ultra-550b-a55b",
    "openai-gpt-oss-120b",
  ],
  "minimax": ["MiniMax-M3", "MiniMax-M2.7"],
  "perplexity": ["sonar-pro", "sonar"],
};

export const INJECT: Array<[string, string]> = [
  ["xai", "grok-4.6"],
  ["zai", "glm-5.3-flash"],
];

export const CHEAP_CASCADE: Record<string, string[]> = {
  "openrouter": [
    "x-ai/grok-4.6",
    "deepseek/deepseek-v4-flash",
    "z-ai/glm-5.3-flash",
  ],
  "orcarouter": ["qwen/qwen3.8-flash", "deepseek/deepseek-v4-flash"],
  "venice": ["venice-uncensored-1-2", "qwen-3-8-27b", "z-ai-glm-5-3-flash"],
  "zai": ["glm-5.3-flash"],
  "deepseek": ["deepseek-flash"],
  "groq": ["openai/gpt-oss-120b", "openai/gpt-oss-20b"],
  "xai": ["grok-4.6"],
  "nvidia": ["nvidia/nemotron-3-ultra-550b-a55b", "nvidia/nemotron-3.5-lightning-30b-a3b", "openai/gpt-oss-20b"],
  "sambanova": ["DeepSeek-V3.2", "MiniMax-M3"],
  "huggingface": ["openai/gpt-oss-120b", "moonshotai/Kimi-K3"],
  "moonshot": ["kimi-k2.7-code"],
  "dashscope": ["qwen3.8-max", "qwen-plus"],
  "perplexity": ["sonar"],
};

export const PIN_REMAP: Record<string, [string, string]> = {
  ["openrouter\u0000x-ai/grok-4-fast"]: ["openrouter", "x-ai/grok-4.6"],
  ["openrouter\u0000~x-ai/grok-latest"]: ["openrouter", "x-ai/grok-4.6"],
  ["xai\u0000grok-4"]: ["xai", "grok-4.6"],
  ["xai\u0000grok-4.7"]: ["xai", "grok-4.6"],
  ["zai\u0000glm-5.1"]: ["zai", "glm-5.3"],
  ["zai\u0000glm-5"]: ["zai", "glm-5.3"],
  ["nvidia\u0000meta/llama-3.3-70b-instruct"]: ["nvidia", "nvidia/nemotron-3-super-120b-a12b"],
  ["nvidia\u0000deepseek-ai/deepseek-r1"]: ["nvidia", "nvidia/nemotron-3-super-120b-a12b"],
  ["nvidia\u0000qwen/qwen3-235b-a22b-instruct"]: ["nvidia", "nvidia/nemotron-3-super-120b-a12b"],
  ["nvidia\u0000moonshotai/kimi-k2-instruct"]: ["nvidia", "nvidia/nemotron-3-ultra-550b-a55b"],
  ["nvidia\u0000moonshotai/kimi-k2.6"]: ["nvidia", "moonshotai/kimi-k3"],
  ["nvidia\u0000google/paligemma"]: ["nvidia", "meta/llama-3.2-90b-vision-instruct"],
  ["nvidia\u0000nvidia/nemotron-4-340b-instruct"]: ["nvidia", "nvidia/nemotron-3-ultra-550b-a55b"],
  ["nvidia\u0000mistralai/mistral-large"]: ["nvidia", "nvidia/nemotron-3-super-120b-a12b"],
  ["nvidia\u0000mistralai/mixtral-8x22b-v0.1"]: ["nvidia", "nvidia/nemotron-3-super-120b-a12b"],
  ["nvidia\u0000google/gemma-3-12b-it"]: ["nvidia", "google/gemma-4-31b-it"],
  ["nvidia\u000001-ai/yi-large"]: ["nvidia", "nvidia/nemotron-3-super-120b-a12b"],
  ["nvidia\u0000nvidia/llama-3.1-nemotron-ultra-253b-instruct"]: ["nvidia", "nvidia/nemotron-3-ultra-550b-a55b"],
  ["nvidia\u0000nvidia/llama-3.1-nemotron-ultra-253b-v1"]: ["nvidia", "nvidia/nemotron-3-ultra-550b-a55b"],
  ["nvidia\u0000nvidia/llama-3.1-nemotron-70b-instruct"]: ["nvidia", "nvidia/nemotron-3-super-120b-a12b"],
  ["nvidia\u0000nvidia/llama-3.1-nemotron-51b-instruct"]: ["nvidia", "nvidia/nemotron-3-super-120b-a12b"],
  ["nvidia\u0000nvidia/nemotron-nano-3-30b-a3b"]: ["nvidia", "nvidia/nemotron-3-super-120b-a12b"],
  ["nvidia\u0000mistralai/mistral-large-2-instruct"]: ["nvidia", "nvidia/nemotron-3-super-120b-a12b"],
  ["nvidia\u0000mistralai/mistral-nemotron"]: ["nvidia", "nvidia/nemotron-3-super-120b-a12b"],
  ["deepseek\u0000deepseek-chat"]: ["deepseek", "deepseek-flash"],
  ["deepseek\u0000deepseek-reasoner"]: ["deepseek", "deepseek-flash"],
  ["groq\u0000deepseek-r1-distill-llama-70b"]: ["groq", "openai/gpt-oss-120b"],
  ["groq\u0000moonshotai/kimi-k2-instruct"]: ["groq", "openai/gpt-oss-120b"],
  ["groq\u0000llama-3.3-70b-versatile"]: ["groq", "openai/gpt-oss-120b"],
  ["moonshot\u0000kimi-k2-0711-preview"]: ["moonshot", "kimi-k2.7-code"],
  ["moonshot\u0000kimi-k2-turbo-preview"]: ["moonshot", "kimi-k2.7-code"],
  ["moonshot\u0000kimi-latest"]: ["moonshot", "kimi-k3"],
  ["dashscope\u0000qwen3-max"]: ["dashscope", "qwen3.8-max"],
  ["minimax\u0000MiniMax-M2"]: ["minimax", "MiniMax-M3"],
  ["minimax\u0000MiniMax-Text-01"]: ["minimax", "MiniMax-M3"],
  ["cerebras\u0000qwen-3-235b-a22b-instruct"]: ["cerebras", "gpt-oss-120b"],
  ["cerebras\u0000llama-3.3-70b"]: ["cerebras", "gpt-oss-120b"],
  ["together\u0000deepseek-ai/DeepSeek-R1"]: ["together", "deepseek-ai/DeepSeek-V4-Pro"],
  ["together\u0000NousResearch/Hermes-3-Llama-3.1-405B"]: ["together", "moonshotai/Kimi-K3"],
  ["fireworks\u0000accounts/fireworks/models/llama-v3p3-70b-instruct"]: ["fireworks", "accounts/fireworks/models/deepseek-v4.1-flash"],
  ["fireworks\u0000accounts/fireworks/models/deepseek-v3"]: ["fireworks", "accounts/fireworks/models/deepseek-v4.1-flash"],
  ["fireworks\u0000accounts/fireworks/models/qwen3-235b-a22b-instruct"]: ["fireworks", "accounts/fireworks/models/deepseek-v4.1-flash"],
  ["fireworks\u0000accounts/fireworks/models/kimi-k2-instruct"]: ["fireworks", "accounts/fireworks/models/kimi-k3"],
  ["huggingface\u0000meta-llama/Llama-3.3-70B-Instruct"]: ["huggingface", "openai/gpt-oss-120b"],
  ["huggingface\u0000deepseek-ai/DeepSeek-V3.1"]: ["huggingface", "deepseek-ai/DeepSeek-V4-Pro"],
  ["huggingface\u0000Qwen/Qwen3-235B-A22B"]: ["huggingface", "Qwen/Qwen3.5-397B-A17B"],
  ["huggingface\u0000moonshotai/Kimi-K2.5"]: ["huggingface", "moonshotai/Kimi-K3"],
  ["codex\u0000gpt-5.5"]: ["codex", "gpt-6-sol"],
  ["codex\u0000gpt-5.4"]: ["codex", "gpt-6-sol"],
  ["codex\u0000gpt-5.3-codex"]: ["codex", "gpt-6-sol"],
  ["codex\u0000gpt-5.2-codex"]: ["codex", "gpt-6-sol"],
  ["sambanova\u0000Llama-3.3-70B-Instruct"]: ["sambanova", "Meta-Llama-3.3-70B-Instruct"],
  ["sambanova\u0000DeepSeek-V3-0324"]: ["sambanova", "DeepSeek-V3.2"],
  ["sambanova\u0000QwQ-32B"]: ["sambanova", "gpt-oss-120b"],
  ["sambanova\u0000Qwen3-235B-A22B-Instruct"]: ["sambanova", "MiniMax-M3"],
};

export function is_allowed(backend: string, model: string): boolean {
  /* the shipped tables are a curated cheap floor. A provider the reader added
     themselves is not on it and never will be, and refusing their own model
     would leave the endpoint configured but unusable. */
  if (P.is_custom_provider(backend)) return true;
  /* a gateway is limited by the subscription behind it, not by this table, so
     what counts is what the reader left switched on for it */
  if (P.is_gateway(backend)) return P.gateway_model_on(backend, model);
  const allowed = CHEAP_BY_BACKEND[backend];
  return Boolean(allowed) && allowed.includes(model);
}

export function remap_pin(backend?: string | null, model?: string | null): [string, string] {
  const pinned_backend = String(backend || DEFAULT_BACKEND);
  const pinned_model = String(model || DEFAULT_MODEL);
  const mapped = PIN_REMAP[`${pinned_backend}\u0000${pinned_model}`];
  if (mapped) {
    return mapped;
  }
  if (is_allowed(pinned_backend, pinned_model)) {
    return [pinned_backend, pinned_model];
  }
  return [DEFAULT_BACKEND, DEFAULT_MODEL];
}

export function cascade_for(backend: string, pinned: string): string[] {
  const models = [pinned];
  const alts = CHEAP_CASCADE[backend];
  for (const alt of alts || []) {
    if (alt && !models.includes(alt)) {
      models.push(alt);
    }
    if (models.length >= 3) break;
  }
  return models;
}

export function _row(backend: string, model: string, keyed: boolean): ModelChoice {
  const be = P.BACKENDS[backend];
  const price = P.price_for(model);
  return {
    backend,
    model,
    tag: be.tag,
    keyed,
    is_default: backend === DEFAULT_BACKEND && model === DEFAULT_MODEL,
    label: `${backend} · ${model}`,
    traits: [],
    search: `${backend} ${model}`.toLowerCase(),
    price_in: price[0],
    price_out: price[1],
  };
}

export function cheap_choices(overlays?: Record<string, string[]> | null): ModelChoice[] {
  const key = (backend: string, model: string): string => `${backend}\u0000${model}`;
  const full = P.model_choices(overlays as Record<string, string[]>);
  const seen = new Set<string>();
  const out: ModelChoice[] = [];
  for (const source of full) {
    const backend = source.backend;
    const model = source.model;
    if (!is_allowed(backend, model)) continue;
    const row_key = key(backend, model);
    if (seen.has(row_key)) continue;
    seen.add(row_key);
    out.push({ ...source, is_default: backend === DEFAULT_BACKEND && model === DEFAULT_MODEL });
  }
  for (const [backend, model] of INJECT) {
    const row_key = key(backend, model);
    if (seen.has(row_key) || !Object.hasOwn(P.BACKENDS, backend)) continue;
    const keyed = P.BACKENDS[backend].has_key();
    out.push(_row(backend, model, keyed));
    seen.add(row_key);
  }
  const rank: Record<string, number | undefined> = {};
  let index = 0;
  for (const [backend, models] of Object.entries(CHEAP_BY_BACKEND)) {
    for (const model of models) {
      rank[key(backend, model)] = index;
      index++;
    }
  }
  out.sort((a, b) => {
    const a_rank_group = a.backend in CHEAP_BY_BACKEND ? 0 : 1;
    const b_rank_group = b.backend in CHEAP_BY_BACKEND ? 0 : 1;
    if (a_rank_group !== b_rank_group) return a_rank_group - b_rank_group;
    const a_rank = rank[key(a.backend, a.model)] ?? 10_000;
    const b_rank = rank[key(b.backend, b.model)] ?? 10_000;
    if (a_rank !== b_rank) return a_rank - b_rank;
    if (a.backend !== b.backend) return a.backend < b.backend ? -1 : 1;
    if (a.model !== b.model) return a.model < b.model ? -1 : 1;
    return 0;
  });
  return out;
}
