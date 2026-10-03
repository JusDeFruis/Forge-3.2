import type { ChatMessage } from './types';

export const CODEX_URL = 'https://chatgpt.com/backend-api/codex/responses';
export const CODEX_MODELS: string[] = [
  'gpt-6-sol',
  'gpt-6-luna',
  'gpt-6-astra',
  'gpt-5.6-sol',
  'gpt-5.6-terra',
  'gpt-5.6-luna',
];

export class CodexRequestError extends Error {
  status?: number;
  status_code?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'CodexRequestError';
    this.status = status;
    this.status_code = status;
  }
}

export function safe_error_detail(payload: unknown, limit: number = 600): string {
  let value: unknown = payload;
  if (value instanceof Uint8Array) {
    value = Buffer.from(value).toString('utf8');
  }
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
    }
  }
  let text: string;
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const record = value as Record<string, any>;
    const detail = record['detail'];
    const error = record['error'];
    if (typeof detail === 'string') {
      text = detail;
    } else if (
      error !== null &&
      typeof error === 'object' &&
      !Array.isArray(error) &&
      typeof (error as Record<string, any>)['message'] === 'string'
    ) {
      text = (error as Record<string, any>)['message'];
    } else if (typeof error === 'string') {
      text = error;
    } else {
      text = JSON.stringify(value);
    }
  } else {
    text = value ? String(value) : '';
  }
  text = text.replace(/Bearer\s+\S+/gi, 'Bearer <redacted>');
  text = text.replace(/[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, '<redacted>');
  text = text.replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, '<redacted>');
  const collapsed = text
    .split(/\s+/)
    .filter((part) => part !== '')
    .join(' ');
  return collapsed.slice(0, Math.max(1, Math.trunc(limit)));
}

export function model_leaf(model: string): string {
  let raw = model ? String(model).trim() : '';
  if (raw.startsWith('openai/')) raw = raw.slice('openai/'.length);
  return raw.split(':', 1)[0];
}

export function to_input(messages: ChatMessage[]): Record<string, any>[] {
  const items: Record<string, any>[] = [];
  for (const message of messages) {
    const role = message.role || 'user';
    const text = message.content || '';
    if (role === 'system' || role === 'developer') continue;
    if (role === 'assistant') {
      items.push({
        type: 'message',
        role: 'assistant',
        content: [{ type: 'output_text', text }],
      });
    } else {
      items.push({
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text }],
      });
    }
  }
  return items;
}

export function delta_text(payload: Record<string, any>): string {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return '';
  const kind = String(payload['type'] || '');
  if (kind === 'response.output_text.delta' || kind === 'response.output_text.delta.done') {
    return String(payload['delta'] || payload['text'] || '');
  }
  if (kind.includes('output_text') && typeof payload['delta'] === 'string') {
    return payload['delta'];
  }
  const delta = payload['delta'];
  if (delta && typeof delta === 'object' && !Array.isArray(delta)) {
    return String(delta['text'] || '');
  }
  return '';
}

export function hidden_text(payload: Record<string, any>): string {
  const kind = String((payload && payload['type']) || '');
  if (kind.includes('reasoning') && kind.includes('delta')) {
    return String((payload && payload['delta']) || (payload && payload['text']) || '');
  }
  return '';
}
