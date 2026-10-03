import * as fs from 'node:fs';
import * as os from 'node:os';

import * as hold from '../core/hold';
import { clamp_effort, resolve_max_output_tokens } from '../core/providers';
import type { Client } from '../core/providers';
import type { ChatMessage, ForgeConfig, ToolCall, ToolDef } from '../core/types';

import { Workspace } from './workspace';
import { agent_tools, run_tool } from './tools';

export const MAX_AGENT_STEPS = 10;

function isAbortLike(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.name === 'AbortError' || /abort/i.test(error.message);
}

export interface AgentHooks {
  is_stopped(): boolean;
  phase(payload: Record<string, any>): void;
  trace?(entry: AgentTraceEntry): void;
  notice?(message: string): void;
  /** the model text as it arrives, so a long reasoning turn never looks dead */
  delta?(text: string): void;
  /** the reasoning as it arrives, so it can sit where it happened */
  reasoning?(text: string): void;
  ask_permission?(request: { kind: 'shell' | 'web'; detail: string }): Promise<string>;
  ask_user?(question: string, options?: string[]): Promise<string>;
}

/* one persistent row per agent move: steps stay visible and every tool
   call can be unfolded to its arguments and result, Claude-Code style */
export interface AgentTraceEntry {
  kind: 'step' | 'tool' | 'result';
  id: number;
  label: string;
  detail?: string;
  /** file a write touched, for the "+8 -5" stat on its row */
  file?: string;
  added?: number;
  removed?: number;
  created?: boolean;
}

export interface AgentParams {
  config: ForgeConfig;
  history: ChatMessage[];
  model: string;
  dialect: string;
  max_tokens: number;
  open_client(): Client;
  hooks: AgentHooks;
  /** the Forge identity, prepended so an agent turn sounds like the rest of
      the app instead of a generic tool bot */
  identity?: string;
  /** extra system guidance appended to the built prompt (chat tone, …) */
  system_note?: string;
}

export interface AgentResult {
  text: string;
  client: Client;
  steps: number;
  used_tools: string[];
  usage: { input: number; output: number };
}

export function agent_enabled(config: ForgeConfig): boolean {
  return Boolean(config['agent_enabled']) && String(config['workspace'] ?? '').trim() !== '';
}

export function workspace_error(config: ForgeConfig): string | null {
  const folder = String(config['workspace'] ?? '').trim();
  if (!folder) return 'no workspace folder is set';
  if (!Workspace.open(folder)) return `workspace folder not found: ${folder}`;
  return null;
}

export function build_system(workspace: Workspace, config: ForgeConfig, tools: ToolDef[]): string {
  const shell = config['agent_shell'] ? 'allowed without asking' : 'ask the user first';
  const web = config['agent_web'] ? 'allowed without asking' : 'ask the user first';
  const names = tools.map((tool) => tool.name).join(', ');
  return [
    'You are FORGE 3.2, a coding agent working inside a workspace folder on the user\'s computer.',
    'You can read, write, search and edit files in that folder with the tools you are given.',
    '',
    'WORKSPACE',
    workspace.summary(),
    '',
    `host: ${process.platform} · shell: ${shell} · web: ${web}`,
    `tools: ${names}`,
    '',
    'RULES',
    '- Paths are always relative to the workspace root. Never use absolute paths or "..".',
    '- Use the tools to inspect files instead of guessing their contents.',
    '- Read a file before rewriting it, unless you wrote it earlier in this turn.',
    '- Keep edits minimal and leave the workspace in a working state.',
    '- A tool reply starting with "error:" means the arguments were wrong — correct them, do not repeat the same call.',
    '- When only the user can decide (a choice, credentials, confirmation), ask them with ask_user instead of guessing.',
    '- Ask a question once. If the answer says the user passed on it, take that as the answer: pick the sensible default yourself, say what you chose, and never ask it again.',
    '- Real files are the deliverable: create them with write_file instead of pasting long code into the chat.',
    '- You can hand over a whole project as one archive with make_zip — use it when the result spans several files.',
    '- When the job is done, answer with a short summary: files changed, commands run, what is left.',
    '- Answer in the language the user wrote in.',
  ].join('\n');
}

const parse_args = (call: ToolCall): { args: Record<string, any>; error: string } => {
  const raw = String(call.arguments ?? '').trim();
  if (!raw) return { args: {}, error: '' };
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { args: {}, error: 'arguments must be a JSON object' };
    }
    return { args: parsed as Record<string, any>, error: '' };
  } catch (error) {
    return { args: {}, error: `invalid JSON arguments: ${error instanceof Error ? error.message : String(error)}` };
  }
};

const is_tool_finish = (reason: string | null): boolean =>
  reason === 'tool_calls' || reason === 'tool_use' || reason === 'function_call';

