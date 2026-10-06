import { reveal } from './prompts/sealedPrompts';
import * as vault from './vault';
import type { PromptSource } from './vault';
import type { ChatMessage } from './types';

export const ANTHROPIC_SPINE_IDENTITY = reveal('ANTHROPIC_SPINE_IDENTITY');
export const ANTHROPIC_FABLE5_IDENTITY = reveal('ANTHROPIC_FABLE5_IDENTITY');
export const ANTHROPIC_FABLE5_IDENTITY_STRONG = reveal('ANTHROPIC_FABLE5_IDENTITY_STRONG');
export const ANTHROPIC_FABLE5_INTERN_IDENTITY = reveal('ANTHROPIC_FABLE5_INTERN_IDENTITY');
export const ANTHROPIC_BARE_IDENTITY = reveal('ANTHROPIC_BARE_IDENTITY');
export const ANTHROPIC_COMPACT_IDENTITY = reveal('ANTHROPIC_COMPACT_IDENTITY');

export let FABLE5_PROFILE: string = 'quiet';

export function _leaf(model?: string | null): string {
  const raw = String(model ?? '').trim().toLowerCase().split(':', 1)[0];
  const cut = raw.lastIndexOf('/');
  return cut === -1 ? raw : raw.slice(cut + 1);
}

export function uses_fable_51(model?: string | null): boolean {
  const leaf = _leaf(model);
  return leaf.includes('fable') && leaf.includes('5.1');
}

export function uses_fable_5(model?: string | null): boolean {
  if (uses_fable_51(model)) return false;
  const leaf = _leaf(model);
  return leaf.includes('fable-5') || leaf.startsWith('claude-fable-5') || leaf.startsWith('fable-5');
}

export function uses_fable_51_spine(model?: string | null): boolean {
  return uses_fable_51(model);
}

export function fable5_uses_quiet_ladder(): boolean {
  return String(FABLE5_PROFILE || '').trim().toLowerCase() !== 'strong';
}

export function fable5_first_identity(): string {
  if (fable5_uses_quiet_ladder()) {
    return ANTHROPIC_FABLE5_IDENTITY;
  }
  return ANTHROPIC_FABLE5_IDENTITY_STRONG;
}

export function fable5_intern_identity(): string {
  if (fable5_uses_quiet_ladder()) {
    return ANTHROPIC_FABLE5_INTERN_IDENTITY;
  }
  return ANTHROPIC_COMPACT_IDENTITY;
}

export function uses_anthropic_compact(model?: string | null, backend?: string | null): boolean {
  if (String(backend ?? '').trim().toLowerCase() === 'anthropic') {
    return true;
  }
  const raw = String(model ?? '').trim().toLowerCase().split(':', 1)[0];
  if (!raw) {
    return false;
  }
  const cut = raw.lastIndexOf('/');
  const leaf = cut === -1 ? raw : raw.slice(cut + 1);
  const vendor = cut === -1 ? '' : raw.slice(0, cut);
  if (vendor === 'anthropic') {
    return true;
  }
  return leaf.startsWith('claude') || leaf.startsWith('fable');
}

export function system_prompt(
  source: PromptSource,
  extra?: string | null,
  model = '',
  compact = false,
  backend = '',
  intern = false,
  bare = false,
): string {
  let base = '';
  if (uses_anthropic_compact(model, backend)) {
    if (!intern && !bare && source.has(vault.PERSONA_ANTHROPIC)) {
      base = String(source.get(vault.PERSONA_ANTHROPIC) || '').trim();
    }
    if (!base) {
      if (bare && uses_fable_5(model)) {
        base = ANTHROPIC_BARE_IDENTITY;
      } else if (intern) {
        base = uses_fable_5(model) ? fable5_intern_identity() : ANTHROPIC_COMPACT_IDENTITY;
      } else if (uses_fable_5(model)) {
        base = fable5_first_identity();
      } else if (uses_fable_51(model)) {
        base = ANTHROPIC_SPINE_IDENTITY;
      } else {
        base = ANTHROPIC_COMPACT_IDENTITY;
      }
    }
  } else {
    base = source.get(vault.PERSONA) ?? '';
  }
  return extra ? `${base}\n\n${extra}` : base;
}

export function build_chat(
  source: PromptSource,
  conversation: ChatMessage[],
  extra?: string | null,
  model = '',
  compact = false,
  backend = '',
  intern = false,
  bare = false,
): [string, ChatMessage[]] {
  return [system_prompt(source, extra, model, compact, backend, intern, bare), conversation];
}
