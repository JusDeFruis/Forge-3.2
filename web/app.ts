/* FORGE 3.2 — yellow chatbot skin over the Forge room. */

import { playSound, setSoundEnabled, soundEnabled } from './sounds';
import { passphraseTooWeak, scorePassphrase } from '../src/core/passphrase';
import { DEFAULT_THEME, THEMES } from '../src/core/themes';

const ICONS = {
  plus:
    '<svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M7 2.8v8.4M2.8 7h8.4"></path></svg>',
  kebab:
    '<svg width="13" height="13" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">' +
    '<circle cx="2.9" cy="7" r="1.35"></circle><circle cx="7" cy="7" r="1.35"></circle>' +
    '<circle cx="11.1" cy="7" r="1.35"></circle></svg>',
  chevron:
    '<svg width="11" height="11" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5.3 2.8 9.7 7l-4.4 4.2"></path></svg>',
  check:
    '<svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.6 7.5 5.7 10.6 11.4 3.9"></path></svg>',
  spinner:
    '<svg class="iconspin" width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M7 1.7a5.3 5.3 0 1 1-4.6 2.7"></path></svg>',
  spark:
    '<svg width="13" height="13" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">' +
    '<path d="M7 .9c.36 2.6 1.6 3.84 4.2 4.2-2.6.36-3.84 1.6-4.2 4.2C6.64 6.7 5.4 5.46 2.8 5.1 5.4 4.74 6.64 3.5 7 .9Z"></path>' +
    '<path d="M11.6 8.4c.19 1.31.85 1.97 2.16 2.16-1.31.19-1.97.85-2.16 2.16-.19-1.31-.85-1.97-2.16-2.16 1.31-.19 1.97-.85 2.16-2.16Z"></path>' +
    '</svg>',
  code:
    '<svg width="12" height="12" aria-hidden="true"><use href="#icoCode"></use></svg>',
  globe:
    '<svg width="12" height="12" aria-hidden="true"><use href="#icoGlobe"></use></svg>',
  archive:
    '<svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<rect x="1.6" y="2.4" width="10.8" height="2.4" rx="1"></rect>' +
    '<path d="M2.4 4.8v6a1.2 1.2 0 0 0 1.2 1.2h6.8a1.2 1.2 0 0 0 1.2-1.2v-6"></path>' +
    '<path d="M5.6 7.4h2.8"></path></svg>',
  save:
    '<svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M7 1.9v6.4"></path><path d="M4.3 5.7 7 8.4l2.7-2.7"></path>' +
    '<path d="M2.4 9.6v1.3a1.2 1.2 0 0 0 1.2 1.2h6.8a1.2 1.2 0 0 0 1.2-1.2V9.6"></path></svg>',
};

interface PyWebViewAPI {
  send: (text: string) => Promise<{ ok: boolean; error?: string }>;
  stop: () => Promise<void>;
  bootstrap: () => Promise<BootstrapData>;
  model_choices: () => Promise<ModelItem[]>;
  backend_catalog: () => Promise<BackendItem[]>;
  pin_model: (backend: string, model: string) => Promise<{ ok: boolean; error?: string; state: StateData }>;
  save_key: (backend: string, value: string) => Promise<{ ok: boolean; error?: string; state: StateData }>;
  connect_gateway: (gateway: string, credential: string) => Promise<{ ok: boolean; error?: string; state: StateData }>;
  disconnect_gateway: (gateway: string) => Promise<{ ok: boolean; error?: string; state: StateData }>;
  delete_key: (backend: string) => Promise<{ ok: boolean; error?: string; state: StateData }>;
  list_sessions: () => Promise<SessionItem[]>;
  load_session: (id: string) => Promise<{ ok: boolean; error?: string; id: string; payload: SessionPayload }>;
  get_state: () => Promise<StateData>;
  new_session: (options?: {
    workspace?: string;
    agent_shell?: boolean;
    agent_web?: boolean;
    project_id?: string;
  } | null) => Promise<{ ok: boolean; error?: string; id?: string; workspace?: string }>;
  create_project: (options: { folder: string; name?: string }) => Promise<{
    ok: boolean;
    error?: string;
    project?: ProjectItem;
    state?: StateData;
  }>;
  remove_project: (project_id: string) => Promise<{ ok: boolean; error?: string; state?: StateData }>;
  approve_tool: (request_id: string, decision: 'once' | 'always' | 'deny') => Promise<{
    ok: boolean;
    error?: string;
    state?: StateData;
  }>;
  answer_ask_user: (request_id: string, text: string) => Promise<{
    ok: boolean;
    error?: string;
  }>;
  read_delivery: (name: string) => Promise<{
    ok: boolean;
    error?: string;
    name?: string;
    size?: number;
    base64?: string;
  }>;
  read_delivery_bundle: () => Promise<{
    ok: boolean;
    error?: string;
    name?: string;
    size?: number;
    entries?: number;
    base64?: string;
  }>;
  rename_session: (id: string, title: string) => Promise<{ ok: boolean; error?: string }>;
  delete_session: (id: string) => Promise<{ ok: boolean; error?: string; id: string }>;
  unlock: (password: string) => Promise<{ ok: boolean; error?: string; state: StateData }>;
  seal_vault: (passphrase: string, confirm: string) => Promise<{ ok: boolean; error?: string; state: StateData }>;
  update_config: (fields: Record<string, any>) => Promise<{ ok: boolean; error?: string; state: StateData }>;
  minimize: () => Promise<void>;
  toggle_maximize: () => Promise<void>;
  close: () => Promise<void>;
  drag_by: (dx: number, dy: number) => Promise<{ ok: boolean; error?: string }>;
  browse_workspace: (target?: string) => Promise<{
    ok: boolean;
    error?: string;
    path?: string;
    parent?: string;
    folders?: Array<{ name: string; path: string }>;
    drives?: Array<{ name: string; path: string }>;
  }>;
  pick_folder_native: () => Promise<{ ok: boolean; error?: string; path?: string }>;
}

interface BootstrapData {
  models: ModelItem[];
  backends: BackendItem[];
  sessions: SessionItem[];
  state: StateData;
  drawer: string;
  room: { turns: Turn[] };
}

interface ModelItem {
  backend: string;
  model: string;
  traits?: string[];
  keyed: boolean;
  gateway?: boolean;
  search?: string;
}

interface BackendItem {
  backend: string;
  source: 'stored' | 'external' | 'env' | 'missing';
  tag: string;
  blurb?: string;
  detail?: string;
  removable: boolean;
  keys_dir?: string;
}

interface SessionItem {
  id: string;
  title?: string;
  preview?: string;
  message_count?: number;
  updated_at?: number;
  workspace?: string;
  project_id?: string;
}

interface ProjectItem {
  id: string;
  name: string;
  folder: string;
  created_at?: number;
}

interface SessionPayload {
  draft?: Turn[];
  chat?: Turn[];
}

interface StateData {
  state?: StateData;
  session_id?: string;
  draft_model?: string;
  draft_backend?: string;
  locked?: boolean;
  vault?: string;
  vault_available?: boolean;
  rooms?: { forge: { phase: string } };
  hold?: boolean;
  hold_max?: number;
  chat_fallback?: string;
  hold_prefill?: boolean;
  judge_backend?: string;
  judge_model?: string;
  target?: string;
  style?: string;
  style_names?: string[];
  temp?: number;
  top_p?: number;
  reasoning_effort?: string;
  request_timeout?: number;
  connect_retries?: number;
  insecure?: boolean;
  tls_strict?: boolean;
  theme?: string;
  record_tests?: boolean;
  custom_prompt?: string;
  custom_prompt_on?: boolean;
  saved_prompts?: Array<{ id: string; name: string; text: string }>;
  setup_done?: boolean;
  first_run?: boolean;
  anvil_auto_improve?: boolean;
  anvil_probe_count?: number;
  anvil_max_versions?: number;
  anvil_threshold?: number;
  keys?: Record<string, string>;
  workspace?: string;
  agent_enabled?: boolean;
  agent_shell?: boolean;
  agent_web?: boolean;
  projects?: ProjectItem[];
  project_id?: string;
}

interface Turn {
  role: 'user' | 'assistant';
  content: string;
}

interface PendingTurn {
  wrap: HTMLElement;
  body: HTMLElement;
  md: HTMLElement;
}

interface TokenPayload {
  text?: string;
}

interface CompletePayload {
  text?: string | null;
  usage?: { input: number; output: number };
  held?: boolean;
  hold_class?: string;
  notice?: string;
}

interface EventPayload {
  room?: string;
  phase?: string;
  label?: string;
  hold?: boolean;
  fallback?: boolean;
  attempt?: number;
  of?: number;
  maximum?: number;
  text?: string;
  usage?: { input: number; output: number };
  held?: boolean;
  hold_class?: string;
  message?: string;
  notice?: string;
  state?: StateData;
  action?: string;
  payload?: SessionPayload;
  id?: string | number;
  kind?: string;
  detail?: string;
  file?: string;
  added?: number;
  removed?: number;
  created?: boolean;
  model?: string;
  backend?: string;
  reasoning?: string;
  files?: Array<{ name: string; size: number }>;
  question?: string;
  options?: unknown[];
}

