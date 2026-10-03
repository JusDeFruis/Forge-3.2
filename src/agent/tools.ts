import type { ForgeConfig, ToolDef } from '../core/types';
import { httpRequest } from '../core/httpTransport';

import { Workspace } from './workspace';
import { run_command } from './shell';
import { fetch_page } from './webfetch';

export interface AgentContext {
  workspace: Workspace;
  config: ForgeConfig;
  signal?: AbortSignal;
  ask_permission?: (request: { kind: 'shell' | 'web'; detail: string }) => Promise<string>;
  ask_question?: (question: string, options?: string[]) => Promise<string>;
}

export const MAX_TOOL_OUTPUT = 20000;

const FS_TOOLS: ToolDef[] = [
  {
    name: 'list_files',
    description: 'List the files and folders inside the workspace. Paths are relative to the workspace root.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Folder to list, relative to the workspace root. Defaults to the root.' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'read_file',
    description: 'Read a text file from the workspace. Returns line numbers. Use offset/limit for long files.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path relative to the workspace root.' },
        offset: { type: 'integer', description: 'First line to read, 1-based. Defaults to 1.' },
        limit: { type: 'integer', description: 'How many lines to read. Defaults to 400.' },
      },
      required: ['path'],
      additionalProperties: false,
    },
  },
  {
    name: 'write_file',
    description: 'Create or overwrite a file in the workspace with the given content. Parent folders are created.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path relative to the workspace root.' },
        content: { type: 'string', description: 'Full new content of the file.' },
      },
      required: ['path', 'content'],
      additionalProperties: false,
    },
  },
  {
    name: 'replace_in_file',
    description: 'Replace exact text inside a file. old_text must match once unless replace_all is set.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path relative to the workspace root.' },
        old_text: { type: 'string', description: 'Exact text to find, including indentation.' },
        new_text: { type: 'string', description: 'Replacement text.' },
        replace_all: { type: 'boolean', description: 'Replace every match instead of requiring exactly one.' },
      },
      required: ['path', 'old_text', 'new_text'],
      additionalProperties: false,
    },
  },
  {
    name: 'search_files',
    description: 'Search file contents inside the workspace and return path:line matches.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Text to look for, case-insensitive.' },
        path: { type: 'string', description: 'Folder to search in, relative to the workspace root.' },
      },
      required: ['query'],
      additionalProperties: false,
    },
  },
];

const SHELL_TOOL: ToolDef = {
  name: 'run_command',
  description:
    'Run a shell command inside the workspace folder (Windows). stdout and stderr are returned, truncated when long. The command is killed after 60 seconds.',
  parameters: {
    type: 'object',
    properties: {
      command: { type: 'string', description: 'The command line to run.' },
      shell: { type: 'string', enum: ['powershell', 'cmd'], description: 'Shell to use. Defaults to powershell.' },
    },
    required: ['command'],
    additionalProperties: false,
  },
};

const WEB_TOOL: ToolDef = {
  name: 'web_fetch',
  description: 'Download an http(s) page and return its readable text. Use it for documentation and references.',
  parameters: {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'The http(s) url to fetch.' },
    },
    required: ['url'],
    additionalProperties: false,
  },
};

const WEB_SEARCH_TOOL: ToolDef = {
  name: 'web_search',
  description:
    'Search the web and return titles, urls and snippets. Use it when you need current or external information, then web_fetch the most relevant pages for details.',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'The search query.' },
      count: { type: 'integer', description: 'How many results to return (1-8). Defaults to 5.' },
    },
    required: ['query'],
    additionalProperties: false,
  },
};

const ASK_USER_TOOL: ToolDef = {
  name: 'ask_user',
  description:
    'Ask the user a question and wait for their answer. Use it when you cannot proceed without information only the user has: a choice to make, credentials, confirmation, or a missing detail. Keep the question short and specific.',
  parameters: {
    type: 'object',
    properties: {
      question: { type: 'string', description: 'The question for the user.' },
      options: {
        type: 'array',
        items: { type: 'string' },
        description: 'Optional short suggested answers shown as quick replies.',
      },
    },
    required: ['question'],
    additionalProperties: false,
  },
};

const ZIP_TOOL: ToolDef = {
  name: 'make_zip',
  description:
    'Bundle workspace files into a .zip archive inside the workspace, so the user can download the whole result in one click. Use it at the end of a build, or whenever the deliverable is a set of files rather than an answer.',
  parameters: {
    type: 'object',
    properties: {
      output: {
        type: 'string',
        description: 'Archive name, relative to the workspace root. Defaults to forge-output.zip.',
      },
      paths: {
        type: 'array',
        items: { type: 'string' },
        description:
          'Files or folders to include, relative to the workspace root. Defaults to everything not ignored (node_modules, .git, dist, build, venv, …).',
      },
    },
    additionalProperties: false,
  },
};

