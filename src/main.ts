import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { Application } from '@webviewjs/webview';

import { Api } from './bridge';
import { restrictPrivateFile } from './core/secretFiles';
import { default_data_dir } from './paths';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
};

function web_root(): string {
  try {
    if (typeof __dirname === 'string' && __dirname) {
      return path.resolve(__dirname, 'web');
    }
  } catch (error) {
    void error;
  }
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'web');
}

const WEB_ROOT = web_root();

declare const require: ((id: string) => unknown) | undefined;

function sea_get_asset(name: string): Uint8Array<ArrayBuffer> | null {
  try {
    if (typeof require === 'undefined' || typeof require !== 'function') return null;
    const sea = require('node:sea') as {
      isSea?: () => boolean;
      getAsset?: (name: string) => unknown;
    } | null;
    if (!sea || typeof sea.isSea !== 'function' || !sea.isSea()) return null;
    const data = sea.getAsset ? sea.getAsset(name) : null;
    if (data instanceof ArrayBuffer) return new Uint8Array(data);
    if (typeof data === 'string') return new TextEncoder().encode(data);
    return null;
  } catch (error) {
    void error;
    return null;
  }
}

function dev_mode(): boolean {
  if (process.argv.includes('--dev')) return true;
  const flag = (process.env.FORGE3_DEBUG || '').toLowerCase();
  return flag === '1' || flag === 'true' || flag === 'yes';
}

function resolve_shell(): string {
  if (sea_get_asset('web/index.html')) return 'app://localhost/index.html';
  const candidates = [path.join(WEB_ROOT, 'index.html'), path.join(process.cwd(), 'web', 'index.html')];
  for (const html of candidates) {
    if (fs.existsSync(html)) return html;
  }
  throw new Error(`FORGE 3.2 shell not found. Tried: ${candidates.join(' ; ')}`);
}