(() => {
  'use strict';

  const $el = (id: string): HTMLElement => document.getElementById(id)!;
  const bridge = (): PyWebViewAPI | undefined => (window as any).pywebview?.api;

  let state: StateData | null = null;
  let models: ModelItem[] = [];
  let backends: BackendItem[] = [];
  let sessions: SessionItem[] = [];
  let activeId: string = '';
  let pending: PendingTurn | null = null;
  let streamBuf: string = '';
  let phase: string = 'idle';
  let atBottom: boolean = true;
  let lastUserText: string = '';
  let startedAt: number = 0;
  /* why this turn ended up on a different thinking level than asked for */
  let effortNote: string = '';

  /* ───────────────────────── markdown ───────────────────────── */

  const esc = (value: any): string => {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  const inline = (value: any): string => {
    const spans: string[] = [];
    let text = String(value).replace(/`([^`]+)`/g, (_, code: string) => {
      spans.push(code);
      return '\u0000' + (spans.length - 1) + '\u0000';
    });
    text = esc(text);
    text = text.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g,
      '<a href=\"#\" data-url=\"$2\" title=\"$2\">$1</a>');
    text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/(^|[^*\w])\*([^*\n]+)\*/g, '$1<em>$2</em>');
    return text.replace(/\u0000(\d+)\u0000/g, (_, index: string) => {
      return '<code>' + esc(spans[parseInt(index)]) + '</code>';
    });
  };

  /* long code opens like the reasoning line: a header with the file it
     belongs to, a peek at the first lines, and the rest one click away */
  const CODE_FOLD_LINES = 16;
  const CODE_FOLD_MIN = 900;

  /* which blocks the reader opened, by position in the rendered answer. The
     text is re-rendered on every stream frame, so without this a click during
     the stream would be thrown away on the next frame. */
  const open_blocks = new Set<number>();

  const code_name = (lang: string | null): string => {
    const raw = String(lang || '').trim();
    if (!raw) return 'snippet';
    const first = raw.split(/[\s:,]/)[0] || '';
    return /^[A-Za-z0-9_.-]{1,60}$/.test(first) ? first : first || 'snippet';
  };

  const code_ext = (name: string, lang: string | null): string => {
    if (/\.[A-Za-z0-9]{1,8}$/.test(name)) return '';
    const known: Record<string, string> = {
      ts: 'ts', tsx: 'tsx', js: 'js', jsx: 'jsx', py: 'py', rs: 'rs', go: 'go',
      java: 'java', c: 'c', h: 'h', cpp: 'cpp', hpp: 'hpp', cs: 'cs', rb: 'rb',
      php: 'php', sh: 'sh', bash: 'sh', ps1: 'ps1', json: 'json', yaml: 'yml',
      yml: 'yml', toml: 'toml', md: 'md', html: 'html', css: 'css', sql: 'sql',
      swift: 'swift', kt: 'kt', lua: 'lua', xml: 'xml',
    };
    const key = String(lang || '').trim().toLowerCase();
    return known[key] ? `.${known[key]}` : '';
  };

  const codeBlock = (lang: string | null, body: string, index: number): string => {
    const text = body.replace(/\n+$/, '');
    const lines = text ? text.split('\n').length : 0;
    const name = code_name(lang);
    const big = lines > CODE_FOLD_LINES || text.length > CODE_FOLD_MIN;
    const open = big && open_blocks.has(index);
    return '<div class="codeblock' + (big ? ' big' : '') + (open ? ' open' : '') +
      '" data-idx="' + index + '" data-name="' + esc(name) + '" data-ext="' +
      esc(code_ext(name, lang)) + '">' +
      '<div class="codehead"><span class="lang">' + ICONS.code + esc(name) + '</span>' +
      '<span class="codestat">' + (lines ? lines + (lines > 1 ? ' lines' : ' line') : '') +
      (big ? '<button type="button" class="codefold" aria-expanded="' + (open ? 'true' : 'false') +
        '">' + (open ? 'show less' : 'show all') + '</button>' : '') +
      '</span>' +
      '<button type="button" class="codedl" title="Download this code">' + ICONS.save + '</button>' +
      '<button type="button" class="copycode">copy</button></div>' +
      '<pre><code>' + esc(text) + '</code></pre></div>';
  };

  const md = (source: any): string => {
    let text = String(source == null ? '' : source);
    if ((text.split('```').length - 1) % 2 === 1) text += '\n```';

    const lines = text.split('\n');
    const out: string[] = [];
    let i = 0;
    let code_index = 0;

    while (i < lines.length) {
      const line = lines[i];

      if (/^```/.test(line)) {
        const lang = line.slice(3).trim();
        const buf: string[] = [];
        i++;
        while (i < lines.length && !/^```/.test(lines[i])) { buf.push(lines[i]); i++; }
        i++;
        out.push(codeBlock(lang || null, buf.join('\n'), code_index));
        code_index += 1;
        continue;
      }

      if (/^\s*$/.test(line)) { i++; continue; }

      if (/^---+\s*$/.test(line)) { out.push('<hr>'); i++; continue; }

      const heading = /^(#{1,4})\s+(.*)$/.exec(line);
      if (heading) {
        const tag = heading[1].length <= 2 ? 'h3' : 'h4';
        out.push('<' + tag + '>' + inline(heading[2]) + '</' + tag + '>');
        i++;
        continue;
      }

      if (/^\s*\|.*\|\s*$/.test(line) &&
          i + 1 < lines.length &&
          /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1])) {
        const cells = (row: string) => {
          return row.trim().replace(/^\||\|$/g, '').split('|').map((cell: string) => cell.trim());
        };
        const head = cells(line);
        i += 2;
        const rows: string[][] = [];
        while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) { rows.push(cells(lines[i])); i++; }
        let table = '<div class=\"tablewrap\"><table><thead><tr>';
        head.forEach((cell: string) => { table += '<th>' + inline(cell) + '</th>'; });
        table += '</tr></thead><tbody>';
        rows.forEach((row: string[]) => {
          table += '<tr>';
          row.forEach((cell: string) => { table += '<td>' + inline(cell) + '</td>'; });
          table += '</tr>';
        });
        out.push(table + '</tbody></table></div>');
        continue;
      }

      if (/^\s*>\s?/.test(line)) {
        const quote: string[] = [];
        while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
          quote.push(lines[i].replace(/^\s*>\s?/, ''));
          i++;
        }
        out.push('<blockquote>' + inline(quote.join(' ')) + '</blockquote>');
        continue;
      }

      if (/^\s*[-*]\s+/.test(line)) {
        const bullets: string[] = [];
        while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
          bullets.push('<li>' + inline(lines[i].replace(/^\s*[-*]\s+/, '')) + '</li>');
          i++;
        }
        out.push('<ul>' + bullets.join('') + '</ul>');
        continue;
      }

      if (/^\s*\d+[.)]\s+/.test(line)) {
        const numbered: string[] = [];
        while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) {
          numbered.push('<li>' + inline(lines[i].replace(/^\s*\d+[.)]\s+/, '')) + '</li>');
          i++;
        }
        out.push('<ol>' + numbered.join('') + '</ol>');
        continue;
      }

      let para: string[] = [];
      while (i < lines.length &&
             !/^\s*$/.test(lines[i]) &&
             !/^(```|#{1,4}\s|\s*[-*]\s|\s*\d+[.)]\s|\s*>|---+\s*$)/.test(lines[i]) &&
             !/^\s*\|.*\|\s*$/.test(lines[i])) {
        para.push(lines[i]);
        i++;
      }
      if (!para.length) {
        para.push(lines[i]);
        i++;
      }
      out.push('<p>' + inline(para.join(' ')) + '</p>');
    }

    return out.join('');
  };

  /* ───────────────────────── chrome ───────────────────────── */

  let toastTimer: number | null = null;

  const toast = (message: string) => {
    const el = $el('toast');
    el.textContent = message;
    el.classList.add('on');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => { el.classList.remove('on'); }, 1800);
  };

  /* ripple: a soft burst of light where the finger lands */
  document.addEventListener('click', (event: Event) => {
    const mouse = event as MouseEvent;
    const target = event.target as HTMLElement | null;
    const button = target && target.closest('button:not(:disabled)');
    if (!button || !button.matches('.cardrow button, .send, .newchat, .thinkbtn')) return;
    const rect = button.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 1.2;
    const ripple = document.createElement('span');
    ripple.className = 'ripple' + (button.matches('.newchat') ? ' dark' : '');
    ripple.style.width = ripple.style.height = size + 'px';
    ripple.style.left = (mouse.clientX - rect.left - size / 2) + 'px';
    ripple.style.top = (mouse.clientY - rect.top - size / 2) + 'px';
    button.appendChild(ripple);
    ripple.addEventListener('animationend', () => ripple.remove(), { once: true });
    /* nodes whose animation never starts (detached button, frozen frame)
       are swept up instead of lingering invisibly */
    window.setTimeout(() => ripple.remove(), 700);
  });

  /* rows: a brief warm flash when a row is chosen */
  const flashRow = (row: Element) => {
    row.classList.remove('flash');
    void (row as HTMLElement).offsetWidth;
    row.classList.add('flash');
    const done = () => row.classList.remove('flash');
    /* a re-click cancels the in-flight animation, which fires
       animationcancel instead of animationend */
    row.addEventListener('animationend', done, { once: true });
    row.addEventListener('animationcancel', done, { once: true });
  };

  const setAlert = (text: string, bad?: boolean) => {
    const chip = $el('alertChip');
    if (!text) {
      chip.hidden = true;
      return;
    }
    $el('alertText').textContent = text;
    chip.classList.toggle('bad', Boolean(bad));
    chip.hidden = false;
  };

  const busy = (): boolean => phase !== 'idle' && phase !== 'ready';

  /* leaving a chat mid-stream stops its generation first, so orphaned
     tokens can never land in the chat we are switching to */
  const stopIfBusy = (): void => {
    if (!busy()) return;
    const api = bridge();
    if (api) api.stop().catch(() => {});
  };

  const paintSendButton = () => {
    const button = $el('sendBtn') as HTMLButtonElement;
    if (busy()) {
      button.classList.add('stop');
      button.innerHTML = '<span class=\"sq\"></span><span>Stop</span>';
      button.disabled = false;
      button.setAttribute('aria-label', 'Stop generating');
    } else {
      button.classList.remove('stop');
      button.innerHTML =
        '<span>Send</span><svg width=\"12\" height=\"12\" viewBox=\"0 0 13 13\" fill=\"none\" ' +
        'stroke=\"currentColor\" stroke-width=\"1.7\" stroke-linecap=\"round\" stroke-linejoin=\"round\">' +
        '<path d=\"M6.5 10.5v-8M3 6l3.5-3.5L10 6\"></path></svg>';
      button.disabled = !($el('input') as HTMLInputElement).value.trim();
      button.setAttribute('aria-label', 'Send');
    }
  };

  const THINK_LEVELS = ['off', 'low', 'medium', 'high', 'max'];
  const normalizeThink = (value: unknown): string => {
    const key = String(value ?? 'medium').trim().toLowerCase();
    return (THINK_LEVELS as string[]).includes(key) ? key : 'medium';
  };
  const thinkLabel = (level: string): string => level.charAt(0).toUpperCase() + level.slice(1);

  /* the Think button: a spark, the word, and a four-step meter for the four
     reasoning levels — off is empty, max fills every bar */
  const THINK_STEPS = 4;
  const thinkMeter = (level: string): string => {
    const at = THINK_LEVELS.indexOf(level);
    /* THINK_LEVELS starts at off, so the lit count is the distance from it */
    const lit = Math.max(0, Math.min(THINK_STEPS, at));
    let out = '<span class="thinkmeter" aria-hidden="true">';
    for (let step = 0; step < THINK_STEPS; step += 1) {
      out += `<i class="${step < lit ? 'on' : ''}"></i>`;
    }
    return `${out}</span>`;
  };

  const paintThinkButton = () => {
    const level = normalizeThink(state && state.reasoning_effort);
    const button = $el('thinkBtn') as HTMLButtonElement;
    button.innerHTML =
      `<span class="thinkico">${ICONS.spark}</span>` +
      '<span class="thinktext">Think</span>' +
      thinkMeter(level) +
      `<span class="thinklevel">${thinkLabel(level)}</span>`;
    button.classList.toggle('off', level === 'off');
    const label = 'Think · ' + thinkLabel(level);
    button.setAttribute('aria-label', label);
    button.setAttribute('aria-valuetext', label);
    button.title =
      label + ' — click to cycle. Each model family maps it to its ' +
      'own control: token budget, effort level, or thinking level';

    /* a live "thinking …" line follows the level too — clicking it reveals
       the reasoning once the answer lands, it never changes the level */
    const chip = pending && pending.md.classList.contains('waiting')
      ? pending.md.querySelector('.think') as HTMLElement | null
      : null;
    const waiting = chip ? chip.querySelector('.thinkword') as HTMLElement | null : null;
    if (waiting && /^thinking/.test(waiting.textContent || '')) {
      waiting.textContent = waitingLabel();
      chip!.title = 'Thinking: ' + thinkLabel(level) + ' — the reasoning appears here when the answer lands';
    }
  };

  const waitingLabel = (): string =>
    'thinking · ' + thinkLabel(normalizeThink(state && state.reasoning_effort));

  /* one shared cycle: the composer Think button owns the effort control —
     the in-chat thinking line only shows the level and reveals the reasoning */
  const cycleEffort = () => {
    const current = normalizeThink(state && state.reasoning_effort);
    const next = THINK_LEVELS[(THINK_LEVELS.indexOf(current) + 1) % THINK_LEVELS.length];
    commitConfig({ reasoning_effort: next });
  };

  const setPhase = (next: string, payload?: EventPayload) => {
    phase = next === 'ready' ? 'idle' : next;
    payload = payload || {};

    if (phase === 'hold') {
      if (payload.fallback) setAlert('falling back');
      else if (payload.attempt && payload.maximum) setAlert(`hold ${payload.attempt}/${payload.maximum}`);
      else setAlert('hold');
    } else if (phase !== 'idle') {
      setAlert('');
    }

    paintSendButton();
  };

  /* ───────────────────────── thread ───────────────────────── */

  const showEmpty = (on: boolean) => {
    $el('empty').hidden = !on;
    $el('turns').hidden = on;
  };

  const setWaiting = (pane: HTMLElement, label: string) => {
    pane.className = 'md waiting';
    const level = normalizeThink(state && state.reasoning_effort);
    pane.innerHTML =
      '<span class=\"think\" title=\"' +
      esc('Thinking: ' + thinkLabel(level) + ' — the reasoning appears here when the answer lands') + '\">' +
      '<span class=\"thinkword\">' + esc(label) + '</span>' +
      '<span class=\"dots\" aria-hidden=\"true\"><i></i><i></i><i></i></span></span>';
  };

  const nearBottom = (): boolean => {
    const thread = $el('thread');
    return thread.scrollHeight - thread.scrollTop - thread.clientHeight < 60;
  };

  const toBottom = (force: boolean) => {
    if (!force && !atBottom) return;
    const thread = $el('thread');
    thread.scrollTop = thread.scrollHeight;
    atBottom = true;
    $el('jumpBtn').hidden = true;
  };

  const nestedCanScroll = (root: HTMLElement, from: Element, deltaY: number): boolean => {
    let node: Element | null = from;
    while (node && node !== root) {
      if (node.scrollHeight > node.clientHeight + 1) {
        const overflow = window.getComputedStyle(node as HTMLElement).overflowY;
        if (overflow === 'auto' || overflow === 'scroll') {
          if (deltaY < 0 && (node as HTMLElement).scrollTop > 0) return true;
          if (deltaY > 0 && (node as HTMLElement).scrollTop < (node as HTMLElement).scrollHeight - (node as HTMLElement).clientHeight - 1) return true;
        }
      }
      node = node.parentNode as Element | null;
    }
    return false;
  };

  const bindScroller = (el: HTMLElement | null) => {
    if (!el || el.getAttribute('data-scroller') === 'on') return;
    el.setAttribute('data-scroller', 'on');
    el.addEventListener('wheel', (event: WheelEvent) => {
      if (event.ctrlKey) return;
      if (nestedCanScroll(el, event.target as Element, event.deltaY)) return;
      const max = el.scrollHeight - el.clientHeight;
      if (max <= 1) return;
      let delta = event.deltaY;
      if (event.deltaMode === 1) delta *= 16;
      if (event.deltaMode === 2) delta *= el.clientHeight;
      let next = el.scrollTop + delta;
      if (next < 0) next = 0;
      if (next > max) next = max;
      if (next === el.scrollTop) return;
      el.scrollTop = next;
      event.preventDefault();
    }, { passive: false });
  };

  const scrollThreadBy = (amount: number): boolean => {
    const thread = $el('thread');
    const max = thread.scrollHeight - thread.clientHeight;
    if (max <= 1) return false;
    thread.scrollTop = Math.max(0, Math.min(max, thread.scrollTop + amount));
    atBottom = nearBottom();
    $el('jumpBtn').hidden = atBottom;
    return true;
  };

  const copyButton = (getText: () => string): HTMLButtonElement => {
    const button = document.createElement('button');
    button.type = 'button';
    button.innerHTML =
      '<svg width=\"11\" height=\"11\" viewBox=\"0 0 12 12\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.4\">' +
      '<rect x=\"3.4\" y=\"3.4\" width=\"6.4\" height=\"6.4\" rx=\"1.3\"></rect>' +
      '<path d=\"M8.6 3.4V2.6a1.3 1.3 0 0 0-1.3-1.3H2.6a1.3 1.3 0 0 0-1.3 1.3v4.7a1.3 1.3 0 0 0 1.3 1.3h.8\"></path>' +
      '</svg>copy';
    button.addEventListener('click', () => {
      const text = getText();
      if (navigator.clipboard) navigator.clipboard.writeText(text).catch(() => {});
      toast('copied');
    });
    return button;
  };

  const reuseButton = (text: string): HTMLButtonElement => {
    const button = document.createElement('button');
    button.type = 'button';
    button.title = 'Put this back in the composer';
    button.innerHTML =
      '<svg width=\"11\" height=\"11\" viewBox=\"0 0 12 12\" fill=\"none\" stroke=\"currentColor\" ' +
      'stroke-width=\"1.4\" stroke-linecap=\"round\" stroke-linejoin=\"round\">' +
      '<path d=\"M10 6a4 4 0 1 1-1.3-2.9\"></path><path d=\"M10.4 1.4v2.6H7.8\"></path></svg>reuse';
    button.addEventListener('click', () => {
      ($el('input') as HTMLInputElement).value = text;
      grow();
      paintSendButton();
      ($el('input') as HTMLInputElement).focus();
      toast('put back in the composer');
    });
    return button;
  };

  const metaLine = (usage?: { input: number; output: number }, seconds?: number, held?: boolean, holdClass?: string): string => {
    const bits: string[] = [];
    if (seconds) bits.push(seconds.toFixed(1) + 's');
    if (usage && (usage.input || usage.output)) {
      bits.push(usage.input + ' in · ' + usage.output + ' out');
    }
    if (held) bits.push('held' + (holdClass ? ' · ' + holdClass : ''));
    return bits.join('  ');
  };

  const wireCodeCopy = (scope: Element) => {
    const buttons = scope.querySelectorAll('.copycode');
    for (let i = 0; i < buttons.length; i++) {
      buttons[i].addEventListener('click', (event: Event) => {
        const block = (event.currentTarget as HTMLElement).parentElement?.parentElement?.querySelector('code');
        if (block && navigator.clipboard) navigator.clipboard.writeText(block.textContent || '').catch(() => {});
        const button = event.currentTarget as HTMLButtonElement;
        button.textContent = 'copied';
        setTimeout(() => { button.textContent = 'copy'; }, 1200);
      });
    }

    const folds = scope.querySelectorAll('.codefold');
    for (let i = 0; i < folds.length; i++) {
      folds[i].addEventListener('click', (event: Event) => {
        event.stopPropagation();
        const button = event.currentTarget as HTMLButtonElement;
        const box = button.closest('.codeblock');
        if (!box) return;
        const open = box.classList.toggle('open');
        /* remember it: the stream re-renders this block on every frame */
        const index = Number(box.getAttribute('data-idx'));
        if (Number.isInteger(index)) {
          if (open) open_blocks.add(index);
          else open_blocks.delete(index);
        }
        button.textContent = open ? 'show less' : 'show all';
        button.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
    }

    const saves = scope.querySelectorAll('.codedl');
    for (let i = 0; i < saves.length; i++) {
      saves[i].addEventListener('click', (event: Event) => {
        event.stopPropagation();
        const button = event.currentTarget as HTMLElement;
        const box = button.closest('.codeblock');
        const code = box ? box.querySelector('code') : null;
        if (!box || !code) return;
        const name = box.getAttribute('data-name') || 'snippet';
        const ext = box.getAttribute('data-ext') || '';
        const filename = (name === 'snippet' ? 'code' : name) + ext;
        save_blob(new Blob([code.textContent || ''], { type: 'text/plain;charset=utf-8' }), filename);
      });
    }
  };

  const addUserTurn = (text: string): HTMLElement => {
    showEmpty(false);
    lastUserText = text;

    const wrap = document.createElement('div');
    wrap.className = 'turn you';

    const who = document.createElement('div');
    who.className = 'who';
    who.textContent = 'You';

    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.textContent = text;

    const actions = document.createElement('div');
    actions.className = 'actions';
    actions.appendChild(copyButton(() => text));
    actions.appendChild(reuseButton(text));

    wrap.appendChild(who);
    wrap.appendChild(bubble);
    wrap.appendChild(actions);
    $el('turns').appendChild(wrap);
    toBottom(true);
    return wrap;
  };

  const addBotTurn = (text: string, live: boolean): PendingTurn => {
    showEmpty(false);

    const wrap = document.createElement('div');
    wrap.className = 'turn forge';
    wrap.innerHTML =
      '<div class=\"who\">Forge</div>' +
      '<div class=\"bot\">' +
      '<svg class=\"glyph\" viewBox=\"0 0 200 200\" aria-hidden=\"true\"><use href=\"#forgeSword\"></use></svg>' +
      '<div class=\"body\"><div class=\"md\"></div></div></div>';

    const body = wrap.querySelector('.body') as HTMLElement;
    const pane = wrap.querySelector('.md') as HTMLElement;

    if (live) {
      setWaiting(pane, waitingLabel());
    } else {
      pane.innerHTML = md(text);
      wireCodeCopy(pane);
      const actions = document.createElement('div');
      actions.className = 'actions';
      actions.appendChild(copyButton(() => text));
      body.appendChild(actions);
    }

    $el('turns').appendChild(wrap);
    toBottom(true);
    return { wrap, body, md: pane };
  };

  /* agent trace: one folded summary line, click to unfold the whole run.
     rows land on the latest forge turn, so a finished turn keeps its
     history and late results still find their tool row by id. */
  /* the trace rows already carry the "agent · " prefix the engine sends, so
     the folded header stays a context line and a count instead of repeating
     the first row word for word */
  /* an agent turn reads in the order it happened:
     thinking → what it said → the tool it ran → thinking → what it said.
     Segments are appended in arrival order; a plain chat turn never produces
     these events and keeps its single streaming block. */
  let segments: {
    kind: 'text' | 'thinking' | null;
    text_node: HTMLElement | null;
    body: string;
  } | null = null;
  let segments_text = '';
  let segments_last_text = '';
  let segments_reasoned = false;
  let segment_nodes = 0;
  let tool_count = 0;

  const TOOL_VERBS: Record<string, string> = {
    write_file: 'Write',
    replace_in_file: 'Edit',
    read_file: 'Read',
    list_files: 'Folder',
    search_files: 'Search',
    run_command: 'Shell',
    web_fetch: 'Web',
    web_search: 'Search web',
    make_zip: 'Archive',
    ask_user: 'Ask',
  };

  const begin_segments = (): void => {
    if (segments || !pending) return;
    const carried = streamBuf.trim();
    segments = { kind: null, text_node: null, body: '' };
    segments_last_text = carried;
    segments_reasoned = false;
    segment_nodes = 0;
    tool_count = 0;
    streamBuf = '';
    /* the waiting line has no place in a transcript */
    pending.md.className = 'md';
    pending.md.innerHTML = '';
    if (carried) {
      pending.md.innerHTML = md(carried);
      wireCodeCopy(pending.md);
      segments_text = carried;
      segments.kind = 'text';
      segments.text_node = pending.md;
      segments.body = carried;
    }
  };

  const close_segment = (): void => {
    if (!segments) return;
    if (segments.kind === 'text') segments_last_text = segments.body;
    segments.kind = null;
    segments.text_node = null;
    segments.body = '';
  };

  const push_text = (chunk: string): void => {
    if (!segments || !pending) return;
    if (segments.kind !== 'text' || !segments.text_node) {
      /* the very first block may reuse the waiting line's node, which already
         sits at the top of the body; anything later must append, or it would
         jump back in front of the transcript */
      const block = segment_nodes === 0 && !pending.md.innerHTML.trim()
        ? pending.md
        : document.createElement('div');
      if (block !== pending.md) {
        block.className = 'md seg';
        pending.body.appendChild(block);
        segment_nodes += 1;
      }
      segments.kind = 'text';
      segments.text_node = block;
      segments.body = '';
    }
    segments.body += chunk;
    const node = segments.text_node as HTMLElement;
    node.innerHTML = md(segments.body);
    wireCodeCopy(node);
    segments_text += chunk;
    segments_last_text = segments.body;
    toBottom(false);
  };

  /* a couple of words before a tool call is bookkeeping, not reasoning: it
     would stack up as a column of empty "thinking" labels */
  const THINKING_MIN_CHARS = 24;

  const push_thinking = (chunk: string): void => {
    if (!segments || !pending) return;
    if (segments.kind !== 'thinking' || !segments.text_node) {
      const wrap = document.createElement('div');
      wrap.className = 'segthink';
      wrap.dataset['quiet'] = '1';
      const head = document.createElement('button');
      head.type = 'button';
      head.className = 'segthink-head';
      const words = document.createElement('span');
      words.textContent = 'thinking';
      const count = document.createElement('span');
      count.className = 'segthink-count';
      const pre = document.createElement('pre');
      pre.className = 'segthink-body';
      head.appendChild(words);
      head.appendChild(count);
      head.addEventListener('click', () => wrap.classList.toggle('open'));
      wrap.appendChild(head);
      wrap.appendChild(pre);
      pending.body.appendChild(wrap);
      segment_nodes += 1;
      segments.kind = 'thinking';
      segments.text_node = pre;
      segments.body = '';
      count.textContent = '';
    }
    segments.body += chunk;
    (segments.text_node as HTMLElement).textContent = segments.body;
    segments_reasoned = true;
    const wrap = (segments.text_node as HTMLElement).parentElement;
    /* the marker drops itself once there is something worth opening */
    if (segments.body.trim().length >= THINKING_MIN_CHARS && wrap) {
      wrap.dataset['quiet'] = '0';
    }
    const label = wrap ? wrap.querySelector('.segthink-head span') as HTMLElement : null;
    if (label) label.textContent = 'thinking';
    toBottom(false);
  };

  const agent_tool_row = (entry: {
    id?: number;
    label?: string;
    detail?: string;
    file?: string;
    kind?: string;
  }): HTMLElement | null => {
    if (!pending) return null;
    const name = String(entry.label || 'tool');
    const row = document.createElement('div');
    row.className = 'segtool';
    if (entry.id != null) row.dataset.tid = String(entry.id);
    const verb = document.createElement('span');
    verb.className = 'segtool-verb';
    const file = String(entry.file || '').trim();
    verb.textContent = TOOL_VERBS[name] || name;
    row.appendChild(verb);
    if (file) {
      const target = document.createElement('span');
      target.className = 'segtool-file';
      target.textContent = file;
      target.title = file;
      row.appendChild(target);
    } else {
      const hint = document.createElement('span');
      hint.className = 'segtool-hint';
      hint.textContent = String(entry.detail || '').split('\n')[0].slice(0, 90);
      hint.title = String(entry.detail || '');
      row.appendChild(hint);
    }
    const stat = document.createElement('span');
    stat.className = 'segtool-stat';
    row.appendChild(stat);
    pending.body.appendChild(row);
    segment_nodes += 1;
    toBottom(false);
    return row;
  };

  const refreshTraceSummary = (box: HTMLElement): void => {
    const head = box.querySelector(':scope > .tsum > .stext') as HTMLElement | null;
    if (!head) return;
    const list = box.querySelector(':scope > .tlist > .tlin');
    const steps = list ? list.querySelectorAll(':scope > .tstep').length : 0;
    const parts = ['agent'];
    if (steps > 1) parts.push(`${steps} steps`);
    if (tool_count > 0) parts.push(`${tool_count} tool${tool_count > 1 ? 's' : ''}`);
    head.textContent = parts.join(' · ');
  };

  /* the engine prefixes its step names with "agent · " so the status line
     reads well on its own; inside the trace box the header already says
     agent, so the rows drop the prefix instead of echoing it */
  const traceWord = (label: string): string =>
    label.replace(/^agent\s*·\s*/i, '').trim() || label;

  const appendAgentTrace = (entry: { kind?: string; id?: number; label?: string; detail?: string }): void => {
    const turns = ($el('turns') as HTMLElement).querySelectorAll(':scope > .turn.forge');
    const last = turns.length ? (turns[turns.length - 1] as HTMLElement) : null;
    if (!last) return;
    const body = last.querySelector(':scope > .bot > .body') as HTMLElement | null;
    if (!body) return;
    let box = body.querySelector(':scope > .tracebox') as HTMLElement | null;
    let list: HTMLElement | null = null;
    if (!box) {
      box = document.createElement('div');
      box.className = 'tracebox';
      const head = document.createElement('button');
      head.type = 'button';
      head.className = 'tsum';
      const chev = document.createElement('span');
      chev.className = 'tchev';
      chev.innerHTML = ICONS.chevron;
      const summary = document.createElement('span');
      summary.className = 'stext';
      summary.textContent = 'thinking…';
      head.appendChild(chev);
      head.appendChild(summary);
      head.addEventListener('click', () => box!.classList.toggle('open'));
      const holder = document.createElement('div');
      holder.className = 'tlist';
      list = document.createElement('div');
      list.className = 'tlin';
      holder.appendChild(list);
      box.appendChild(head);
      box.appendChild(holder);
      body.insertBefore(box, body.firstChild);
      /* a running turn starts unfolded so progress is visible live; the
         finished turn folds itself back down (see finish/failPending) */
      if (pending && pending.wrap === last) box.classList.add('open');
    } else {
      list = box.querySelector(':scope > .tlist > .tlin') as HTMLElement | null;
    }
    if (!box || !list) return;
    const kind = entry.kind || 'step';
    const label = String(entry.label || '').slice(0, 200);
    if (kind === 'tool') {
      const row = document.createElement('div');
      row.className = 'ttool';
      if (entry.id != null) row.dataset.tid = String(entry.id);
      const head = document.createElement('button');
      head.type = 'button';
      head.className = 'thead';
      const chev = document.createElement('span');
      chev.className = 'tchev';
      chev.innerHTML = ICONS.chevron;
      const name = document.createElement('span');
      name.className = 'tname';
      name.textContent = label || 'tool';
      const toolIcon = document.createElement('span');
      toolIcon.className = 'tico';
      const toolText = (label || '').toLowerCase();
      if (/\b(web|webfetch|fetch|browse|http|https|curl|url|page|search)\b/.test(toolText)) {
        toolIcon.innerHTML = ICONS.globe;
      } else if (/\b(shell|bash|zsh|powershell|cmd|run|exec|command|terminal|process|npm|node|git|python)\b/.test(toolText)) {
        toolIcon.innerHTML = ICONS.code;
      }
      head.appendChild(chev);
      if (toolIcon.firstChild) head.appendChild(toolIcon);
      head.appendChild(name);
      const hintText = String(entry.detail || '').split('\n')[0].slice(0, 90);
      if (hintText) {
        const hint = document.createElement('span');
        hint.className = 'thint';
        hint.textContent = hintText;
        head.appendChild(hint);
      }
      head.addEventListener('click', () => row.classList.toggle('open'));
      const detail = document.createElement('div');
      detail.className = 'tdetail';
      const inner = document.createElement('div');
      inner.className = 'tin';
      const args = document.createElement('pre');
      args.className = 'targs';
      args.textContent = String(entry.detail || '');
      inner.appendChild(args);
      const res = document.createElement('pre');
      res.className = 'tres';
      res.dataset.role = 'result';
      res.textContent = 'running…';
      inner.appendChild(res);
      detail.appendChild(inner);
      row.appendChild(head);
      row.appendChild(detail);
      list.appendChild(row);
    } else if (kind === 'result') {
      const row = entry.id != null
        ? list.querySelector(`.ttool[data-tid="${entry.id}"]`)
        : list.querySelector('.ttool:not(.done)');
      if (!row) return;
      const res = row.querySelector('.tres[data-role="result"]') as HTMLElement | null;
      if (res) res.textContent = String(entry.detail || '(no output)');
      row.classList.add('done');
    } else {
      const step = document.createElement('div');
      step.className = 'tstep';
      const dot = document.createElement('span');
      dot.className = 'tdot';
      const text = document.createElement('span');
      text.textContent = traceWord(label);
      step.appendChild(dot);
      step.appendChild(text);
      list.appendChild(step);
    }
    refreshTraceSummary(box);
    toBottom(false);
  };

  let paintFrame: number = 0;

  const cancelPaint = () => {
    if (!paintFrame) return;
    cancelAnimationFrame(paintFrame);
    paintFrame = 0;
  };

  const paintPending = () => {
    if (!pending || paintFrame) return;
    paintFrame = requestAnimationFrame(() => {
      paintFrame = 0;
      if (!pending) return;
      if (pending.md.classList.contains('waiting')) {
        pending.md.classList.remove('waiting');
        pending.md.classList.add('streaming');
      }
      pending.md.innerHTML = md(streamBuf);
      /* the fold, copy and download controls live in that fresh markup */
      wireCodeCopy(pending.md);
      toBottom(false);
    });
  };

  const finishPending = (text: string | null | undefined, usage?: { input: number; output: number }, held?: boolean, holdClass?: string, note?: string, extra?: { reasoning?: string; files?: Array<{ name: string; size: number }> }) => {
    cancelPaint();
    if (!pending) return;
    const segmented = Boolean(segments);

    /* an agent turn is already laid out in order: only add what the engine
       sent that never made it into a segment, never rewrite the transcript */
    if (segmented) {
      close_segment();
      const final = String(text == null ? '' : text).trim();
      /* the engine's final text is the step we already streamed: only add it
         when it never made it into a segment */
      const already = segments && segments.kind === 'text' ? segments.body : segments_last_text;
      if (final && final !== already.trim()) {
        const block = document.createElement('div');
        block.className = 'md seg';
        block.innerHTML = md(final);
        wireCodeCopy(block);
        pending.body.appendChild(block);
        segments_text += final;
      }
      for (const wrap of Array.from(pending.body.querySelectorAll('.segthink'))) {
        const label = wrap.querySelector('.segthink-head span') as HTMLElement | null;
        if (label) label.textContent = 'thinking — click to show';
      }
      /* the reused waiting node can end up empty when the turn opened on
         thinking: an empty answer block is just noise */
      for (const node of Array.from(pending.body.querySelectorAll('.md'))) {
        const empty = !node.textContent.trim() && !node.querySelector('pre, ul, ol, table, h3, h4');
        if (empty) node.remove();
      }
      if (note) {
        const line = document.createElement('p');
        line.className = 'stopnote';
        line.textContent = note;
        pending.body.appendChild(line);
      }
      const reasoned = segments_reasoned || Boolean(extra?.reasoning && extra.reasoning.trim());
      if (effortNote && !(reasoned && /no thinking/i.test(effortNote))) {
        const line = document.createElement('p');
        line.className = 'stopnote effortnote';
        line.textContent = effortNote;
        pending.body.appendChild(line);
      }
      effortNote = '';
      /* reasoning that never streamed still belongs at the end of the turn */
      if (extra && extra.reasoning && extra.reasoning.trim() && !segments_reasoned) {
        pending.body.appendChild(thinkline(extra.reasoning));
      }
      if (extra && extra.files && extra.files.length) {
        pending.body.appendChild(delfiles(extra.files));
      }
      const trace = pending.wrap.querySelector(':scope > .bot > .body > .tracebox');
      if (trace) trace.classList.remove('open');
      const seg_actions = document.createElement('div');
      seg_actions.className = 'actions';
      seg_actions.appendChild(copyButton(() => segments_text));
      const seg_meta = document.createElement('span');
      seg_meta.className = 'meta';
      seg_meta.textContent = metaLine(
        usage,
        startedAt ? (Date.now() - startedAt) / 1000 : undefined,
        held,
        holdClass,
      );
      seg_actions.appendChild(seg_meta);
      pending.body.appendChild(seg_actions);
      pending = null;
      segments = null;
      segments_text = '';
      segments_last_text = '';
      segments_reasoned = false;
      tool_count = 0;
      streamBuf = '';
      open_blocks.clear();
      startedAt = 0;
      toBottom(false);
      return;
    }

    const final = text == null ? streamBuf : text;

    /* the finished turn folds its trace back to the one-line summary */
    const trace = pending.wrap.querySelector(':scope > .bot > .body > .tracebox');
    if (trace) trace.classList.remove('open');

    pending.md.className = 'md';
    pending.md.innerHTML = md(final);
    wireCodeCopy(pending.md);

    if (note) {
      const line = document.createElement('p');
      line.className = 'stopnote';
      line.textContent = note;
      pending.md.appendChild(line);
    }

    /* the thinking level this turn really ran on, when it had to move. A
       "has no thinking" claim is dropped when reasoning did come back: the
       note would sit right above the reasoning it denies. */
    const reasoned = Boolean(extra && extra.reasoning && extra.reasoning.trim());
    if (effortNote && !(reasoned && /no thinking/i.test(effortNote))) {
      const line = document.createElement('p');
      line.className = 'stopnote effortnote';
      line.textContent = effortNote;
      pending.md.appendChild(line);
    }
    effortNote = '';

    /* the model's hidden reasoning: collapsed, revealed on click — clicking
       never changes the effort, that stays on the composer Think button */
    if (extra && extra.reasoning && extra.reasoning.trim()) {
      pending.md.appendChild(thinkline(extra.reasoning));
    }

    /* files the turn staged in the sandbox, ready to download */
    if (extra && extra.files && extra.files.length) {
      pending.md.appendChild(delfiles(extra.files));
    }

    const actions = document.createElement('div');
    actions.className = 'actions';
    actions.appendChild(copyButton(() => final));

    const meta = document.createElement('span');
    meta.className = 'meta';
    meta.textContent = metaLine(usage, startedAt ? (Date.now() - startedAt) / 1000 : undefined, held, holdClass);
    actions.appendChild(meta);

    pending.body.appendChild(actions);
    pending = null;
    streamBuf = '';
    open_blocks.clear();
    startedAt = 0;
    toBottom(false);
  };

  /* collapsed reasoning block under a finished answer */
  const thinkline = (reasoning: string): HTMLElement => {
    const wrap = document.createElement('div');
    wrap.className = 'thinkwrap';
    const head = document.createElement('button');
    head.type = 'button';
    head.className = 'thinkline';
    head.setAttribute('aria-expanded', 'false');
    head.title = 'Show the model reasoning';
    const chev = document.createElement('span');
    chev.className = 'thinkchev';
    chev.innerHTML = ICONS.chevron;
    const words = document.createElement('span');
    words.className = 'thinkwords';
    words.textContent = 'reasoning — click to show';
    head.appendChild(chev);
    head.appendChild(words);
    const pre = document.createElement('pre');
    pre.className = 'reasoning';
    pre.textContent = reasoning.trim().slice(0, 6000);
    pre.hidden = true;
    head.addEventListener('click', () => {
      const open = pre.hidden;
      pre.hidden = !open;
      head.classList.toggle('open', open);
      head.setAttribute('aria-expanded', open ? 'true' : 'false');
      words.textContent = open ? 'reasoning — click to hide' : 'reasoning — click to show';
      head.title = open ? 'Hide the model reasoning' : 'Show the model reasoning';
    });
    wrap.appendChild(head);
    wrap.appendChild(pre);
    return wrap;
  };

  const fmtSize = (bytes: number): string => {
    const value = Math.max(0, Math.trunc(Number(bytes) || 0));
    if (value < 1024) return `${value} B`;
    if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
    return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  };

  /* delivered files: download chips for what the turn staged */
  const delfiles = (files: Array<{ name: string; size: number }>): HTMLElement => {
    const row = document.createElement('div');
    row.className = 'delfiles';
    const label = document.createElement('span');
    label.className = 'delfiles-label';
    label.textContent = 'Delivered files';
    row.appendChild(label);
    for (const file of files.slice(0, 20)) {
      const name = String(file.name || '').trim();
      if (!name) continue;
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'delfile';
      chip.textContent = `${name} · ${fmtSize(file.size)}`;
      chip.title = `Download ${name}`;
      chip.addEventListener('click', () => downloadDelivery(name));
      row.appendChild(chip);
    }
    /* one archive beats twenty clicks, and it is what the user wants after a
       build that produced a whole folder */
    if (files.length > 1) {
      const all = document.createElement('button');
      all.type = 'button';
      all.className = 'delfile delall';
      all.innerHTML = ICONS.archive + '<span>Download all as .zip</span>';
      all.title = 'Pack every delivered file into one .zip';
      all.addEventListener('click', () => downloadBundle());
      row.appendChild(all);
    }
    return row;
  };

  const save_blob = (blob: Blob, filename: string): void => {
    try {
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch {
      toast('download failed');
    }
  };

  const downloadDelivery = (name: string): void => {
    const api = bridge();
    if (!api) return;
    toast(`preparing ${name}`);
    api.read_delivery(name).then((result: any) => {
      if (!result || !result.ok) {
        toast(result && result.error ? String(result.error) : 'download failed');
        return;
      }
      try {
        const raw = String(result.base64 || '');
        const bytes = Uint8Array.from(atob(raw), (character) => character.charCodeAt(0));
        save_blob(new Blob([bytes], { type: 'application/octet-stream' }), String(result.name || name));
      } catch {
        toast('download failed');
      }
    }).catch(() => toast('download failed'));
  };

  const downloadBundle = (): void => {
    const api = bridge();
    if (!api) return;
    toast('packing the files');
    Promise.resolve(api.read_delivery_bundle()).then((result: any) => {
      if (!result || !result.ok) {
        toast(result && result.error ? String(result.error) : 'download failed');
        return;
      }
      try {
        const raw = String(result.base64 || '');
        const bytes = Uint8Array.from(atob(raw), (character) => character.charCodeAt(0));
        save_blob(new Blob([bytes], { type: 'application/zip' }), String(result.name || 'forge-files.zip'));
      } catch {
        toast('download failed');
      }
    }).catch(() => toast('download failed'));
  };

  const failPending = (message: string, detail?: { model?: string }) => {
    cancelPaint();
    if (!pending) {
      setAlert(message.slice(0, 40), true);
      return;
    }
    const trace = pending.wrap.querySelector(':scope > .bot > .body > .tracebox');
    if (trace) trace.classList.remove('open');
    pending.md.className = 'md failed';
    pending.md.innerHTML = '';
    const card = document.createElement('div');
    card.className = 'errcard';
    const icon = document.createElement('span');
    icon.className = 'errico';
    icon.setAttribute('aria-hidden', 'true');
    icon.innerHTML =
      '<svg width="15" height="15" viewBox="0 0 14 14" fill="none" stroke="currentColor" ' +
      'stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M7 1.8 12.8 12H1.2Z"></path><path d="M7 5.4v3M7 10.2v.1"></path></svg>';
    const body = document.createElement('div');
    body.className = 'errbody';
    const title = document.createElement('div');
    title.className = 'errtitle';
    title.textContent = detail && detail.model
      ? 'No answer from ' + String(detail.model).split('/').pop()
      : 'Request failed';
    const text = document.createElement('div');
    text.className = 'errmsg';
    text.textContent = message;
    const actions = document.createElement('div');
    actions.className = 'erractions';
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'errretry';
    retry.textContent = 'Try again';
    retry.addEventListener('click', () => {
      const box = $el('input') as HTMLInputElement;
      if (!box.value.trim() && lastUserText) box.value = lastUserText;
      box.focus();
      send();
    });
    actions.appendChild(retry);
    body.appendChild(title);
    body.appendChild(text);
    body.appendChild(actions);
    card.appendChild(icon);
    card.appendChild(body);
    pending.md.appendChild(card);
    pending = null;
    streamBuf = '';
    effortNote = '';
    segments = null;
    segments_text = '';
    segments_last_text = '';
    segments_reasoned = false;
    tool_count = 0;
    open_blocks.clear();
    startedAt = 0;
    setPhase('idle');
    setAlert(message.slice(0, 40), true);
  };

  const resetThread = (turns: Turn[]) => {
    cancelPaint();
    $el('turns').innerHTML = '';
    pending = null;
    streamBuf = '';
    effortNote = '';
    const rows = turns || [];
    showEmpty(rows.length === 0);
    rows.forEach((turn: Turn) => {
      if (turn.role === 'user') addUserTurn(turn.content || '');
      else addBotTurn(turn.content || '', false);
    });
    atBottom = true;
    toBottom(true);
  };

  /* ───────────────────────── sessions ───────────────────────── */

  const groupFor = (updatedAt?: number): string => {
    if (!updatedAt) return 'Earlier';
    const then = new Date(updatedAt * 1000);
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const stamp = then.getTime();
    if (stamp >= startOfToday) return 'Today';
    if (stamp >= startOfToday - 86400000) return 'Yesterday';
    if (stamp >= startOfToday - 7 * 86400000) return 'Previous 7 days';
    return 'Earlier';
  };

  let openMenu: HTMLElement | null = null;

  const closeMenu = () => {
    if (openMenu) {
      openMenu.remove();
      openMenu = null;
    }
    const rows = document.querySelectorAll('.chatrow.menuopen');
    for (let i = 0; i < rows.length; i++) rows[i].classList.remove('menuopen');
  };

  const sessionTurns = (payload: SessionPayload | undefined): Turn[] => {
    if (!payload) return [];
    if (payload.draft && payload.draft.length) return payload.draft;
    return payload.chat || [];
  };

  const folderIcon =
    '<svg width="12" height="12" aria-hidden="true"><use href="#icoFolder"></use></svg>';

  const sectionLabel = (text: string): HTMLElement => {
    const label = document.createElement('div');
    label.className = 'grouplabel';
    label.textContent = text;
    return label;
  };

  const chatInProject = (project_id: string) => {
    const api = bridge();
    if (!api) return;
    stopIfBusy();
    api.new_session({ project_id }).then((result: any) => {
      if (!result || !result.ok) {
        toast((result && result.error) || 'could not start a chat');
        return;
      }
      refreshSessions(result.id || undefined);
      ($el('input') as HTMLInputElement).focus();
    }, () => {
      toast('could not start a chat');
    });
  };

  const removeProject = (project_id: string) => {
    const api = bridge();
    if (!api) return;
    api.remove_project(project_id).then((result: any) => {
      if (!result || !result.ok) {
        toast((result && result.error) || 'could not remove the project');
        refreshSessions();
        return;
      }
      toast('project removed · its chats are kept');
      refreshSessions();
    }, () => {
      toast('could not remove the project');
    });
  };

  const menuOption = (label: string, className: string | null, handler: () => void): HTMLButtonElement => {
    const button = document.createElement('button');
    button.type = 'button';
    if (className) button.className = className;
    button.textContent = label;
    button.addEventListener('click', (event: Event) => {
      /* menus are rebuilt in place, so the document click listener must not
         treat the click as "outside the menu". */
      event.stopPropagation();
      handler();
    });
    return button;
  };

  const buildProjectMenu = (project: ProjectItem, row: HTMLElement): HTMLElement => {
    const menu = document.createElement('div');
    menu.className = 'rowmenu';
    menu.dataset.owner = project.id;

    menu.appendChild(menuOption('New chat here', '', () => {
      closeMenu();
      chatInProject(project.id);
    }));

    const separator = document.createElement('div');
    separator.className = 'sep';
    menu.appendChild(separator);

    menu.appendChild(menuOption('Remove project', 'danger', () => {
      menu.innerHTML = '';
      const note = document.createElement('div');
      note.className = 'confirm';
      note.textContent = 'chats are kept';
      menu.appendChild(note);
      menu.appendChild(menuOption('Remove it', 'danger', () => {
        closeMenu();
        removeProject(project.id);
      }));
      menu.appendChild(menuOption('Keep it', '', () => { closeMenu(); }));
    }));

    document.body.appendChild(menu);

    const rect = row.getBoundingClientRect();
    const width = menu.offsetWidth;
    const height = menu.offsetHeight;
    let left = Math.min(rect.left + 24, window.innerWidth - width - 10);
    let top = rect.bottom + 4;
    if (top + height > window.innerHeight - 10) {
      top = rect.top - height - 4;
      menu.style.transformOrigin = 'bottom right';
    }
    menu.style.left = Math.max(10, left) + 'px';
    menu.style.top = Math.max(10, top) + 'px';

    return menu;
  };

  const projectRow = (project: ProjectItem): HTMLElement => {
    const row = document.createElement('div');
    row.className = 'prow';
    row.title = 'New chat in ' + project.name;

    const icon = document.createElement('span');
    icon.className = 'pico';
    icon.innerHTML = folderIcon;

    const name = document.createElement('span');
    name.className = 't';
    name.textContent = project.name;
    name.title = project.folder;

    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'addchat';
    add.innerHTML = ICONS.plus;
    add.title = 'New chat in ' + project.name;
    add.setAttribute('aria-label', 'New chat in ' + project.name);
    add.addEventListener('click', (event: Event) => {
      event.stopPropagation();
      chatInProject(project.id);
    });

    const kebab = document.createElement('button');
    kebab.className = 'kebab';
    kebab.type = 'button';
    kebab.setAttribute('aria-label', 'Project options');
    kebab.innerHTML = ICONS.kebab;
    kebab.addEventListener('click', (event: Event) => {
      event.stopPropagation();
      const wasOpen = openMenu && openMenu.dataset.owner === project.id;
      closeMenu();
      if (wasOpen) return;
      row.classList.add('menuopen');
      openMenu = buildProjectMenu(project, row);
    });

    row.appendChild(icon);
    row.appendChild(name);
    row.appendChild(add);
    row.appendChild(kebab);
    row.addEventListener('click', () => { flashRow(row); chatInProject(project.id); });

    return row;
  };

  const paintSessions = () => {
    const host = $el('chats');
    const query = ($el('chatSearch') as HTMLInputElement).value.trim().toLowerCase();
    host.innerHTML = '';
    closeMenu();

    const projects: ProjectItem[] = (state && state.projects) || [];
    const live = (item: SessionItem): boolean => Boolean(item.message_count) || item.id === activeId;
    const matches = (item: SessionItem): boolean => {
      if (!query) return live(item);
      const hay = `${item.title || 'New chat'} ${item.preview || ''} ${item.workspace || ''}`.toLowerCase();
      return hay.indexOf(query) !== -1;
    };
    const inProject = (item: SessionItem, project: ProjectItem): boolean =>
      Boolean(item.project_id) && item.project_id === project.id;

    let shown = 0;

    if (projects.length) {
      host.appendChild(sectionLabel('Projects'));
      for (const project of projects) {
        const chats = sessions
          .filter((item: SessionItem) => inProject(item, project))
          .filter(matches)
          .sort((a: SessionItem, b: SessionItem) => Number(b.updated_at || 0) - Number(a.updated_at || 0));
        const nameHit =
          query && (project.name + ' ' + project.folder).toLowerCase().indexOf(query) !== -1;
        if (query && !chats.length && !nameHit) continue;
        host.appendChild(projectRow(project));
        chats.forEach((item: SessionItem) => { host.appendChild(sessionRow(item, true)); });
        shown += chats.length;
      }
      host.appendChild(sectionLabel('Chats'));
    }

    const order = ['Today', 'Yesterday', 'Previous 7 days', 'Earlier'];
    const buckets: { [key: string]: SessionItem[] } = {};
    sessions.forEach((item: SessionItem) => {
      if (item.project_id && projects.some((project: ProjectItem) => project.id === item.project_id)) return;
      if (!matches(item)) return;
      const key = groupFor(item.updated_at);
      (buckets[key] = buckets[key] || []).push(item);
      shown++;
    });

    order.forEach((key: string) => {
      const rows = buckets[key];
      if (!rows || !rows.length) return;
      const label = sectionLabel(key);
      if (projects.length) label.classList.add('sub');
      host.appendChild(label);
      rows.forEach((item: SessionItem) => {
        host.appendChild(sessionRow(item));
      });
    });

    if (!shown) {
      host.appendChild(sectionLabel(query ? 'nothing matches' : 'saved chats land here after you send'));
    }
  };

  const sessionRow = (item: SessionItem, nested = false): HTMLElement => {
    const row = document.createElement('div');
    row.className = 'chatrow' + (nested ? ' nested' : '') + (item.id === activeId ? ' on' : '');

    const meta = document.createElement('div');
    meta.className = 'meta';

    const title = document.createElement('span');
    title.className = 't';
    title.textContent = item.title || 'New chat';
    if (item.message_count) title.title = item.message_count + ' messages';
    meta.appendChild(title);

    if (item.preview && item.preview !== (item.title || '')) {
      const preview = document.createElement('span');
      preview.className = 'p';
      preview.textContent = item.preview;
      preview.title = item.preview;
      meta.appendChild(preview);
    }

    if (item.workspace) {
      const parts = String(item.workspace).split(/[\\/]/).filter(Boolean);
      const badge = document.createElement('span');
      badge.className = 'fbadge';
      badge.textContent = parts.length ? parts[parts.length - 1] : String(item.workspace);
      badge.title = String(item.workspace);
      badge.setAttribute('aria-label', 'workspace ' + item.workspace);
      meta.appendChild(badge);
    }

    const kebab = document.createElement('button');
    kebab.className = 'kebab';
    kebab.type = 'button';
    kebab.setAttribute('aria-label', 'Chat options');
    kebab.innerHTML = ICONS.kebab;
    kebab.addEventListener('click', (event: Event) => {
      event.stopPropagation();
      const wasOpen = openMenu && openMenu.dataset.owner === item.id;
      closeMenu();
      if (wasOpen) return;
      row.classList.add('menuopen');
      openMenu = buildRowMenu(item, row);
    });

    row.appendChild(meta);
    row.appendChild(kebab);
    row.addEventListener('click', () => { flashRow(row); loadSession(item.id); });
    row.addEventListener('dblclick', () => { startRename(item, row); });

    return row;
  };

  const buildRowMenu = (item: SessionItem, row: HTMLElement): HTMLElement => {
    const menu = document.createElement('div');
    menu.className = 'rowmenu';
    menu.dataset.owner = item.id;

    const option = (label: string, className: string | null, handler: () => void): HTMLButtonElement => {
      const button = document.createElement('button');
      button.type = 'button';
      if (className) button.className = className;
      button.textContent = label;
      button.addEventListener('click', (event: Event) => {
        /* the confirm step detaches this button, so the document click
           listener must not treat the click as "outside the menu". */
        event.stopPropagation();
        handler();
      });
      return button;
    };

    menu.appendChild(option('Rename', '', () => {
      closeMenu();
      startRename(item, row);
    }));

    const separator = document.createElement('div');
    separator.className = 'sep';
    menu.appendChild(separator);

    menu.appendChild(option('Delete chat', 'danger', () => {
      menu.innerHTML = '';
      const note = document.createElement('div');
      note.className = 'confirm';
      note.textContent = 'encrypted history · no undo';
      menu.appendChild(note);
      menu.appendChild(option('Yes, delete it', 'danger', () => {
        closeMenu();
        removeSession(item.id);
      }));
      menu.appendChild(option('Keep it', '', () => { closeMenu(); }));
    }));

    document.body.appendChild(menu);

    const rect = row.getBoundingClientRect();
    const width = menu.offsetWidth;
    const height = menu.offsetHeight;
    let left = Math.min(rect.left + 24, window.innerWidth - width - 10);
    let top = rect.bottom + 4;
    if (top + height > window.innerHeight - 10) {
      top = rect.top - height - 4;
      menu.style.transformOrigin = 'bottom right';
    }
    menu.style.left = Math.max(10, left) + 'px';
    menu.style.top = Math.max(10, top) + 'px';

    return menu;
  };

  const startRename = (item: SessionItem, row: HTMLElement) => {
    const title = row.querySelector('.t') as HTMLElement;
    if (!title) return;
    const parent = title.parentNode as HTMLElement;

    const input = document.createElement('input');
    input.className = 'rename';
    input.value = item.title || '';
    parent.replaceChild(input, title);
    input.focus();
    input.select();

    let settled = false;

    const commit = () => {
      if (settled) return;
      settled = true;
      const next = input.value.trim();
      if (!next || next === item.title) {
        paintSessions();
        return;
      }
      const api = bridge();
      if (!api) {
        paintSessions();
        return;
      }
      api.rename_session(item.id, next).then((result: any) => {
        if (!result || !result.ok) toast((result && result.error) || 'could not rename');
        refreshSessions();
      }, () => {
        toast('could not reach the engine');
        refreshSessions();
      });
    };

    input.addEventListener('click', (event: Event) => { event.stopPropagation(); });
    input.addEventListener('dblclick', (event: Event) => { event.stopPropagation(); });
    input.addEventListener('keydown', (event: KeyboardEvent) => {
      if (event.key === 'Enter') { event.preventDefault(); commit(); }
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        settled = true;
        paintSessions();
      }
    });
    input.addEventListener('blur', commit);
  };

  const removeSession = (id: string) => {
    const api = bridge();
    if (!api) return;
    api.delete_session(id).then((result: any) => {
      if (!result || !result.ok) {
        toast((result && result.error) || 'could not delete');
        refreshSessions();
        return;
      }
      toast('chat deleted');
      refreshSessions(result.id || undefined);
    }, () => {
      toast('could not delete');
      refreshSessions();
    });
  };

  const loadSession = (id: string) => {
    if (id === activeId) return;
    const api = bridge();
    if (!api) return;
    stopIfBusy();
    api.load_session(id).then((result: any) => {
      if (!result || !result.ok) {
        toast((result && result.error) || 'could not load');
        return;
      }
      activeId = result.id;
      resetThread(sessionTurns(result.payload));
      paintSessions();
      paintTitle();
    }).catch((error: any) => {
      toast('could not load that chat');
      if (window.console) console.error(error);
    });
  };

  const refreshSessions = (preferId?: string): Promise<void> => {
    const api = bridge();
    if (!api) return Promise.resolve();
    return api.list_sessions().then((rows: SessionItem[]) => {
      sessions = rows || [];
      return api.get_state();
    }).then((next: StateData) => {
      applyState(next);
      if (preferId) activeId = preferId;
      paintSessions();
      paintTitle();
    }).catch((error: any) => {
      toast('could not refresh chats');
      if (window.console) console.error(error);
    });
  };

  const paintTitle = () => {
    let current: SessionItem | null = null;
    for (let i = 0; i < sessions.length; i++) {
      if (sessions[i].id === activeId) { current = sessions[i]; break; }
    }
    $el('titleBar').textContent = current ? (current.title || 'New chat') : '';
  };

  const paintDrawer = (path: string | null) => {
    if (!path) return;
    $el('drawerPath').textContent = path;
    ($el('drawerPath') as HTMLElement).title = path;
    $el('setDrawer').textContent = path;
    ($el('setDrawer') as HTMLElement).title = path;
  };

  /* ───────────────────────── state ───────────────────────── */

  const paintWorkspaceChip = () => {
    const chip = $el('wsChip') as HTMLElement;
    const folder = String((state && state.workspace) || '');
    chip.hidden = !folder;
    if (!folder) return;
    const parts = folder.split(/[\\/]/).filter(Boolean);
    const name = parts.length ? parts[parts.length - 1] : folder;
    const tools: string[] = [];
    if (state && state.agent_shell) tools.push('shell');
    if (state && state.agent_web) tools.push('web');
    ($el('wsChipText') as HTMLElement).textContent = name;
    chip.title = folder + (tools.length ? '\n' + tools.join(' + ') : '');
    chip.classList.toggle('shell', Boolean(state && state.agent_shell));
    chip.classList.toggle('web', Boolean(state && state.agent_web));
    ($el('wsTools') as HTMLElement).innerHTML =
      (state && state.agent_shell ? ICONS.code : '') +
      (state && state.agent_web ? ICONS.globe : '');
  };

  const applyState = (next: StateData | null) => {
    if (!next) return;
    state = ((next as any).state || next) as StateData;
    activeId = state.session_id || activeId;

    const model = state.draft_model || 'no model';
    $el('modelName').textContent = model;
    $el('modelProvider').textContent = state.draft_backend || 'backend';
    ($el('modelChip') as HTMLElement).title = (state.draft_backend || '') + ' · ' + model;

    const locked = Boolean(state.locked);
    $el('lockText').textContent = locked ? 'locked' : (state.vault || 'open');
    $el('lockChip').classList.toggle('locked', locked);
    $el('unlock').hidden = !locked;
    if (locked) setTimeout(() => { ($el('pass') as HTMLInputElement).focus(); }, 30);

    paintThinkButton();

    $el('vaultSealGroup').hidden = Boolean(state.vault_available);

    applyTheme(state.theme || DEFAULT_THEME);
    paintThemeGrid();
    if (typeof state.custom_prompt === 'string' || typeof state.custom_prompt_on === 'boolean') {
      loadPrompt();
    }

    const room = state.rooms && state.rooms.forge;
    if (room && room.phase) setPhase(room.phase);

    paintSettings();
    paintWorkspaceChip();
    paintSessions();
  };

  /* Ask OpenCode which of its free models this account may really use. Runs
     once, after the window is up, because it is the provider's server that
     decides — not Forge — and only usable models are shown. */
  let probedZen = false;
  const probeZen = (): void => {
    if (probedZen) return;
    const api = bridge();
    if (!api || typeof (api as any).probe_opencode !== 'function') return;
    probedZen = true;
    void (api as any).probe_opencode().then((result: any) => {
      if (!result || !result.ok || !Array.isArray(result.models)) return;
      if (result.state) applyState(result.state);
      /* repaint from the usable list, so refused models disappear instead of
         waiting to be found out at request time */
      models = result.models as ModelItem[];
      const settingsList = $el('setModelList');
      if (settingsList) {
        paintModelList(
          settingsList,
          ($el('setModelSearch') as HTMLInputElement).value.trim().toLowerCase(),
          ($el('setOnlyKeyed') as HTMLInputElement).checked,
          200,
          undefined
        );
      }
      const usable = Array.isArray(result.usable) ? result.usable.length : 0;
      const probed = Number(result.probed) || 0;
      if (result.repinned && result.to && typeof result.to.model === 'string') {
        toast(`OpenCode: moved the pinned model to ${result.to.model} — ${usable} of ${probed} usable`);
      } else if (usable > 0) {
        toast(`OpenCode: ${usable} of ${probed} free models usable`);
      } else if (probed > 0) {
        toast('OpenCode: no usable free model right now');
      }
    }, () => { /* offline, or OpenCode unreachable: the picker keeps its
                  unprobed list rather than hiding models that were never checked */ });
  };

  /* ───────────────────────── model picker ───────────────────────── */

  let pop: HTMLElement | null = null;

  const pinModel = (item: ModelItem, after?: () => void) => {
    if (!bridge()) return;
    if (!item.keyed) {
      /* a gateway has no key to paste: asking for one there sends the reader
         looking for a file that does not exist. It needs connecting, not a
         credential. */
      toast(item.gateway
        ? `${item.backend} is not connected — connect it in Settings → Gateways`
        : `no key for ${item.backend} — add one in Settings`);
      return;
    }
    const api = bridge();
    if (!api) return;
    api.pin_model(item.backend, item.model).then((result: any) => {
      if (!result || !result.ok) {
        toast((result && result.error) || 'could not pin');
        return;
      }
      applyState(result.state);
      if (after) after();
      toast('pinned · forge-3 overlay only');
    }, () => {
      toast('could not reach the engine');
    });
  };

  const modelRow = (item: ModelItem, after?: () => void): HTMLElement => {
    const row = document.createElement('div');
    const current = state && state.draft_backend === item.backend && state.draft_model === item.model;
    row.className = 'mrow' + (current ? ' on' : '');

    const name = document.createElement('span');
    name.className = 'mid';
    name.textContent = item.model;
    name.title = `${item.backend} · ${item.model}`;
    row.appendChild(name);

    (item.traits || []).forEach((trait: string) => {
      const tag = document.createElement('span');
      tag.className = 'tag';
      tag.textContent = trait;
      row.appendChild(tag);
    });

    if (!item.keyed) {
      const nokey = document.createElement('span');
      nokey.className = 'tag nokey';
      nokey.textContent = 'no key';
      row.appendChild(nokey);
    }

    if (current) {
      const tick = document.createElement('span');
      tick.className = 'tick';
      tick.innerHTML = ICONS.check;
      row.appendChild(tick);
    }

    row.addEventListener('click', () => { flashRow(row); pinModel(item, after); });
    return row;
  };

  const paintModelList = (list: HTMLElement, query: string, onlyKeyed: boolean, limit: number, after?: () => void) => {
    const byBackend: { [key: string]: ModelItem[] } = {};
    const order: string[] = [];
    models.forEach((item: ModelItem) => {
      if (onlyKeyed && !item.keyed) return;
      const hay = item.search || ((item.backend + ' ' + item.model).toLowerCase());
      if (query && hay.indexOf(query) === -1) return;
      if (!byBackend[item.backend]) { byBackend[item.backend] = []; order.push(item.backend); }
      byBackend[item.backend].push(item);
    });

    list.innerHTML = '';

    if (!order.length) {
      const none = document.createElement('div');
      none.className = 'mgroup';
      none.textContent = onlyKeyed && !query ? 'no provider has a key yet' : 'nothing matches';
      list.appendChild(none);
      return;
    }

    order.forEach((backend: string) => {
      const rows = byBackend[backend];
      if (!rows || !rows.length) return;

      const label = document.createElement('div');
      label.className = 'mgroup';
      label.textContent = backend;
      list.appendChild(label);
      rows.slice(0, limit).forEach((item: ModelItem) => {
        list.appendChild(modelRow(item, after));
      });
    });
  };

  const closePop = () => {
    if (pop) { pop.remove(); pop = null; }
    $el('modelChip').setAttribute('aria-expanded', 'false');
  };

  const openPop = () => {
    const chip = $el('modelChip');

    pop = document.createElement('div');
    pop.className = 'pop';

    const search = document.createElement('input');
    search.type = 'search';
    search.placeholder = 'Search cheap models';
    search.setAttribute('aria-label', 'Search models');

    const list = document.createElement('div');
    list.className = 'modellist';

    const paint = () => {
      paintModelList(list, (search as HTMLInputElement).value.trim().toLowerCase(), false, 60, closePop);
    };

    const foot = document.createElement('div');
    foot.className = 'popfoot';
    const footNote = document.createElement('span');
    footNote.textContent = 'writes the forge-3 overlay';
    const footLink = document.createElement('button');
    footLink.type = 'button';
    footLink.className = 'poplink';
    footLink.textContent = 'all models & keys';
    footLink.addEventListener('click', (event: Event) => {
      event.stopPropagation();
      closePop();
      openSettings();
    });
    foot.appendChild(footNote);
    foot.appendChild(footLink);

    search.addEventListener('input', paint);
    pop.appendChild(search);
    pop.appendChild(list);
    pop.appendChild(foot);
    document.body.appendChild(pop);

    const rect = chip.getBoundingClientRect();
    const width = pop.offsetWidth;
    pop.style.left = Math.max(10, Math.min(rect.left, window.innerWidth - width - 10)) + 'px';
    pop.style.top = (rect.bottom + 7) + 'px';

    paint();
    bindScroller(list);
    search.focus();
    chip.setAttribute('aria-expanded', 'true');
  };

  /* ───────────────────────── settings ───────────────────────── */

  let settingsOpen: boolean = false;
  let keyEditorFor: string = '';

  const KEY_SOURCE: { [key: string]: [string, string] } = {
    stored: ['set', 'stored by FORGE 3.2'],
    external: ['external', 'supplied outside FORGE 3.2'],
    env: ['env', 'supplied by an environment variable'],
    missing: ['missing', 'no key yet']
  };

  const refreshProviders = (): Promise<void> => {
    const api = bridge();
    if (!api) return Promise.resolve();
    return Promise.all([api.model_choices(), api.backend_catalog()]).then(
      (results: any[]) => {
        if (results[0]) models = results[0];
        if (results[1]) backends = results[1];
      },
      () => {}
    );
  };

  const showPane = (id: string) => {
    /* every pane comes from the markup: a hardcoded list silently hides a tab
       that was added later */
    Array.prototype.forEach.call(document.querySelectorAll('.pane'), (pane: HTMLElement) => {
      pane.hidden = pane.id !== id;
    });
    Array.prototype.forEach.call(document.querySelectorAll('.tab'), (tab: HTMLElement) => {
      const on = tab.getAttribute('data-pane') === id;
      tab.classList.toggle('on', on);
      tab.setAttribute('aria-selected', on ? 'true' : 'false');
    });
  };

  /* ─────────── gateways: subscriptions, not keys ─────────── */

  interface GatewayItem {
    id: string;
    label: string;
    connected: boolean;
    plan: string | null;
    mode: string | null;
    renews: string | null;
    offered: string[];
    selected: string[];
    blurb: string;
    blocked: string;
  }

  const gatewayList = (): GatewayItem[] => {
    const list = (state && (state as any).gateways) || [];
    return Array.isArray(list) ? (list as GatewayItem[]) : [];
  };

  const saveGatewayModels = (next: Record<string, string[]>, label: string) => {
    const api = bridge();
    if (!api) return;
    api.update_config({ gateway_models: next }).then((result: any) => {
      if (result && result.ok === false) {
        toast(String(result.error || 'the gateway models were not saved'));
        return;
      }
      applyState((result && result.state) ?? null);
      toast(label);
    }).catch(() => toast('the gateway models were not saved'));
  };

  const paintGateways = () => {
    const host = $el('setGatewayList');
    const wrap = $el('setGateways');
    const list = gatewayList();
    wrap.hidden = !list.length;
    if (!list.length) return;
    host.innerHTML = '';

    for (const item of list) {
      const card = document.createElement('div');
      card.className = 'gatewaycard' + (item.connected ? '' : ' off');

      const top = document.createElement('div');
      top.className = 'gcardtop';
      const name = document.createElement('span');
      name.className = 'gname';
      name.textContent = item.label;
      top.appendChild(name);
      const live = document.createElement('span');
      live.className = 'gstate ' + (item.connected ? 'on' : 'off');
      live.textContent = item.connected ? 'connected' : 'not connected';
      top.appendChild(live);
      card.appendChild(top);

      const plan = document.createElement('div');
      plan.className = 'gplan';
      if (item.plan) {
        plan.textContent = 'plan: ' + item.plan + (item.renews ? ' · renews ' + item.renews.slice(0, 10) : '');
      } else if (item.connected) {
        plan.textContent = 'connected, but the plan could not be read from the login';
      } else {
        plan.textContent = 'no login found';
      }
      card.appendChild(plan);

      const note = document.createElement('div');
      note.className = 'gnote-line';
      note.textContent = item.blocked || item.blurb;
      card.appendChild(note);

      const picker = document.createElement('div');
      picker.className = 'gmodels';
      for (const model of item.offered) {
        const on = item.selected.includes(model);
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'gchip' + (on ? ' on' : '');
        chip.textContent = model;
        chip.title = on ? 'Switched on' : 'Switched off';
        chip.addEventListener('click', () => {
          const kept = on
            ? item.selected.filter((m) => m !== model)
            : [...item.selected, model];
          const next: Record<string, string[]> = {};
          gatewayList().forEach((g) => {
            next[g.id] = g.id === item.id ? kept : g.selected;
          });
          saveGatewayModels(next, kept.length ? 'Gateway models updated' : 'Every gateway model is off');
        });
        picker.appendChild(chip);
      }
      card.appendChild(picker);

      /* a gateway with no local login is not stuck: the credential can be
         pasted, which is the only way in on a machine that has never run
         `codex login` */
      const acts = document.createElement('div');
      acts.className = 'gacts';
      const link = document.createElement('button');
      link.type = 'button';
      link.className = 'pbtn';
      link.textContent = item.connected ? 'Replace credential' : 'Connect manually';
      link.addEventListener('click', () => openGatewayForm(item.id));
      acts.appendChild(link);
      if (item.connected) {
        const drop = document.createElement('button');
        drop.type = 'button';
        drop.className = 'pbtn ghost';
        drop.textContent = 'Disconnect';
        drop.addEventListener('click', () => {
          const api = bridge();
          if (!api) return;
          api.disconnect_gateway(item.id).then((result: any) => {
            if (result && result.ok === false) {
              toast(String(result.error || 'the gateway stayed connected'));
              return;
            }
            applyState((result && result.state) ?? null);
            toast(`${item.label} disconnected`);
          }).catch(() => toast('the gateway stayed connected'));
        });
        acts.appendChild(drop);
      }
      card.appendChild(acts);
      host.appendChild(card);
    }
  };

  let gatewayTarget = '';

  /* one place that answers, so a refused attempt always replaces the previous
     reason instead of sitting under it */
  const gatewayAnswer = (message: string): void => {
    ($el('gatewayErr') as HTMLElement).textContent = message;
  };

  const gatewayHelp = (id: string): string => (id === 'opencode'
    ? 'Paste the Zen key from the OpenCode app, or its whole auth.json. Checked ' +
      'before anything is written, kept owner-only in the keys folder, and never in ' +
      'the config. The app already installed here is preferred. Only the free tier is ' +
      'listed — Zen names those with a -free suffix, read live so nothing goes stale.'
    : 'Paste the auth.json that `codex login` wrote on the machine that has the ' +
      'subscription. It is checked before anything is written, kept owner-only in the ' +
      'keys folder, and never in the config. On this machine the existing login is ' +
      'still preferred.');

  const openGatewayForm = (id: string) => {
    gatewayTarget = id;
    gatewayAnswer('');
    ($el('gatewayHelp') as HTMLElement).textContent = gatewayHelp(id);
    ($el('gatewaySecret') as HTMLTextAreaElement).placeholder = id === 'opencode'
      ? 'paste the Zen key here'
      : 'paste the auth.json here';
    ($el('gatewaySecret') as HTMLTextAreaElement).value = '';
    $el('setGatewayForm').hidden = false;
    ($el('gatewaySecret') as HTMLTextAreaElement).focus();
  };

  $el('gatewayCancel').addEventListener('click', () => {
    $el('setGatewayForm').hidden = true;
  });

  $el('setGatewayForm').addEventListener('submit', (event: Event) => {
    event.preventDefault();
    const api = bridge();
    if (!api) return gatewayAnswer('the engine is not reachable');
    const credential = ($el('gatewaySecret') as HTMLTextAreaElement).value.trim();
    if (!credential) return gatewayAnswer('paste the credential first');
    const save = $el('gatewaySave') as HTMLButtonElement;
    save.disabled = true;
    save.textContent = 'Connecting…';
    const done = (): void => {
      save.disabled = false;
      save.textContent = 'Connect';
    };
    api.connect_gateway(gatewayTarget, credential)
      .then((result: any) => {
        done();
        if (result && result.ok === false) {
          gatewayAnswer(String(result.error || 'that credential was not accepted'));
          return;
        }
        applyState((result && result.state) ?? null);
        $el('setGatewayForm').hidden = true;
        toast('Gateway connected');
      })
      .catch((error: any) => {
        done();
        gatewayAnswer(String((error && error.message) || 'that credential was not accepted'));
      });
  });

  const paintSettingsModels = () => {
    const label = state
      ? (state.draft_backend || '?') + ' · ' + (state.draft_model || 'no model')
      : '—';
    $el('setPinned').textContent = label;
    ($el('setPinned') as HTMLElement).title = label;

    paintGateways();
    paintModelList(
      $el('setModelList'),
      ($el('setModelSearch') as HTMLInputElement).value.trim().toLowerCase(),
      ($el('setOnlyKeyed') as HTMLInputElement).checked,
      200,
      undefined
    );
  };

  const keyCard = (item: BackendItem): HTMLElement => {
    const card = document.createElement('div');
    card.className = 'keycard' + (keyEditorFor === item.backend ? ' open' : '');

    const top = document.createElement('div');
    top.className = 'keytop';

    const name = document.createElement('span');
    name.className = 'keyname';
    name.textContent = item.backend;
    top.appendChild(name);

    const meta = KEY_SOURCE[item.source] || KEY_SOURCE.missing;
    const badge = document.createElement('span');
    badge.className = 'keystate ' + (item.source === 'stored' ? 'set' : item.source);
    badge.textContent = meta[0];
    badge.title = meta[1];
    top.appendChild(badge);

    const tag = document.createElement('span');
    tag.className = 'keystate';
    tag.textContent = item.tag;
    top.appendChild(tag);

    const actions = document.createElement('div');
    actions.className = 'keyact';

    const edit = document.createElement('button');
    edit.type = 'button';
    edit.textContent = item.source === 'missing' ? 'Add key' : 'Replace';
    edit.addEventListener('click', () => {
      keyEditorFor = keyEditorFor === item.backend ? '' : item.backend;
      paintSettingsKeys();
    });
    actions.appendChild(edit);

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'danger';
    remove.textContent = 'Remove';
    remove.disabled = !item.removable;
    if (!item.removable) {
      remove.title = item.source === 'env'
        ? 'set by ' + (item.detail || 'an environment variable') + ' — clear it there'
        : item.source === 'external'
          ? 'stored outside the FORGE 3.2 keys folder — remove that file by hand'
          : 'nothing stored to remove';
    }
    remove.addEventListener('click', () => {
      if (remove.disabled) return;
      if (!window.confirm(
        'Remove the stored ' + item.backend + ' key?\n\n' +
        'This removes it from FORGE 3.2.'
      )) return;
      const api = bridge();
      if (!api) return;
      api.delete_key(item.backend).then((result: any) => {
        if (!result || !result.ok) {
          toast((result && result.error) || 'could not remove the key');
          return;
        }
        keyEditorFor = '';
        applyState(result.state);
        refreshProviders().then(() => {
          paintSettings();
          toast(item.backend + ' key removed');
        });
      }, () => {
        toast('could not reach the engine');
      });
    });
    actions.appendChild(remove);

    top.appendChild(actions);
    card.appendChild(top);

    if (item.blurb) {
      const blurb = document.createElement('p');
      blurb.className = 'keyblurb';
      blurb.textContent = item.blurb;
      card.appendChild(blurb);
    }

    if (item.detail) {
      const where = document.createElement('p');
      where.className = 'keywhere';
      where.textContent = item.source === 'env' ? 'env · ' + item.detail : item.detail;
      card.appendChild(where);
    }

    if (keyEditorFor === item.backend) {
      const editor = document.createElement('div');
      editor.className = 'keyedit';

      const input = document.createElement('input');
      input.type = 'password';
      input.placeholder = 'Paste the ' + item.backend + ' key';
      input.autocomplete = 'off';
      input.spellcheck = false;

      const save = document.createElement('button');
      save.type = 'button';
      save.textContent = 'Save';

      const commit = () => {
        const value = input.value.trim();
        if (!value) { toast('key is empty'); return; }
        const api = bridge();
        if (!api) return;
        api.save_key(item.backend, value).then((result: any) => {
          input.value = '';
          if (!result || !result.ok) {
            toast((result && result.error) || 'could not save the key');
            return;
          }
          keyEditorFor = '';
          applyState(result.state);
          refreshProviders().then(() => {
            paintSettings();
            toast(item.backend + ' key saved');
          });
        }, () => {
          toast('could not reach the engine');
        });
      };

      save.addEventListener('click', commit);
      input.addEventListener('keydown', (event: KeyboardEvent) => {
        if (event.key === 'Enter') { event.preventDefault(); commit(); }
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          keyEditorFor = '';
          paintSettingsKeys();
        }
      });

      editor.appendChild(input);
      editor.appendChild(save);
      card.appendChild(editor);
      setTimeout(() => { input.focus(); }, 0);
    }

    return card;
  };

  const paintSettingsKeys = () => {
    const list = $el('setKeyList');
    list.innerHTML = '';

    if (!backends.length) {
      const none = document.createElement('p');
      none.className = 'note';
      none.textContent = 'no providers reported';
      list.appendChild(none);
      return;
    }

    backends.forEach((item: BackendItem) => { list.appendChild(keyCard(item)); });

    const folder = backends[0] && backends[0].keys_dir;
    $el('keysNote').textContent = folder
      ? 'Stored only for FORGE 3.2 in ' + folder
      : 'Stored only for FORGE 3.2.';
  };

  /* ─────────── custom providers: the reader's own endpoints ─────────── */

  interface CustomProvider {
    id: string;
    label: string;
    base_url: string;
    models: string[];
    dialect: string;
    free: boolean;
  }

  let customEditing = '';

  const slugify = (value: string): string =>
    String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, '-')
      .replace(/^[-.]+|[-.]+$/g, '')
      .slice(0, 40);

  const customProviders = (): CustomProvider[] => {
    const list = (state && (state as any).custom_providers) || [];
    return Array.isArray(list) ? (list as CustomProvider[]) : [];
  };

  const openCustomForm = (id?: string): void => {
    customEditing = String(id || '');
    const form = $el('setCustomForm');
    const entry = customEditing ? customProviders().find((item) => item.id === customEditing) : null;
    ($el('customLabel') as HTMLInputElement).value = entry ? entry.label : '';
    ($el('customId') as HTMLInputElement).value = entry ? entry.id : '';
    ($el('customUrl') as HTMLInputElement).value = entry ? entry.base_url : '';
    ($el('customModels') as HTMLInputElement).value = entry ? entry.models.join(', ') : '';
    ($el('customDialect') as HTMLSelectElement).value = entry ? entry.dialect : 'openai';
    ($el('customFree') as HTMLInputElement).checked = entry ? Boolean(entry.free) : false;
    ($el('customKey') as HTMLInputElement).value = '';
    ($el('customKey') as HTMLInputElement).placeholder = entry ? 'unchanged unless you type one' : 'optional if the server needs none';
    ($el('customErr') as HTMLElement).textContent = '';
    ($el('setCustomAdd') as HTMLButtonElement).hidden = true;
    form.hidden = false;
    ($el('customLabel') as HTMLInputElement).focus();
  };

  const closeCustomForm = (): void => {
    $el('setCustomForm').hidden = true;
    $el('setCustomAdd').hidden = false;
    customEditing = '';
  };

  const paintCustomProviders = (): void => {
    const box = $el('setCustomList');
    box.innerHTML = '';
    const list = customProviders();
    if (!list.length) {
      const empty = document.createElement('p');
      empty.className = 'note';
      empty.textContent =
        'None yet. Add a gateway, a local server, or anything else that answers the chat API.';
      box.appendChild(empty);
      return;
    }
    for (const entry of list) {
      const card = document.createElement('div');
      card.className = 'customcard';

      const top = document.createElement('div');
      top.className = 'customtop';
      const name = document.createElement('span');
      name.className = 'customname';
      name.textContent = entry.label;
      top.appendChild(name);
      const tag = document.createElement('span');
      tag.className = 'keystate';
      tag.textContent = entry.dialect === 'anthropic' ? 'ANTHROPIC' : 'OPENAI';
      top.appendChild(tag);
      const free = document.createElement('span');
      free.className = 'keystate';
      free.textContent = entry.free ? 'FREE' : 'PAID';
      top.appendChild(free);
      card.appendChild(top);

      const url = document.createElement('div');
      url.className = 'customurl';
      url.textContent = entry.base_url;
      card.appendChild(url);

      const models = document.createElement('div');
      models.className = 'custommodels';
      models.textContent = entry.models.join(' · ');
      card.appendChild(models);

      const acts = document.createElement('div');
      acts.className = 'customacts';
      const edit = document.createElement('button');
      edit.type = 'button';
      edit.textContent = 'Edit';
      edit.addEventListener('click', () => openCustomForm(entry.id));
      acts.appendChild(edit);
      const drop = document.createElement('button');
      drop.type = 'button';
      drop.className = 'danger';
      drop.textContent = 'Remove';
      drop.addEventListener('click', () => {
        const kept = customProviders().filter((item) => item.id !== entry.id);
        const api = bridge();
        if (!api) return;
        api.update_config({ custom_providers: kept }).then((result: any) => {
          if (result && result.ok === false) {
            toast(String(result.error || 'the provider was not removed'));
            return;
          }
          if (entry.id === customEditing) closeCustomForm();
          applyState((result && result.state) ?? null);
          toast(`${entry.label} removed`);
        }).catch(() => toast('the provider was not removed'));
      });
      acts.appendChild(drop);
      card.appendChild(acts);
      box.appendChild(card);
    }
  };

  $el('setCustomAdd').addEventListener('click', () => openCustomForm());
  $el('customCancel').addEventListener('click', closeCustomForm);

  /* the id has to be a file name in the keys folder, so it is shown as soon as
     it is typed rather than only after the save is refused */
  $el('customLabel').addEventListener('input', () => {
    if (customEditing) return;
    const id = $el('customId') as HTMLInputElement;
    if (!id.getAttribute('data-touched')) id.value = slugify(($el('customLabel') as HTMLInputElement).value);
  });
  $el('customId').addEventListener('input', () => {
    $el('customId').setAttribute('data-touched', '1');
  });

  $el('setCustomForm').addEventListener('submit', (event: Event) => {
    event.preventDefault();
    const api = bridge();
    const fail = (message: string) => {
      ($el('customErr') as HTMLElement).textContent = message;
    };
    if (!api) return fail('the engine is not reachable');

    const label = ($el('customLabel') as HTMLInputElement).value.trim();
    const id = slugify(($el('customId') as HTMLInputElement).value.trim() || label);
    const base_url = ($el('customUrl') as HTMLInputElement).value.trim();
    const models = ($el('customModels') as HTMLInputElement).value
      .split(',')
      .map((piece) => piece.trim())
      .filter(Boolean);
    const dialect = ($el('customDialect') as HTMLSelectElement).value;
    const free = ($el('customFree') as HTMLInputElement).checked;
    const key = ($el('customKey') as HTMLInputElement).value.trim();

    if (!id) return fail('give it a short id, made of letters, digits, dot, dash or underscore');
    if (!/^https?:\/\//i.test(base_url)) return fail('the base URL has to start with http:// or https://');
    if (!models.length) return fail('list at least one model, separated by commas');

    const others = customProviders().filter((item) => item.id !== customEditing);
    if (others.some((item) => item.id === id)) return fail(`"${id}" is already in the list`);

    const next = [...others, { id, label: label || id, base_url, models, dialect, free }];
    const saved = ($el('customSave') as HTMLButtonElement);
    saved.disabled = true;
    saved.textContent = 'Saving…';
    api.update_config({ custom_providers: next }).then((result: any) => {
      if (result && result.ok === false) {
        saved.disabled = false;
        saved.textContent = 'Save provider';
        fail(String(result.error || 'the provider was not saved'));
        return;
      }
      applyState((result && result.state) ?? null);
      if (key) {
        return api.save_key(id, key).then((savedKey: any) => {
          if (savedKey && savedKey.ok === false) {
            toast(String(savedKey.error || 'the key was not stored'));
            return;
          }
          applyState((savedKey && savedKey.state) ?? null);
        }).catch(() => toast('the provider was saved, the key was not'));
      }
      return undefined;
    }).catch(() => {
      saved.disabled = false;
      saved.textContent = 'Save provider';
      fail('the provider was not saved');
    }).then(() => {
      saved.disabled = false;
      saved.textContent = 'Save provider';
      closeCustomForm();
      paintCustomProviders();
      toast(`${label || id} added`);
    });
  });

  const fillSelect = (id: string, values: string[], current: string) => {
    const el = $el(id) as HTMLSelectElement;
    const list = values.length ? values : [current || 'auto'];
    const signature = list.join('|') + '|' + current;
    if (el.getAttribute('data-sig') === signature) return;
    el.innerHTML = '';
    list.forEach((value: string) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = value;
      el.appendChild(option);
    });
    el.value = list.includes(current) ? current : list[0];
    el.setAttribute('data-sig', signature);
  };

  const paintParams = () => {
    if (!state) return;
    const num = (id: string, value: any, fallback: any) => {
      const el = $el(id) as HTMLInputElement;
      if (document.activeElement === el) return;
      el.value = String(value ?? fallback);
    };
    const bool = (id: string, value: any, fallback: boolean) => {
      ($el(id) as HTMLInputElement).checked = Boolean(value ?? fallback);
    };
    const text = (id: string, value: any) => {
      const el = $el(id) as HTMLInputElement;
      if (document.activeElement === el) return;
      el.value = String(value ?? '');
    };

    num('setTemp', state.temp, 0.9);
    ($el('setTempVal') as HTMLOutputElement).textContent = Number(state.temp ?? 0.9).toFixed(2);
    num('setTopP', state.top_p, 1);
    ($el('setTopPVal') as HTMLOutputElement).textContent = Number(state.top_p ?? 1).toFixed(2);
    num('setHoldMax', state.hold_max, 4);
    num('setReqTimeout', state.request_timeout, 180);
    num('setRetries', state.connect_retries, 4);
    num('setProbes', state.anvil_probe_count, 4);
    num('setVersions', state.anvil_max_versions, 3);
    num('setThreshold', state.anvil_threshold, 6);
    bool('setHold', state.hold, true);
    bool('setHoldPrefill', state.hold_prefill, true);
    bool('setInsecure', state.insecure, false);
    bool('setTlsStrict', state.tls_strict, false);
    const strict = Boolean(state.tls_strict);
    const insecure = $el('setInsecure') as HTMLInputElement;
    insecure.disabled = strict;
    if (insecure.parentElement) insecure.parentElement.classList.toggle('muted', strict);
    bool('setRecordTests', state.record_tests, false);
    bool('setAnvilAuto', state.anvil_auto_improve, true);
    text('setFallback', state.chat_fallback);
    text('setTarget', state.target);
    text('setJudgeModel', state.judge_model);

    const style_names = state.style_names && state.style_names.length
      ? state.style_names
      : ['auto', 'interface', 'roleplay', 'persona', 'operator', 'relational', 'minimal'];
    fillSelect('setStyle', style_names, state.style || 'auto');
    const judge_backends = state.keys && Object.keys(state.keys).length
      ? Object.keys(state.keys)
      : backends.map((item: BackendItem) => item.backend);
    fillSelect('setJudgeBackend', judge_backends, state.judge_backend || 'gemini');
  };

  let themeSwap = 0;
  const applyTheme = (id: string) => {
    const root = document.documentElement;
    /* a theme change is the one edit that repaints the entire window at
       once, so it gets a short cross-fade; the class comes straight back off
       afterwards so ordinary hovers keep snapping */
    if (root.getAttribute('data-theme') !== id) {
      root.classList.add('theming');
      window.clearTimeout(themeSwap);
      themeSwap = window.setTimeout(() => root.classList.remove('theming'), 300);
    }
    root.setAttribute('data-theme', id);
  };

  const paintThemeGrid = () => {
    const grid = $el('themeGrid');
    if (grid.getAttribute('data-built') !== '1') {
      grid.innerHTML = '';
      THEMES.forEach((theme) => {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'themecard';
        card.setAttribute('role', 'radio');
        card.setAttribute('data-theme-id', theme.id);
        card.setAttribute('aria-checked', 'false');
        const swatch = document.createElement('span');
        swatch.className = 'swatch';
        swatch.setAttribute('aria-hidden', 'true');
        for (let i = 0; i < 3; i++) swatch.appendChild(document.createElement('i'));
        const name = document.createElement('span');
        name.className = 'themename';
        name.textContent = theme.label;
        const note = document.createElement('span');
        note.className = 'themenote';
        note.textContent = theme.note;
        card.appendChild(swatch);
        card.appendChild(name);
        card.appendChild(note);
        card.addEventListener('click', () => {
          applyTheme(theme.id);
          paintThemeGrid();
          commitConfig({ theme: theme.id });
        });
        grid.appendChild(card);
      });
      grid.addEventListener('keydown', (event: KeyboardEvent) => {
        const arrows = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'];
        if (arrows.indexOf(event.key) === -1) return;
        const cards = Array.prototype.slice.call(grid.querySelectorAll('.themecard')) as HTMLElement[];
        const index = cards.indexOf(document.activeElement as HTMLElement);
        if (index < 0) return;
        event.preventDefault();
        const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : -1;
        const next = cards[(index + step + cards.length) % cards.length];
        next.focus();
        next.click();
      });
      grid.setAttribute('data-built', '1');
    }
    const current = (state && state.theme) || DEFAULT_THEME;
    Array.prototype.forEach.call(grid.querySelectorAll('.themecard'), (card: HTMLElement) => {
      card.setAttribute('aria-checked', card.getAttribute('data-theme-id') === current ? 'true' : 'false');
    });
  };

  const commitConfig = (fields: Record<string, any>) => {
    const api = bridge();
    if (!api || !api.update_config) return;
    api.update_config(fields).then((result: any) => {
      if (!result || !result.ok) {
        toast((result && result.error) || 'could not save settings');
        return;
      }
      applyState(result.state);
    }, () => toast('could not save settings'));
  };

  const paintSettings = () => {
    if (!settingsOpen) return;
    paintSettingsModels();
    paintSettingsKeys();
    paintCustomProviders();
    paintParams();
  };

  const openSettings = () => {
    closePop();
    closeMenu();
    settingsOpen = true;
    keyEditorFor = '';
    $el('settings').hidden = false;
    paintSettings();
    refreshProviders().then(() => {
      paintSettings();
      ($el('setModelSearch') as HTMLInputElement).focus();
    });
  };

  const closeSettings = () => {
    settingsOpen = false;
    keyEditorFor = '';
    $el('settings').hidden = true;
  };

  /* ───────────────────────── composer ───────────────────────── */

  const grow = () => {
    const box = $el('input') as HTMLInputElement;
    box.style.height = 'auto';
    box.style.height = Math.min(box.scrollHeight, 170) + 'px';
  };

  const send = () => {
    const box = $el('input') as HTMLInputElement;
    const text = box.value.trim();
    if (!text || !bridge() || busy()) return;

    const youTurn = addUserTurn(text);
    youTurn.classList.add('enter');
    pending = addBotTurn('', true);
    pending.wrap.classList.add('enter');
    streamBuf = '';
    effortNote = '';
    segments = null;
    segments_text = '';
    segments_last_text = '';
    segments_reasoned = false;
    tool_count = 0;
    open_blocks.clear();
    startedAt = Date.now();
    box.value = '';
    grow();
    setPhase('thinking');
    setAlert('');
    playSound('send');

    const api = bridge();
    if (!api) return;
    api.send(text).then((result: any) => {
      if (!result || !result.ok) {
        failPending((result && result.error) || 'request rejected');
        playSound('error');
      }
    }).catch((error: any) => {
      failPending(String(error));
      playSound('error');
    });
  };

  /* ───────────────────────── events from the engine ───────────────────────── */

  (window as any).forge3Event = (event: string, payload?: EventPayload) => {
    payload = payload || {};
    if (payload.room && payload.room !== 'forge') return;

    if (event === 'phase') {
      setPhase(payload.phase || 'thinking', payload);
      const label = typeof payload.label === 'string' ? payload.label : '';
      if (label) {
        /* retries and stalls say what they are doing instead of spinning
           on the word "thinking" for minutes */
        setAlert(label);
        /* a segmented turn has no waiting line to fill: the transcript is
           being written already and a stray status would sit above it */
        if (pending && !segments && !streamBuf) setWaiting(pending.md, label);
        return;
      }
      if (payload.phase === 'thinking' && pending && !segments && !streamBuf) {
        setWaiting(pending.md, waitingLabel());
      }
      return;
    }

    if (event === 'effort') {
      const message = typeof payload.message === 'string' ? payload.message : '';
      if (!message) return;
      effortNote = message;
      setAlert(message);
      if (pending && !streamBuf) setWaiting(pending.md, message);
      return;
    }

    if (event === 'agent_trace') {
      if (typeof payload.label === 'string') {
        /* a trace means this is an agent turn: from here the answer is
           assembled in arrival order instead of one block at the end */
        if (!segments) begin_segments();
        const kind = typeof payload.kind === 'string' ? payload.kind : 'step';
        if (kind === 'tool') {
          close_segment();
          tool_count += 1;
          agent_tool_row({
            kind,
            id: typeof payload.id === 'number' ? payload.id : undefined,
            label: payload.label,
            detail: typeof payload.detail === 'string' ? payload.detail : '',
            file: typeof payload.file === 'string' ? payload.file : '',
          });
          const box = pending
            ? pending.wrap.querySelector(':scope > .bot > .body > .tracebox') as HTMLElement | null
            : null;
          if (box) refreshTraceSummary(box);
        } else if (kind === 'result') {
          /* the stat lands on the row the tool already opened */
          const id = typeof payload.id === 'number' ? payload.id : undefined;
          const row = id != null && pending
            ? pending.body.querySelector(`.segtool[data-tid="${id}"]`)
            : null;
          if (row) {
            if (typeof payload.file === 'string' && payload.file) {
              const name = row.querySelector('.segtool-file') as HTMLElement | null;
              if (!name && payload.file) {
                const added = document.createElement('span');
                added.className = 'segtool-file';
                added.textContent = payload.file;
                added.title = payload.file;
                row.insertBefore(added, row.querySelector('.segtool-stat'));
              }
            }
            const stat = row.querySelector('.segtool-stat') as HTMLElement | null;
            const plus = typeof payload.added === 'number' ? payload.added : null;
            const minus = typeof payload.removed === 'number' ? payload.removed : null;
            if (stat && (plus !== null || minus !== null)) {
              stat.innerHTML =
                (plus ? `<b class="add">+${plus}</b>` : '') +
                (minus ? `<b class="del">-${minus}</b>` : '') +
                (payload.created ? '<i class="newfile">new</i>' : '');
            }
            row.classList.add('done');
          }
        } else {
          appendAgentTrace({ kind: 'step', label: payload.label });
        }
      }
      return;
    }

    if (event === 'reasoning') {
      const chunk = typeof payload.text === 'string' ? payload.text : '';
      if (!chunk || !pending) return;
      if (!segments) begin_segments();
      push_thinking(chunk);
      return;
    }

    if (event === 'rewind') {
      if (pending) {
        streamBuf = '';
        setWaiting(pending.md, payload.fallback
          ? 'falling back to another model'
          : `held — attempt ${payload.attempt || '?'} of ${payload.maximum || '?'}`);
        playSound('hold');
      }
      return;
    }

    if (event === 'token') {
      if (!pending) return;
      if (segments) {
        push_text(payload.text || '');
        return;
      }
      streamBuf += payload.text || '';
      paintPending();
      return;
    }

    if (event === 'complete') {
      const text = payload.text == null ? streamBuf : payload.text;
      if (!String(text).trim() && payload.notice) {
        if (pending) {
          pending.md.className = 'md waiting';
          pending.md.textContent = payload.notice;
          pending = null;
          streamBuf = '';
          effortNote = '';
        }
      } else {
        finishPending(text, payload.usage, payload.held, payload.hold_class, undefined, {
          reasoning: typeof payload.reasoning === 'string' ? payload.reasoning : '',
          files: Array.isArray(payload.files) ? payload.files : [],
        });
      }
      setPhase('idle');
      setAlert('');
      refreshSessions();
      playSound('done');
      return;
    }

    if (event === 'error') {
      const model = typeof payload.model === 'string' && payload.model ? payload.model : undefined;
      failPending(payload.message || 'request failed', model ? { model } : undefined);
      playSound('error');
      return;
    }

    if (event === 'question') {
      openAsk(
        String(payload.id || ''),
        String(payload.question || ''),
        Array.isArray(payload.options) ? (payload.options as unknown[]).map((item) => String(item)) : [],
      );
      return;
    }

    if (event === 'cancelled') {
      /* a stopped turn keeps the answer it managed to write, and whatever it
         already staged stays downloadable — stopping is not a reason to throw
         the work away or to paste it into the chat */
      const stopped_files = Array.isArray(payload.files) ? payload.files as Array<{ name: string; size: number }> : [];
      if (pending && streamBuf) {
        finishPending(streamBuf, undefined, false, undefined, 'stopped', { files: stopped_files });
      } else if (pending && stopped_files.length) {
        finishPending('', undefined, false, undefined, 'stopped before any text', { files: stopped_files });
      } else if (pending) failPending('stopped');
      setPhase('idle');
      setAlert('');
      playSound('stop');
      return;
    }

    if (event === 'state') {
      applyState(payload.state ?? null);
      return;
    }

    if (event === 'session') {
      if (payload.action === 'new') resetThread([]);
      if (payload.action === 'loaded' && payload.payload) resetThread(sessionTurns(payload.payload));
      refreshSessions(typeof payload.id === 'string' ? payload.id : undefined);
      return;
    }

    if (event === 'permission') {
      showPermit(payload);
      return;
    }
  };

  /* ───────────────────────── wiring ───────────────────────── */

  ($el('composer') as HTMLFormElement).addEventListener('submit', (event: Event) => {
    event.preventDefault();
    if (busy()) {
      const api = bridge();
      if (api) api.stop().catch(() => {});
      return;
    }
    send();
  });

  ($el('sendBtn') as HTMLButtonElement).addEventListener('click', (event: Event) => {
    if (!busy()) return;
    event.preventDefault();
    const api = bridge();
    if (api) api.stop();
  });

  ($el('input') as HTMLInputElement).addEventListener('input', () => {
    grow();
    paintSendButton();
  });

  ($el('input') as HTMLInputElement).addEventListener('keydown', (event: KeyboardEvent) => {
    /* IME composition confirmations (CJK input) must not send the draft */
    if (event.isComposing) return;
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      send();
      return;
    }
    if (event.key === 'ArrowUp' && !($el('input') as HTMLInputElement).value && lastUserText && !busy()) {
      event.preventDefault();
      ($el('input') as HTMLInputElement).value = lastUserText;
      grow();
      paintSendButton();
    }
  });

  ($el('newChat') as HTMLButtonElement).addEventListener('click', () => {
    const api = bridge();
    if (!api) return;
    stopIfBusy();
    api.new_session().then((result: any) => {
      if (!result || !result.ok) {
        toast((result && result.error) || 'could not start a chat');
        return;
      }
      refreshSessions(result.id || undefined);
      ($el('input') as HTMLInputElement).focus();
    }, () => {
      toast('could not start a chat');
    });
  });

  ($el('newProject') as HTMLButtonElement).addEventListener('click', () => {
    openProject();
  });

  ($el('thinkBtn') as HTMLButtonElement).addEventListener('click', cycleEffort);

  ($el('chatSearch') as HTMLInputElement).addEventListener('input', paintSessions);

  ($el('railBtn') as HTMLButtonElement).addEventListener('click', () => {
    $el('app').classList.toggle('railoff');
    closePop();
    closeMenu();
  });

  ($el('modelChip') as HTMLButtonElement).addEventListener('click', (event: Event) => {
    event.stopPropagation();
    if (pop) closePop();
    else openPop();
  });

  ($el('settingsBtn') as HTMLButtonElement).addEventListener('click', () => {
    if (settingsOpen) closeSettings();
    else openSettings();
  });

  ($el('setClose') as HTMLButtonElement).addEventListener('click', closeSettings);

  ($el('settings') as HTMLElement).addEventListener('click', (event: Event) => {
    if (event.target === $el('settings')) closeSettings();
  });

  Array.prototype.forEach.call(document.querySelectorAll('.tab'), (tab: HTMLElement) => {
    tab.addEventListener('click', () => { showPane(tab.getAttribute('data-pane') || ''); });
  });

  ($el('setModelSearch') as HTMLInputElement).addEventListener('input', paintSettingsModels);
  ($el('setOnlyKeyed') as HTMLInputElement).addEventListener('change', paintSettingsModels);

  type ParamKind = 'number' | 'boolean' | 'string' | 'select' | 'range';

  const bindParam = (id: string, key: string, kind: ParamKind) => {
    const el = $el(id) as HTMLInputElement | HTMLSelectElement;
    const read = (): any => {
      if (kind === 'boolean') return (el as HTMLInputElement).checked;
      if (kind === 'number' || kind === 'range') return Number((el as HTMLInputElement).value);
      return el.value;
    };
    el.addEventListener('change', () => {
      const value = read();
      if ((kind === 'number' || kind === 'range') && !Number.isFinite(value)) return;
      if (kind === 'string' && !String(value).trim() && key !== 'target' && key !== 'chat_fallback') return;
      commitConfig({ [key]: value });
    });
    if (kind === 'range') {
      el.addEventListener('input', () => {
        ($el(id + 'Val') as HTMLOutputElement).textContent = Number((el as HTMLInputElement).value).toFixed(2);
      });
    }
  };

  bindParam('setTemp', 'temp', 'range');
  bindParam('setTopP', 'top_p', 'range');
  bindParam('setHold', 'hold', 'boolean');
  bindParam('setHoldPrefill', 'hold_prefill', 'boolean');
  bindParam('setHoldMax', 'hold_max', 'number');
  bindParam('setFallback', 'chat_fallback', 'string');
  bindParam('setReqTimeout', 'request_timeout', 'number');
  bindParam('setRetries', 'connect_retries', 'number');
  bindParam('setTlsStrict', 'tls_strict', 'boolean');
  bindParam('setStyle', 'style', 'select');
  bindParam('setTarget', 'target', 'string');
  bindParam('setRecordTests', 'record_tests', 'boolean');
  bindParam('setJudgeBackend', 'judge_backend', 'select');
  bindParam('setJudgeModel', 'judge_model', 'string');
  bindParam('setAnvilAuto', 'anvil_auto_improve', 'boolean');
  bindParam('setProbes', 'anvil_probe_count', 'number');
  bindParam('setVersions', 'anvil_max_versions', 'number');
  bindParam('setThreshold', 'anvil_threshold', 'number');

  /* ───────── project dialog: the folder a new project owns ───────── */
  const projectModal = $el('projectModal') as HTMLElement;
  const wsError = $el('workspaceErr');
  let wsPath = '';

  const projectName = $el('projectName') as HTMLInputElement;
  const folderPathInput = $el('folderPath') as HTMLInputElement;
  const folderChip = $el('folderChip');
  const projectCreate = $el('projectCreate') as HTMLButtonElement;

  const paintProjectFolder = () => {
    const chipName = $el('folderChipName') as HTMLElement;
    if (wsPath) {
      const parts = wsPath.split(/[\\/]/).filter(Boolean);
      chipName.textContent = parts.length ? parts[parts.length - 1] : wsPath;
      chipName.title = wsPath;
      folderChip.hidden = false;
      folderPathInput.value = wsPath;
    } else {
      folderChip.hidden = true;
      folderPathInput.value = '';
    }
    projectCreate.disabled = !wsPath;
  };

  let fpSelectedPath = '';

  const closeFolderPicker = () => {
    ($el('folderPickerModal') as HTMLElement).hidden = true;
  };

  const markPicked = (path: string) => {
    fpSelectedPath = path;
    const current = $el('fpCurrent') as HTMLElement;
    current.textContent = path || 'This PC';
    current.title = path || '';
    ($el('folderPickerSelect') as HTMLButtonElement).disabled = !path;
    document.querySelectorAll('#fpTree .fplabelrow').forEach((row) => {
      (row as HTMLElement).classList.toggle('selected', (row as HTMLElement).dataset.path === path);
    });
  };

  const makePickerNode = (name: string, p: string): HTMLElement => {
    const node = document.createElement('div');
    node.className = 'fpnode';
    node.dataset.path = p;

    const label = document.createElement('div');
    label.className = 'fplabelrow';
    label.dataset.path = p;

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'fptoggle';
    toggle.innerHTML = ICONS.chevron;
    toggle.setAttribute('aria-label', 'Expand ' + name);

    const icon = document.createElement('span');
    icon.className = 'fpicon';
    icon.innerHTML = folderIcon;

    const nameEl = document.createElement('span');
    nameEl.className = 'fpname';
    nameEl.textContent = name;
    nameEl.title = p;

    label.appendChild(toggle);
    label.appendChild(icon);
    label.appendChild(nameEl);

    const kids = document.createElement('div');
    kids.className = 'fpkids';
    kids.hidden = true;

    node.appendChild(label);
    node.appendChild(kids);

    const toggleNode = async () => {
      if (!kids.hidden) {
        kids.hidden = true;
        toggle.classList.remove('open');
        toggle.innerHTML = ICONS.chevron;
        return;
      }
      if (!kids.dataset.loaded) {
        toggle.classList.remove('open');
        toggle.innerHTML = ICONS.spinner;
        const api = bridge();
        try {
          const result = api ? await api.browse_workspace(p) : null;
          kids.innerHTML = '';
          if (result && result.ok) {
            const folders: Array<{ name: string; path: string }> = result.folders || [];
            if (folders.length) {
              kids.dataset.loaded = '1';
              folders.forEach((f) => kids.appendChild(makePickerNode(f.name, f.path)));
            } else {
              kids.dataset.loaded = 'empty';
              const empty = document.createElement('span');
              empty.className = 'fpempty';
              empty.textContent = 'empty';
              kids.appendChild(empty);
            }
          } else {
            kids.dataset.loaded = 'denied';
            const denied = document.createElement('span');
            denied.className = 'fpempty';
            denied.textContent = 'not accessible';
            kids.appendChild(denied);
          }
        } catch {
          kids.dataset.loaded = 'denied';
          kids.innerHTML = '<span class="fpempty">not accessible</span>';
        }
      }
      kids.hidden = false;
      toggle.classList.add('open');
      toggle.innerHTML = ICONS.chevron;
    };

    toggle.addEventListener('click', (event: Event) => {
      event.stopPropagation();
      void toggleNode();
    });
    label.addEventListener('click', () => { flashRow(label); markPicked(p); });
    nameEl.addEventListener('dblclick', (event: Event) => {
      event.stopPropagation();
      void toggleNode();
    });

    return node;
  };

  const openFolderPicker = () => {
    fpSelectedPath = '';
    const modal = $el('folderPickerModal') as HTMLElement;
    const tree = $el('fpTree') as HTMLElement;
    const current = $el('fpCurrent') as HTMLElement;
    tree.innerHTML = '<div class="picker-loading">Loading…</div>';
    current.textContent = 'This PC';
    current.title = '';
    ($el('folderPickerSelect') as HTMLButtonElement).disabled = true;
    modal.hidden = false;

    const api = bridge();
    if (!api) {
      tree.innerHTML = '<div class="picker-error">Bridge is not ready</div>';
      return;
    }
    api.browse_workspace('').then((result: any) => {
      tree.innerHTML = '';
      if (!result || !result.ok) {
        tree.innerHTML = '<div class="picker-error">' + esc((result && result.error) || 'Failed to load') + '</div>';
        return;
      }
      const roots: Array<{ name: string; path: string }> = result.drives || [];
      if (!roots.length) {
        tree.innerHTML = '<div class="picker-error">No drives found</div>';
        return;
      }
      roots.forEach((root) => tree.appendChild(makePickerNode(root.name, root.path)));
    }, () => {
      tree.innerHTML = '<div class="picker-error">Failed to load</div>';
    });
  };

  ($el('folderPickerSelect') as HTMLButtonElement).addEventListener('click', () => {
    if (!fpSelectedPath) return;
    wsPath = fpSelectedPath;
    paintProjectFolder();
    closeFolderPicker();
  });

  ($el('folderPickerCancel') as HTMLButtonElement).addEventListener('click', closeFolderPicker);
  ($el('folderPickerClose') as HTMLButtonElement).addEventListener('click', closeFolderPicker);
  ($el('folderPickerModal') as HTMLElement).addEventListener('click', (event: Event) => {
    if (event.target === $el('folderPickerModal')) closeFolderPicker();
  });

  const closeProject = () => {
    projectModal.hidden = true;
    wsPath = '';
    wsError.textContent = '';
    projectName.value = '';
    folderPathInput.value = '';
    folderChip.hidden = true;
    projectCreate.disabled = true;
  };

  const openProject = () => {
    wsError.textContent = '';
    wsPath = '';
    projectName.value = '';
    folderPathInput.value = '';
    folderChip.hidden = true;
    projectCreate.disabled = true;
    projectModal.hidden = false;
    projectName.focus();
  };

  ($el('folderBrowse') as HTMLButtonElement).addEventListener('click', openFolderPicker);
  folderPathInput.addEventListener('change', () => {
    wsPath = folderPathInput.value.trim();
    paintProjectFolder();
  });
  ($el('folderChipX') as HTMLButtonElement).addEventListener('click', (event: Event) => {
    event.stopPropagation();
    wsPath = '';
    paintProjectFolder();
  });
  ($el('projectCancel') as HTMLButtonElement).addEventListener('click', closeProject);
  ($el('projectClose') as HTMLButtonElement).addEventListener('click', closeProject);
  projectName.addEventListener('keydown', (event: KeyboardEvent) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (!projectCreate.disabled) projectCreate.click();
    }
  });
  projectCreate.addEventListener('click', () => {
    if (!wsPath) return;
    const api = bridge();
    if (!api) return;
    wsError.textContent = '';
    const name = projectName.value.trim();
    api.create_project({ folder: wsPath, name: name || undefined }).then((result: any) => {
      if (!result || !result.ok) {
        wsError.textContent = (result && result.error) || 'could not create the project';
        return;
      }
      closeProject();
      refreshSessions();
      const made = (result.project && result.project.name) || name || wsPath;
      toast('project created · ' + made);
    }, () => {
      wsError.textContent = 'could not create the project';
    });
  });
  projectModal.addEventListener('click', (event: Event) => {
    if (event.target === projectModal) closeProject();
  });

  /* ───────── tool permission dialog: shell / web asked the first time ───────── */
  const permitModal = $el('permitModal') as HTMLElement;
  let permitId = '';

  const closePermit = () => {
    permitModal.hidden = true;
    permitId = '';
  };

  const showPermit = (payload: any) => {
    permitId = String(payload.id || '');
    const kind = payload.kind === 'web' ? 'web' : 'shell';
    ($el('permitTitle') as HTMLElement).textContent =
      kind === 'web' ? 'Open this web page?' : 'Run this command?';
    ($el('permitNote') as HTMLElement).textContent =
      kind === 'web'
        ? 'FORGE wants to fetch a page. It stays outside your project folder.'
        : 'FORGE wants to run a command in the project folder.';
    ($el('permitDetail') as HTMLElement).textContent = String(payload.detail || '');
    permitModal.hidden = false;
    ($el('permitOnce') as HTMLButtonElement).focus();
  };

  const answerPermit = (decision: 'once' | 'always' | 'deny') => {
    const api = bridge();
    const id = permitId;
    closePermit();
    if (!api || !id) return;
    api.approve_tool(id, decision).then((result: any) => {
      if (result && result.state) applyState(result.state);
    }, () => {});
  };

  ($el('permitOnce') as HTMLButtonElement).addEventListener('click', () => answerPermit('once'));
  ($el('permitAlways') as HTMLButtonElement).addEventListener('click', () => answerPermit('always'));
  ($el('permitDeny') as HTMLButtonElement).addEventListener('click', () => answerPermit('deny'));
  permitModal.addEventListener('click', (event: Event) => {
    if (event.target === permitModal) answerPermit('deny');
  });

  /* ───────── the model asks the user a question mid-turn ───────── */
  const askModal = $el('askModal') as HTMLElement;
  let askId = '';

  const closeAsk = () => {
    askModal.hidden = true;
    askId = '';
  };

  const answerAsk = (text: string) => {
    const api = bridge();
    const id = askId;
    closeAsk();
    if (!api || !id) return;
    api.answer_ask_user(id, text).then(() => {}, () => {});
  };

  /* The model's question: a numbered list of whatever it proposed, plus a free
     answer. It may propose none, one, or many.
     Passing sends this exact text, not an empty answer: an empty answer
     reads as "nothing happened" and the model asks the same thing again.
     The engine also remembers the pass and answers any repeat by itself. */
  const ASK_PASSED =
    '(the user passed on this question without answering — move on, and do not ask it again)';
  const ASK_MAX_OPTIONS = 9;

  const paintAskSend = (): void => {
    const typed = ($el('askInput') as HTMLInputElement).value.trim();
    const send = $el('askSend') as HTMLButtonElement;
    send.textContent = typed ? 'Send' : 'Pass';
    send.classList.toggle('passing', !typed);
  };

  const openAsk = (id: string, question: string, options: string[]) => {
    askId = String(id || '');
    ($el('askQuestion') as HTMLElement).textContent = question || 'The model has a question.';
    const box = $el('askOptions') as HTMLElement;
    box.innerHTML = '';
    let number = 0;
    for (const item of (options || []).slice(0, ASK_MAX_OPTIONS)) {
      const label = String(item || '').trim().slice(0, 120);
      if (!label) continue;
      number += 1;
      const pick = document.createElement('button');
      pick.type = 'button';
      pick.className = 'askopt';
      pick.dataset['key'] = String(number);

      const rank = document.createElement('span');
      rank.className = 'askrank';
      rank.textContent = String(number);
      const text = document.createElement('span');
      text.className = 'asktext';
      text.textContent = label;

      pick.appendChild(rank);
      pick.appendChild(text);
      pick.addEventListener('click', () => answerAsk(label));
      box.appendChild(pick);
    }
    box.hidden = number === 0;
    ($el('askInput') as HTMLInputElement).value = '';
    paintAskSend();
    askModal.hidden = false;
    if (number > 0) {
      const first = box.querySelector('.askopt') as HTMLElement | null;
      if (first) first.focus();
      else ($el('askInput') as HTMLInputElement).focus();
    } else {
      ($el('askInput') as HTMLInputElement).focus();
    }
  };

  ($el('askSend') as HTMLButtonElement).addEventListener('click', () => {
    const typed = ($el('askInput') as HTMLInputElement).value.trim();
    answerAsk(typed || ASK_PASSED);
  });
  ($el('askInput') as HTMLInputElement).addEventListener('input', paintAskSend);
  ($el('askInput') as HTMLInputElement).addEventListener('keydown', (event: KeyboardEvent) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      answerAsk(($el('askInput') as HTMLInputElement).value.trim());
    }
  });
  ($el('askSkip') as HTMLButtonElement).addEventListener('click', () => answerAsk(ASK_PASSED));
  askModal.addEventListener('click', (event: Event) => {
    if (event.target === askModal) answerAsk(ASK_PASSED);
  });

  /* 1..9 answer the question without reaching for the mouse */
  document.addEventListener('keydown', (event: KeyboardEvent) => {
    if (askModal.hidden) return;
    if (event.key === 'Escape') return;
    if (!/^[1-9]$/.test(event.key)) return;
    const target = askModal.querySelector(`.askopt[data-key="${event.key}"]`) as HTMLElement | null;
    if (!target) return;
    event.preventDefault();
    target.click();
  });

  document.addEventListener('keydown', (event: KeyboardEvent) => {
    if (event.key !== 'Escape') return;
    if (!askModal.hidden) {
      answerAsk(ASK_PASSED);
      return;
    }
    if (!permitModal.hidden) {
      answerPermit('deny');
      return;
    }
    if (!projectModal.hidden) closeProject();
    const picker = $el('folderPickerModal') as HTMLElement;
    if (picker && !picker.hidden) closeFolderPicker();
  });

  const modalEscapeGate = (event: KeyboardEvent): boolean => {
    if (event.key !== 'Escape') return false;
    const picker = $el('folderPickerModal') as HTMLElement;
    return !askModal.hidden || !permitModal.hidden || !projectModal.hidden || (picker !== null && !picker.hidden);
  };

  const insecureBox = $el('setInsecure') as HTMLInputElement;
  insecureBox.addEventListener('change', () => {
    if (insecureBox.checked && !window.confirm(
      'Skip TLS verification?\n\n' +
      'Certificate checks will be off for every provider API call Forge makes, ' +
      'so traffic can be intercepted by anyone on the network path. ' +
      'Codex token refresh keeps verification on. ' +
      'Unchecking the box restores verification immediately.\n\n' +
      'Enable it anyway?'
    )) {
      insecureBox.checked = false;
      return;
    }
    commitConfig({ insecure: insecureBox.checked });
  });

  const bindPassToggle = (toggleId: string, inputId: string) => {
    const toggle = $el(toggleId) as HTMLButtonElement;
    const input = $el(inputId) as HTMLInputElement;
    toggle.addEventListener('click', () => {
      const shown = input.type === 'text';
      input.type = shown ? 'password' : 'text';
      toggle.textContent = shown ? 'Show' : 'Hide';
      toggle.setAttribute('aria-pressed', shown ? 'false' : 'true');
      toggle.setAttribute('aria-label', (shown ? 'Show' : 'Hide') + ' passphrase');
      input.focus();
      const caret = input.value.length;
      try {
        input.setSelectionRange(caret, caret);
      } catch {
        // some input types refuse selection; toggling already happened
      }
    });
  };

  bindPassToggle('passToggle', 'pass');
  bindPassToggle('sealPassToggle', 'sealPass');
  bindPassToggle('sealPass2Toggle', 'sealPass2');

  const sealPass = $el('sealPass') as HTMLInputElement;
  const sealPass2 = $el('sealPass2') as HTMLInputElement;
  const sealStrength = $el('sealStrength');

  const paintSealStrength = () => {
    const value = sealPass.value;
    sealStrength.hidden = !value;
    if (!value) {
      sealStrength.removeAttribute('data-score');
      $el('sealStrengthLabel').textContent = 'very weak';
      return;
    }
    const strength = scorePassphrase(value);
    sealStrength.setAttribute('data-score', String(strength.score));
    $el('sealStrengthLabel').textContent = strength.score < 2
      ? strength.label + ' — too weak to seal'
      : strength.label;
  };

  sealPass.addEventListener('input', paintSealStrength);

  ($el('sealVaultBtn') as HTMLButtonElement).addEventListener('click', () => {
    const api = bridge();
    const failure = $el('sealErr');
    failure.textContent = '';
    if (!api) return;
    const value = sealPass.value;
    if (!value) {
      failure.textContent = 'enter a passphrase';
      return;
    }
    if (value !== sealPass2.value) {
      failure.textContent = 'passphrases do not match';
      return;
    }
    if (passphraseTooWeak(value)) {
      failure.textContent = 'passphrase is too weak — use at least 12 characters, or 8+ with mixed character classes';
      return;
    }
    api.seal_vault(value, sealPass2.value).then((result: any) => {
      if (!result || !result.ok) {
        failure.textContent = (result && result.error) || 'could not seal the vault';
        playSound('error');
        return;
      }
      sealPass.value = '';
      sealPass2.value = '';
      paintSealStrength();
      applyState(result.state);
      toast('vault sealed · unlock with that passphrase');
      playSound('unlock');
    }, () => {
      failure.textContent = 'could not seal the vault';
    });
  });

  /* ─────────── first-run setup: welcome, theme, keys, done ─────────── */

  const setup = $el('setup') as HTMLElement;
  const setupSteps = Array.prototype.slice.call(
    setup.querySelectorAll('.setupstep'),
  ) as HTMLElement[];
  const SETUP_LAST = setupSteps.length - 1;
  let setupAt = 0;
  let setupKeysSaved = 0;

  const paintSetupDots = (): void => {
    const dots = $el('setupDots');
    dots.innerHTML = '';
    for (let index = 0; index <= SETUP_LAST; index += 1) {
      const dot = document.createElement('i');
      dot.className = index === setupAt ? 'on' : index < setupAt ? 'done' : '';
      dots.appendChild(dot);
    }
    ($el('setupBack') as HTMLButtonElement).hidden = setupAt === 0;
    ($el('setupNext') as HTMLButtonElement).textContent = setupAt === SETUP_LAST ? 'Finish' : 'Next';
    ($el('setupSkip') as HTMLButtonElement).hidden = setupAt === SETUP_LAST;
  };

  const showSetupStep = (index: number): void => {
    /* the panel remembers which way it was walked so the steps can slide the
       way the eye expects: forward brings the next page in from the right,
       Back sends the previous one back to the left */
    setup.dataset['dir'] = index >= setupAt ? 'fwd' : 'back';
    setupAt = Math.max(0, Math.min(SETUP_LAST, index));
    setupSteps.forEach((step, at) => {
      step.hidden = at !== setupAt;
    });
    if (setupAt === SETUP_LAST) paintSetupSummary();
    paintSetupDots();
    /* keep the keyboard on the wizard: a stray Enter must not walk the steps */
    const focus = setupSteps[setupAt].querySelector(
      'button:not([hidden]), input, [tabindex]:not([tabindex="-1"])',
    ) as HTMLElement | null;
    if (focus) focus.focus();
  };

  const paintSetupThemes = (): void => {
    const grid = $el('setupThemes');
    if (grid.getAttribute('data-built') !== '1') {
      grid.innerHTML = '';
      for (const theme of THEMES) {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'themecard';
        card.setAttribute('role', 'radio');
        card.dataset['themeId'] = theme.id;
        card.setAttribute('aria-checked', 'false');
        const swatch = document.createElement('span');
        swatch.className = 'swatch';
        swatch.setAttribute('aria-hidden', 'true');
        for (let i = 0; i < 3; i += 1) swatch.appendChild(document.createElement('i'));
        const name = document.createElement('span');
        name.className = 'themename';
        name.textContent = theme.label;
        const note = document.createElement('span');
        note.className = 'themenote';
        note.textContent = theme.note;
        card.appendChild(swatch);
        card.appendChild(name);
        card.appendChild(note);
        card.addEventListener('click', () => {
          applyTheme(theme.id);
          Array.prototype.forEach.call(grid.querySelectorAll('.themecard'), (other: HTMLElement) => {
            const on = other === card;
            other.setAttribute('aria-checked', on ? 'true' : 'false');
            other.classList.toggle('on', on);
          });
          commitConfig({ theme: theme.id });
        });
        grid.appendChild(card);
      }
      grid.setAttribute('data-built', '1');
    }
    markSetupTheme();
  };

  const markSetupTheme = (): void => {
    const current = String(state && state.theme ? state.theme : DEFAULT_THEME);
    Array.prototype.forEach.call(
      $el('setupThemes').querySelectorAll('.themecard'),
      (card: HTMLElement) => {
        const on = card.getAttribute('data-theme-id') === current;
        card.setAttribute('aria-checked', on ? 'true' : 'false');
        card.classList.toggle('on', on);
      },
    );
  };

  const paintSetupKeys = (): void => {
    const box = $el('setupKeys');
    box.innerHTML = '';
    if (!backends.length) {
      const none = document.createElement('p');
      none.className = 'note';
      none.textContent = 'no providers reported';
      box.appendChild(none);
      return;
    }
    /* a welcome screen must not open on twenty-two password fields: show the
       providers worth starting with, the rest live in Settings */
    const START_WITH = [
      'nvidia', 'openrouter', 'anthropic', 'openai',
      'gemini', 'groq', 'mistral', 'deepseek',
    ];
    const wanted = backends.filter((item) => START_WITH.indexOf(item.backend) !== -1);
    const rest = backends.filter((item) => START_WITH.indexOf(item.backend) === -1);
    for (const item of wanted) box.appendChild(setupKeyCard(item));
    const more = document.createElement('p');
    more.className = 'note';
    more.textContent = rest.length
      ? `and ${rest.length} more under Settings → API keys.`
      : '';
    if (rest.length) box.appendChild(more);
  };

  const finishSetup = (): void => {
    const api = bridge();
    /* let the sheet fall away before it is taken out of the tree, otherwise
       the dismissal is a hard cut */
    const done = () => {
      setup.classList.add('hiding');
      window.setTimeout(() => {
        setup.hidden = true;
        setup.classList.remove('hiding');
        showEmpty(true);
      }, 200);
    };
    if (!api) {
      done();
      return;
    }
    api.update_config({ setup_done: true }).then(() => done()).catch(() => done());
  };

    const setupKeyCard = (item: BackendItem): HTMLElement => {
    const card = document.createElement('div');
    card.className = 'setupkey';

    const name = document.createElement('span');
    name.className = 'setupkey-name';
    name.textContent = item.backend;
    card.appendChild(name);

    const meta = KEY_SOURCE[item.source] || KEY_SOURCE.missing;
    const badge = document.createElement('span');
    badge.className = 'keystate ' + (item.source === 'stored' ? 'set' : item.source);
    badge.textContent = meta[0];
    badge.title = meta[1];
    card.appendChild(badge);

    if (item.source === 'stored') {
      const ready = document.createElement('span');
      ready.className = 'setupkey-ready';
      ready.textContent = 'already set';
      card.appendChild(ready);
      return card;
    }

    const input = document.createElement('input');
    input.type = 'password';
    input.autocomplete = 'off';
    input.className = 'setupkey-input';
    input.placeholder = 'paste the key';
    input.setAttribute('aria-label', `${item.backend} key`);
    card.appendChild(input);

    const save = document.createElement('button');
    save.type = 'button';
    save.className = 'pbtn';
    save.textContent = 'Add';
    const store = () => {
      const api = bridge();
      const value = input.value.trim();
      if (!api || !value) return;
      save.disabled = true;
      save.textContent = 'Saving…';
      api.save_key(item.backend, value).then((result: any) => {
        if (result && result.ok === false) {
          save.disabled = false;
          save.textContent = 'Add';
          toast(result.error ? String(result.error) : 'the key was refused');
          return;
        }
        setupKeysSaved += 1;
        applyState((result && result.state) ?? null);
        card.classList.add('saved');
        card.innerHTML = '';
        const ok = document.createElement('span');
        ok.className = 'setupkey-ready';
        ok.textContent = 'added';
        card.appendChild(ok);
        paintSetupSummary();
      }).catch(() => {
        save.disabled = false;
        save.textContent = 'Add';
        toast('the key could not be saved');
      });
    };
    save.addEventListener('click', store);
    input.addEventListener('keydown', (event: KeyboardEvent) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        store();
      }
    });
    card.appendChild(save);
    return card;
  };

  const paintSetupSummary = (): void => {
    const current = String(state && state.theme ? state.theme : DEFAULT_THEME);
    const label = THEMES.find((theme) => theme.id === current);
    ($el('setupThemeName') as HTMLElement).textContent = label ? label.label : current;
    ($el('setupKeyCount') as HTMLElement).textContent = String(setupKeysSaved);
    if (!setupKeysSaved) {
      ($el('setupSummary') as HTMLElement).textContent =
        'No key was added, so Forge cannot call a model yet. Paste one under Settings → API keys whenever you have one.';
    }
  };

  ($el('setupNext') as HTMLButtonElement).addEventListener('click', () => {
    if (setupAt === SETUP_LAST) finishSetup();
    else showSetupStep(setupAt + 1);
  });
  ($el('setupBack') as HTMLButtonElement).addEventListener('click', () => showSetupStep(setupAt - 1));
  ($el('setupSkip') as HTMLButtonElement).addEventListener('click', finishSetup);

  const openSetup = (): void => {
    setupKeysSaved = 0;
    setupAt = 0;
    paintSetupThemes();
    paintSetupKeys();
    showSetupStep(0);
    setup.hidden = false;
  };

  const soundBox = $el('setSound') as HTMLInputElement;
  soundBox.checked = soundEnabled();
  soundBox.addEventListener('change', () => {
    setSoundEnabled(soundBox.checked);
    if (soundBox.checked) playSound('done');
  });

  /* Settings -> Prompts: the user's own instructions, kept here and only
     handed to the engine when the switch is on. Typing saves on its own;
     Save files a named entry the user can pick back later. */
  const promptBox = $el('customPrompt') as HTMLTextAreaElement;
  const promptOn = $el('setPromptOn') as HTMLInputElement;
  const promptCount = $el('promptCount') as HTMLElement;
  const promptState = $el('promptState') as HTMLElement;
  const promptName = $el('promptName') as HTMLInputElement;
  const promptList = $el('promptList') as HTMLElement;

  type SavedPrompt = { id: string; name: string; text: string };
  let savedPrompts: SavedPrompt[] = [];
  let savedTimer = 0;

  const currentPromptText = (): string => String(state && state.custom_prompt ? state.custom_prompt : '');

  const paintPromptCount = (): void => {
    const length = promptBox.value.trim().length;
    promptCount.textContent = `${length} character${length === 1 ? '' : 's'}`;
  };

  const paintPromptState = (note?: string): void => {
    if (note) {
      promptState.textContent = note;
      return;
    }
    const length = promptBox.value.trim().length;
    if (!length) {
      promptState.textContent = promptOn.checked
        ? 'The switch is on but there is nothing to send.'
        : 'Forge is used on its own. Write your instructions here, then switch them on.';
    } else if (promptOn.checked) {
      promptState.textContent = 'Saved and injected in front of every turn.';
    } else {
      promptState.textContent = 'Saved, but not sent: the switch is off.';
    }
  };

  /* editing marks which entry the box is holding, so the list can show it.
     An empty box is Forge itself, which is why it carries a real id. */
  const FORGE_ID = '__forge__';
  let promptActiveId = FORGE_ID;

  const paintPromptList = (): void => {
    promptList.innerHTML = '';

    const row_for = (id: string, name: string, text: string, built_in: boolean): void => {
      const row = document.createElement('div');
      row.className = 'promptitem';
      if (id === promptActiveId) row.classList.add('on');

      const pick = document.createElement('button');
      pick.type = 'button';
      pick.className = 'promptpick';
      pick.title = built_in ? 'Use Forge with no extra prompt' : `Use "${name}"`;
      const label = document.createElement('span');
      label.className = 'promptitem-name';
      label.textContent = name;
      const meta = document.createElement('span');
      meta.className = 'promptitem-meta';
      meta.textContent = built_in ? 'default' : `${text.trim().split('\n').length} lines`;
      pick.appendChild(label);
      pick.appendChild(meta);
      pick.addEventListener('click', () => {
        promptBox.value = built_in ? '' : text;
        promptActiveId = id;
        paintPromptCount();
        savePrompt({ custom_prompt: promptBox.value });
      });
      row.appendChild(pick);

      const drop = document.createElement('button');
      drop.type = 'button';
      drop.className = 'promptdrop';
      drop.textContent = '×';
      drop.title = `Remove "${name}"`;
      drop.setAttribute('aria-label', `Remove ${name}`);
      if (built_in) {
        drop.disabled = true;
        drop.title = 'Forge is the default prompt and cannot be removed';
      } else {
        drop.addEventListener('click', () => {
          savedPrompts = savedPrompts.filter((item) => item.id !== id);
          if (promptActiveId === id) promptActiveId = FORGE_ID;
          savePrompt({ saved_prompts: savedPrompts });
        });
      }
      row.appendChild(drop);
      promptList.appendChild(row);
    };

    /* Forge is the default: selecting it clears the box */
    row_for(FORGE_ID, 'Forge', '', true);
    for (const item of savedPrompts) row_for(item.id, item.name, item.text, false);
  };

  const savePrompt = (patch: Record<string, any>): void => {
    const api = bridge();
    if (!api) return;
    api.update_config(patch).then((result: any) => {
      if (!result || result.ok === false) {
        toast(result && result.error ? String(result.error) : 'could not save the prompt');
        return;
      }
      if (Array.isArray((result.state as any)?.saved_prompts)) {
        savedPrompts = (result.state as any).saved_prompts as SavedPrompt[];
      }
      applyState(result.state ?? null);
      paintPromptList();
      paintPromptCount();
      paintPromptState();
    }).catch(() => toast('could not save the prompt'));
  };

  /* typing saves itself: no button between the user and the setting */
  const autosavePrompt = (): void => {
    paintPromptCount();
    paintPromptState('Saving…');
    if (savedTimer) window.clearTimeout(savedTimer);
    savedTimer = window.setTimeout(() => {
      savedTimer = 0;
      savePrompt({ custom_prompt: promptBox.value });
    }, 700);
  };

  promptBox.addEventListener('input', () => {
    /* an empty box is Forge; text that matches nothing is a draft of its own */
    if (!promptBox.value.trim()) {
      promptActiveId = FORGE_ID;
    } else {
      promptActiveId = savedPrompts.find((item) => item.text === promptBox.value)?.id || '';
    }
    autosavePrompt();
  });
  promptOn.addEventListener('change', () => {
    savePrompt({ custom_prompt: promptBox.value, custom_prompt_on: promptOn.checked });
  });
  ($el('promptClear') as HTMLButtonElement).addEventListener('click', () => {
    promptBox.value = '';
    promptActiveId = FORGE_ID;
    paintPromptCount();
    savePrompt({ custom_prompt: '' });
  });
  ($el('promptSave') as HTMLButtonElement).addEventListener('click', () => {
    const text = promptBox.value.trim();
    if (!text) {
      toast('nothing to save — the box is empty');
      return;
    }
    const name = promptName.value.trim() || (text.split('\n')[0].slice(0, 60) || 'Prompt');
    const entry: SavedPrompt = {
      id: `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      name,
      text,
    };
    savedPrompts = [entry, ...savedPrompts.filter((item) => item.name !== name)].slice(0, 40);
    promptActiveId = entry.id;
    promptName.value = '';
    savePrompt({ saved_prompts: savedPrompts });
  });

  const loadPrompt = (): void => {
    promptBox.value = currentPromptText();
    promptOn.checked = Boolean(state && state.custom_prompt_on);
    const stored = (state as any)?.saved_prompts;
    savedPrompts = Array.isArray(stored) ? (stored as SavedPrompt[]) : [];
    promptActiveId = promptBox.value.trim()
      ? (savedPrompts.find((item) => item.text === promptBox.value)?.id || '')
      : FORGE_ID;
    paintPromptCount();
    paintPromptState();
    paintPromptList();
  };

  ($el('thread') as HTMLElement).addEventListener('scroll', () => {
    atBottom = nearBottom();
    $el('jumpBtn').hidden = atBottom;
  });

  ($el('jumpBtn') as HTMLButtonElement).addEventListener('click', () => { toBottom(true); });

  ($el('unlockBtn') as HTMLButtonElement).addEventListener('click', () => { unlock(); });
  ($el('pass') as HTMLInputElement).addEventListener('keydown', (event: KeyboardEvent) => {
    if (event.key === 'Enter') { event.preventDefault(); unlock(); }
  });

  const unlock = () => {
    const api = bridge();
    if (!api) return;
    api.unlock(($el('pass') as HTMLInputElement).value).then((result: any) => {
      $el('unlockErr').textContent = (result && result.ok) ? '' : ((result && result.error) || 'wrong passphrase');
      if (!result || !result.ok) {
        playSound('error');
        return;
      }
      ($el('pass') as HTMLInputElement).value = '';
      applyState(result.state);
      playSound('unlock');
      return api.bootstrap().then((data: BootstrapData) => {
        models = data.models || [];
        backends = data.backends || [];
        sessions = data.sessions || [];
        applyState(data.state);
        paintDrawer(data.drawer);
        resetThread((data.room && data.room.turns) || []);
        paintSessions();
        paintTitle();
        ($el('input') as HTMLInputElement).focus();
      }, (error: any) => {
        $el('unlockErr').textContent = 'unlocked, but the engine did not reload';
        if (window.console) console.error(error);
      });
    }, () => {
      $el('unlockErr').textContent = 'could not reach the engine';
      playSound('error');
    });
  };

  ($el('winMin') as HTMLButtonElement).addEventListener('click', () => { const api = bridge(); if (api) api.minimize().catch(() => {}); });
  ($el('winMax') as HTMLButtonElement).addEventListener('click', () => { const api = bridge(); if (api) api.toggle_maximize().catch(() => {}); });
  ($el('winClose') as HTMLButtonElement).addEventListener('click', () => {
    const api = bridge();
    if (!api) return;
    if (busy() && !window.confirm('Forge is still drafting. Close anyway?')) return;
    api.close().catch(() => {});
  });

  /* frameless window: the header doubles as the title bar. */
  const topbar = $el('topbar');
  let dragFrom: { x: number; y: number } | null = null;
  let dragStep = { x: 0, y: 0 };
  let dragFrame = 0;
  const flushDrag = (): void => {
    dragFrame = 0;
    const step = dragStep;
    dragStep = { x: 0, y: 0 };
    if (!step.x && !step.y) return;
    const api = bridge();
    if (api && api.drag_by) api.drag_by(step.x, step.y).catch(() => {});
  };
  const drag_ok = (target: EventTarget | null): boolean => {
    const node = target as HTMLElement | null;
    if (!node || typeof node.closest !== 'function') return true;
    return !node.closest('button, input, select, textarea, a, label');
  };
  topbar.addEventListener('mousedown', (event: MouseEvent) => {
    if (event.button !== 0 || !drag_ok(event.target)) return;
    dragFrom = { x: event.screenX, y: event.screenY };
  });
  document.addEventListener('mousemove', (event: MouseEvent) => {
    if (!dragFrom) return;
    dragStep.x += event.screenX - dragFrom.x;
    dragStep.y += event.screenY - dragFrom.y;
    dragFrom = { x: event.screenX, y: event.screenY };
    if (!dragFrame) dragFrame = requestAnimationFrame(flushDrag);
  });
  document.addEventListener('mouseup', () => {
    if (!dragFrom) return;
    dragFrom = null;
    if (dragFrame) {
      cancelAnimationFrame(dragFrame);
      dragFrame = 0;
    }
    flushDrag();
  });
  topbar.addEventListener('dblclick', (event: MouseEvent) => {
    if (!drag_ok(event.target)) return;
    const api = bridge();
    if (api) void api.toggle_maximize();
  });

  document.addEventListener('click', (event: Event) => {
    if (pop && !pop.contains(event.target as Node) && event.target !== $el('modelChip')) closePop();
    if (openMenu && !openMenu.contains(event.target as Node)) closeMenu();
  });

  document.addEventListener('keydown', (event: KeyboardEvent) => {
    if (modalEscapeGate(event)) return;
    if (event.key === 'Escape') {
      if (pop) { closePop(); return; }
      if (openMenu) { closeMenu(); return; }
      if (settingsOpen) { closeSettings(); return; }
    }
    /* global shortcuts never fire while typing — Ctrl+N used to nuke a
       mid-rename edit, Ctrl+F stole Settings searches, PageUp/Down and
       Ctrl+Home/End hijacked the caret */
    const target = event.target as HTMLElement | null;
    if (target && typeof target.closest === 'function' &&
        target.closest('input, textarea, select, [contenteditable="true"]')) {
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key === ',') {
      event.preventDefault();
      if (settingsOpen) closeSettings();
      else openSettings();
    }
    if ((event.ctrlKey || event.metaKey) && (event.key === 'n' || event.key === 'N')) {
      event.preventDefault();
      ($el('newChat') as HTMLButtonElement).click();
    }
    if ((event.ctrlKey || event.metaKey) && (event.key === 'f' || event.key === 'F')) {
      event.preventDefault();
      $el('app').classList.remove('railoff');
      ($el('chatSearch') as HTMLInputElement).focus();
      ($el('chatSearch') as HTMLInputElement).select();
    }
    if (event.key === 'PageDown') {
      if (scrollThreadBy(($el('thread') as HTMLElement).clientHeight * 0.9)) event.preventDefault();
    }
    if (event.key === 'PageUp') {
      if (scrollThreadBy(-($el('thread') as HTMLElement).clientHeight * 0.9)) event.preventDefault();
    }
    if (event.ctrlKey && event.key === 'Home') {
      ($el('thread') as HTMLElement).scrollTop = 0;
      atBottom = false;
      $el('jumpBtn').hidden = nearBottom();
      event.preventDefault();
    }
    if (event.ctrlKey && event.key === 'End') {
      toBottom(true);
      event.preventDefault();
    }
  });

  ($el('thread') as HTMLElement).addEventListener('click', (event: Event) => {
    const target = event.target as HTMLElement;
    const link = target.closest ? target.closest('a[data-url]') : null;
    if (!link) return;
    event.preventDefault();
    /* data-url went through esc(), so every entity (&amp; &quot; &#39;
       &lt; &gt;) must come back — a textarea decodes them all at once */
    const probe = document.createElement('textarea');
    probe.innerHTML = (link as HTMLAnchorElement).getAttribute('data-url') || '';
    const url = probe.value;
    if (navigator.clipboard) navigator.clipboard.writeText(url).catch(() => {});
    toast('link copied');
  });

  window.addEventListener('resize', () => { closePop(); closeMenu(); });

  /* ───────────────────────── boot ───────────────────────── */

  let bootFailed = false;

  const boot = () => {
    const api = bridge();
    if (!api) {
      setTimeout(boot, 80);
      return;
    }
    api.bootstrap().then((data: BootstrapData) => {
      bootFailed = false;
      models = data.models || [];
      backends = data.backends || [];
      sessions = data.sessions || [];
      applyState(data.state);
      paintDrawer(data.drawer);
      resetThread((data.room && data.room.turns) || []);
      paintSessions();
      paintTitle();
      paintSendButton();
      /* check OpenCode as soon as the engine answers, so the picker starts
         from usable models rather than waiting on a timer */
      probeZen();
      /* the welcome setup runs exactly once, on the first launch */
      if (data.state && (data.state as any).first_run) {
        openSetup();
      } else {
        if (!(data.state && (data.state.state || data.state).locked)) ($el('input') as HTMLInputElement).focus();
      }
    }).catch((error: any) => {
      /* a dead engine must never mean a dead silent shell */
      if (!bootFailed) {
        bootFailed = true;
        toast('could not reach the engine — retrying');
      }
      if (window.console) console.error(error);
      setTimeout(boot, 2000);
    });
  };

  bindScroller($el('thread'));
  bindScroller($el('chats'));
  bindScroller($el('sheetbody'));

  window.addEventListener('pywebviewready', boot);

  boot();
})();