export async function run_agent_turn(params: AgentParams): Promise<AgentResult> {
  const stop = new AbortController();
  const stop_check = setInterval(() => {
    if (params.hooks.is_stopped() && !stop.signal.aborted) {
      stop.abort(new Error('stopped'));
    }
  }, 250);
  try {
    return await run_agent_turn_inner(params, stop.signal);
  } finally {
    clearInterval(stop_check);
  }
}

async function run_agent_turn_inner(params: AgentParams, signal: AbortSignal): Promise<AgentResult> {
  const folder = String(params.config['workspace'] ?? '').trim();
  const workspace = Workspace.open(folder);
  if (!workspace) {
    throw new Error(`workspace folder not found: ${folder || '(not set)'}`);
  }
  if (params.dialect === 'codex') {
    throw new Error('agent tools need an OpenAI-compatible or Anthropic backend — pick another model in Settings → Models');
  }
  const tools = agent_tools(params.config);
  const identity = String(params.identity || '').trim();
  const system = (identity ? `${identity}\n\n` : '') + build_system(workspace, params.config, tools) +
    (String(params.system_note || '').trim() ? `\n\n${String(params.system_note).trim()}` : '');
  const messages: ChatMessage[] = [...(params.history ?? [])];
  const client = params.open_client();
  const usage = { input: 0, output: 0 };
  /* every stream resets the client's last reading, so the turn total is
     summed here — reading once at the end would keep only the last step */
  const take_usage = (): void => {
    const reading = client.last_usage();
    usage.input += Math.trunc(Number(reading?.input_tokens) || 0);
    usage.output += Math.trunc(Number(reading?.output_tokens) || 0);
  };
  /* a throwing UI listener must never kill the turn */
  const safe_phase = (payload: Record<string, any>): void => {
    try {
      params.hooks.phase(payload);
    } catch {
      /* the turn continues; the phase update is best effort */
    }
  };
  let trace_id = 0;
  const safe_trace = (
    kind: 'step' | 'tool' | 'result',
    label: string,
    detail?: string,
    id?: number,
    extra?: Partial<AgentTraceEntry>,
  ): void => {
    const hook = params.hooks.trace;
    if (!hook) return;
    try {
      hook({ kind, id: id ?? ++trace_id, label, detail: detail ?? '', ...(extra ?? {}) });
    } catch {
      /* trace is best effort, like phase */
    }
  };

  /* the stat on a file row: count the lines that appeared and disappeared, so
     the reader sees "+8 -5" instead of trusting the word "wrote". The raw
     bytes are read, not Workspace.read, which prefixes line numbers and would
     make every line look rewritten. */
  const read_lines = (relative: string): string[] | null => {
    try {
      return fs.readFileSync(workspace.resolve(relative), 'utf8').replace(/\r\n/g, '\n').split('\n');
    } catch {
      return null;
    }
  };

  const WRITE_TOOLS = new Set(['write_file', 'replace_in_file']);

  const write_stat = (
    name: string,
    args: Record<string, any>,
    before: string[] | null,
  ): Partial<AgentTraceEntry> => {
    if (!WRITE_TOOLS.has(name)) return {};
    const file = String(args['path'] ?? '').trim();
    if (!file) return {};
    const after = read_lines(file);
    if (!after) return { file };
    const counts = new Map<string, number>();
    for (const line of before ?? []) counts.set(line, (counts.get(line) || 0) + 1);
    let added = 0;
    for (const line of after) {
      const left = counts.get(line) || 0;
      if (left > 0) counts.set(line, left - 1);
      else added += 1;
    }
    let removed = 0;
    for (const left of counts.values()) removed += left;
    return { file, added, removed, created: !before };
  };
  /* the one thing worth showing on a tool row: the query, the command, the
     path. Raw JSON on a row is noise, so it never reaches the reader unless
     nothing better exists. */
  const TOOL_TARGETS: Record<string, string[]> = {
    web_search: ['query'],
    web_fetch: ['url'],
    run_command: ['command'],
    list_files: ['path'],
    read_file: ['path'],
    search_files: ['query'],
    make_zip: ['output'],
  };

  const tool_target = (name: string, args: Record<string, any>): string => {
    const path_value = String(args['path'] ?? '').trim();
    if ((name === 'read_file' || name === 'write_file' || name === 'replace_in_file') && path_value) {
      return path_value;
    }
    for (const key of TOOL_TARGETS[name] || []) {
      const value = String(args[key] ?? '').trim();
      if (value) return value.replace(/\s+/g, ' ').slice(0, 160);
    }
    if (path_value) return path_value;
    return '';
  };

  const short_args = (args: Record<string, any>): string => {
    try {
      const raw = JSON.stringify(args);
      return raw.length > 400 ? `${raw.slice(0, 400)}…` : raw;
    } catch {
      return '';
    }
  };
  const short_result = (text: string): string => {
    const clean = String(text ?? '').trim();
    return clean.length > 1500 ? `${clean.slice(0, 1500)}\n… [trace truncated]` : clean;
  };
  /* the budget follows the model, not a fixed number */
  const max_tokens = await resolve_max_output_tokens(client, params.model, params.max_tokens);
  const temperature = Number(params.config['temp'] ?? 0.9);
  const top_p = Number(params.config['top_p'] ?? 1);
  const used: string[] = [];
  let answer = '';
  let steps = 0;
  /* the model only gets a level it can honour — a moved level is reported
     once, before the first turn, in plain words */
  const effort = clamp_effort(params.model, params.config['reasoning_effort']);
  if (effort.message && params.hooks.notice) params.hooks.notice(effort.message);

  for (let step = 0; step < MAX_AGENT_STEPS; step += 1) {
    if (params.hooks.is_stopped()) break;
    steps = step + 1;
    safe_phase({
      phase: 'thinking',
      label: step === 0 ? 'reading the request' : `step ${step + 1}`,
    });
    const raw: string[] = [];
    try {
      const source = client.stream(params.model, system, messages, max_tokens, temperature, false, top_p, tools, signal, effort.level);
      client.on_reasoning = (text) => {
        try {
          params.hooks.reasoning?.(text);
        } catch {
          /* a listener that throws must not end the turn */
        }
      };
      for await (const piece of source) {
        if (params.hooks.is_stopped()) break;
        const chunk = String(piece);
        raw.push(chunk);
        /* the text lands in the chat while it is still being written, so a
           max-effort turn shows its work instead of a frozen status line */
        if (chunk) params.hooks.delta?.(chunk);
      }
    } catch (error) {
      take_usage();
      if (!params.hooks.is_stopped() && !isAbortLike(error)) throw error;
      break;
    }
    take_usage();
    const text = raw.join('');
    const calls = client.last_tool_calls();
    if (params.hooks.is_stopped()) break;
    if (!calls.length) {
      answer = is_tool_finish(client.last_finish_reason()) && !text.trim() ? '' : text;
      break;
    }
    const assistant: ChatMessage = { role: 'assistant', content: text };
    assistant.tool_calls = calls.map((call, index) => ({
      id: call.id || `call_step${step}_${index}`,
      name: call.name,
      arguments: call.arguments || '{}',
    }));
    messages.push(assistant);
    for (const call of assistant.tool_calls as ToolCall[]) {
      if (params.hooks.is_stopped()) break;
      const parsed = parse_args(call);
      safe_phase({
        phase: 'thinking',
        label: parsed.error ? call.name : tool_target(call.name, parsed.args) || call.name,
      });
      let result: string;
      if (parsed.error) {
        result = `error: ${parsed.error}`;
      } else {
        const tid = ++trace_id;
        const target = String(parsed.args['path'] ?? '').trim();
        const before = WRITE_TOOLS.has(call.name) && target ? read_lines(target) : null;
        const shown = tool_target(call.name, parsed.args);
        safe_trace(
          'tool',
          call.name,
          shown || short_args(parsed.args),
          tid,
          target ? { file: target } : undefined,
        );
        result = await run_tool(call.name, parsed.args, {
          workspace,
          config: params.config,
          signal,
          ask_permission: params.hooks.ask_permission
            ? (request) => params.hooks.ask_permission!(request)
            : undefined,
          ask_question: params.hooks.ask_user
            ? (question, options) => params.hooks.ask_user!(question, options)
            : undefined,
        });
        safe_trace(
          'result',
          call.name,
          short_result(result),
          tid,
          write_stat(call.name, parsed.args, before),
        );
      }
      used.push(call.name);
      messages.push({ role: 'tool', tool_call_id: call.id, content: String(result) });
    }
    if (params.hooks.is_stopped()) break;
  }

  if (!answer && !params.hooks.is_stopped()) {
    safe_phase({ phase: 'thinking', label: 'writing the answer' });
    const closing: ChatMessage[] = [
      ...messages,
      {
        role: 'user',
        content:
          'Tool budget reached. Give the final answer now: what you changed, what ran, what is left. No more tool calls.',
      },
    ];
    const raw_final: string[] = [];
    try {
      const source_final = client.stream(params.model, system, closing, max_tokens, temperature, false, top_p, null, signal, effort.level);
      for await (const piece of source_final) {
        if (params.hooks.is_stopped()) break;
        const chunk = String(piece);
        raw_final.push(chunk);
        if (chunk) params.hooks.delta?.(chunk);
      }
    } catch (error) {
      take_usage();
      if (!params.hooks.is_stopped() && !isAbortLike(error)) throw error;
    }
    take_usage();
    answer = raw_final.join('');
  }

  const visible = hold.sanitize_visible_reply(answer, '', system) || String(answer ?? '').trim();
  return { text: visible, client, steps, used_tools: used, usage };
}

export function agent_host_line(config: ForgeConfig): string {
  const shell = config['agent_shell'] ? 'shell on' : 'shell off';
  const web = config['agent_web'] ? 'web on' : 'web off';
  return `${process.platform} · ${os.arch()} · ${shell} · ${web}`;
}