export function agent_tools(config: ForgeConfig): ToolDef[] {
  const tools: ToolDef[] = FS_TOOLS.map((tool) => ({ ...tool }));
  /* shell and web are always offered: the user is asked the first time the
     model reaches for them, and can allow one run or every run. */
  void config;
  tools.push({ ...SHELL_TOOL });
  tools.push({ ...WEB_TOOL });
  tools.push({ ...WEB_SEARCH_TOOL });
  tools.push({ ...ZIP_TOOL });
  tools.push({ ...ASK_USER_TOOL });
  return tools;
}

export function agent_tool_names(config: ForgeConfig): string[] {
  return agent_tools(config).map((tool) => tool.name);
}

const as_args = (value: unknown): Record<string, any> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, any>) : {};

const str = (value: unknown): string => (value === undefined || value === null ? '' : String(value));

const cap = (text: string): string =>
  text.length > MAX_TOOL_OUTPUT ? `${text.slice(0, MAX_TOOL_OUTPUT)}\n… [tool output truncated]` : text;

async function ensure_permission(
  ctx: AgentContext,
  kind: 'shell' | 'web',
  detail: string,
  flag: string,
): Promise<string | null> {
  if (ctx.config[flag] === true) return null;
  if (!ctx.ask_permission) {
    return kind === 'shell'
      ? 'error: shell commands are disabled in this conversation'
      : 'error: web access is disabled in this conversation';
  }
  const decision = String(await ctx.ask_permission({ kind, detail })).trim().toLowerCase();
  if (decision === 'always' || decision === 'once') {
    if (decision === 'always') ctx.config[flag] = true;
    return null;
  }
  return kind === 'shell'
    ? 'error: the user refused the shell command'
    : 'error: the user refused the web access';
}

const strip_tags = (html: string): string => {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
};