function error_text(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

/* the only bridge methods the page may call — keep in sync with the
   METHODS list in web/bridge.js (a test enforces the parity). In
   particular this keeps `constructor` and any future Api helper out of
   reach of page content. */
const BRIDGE_METHODS = new Set([
  'bootstrap', 'get_state', 'unlock', 'seal_vault', 'send', 'stop', 'list_sessions',
  'new_session', 'load_session', 'rename_session', 'delete_session',
  'create_project', 'remove_project', 'approve_tool', 'answer_ask_user', 'read_delivery',
  'read_delivery_bundle',
  'model_choices', 'probe_opencode', 'pin_model', 'backend_catalog', 'update_config',
  'save_key', 'delete_key', 'connect_gateway', 'disconnect_gateway',
  'minimize', 'toggle_maximize', 'close', 'drag_by',
  'browse_workspace', 'pick_folder_native',
]);

const APP_CSP =
  "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; " +
  "img-src 'self' data:; font-src 'self'; connect-src 'none'; frame-src 'none'; " +
  "object-src 'none'; base-uri 'none'; form-action 'none'";

function secure_headers(contentType: string): Record<string, string> {
  return {
    'Content-Type': contentType,
    'Content-Security-Policy': APP_CSP,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'no-store',
  };
}

async function serve(request: Request): Promise<Response> {
  const url = new URL(request.url);
  let pathname = url.pathname;
  try {
    pathname = decodeURIComponent(pathname);
  } catch (error) {
    void error;
  }
  if (pathname === '' || pathname === '/') pathname = '/index.html';
  const target = path.resolve(path.join(WEB_ROOT, pathname));
  const inside = target === path.resolve(WEB_ROOT) || target.startsWith(path.resolve(WEB_ROOT) + path.sep);
  if (!inside) {
    return new Response('Forbidden', { status: 403, headers: secure_headers('text/plain; charset=utf-8') });
  }
  const relative = path.relative(WEB_ROOT, target).split(path.sep).join('/');
  const memory = relative && !relative.startsWith('..') ? sea_get_asset('web/' + relative) : null;
  if (memory) {
    return new Response(memory, {
      headers: secure_headers(MIME[path.extname(target).toLowerCase()] || 'application/octet-stream'),
    });
  }
  try {
    const data = await fs.promises.readFile(target);
    const body = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    return new Response(body, {
      headers: secure_headers(MIME[path.extname(target).toLowerCase()] || 'application/octet-stream'),
    });
  } catch (error) {
    void error;
    return new Response(`Not found: ${pathname}`, {
      status: 404,
      headers: secure_headers('text/plain; charset=utf-8'),
    });
  }
}

function ensure_webview_data_dir(): void {
  if (process.env['WEBVIEW2_USER_DATA_FOLDER']) return;
  const local = process.env['LOCALAPPDATA'];
  const dir = local ? path.join(local, 'Forge-3.2', 'WebView2') : path.join(default_data_dir(), 'WebView2');
  process.env['WEBVIEW2_USER_DATA_FOLDER'] = dir;
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch (error) {
    void error;
  }
}

function main(): void {
  const dev = dev_mode();
  resolve_shell();

  const api = new Api();
  const app = new Application();
  const win = app.createBrowserWindow({
    title: 'FORGE 3.2',
    width: 1180,
    height: 780,
    logical: true,
    decorations: false,
    windowsUndecoratedShadow: true,
  });
  win.setMinSize(860, 560, true);
  win.registerProtocol('app', (request: Request) => serve(request));

  ensure_webview_data_dir();
  const webview = win.createWebview({ url: 'app://localhost/index.html', enableDevtools: dev });
  api._bind_window(win, webview);

  const resolve_frame = (id: number, ok: boolean, value: unknown): void => {
    let payload: string;
    try {
      payload = JSON.stringify(value === undefined ? null : value);
    } catch (error) {
      payload = JSON.stringify({ ok: false, error: error_text(error) });
      ok = false;
    }
    try {
      webview.evaluateScript(`window.__forgeResolve(${JSON.stringify(id)},${ok ? 'true' : 'false'},${payload})`);
    } catch (error) {
      void error;
    }
  };

  webview.onIpcMessage((message) => {
    let frame: any;
    try {
      frame = JSON.parse(message.body.toString('utf8'));
    } catch (error) {
      void error;
      return;
    }
    if (!frame || typeof frame.id !== 'number') return;
    const id: number = frame.id;
    const method = typeof frame.method === 'string' ? frame.method : '';
    const args: any[] = Array.isArray(frame.args) ? frame.args : [];
    const target = method && BRIDGE_METHODS.has(method) ? (api as any)[method] : undefined;
    if (typeof target !== 'function') {
      resolve_frame(id, false, `unknown bridge method: ${method}`);
      return;
    }
    Promise.resolve()
      .then(() => target.apply(api, args))
      .then(
        (value: unknown) => resolve_frame(id, true, value),
        (error: unknown) => resolve_frame(id, false, error_text(error)),
      );
  });

  /* The native window can disappear before an async turn finishes flushing.
     Cancel the close synchronously, settle and save with the live session, and
     only then let the process go. Creating a second Api here would save the
     wrong session. */
  let closing = false;
  const shutdown = (): void => {
    if (closing) return;
    closing = true;
    void api.shutdown(10).finally(() => {
      try {
        app.exit();
      } catch {
        /* exiting is best effort once history has been flushed */
      }
    });
  };
  win.on('close', (event) => {
    event.preventDefault();
    shutdown();
  });

  app.on('application-close-requested', () => {
    shutdown();
  });

  if (!dev) {
    process.on('unhandledRejection', (reason) => {
      const detail = reason instanceof Error ? reason.stack || reason.message : String(reason);
      try {
        console.error('forge: unhandled rejection', detail);
      } catch {
        /* never throw from inside the handler */
      }
      try {
        fs.mkdirSync(default_data_dir(), { recursive: true });
        const log = path.join(default_data_dir(), 'error.log');
        fs.appendFileSync(log, `${new Date().toISOString()} unhandled rejection: ${detail}\n`);
        /* the log can carry provider error detail, so it stays owner-only */
        restrictPrivateFile(log);
      } catch {
        /* best effort — the app keeps running */
      }
    });
  }

  app.run();
}

main();