const unwrap_ddg = (href: string): string => {
  const direct = href.trim();
  const marker = 'uddg=';
  const at = direct.indexOf(marker);
  if (at === -1) {
    if (/^https?:\/\//i.test(direct)) return direct;
    if (direct.startsWith('//')) return `https:${direct}`;
    return direct;
  }
  let encoded = direct.slice(at + marker.length);
  const amp = encoded.indexOf('&');
  if (amp !== -1) encoded = encoded.slice(0, amp);
  try {
    return decodeURIComponent(encoded.replace(/\+/g, ' '));
  } catch {
    return encoded;
  }
};

async function search_web(query: string, count: number, signal?: AbortSignal): Promise<string> {
  const text = String(query || '').trim();
  if (!text) return 'error: web_search needs a query';
  const capped = Math.min(8, Math.max(1, Math.trunc(Number(count) || 5)));
  let html: string;
  try {
    const res = await httpRequest(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(text)}`, {
      method: 'GET',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
        Accept: 'text/html',
      },
      timeout: 25,
      signal,
      redirect: 'follow',
    });
    if (!res.ok) return `error: web search returned HTTP ${res.status}`;
    html = await res.text();
  } catch (error) {
    return `error: web search failed — ${error instanceof Error ? error.message : String(error)}`;
  }
  const anchor = /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  const found: Array<{ title: string; url: string }> = [];
  let match: RegExpExecArray | null;
  while ((match = anchor.exec(html)) !== null && found.length < capped) {
    const url = unwrap_ddg(match[1] || '');
    const title = strip_tags(match[2] || '').slice(0, 200);
    if (!url || !/^https?:\/\//i.test(url) || !title) continue;
    if (found.some((entry) => entry.url === url)) continue;
    found.push({ title, url });
  }
  if (!found.length) return 'error: web search returned no usable results';
  const snippets = html.split(/class="result__a"/gi).slice(1);
  const lines = found.map((entry, index) => {
    let snippet = '';
    const chunk = snippets[index] || '';
    const snip = /result-snippet">([\s\S]*?)<\/td>/i.exec(chunk);
    if (snip) snippet = strip_tags(snip[1] || '').slice(0, 300);
    return `${index + 1}. ${entry.title}\n   ${entry.url}${snippet ? `\n   ${snippet}` : ''}`;
  });
  return `web results for "${text.slice(0, 200)}":\n${lines.join('\n')}`;
}

export async function run_tool(name: string, raw_args: unknown, ctx: AgentContext): Promise<string> {
  const args = as_args(raw_args);
  try {
    switch (String(name)) {
      case 'list_files': {
        const entries = ctx.workspace.list(str(args['path']) || '.');
        if (!entries.length) return 'the folder is empty';
        return cap(entries.map((entry) => `${entry.kind === 'dir' ? 'dir  ' : 'file '}${entry.path}`).join('\n'));
      }
      case 'read_file': {
        const read = ctx.workspace.read(
          str(args['path']),
          Number(args['offset'] || 1),
          Number(args['limit'] || 400),
        );
        const head = `${read.path} · ${read.lines} lines · offset ${read.offset}${read.truncated ? ' · truncated' : ''}`;
        return cap(`${head}\n${read.text}`);
      }
      case 'write_file': {
        const target = str(args['path']).trim();
        if (!target) return 'error: write_file needs a path';
        /* a missing content argument must never silently truncate a file */
        if (args['content'] === undefined || args['content'] === null) {
          return `error: write_file needs content — refusing to empty ${target}`;
        }
        return ctx.workspace.write(target, String(args['content']));
      }
      case 'replace_in_file':
        return ctx.workspace.replace(
          str(args['path']),
          str(args['old_text']),
          str(args['new_text']),
          Boolean(args['replace_all']),
        );
      case 'search_files':
        return cap(ctx.workspace.search(str(args['query']), str(args['path']) || '.'));
      case 'run_command': {
        const command = str(args['command']);
        const refused = await ensure_permission(ctx, 'shell', `run ${command}`, 'agent_shell');
        if (refused) return refused;
        const result = await run_command(command, {
          cwd: ctx.workspace.root,
          shell: str(args['shell']) || 'powershell',
          signal: ctx.signal,
        });
        const head = `exit ${result.code ?? '?'} · ${(result.duration_ms / 1000).toFixed(1)}s${result.timed_out ? ' · timed out' : ''}${
          result.truncated ? ' · truncated' : ''
        }`;
        const parts = [head];
        if (result.stdout.trim()) parts.push(`stdout:\n${result.stdout.trim()}`);
        if (result.stderr.trim()) parts.push(`stderr:\n${result.stderr.trim()}`);
        if (!result.stdout.trim() && !result.stderr.trim()) parts.push('(no output)');
        return cap(parts.join('\n'));
      }
      case 'web_fetch': {
        const url = str(args['url']);
        const refused = await ensure_permission(ctx, 'web', `fetch ${url}`, 'agent_web');
        if (refused) return refused;
        const page = await fetch_page(url, ctx.signal);
        if (!page.ok) return `error: ${page.error}${page.status ? ` (HTTP ${page.status})` : ''}`;
        return cap(`source: ${page.url}\n${page.text}`);
      }
      case 'web_search': {
        const query = str(args['query']);
        const refused = await ensure_permission(ctx, 'web', `search the web for ${query.slice(0, 200)}`, 'agent_web');
        if (refused) return refused;
        return cap(await search_web(query, Number(args['count'] || 5), ctx.signal));
      }
      case 'make_zip': {
        const output = str(args['output']).trim() || 'forge-output.zip';
        const paths = Array.isArray(args['paths']) ? (args['paths'] as unknown[]).map((item) => String(item)) : [];
        const result = await ctx.workspace.zip(output, paths);
        return cap(
          `zipped ${result.entries} file(s) into ${result.name} (${Math.round(result.bytes / 1024)} KB)` +
            `${result.skipped ? `, ${result.skipped} unreadable` : ''} — the user downloads it from the chat`,
        );
      }
      case 'ask_user': {
        const question = str(args['question']).trim();
        if (!question) return 'error: ask_user needs a question';
        if (!ctx.ask_question) return 'error: cannot ask the user in this conversation';
        const options = Array.isArray(args['options'])
          ? (args['options'] as unknown[]).map((item) => str(item)).filter(Boolean).slice(0, 6)
          : [];
        const answer = await new Promise<string>((resolve) => {
          if (ctx.signal && ctx.signal.aborted) {
            resolve('');
            return;
          }
          const onAbort = (): void => resolve('');
          if (ctx.signal) ctx.signal.addEventListener('abort', onAbort, { once: true });
          Promise.resolve(ctx.ask_question!(question, options)).then(
            (text) => {
              if (ctx.signal) ctx.signal.removeEventListener('abort', onAbort);
              resolve(str(text));
            },
            () => {
              if (ctx.signal) ctx.signal.removeEventListener('abort', onAbort);
              resolve('');
            },
          );
        });
        if (!answer.trim()) return 'error: the user did not answer the question';
        return `user answer: ${answer.trim().slice(0, 4000)}`;
      }
      default:
        return `error: unknown tool ${name}`;
    }
  } catch (error) {
    return `error: ${error instanceof Error ? error.message : String(error)}`;
  }
}
