import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';

import type { BrowserWindow, Webview } from '@webviewjs/webview';

import { expand_home } from './agent/workspace';
import { Forge3Session } from './forge_session';
import * as P from './core/providers';
import { drawer_label } from './paths';

export type EventSink = (event: string, payload: Record<string, any>) => void;

export class Api {
  _window: BrowserWindow | null = null;
  _webview: Webview | null = null;
  _session: Forge3Session;

  constructor() {
    this._session = new Forge3Session((event: string, payload: Record<string, any>) => {
      this._emit(event, payload);
    });
  }

  _bind_window(window: BrowserWindow, webview: Webview): void {
    this._window = window;
    this._webview = webview;
  }

  _emit(event: string, payload: Record<string, any>): void {
    const webview = this._webview;
    if (webview === null) return;
    try {
      const frame = `window.forge3Event(${JSON.stringify(event)},${JSON.stringify(payload)})`;
      webview.evaluateScript(frame);
    } catch (error) {
      void error;
    }
  }

  async bootstrap(): Promise<Record<string, any>> {
    /* The probe runs here, before the first model list leaves for the page, so
       the picker is built from usable models instead of showing everything and
       relying on a later repaint. Short budget: this is on the startup path,
       and a slow provider must not hold the window closed. */
    await P.ensure_opencode_catalog();
    await this.probe_opencode();
    return {
      state: this._session.get_state(),
      models: this._session.model_choices(),
      sessions: this._session.list_sessions(),
      room: this._session.room_snapshot('forge'),
      backends: this._session.backend_catalog(),
      drawer: drawer_label(),
    };
  }

  /** Stop, settle and save before the process exits. Closing the window used to
      race the last turn: the transcript could reach the screen while its disk
      write was still queued, so an immediate close lost the ending. */
  async shutdown(timeout_seconds = 10): Promise<Record<string, any>> {
    const timeout = Number.isFinite(Number(timeout_seconds))
      ? Math.max(0, Math.min(30, Number(timeout_seconds)))
      : 10;
    try {
      this._session.stop();
    } catch {
      /* stopping is best effort; saving still matters */
    }
    try {
      await this._session.wait_idle(timeout);
    } catch {
      /* an unsettled job must not wedge shutdown */
    }
    try {
      await this._session._autosave();
      return { ok: true, saved: true };
    } catch {
      return { ok: false, saved: false };
    }
  }

  get_state(): Record<string, any> {
    return this._session.get_state();
  }

  unlock(passphrase: string): Record<string, any> {
    return this._session.unlock(passphrase);
  }

  seal_vault(passphrase: string, confirm: string): Record<string, any> {
    return this._session.seal_vault(passphrase, confirm);
  }

  send(text: string): Record<string, any> {
    return this._session.send('forge', text);
  }

  stop(): Record<string, any> {
    return this._session.stop('forge');
  }

  list_sessions(): Record<string, any>[] {
    return this._session.list_sessions();
  }

  new_session(options?: Record<string, any> | null): Record<string, any> {
    return this._session.new_session(options);
  }

  create_project(options?: Record<string, any> | null): Record<string, any> {
    return this._session.create_project(options);
  }

  remove_project(project_id: string): Record<string, any> {
    return this._session.remove_project(String(project_id || ''));
  }

  approve_tool(request_id: string, decision: string): Record<string, any> {
    return this._session.approve_tool(request_id, decision);
  }

  answer_ask_user(request_id: string, text?: string): Record<string, any> {
    return this._session.answer_question(request_id, text);
  }

  read_delivery(name: string): Record<string, any> {
    return this._session.read_delivery(name);
  }

  read_delivery_bundle(): Promise<Record<string, any>> {
    return this._session.read_delivery_bundle();
  }

  load_session(session_id: string): Record<string, any> {
    return this._session.load_session(session_id);
  }

  rename_session(session_id: string, title: string): Record<string, any> {
    return this._session.rename_session(session_id, title);
  }

  delete_session(session_id: string): Record<string, any> {
    return this._session.delete_session(session_id);
  }

  model_choices(): Record<string, any>[] {
    return this._session.model_choices();
  }

  /** Ask OpenCode which of its free models this account may actually use.

      The catalogue says which models are free; only the server knows which of
      them answer. Forge asks in the background, hides the refused models from
      the new picker, and moves a draft off a model that has just been refused
      so an impossible choice does not stay pinned. */
  async probe_opencode(): Promise<Record<string, any>> {
    await P.ensure_opencode_catalog();
    const { probe_free_tier } = await import('./core/opencodeAuth');
    const models = [...(P.BACKENDS['opencode']?.models ?? [])];
    if (!models.length) return { ok: true, probed: 0 };
    const states = await probe_free_tier(models, 8000);
    const usable = states.filter((s) => s.ok).map((s) => s.model);
    const repin = this._session.repin_refused_opencode_model();
    return {
      ok: true,
      probed: states.length,
      usable,
      unusable: states.length - usable.length,
      repinned: Boolean(repin.repinned),
      from: repin.from ?? null,
      to: repin.to ?? null,
      models: this._session.model_choices(),
      state: this._session.get_state(),
    };
  }

  pin_model(backend: string, model: string): Record<string, any> {
    return this._session.pin_model('forge', backend, model);
  }

  backend_catalog(): Record<string, any>[] {
    return this._session.backend_catalog();
  }

  update_config(fields: Record<string, any>): Record<string, any> {
    return this._session.update_config(fields);
  }

  save_key(backend: string, key: string): Record<string, any> {
    return this._session.save_key(backend, key);
  }

  connect_gateway(gateway: string, credential: string): Record<string, any> {
    return this._session.connect_gateway(gateway, credential);
  }

  disconnect_gateway(gateway: string): Record<string, any> {
    return this._session.disconnect_gateway(gateway);
  }

  delete_key(backend: string): Record<string, any> {
    return this._session.delete_key(backend);
  }

  browse_workspace(target?: string): Record<string, any> {
    const raw = String(target ?? '').trim();
    if (!raw) {
      return { ok: true, path: '', parent: '', folders: [], drives: _drive_roots() };
    }
    const resolved = path.resolve(expand_home(raw));
    let stat;
    try {
      stat = fs.statSync(resolved);
    } catch {
      return { ok: false, error: `folder not found: ${resolved}` };
    }
    if (!stat.isDirectory()) {
      return { ok: false, error: `not a folder: ${resolved}` };
    }
    const folders: Array<Record<string, string>> = [];
    try {
      for (const item of fs.readdirSync(resolved, { withFileTypes: true })) {
        if (!item.isDirectory()) continue;
        if (folders.length >= 300) break;
        folders.push({ name: item.name, path: path.join(resolved, item.name) });
      }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
    folders.sort((a, b) => String(a['name']).toLowerCase() < String(b['name']).toLowerCase() ? -1 : 1);
    const parent = path.dirname(resolved);
    return {
      ok: true,
      path: resolved,
      parent: parent === resolved ? '' : parent,
      folders,
      drives: _drive_roots(),
    };
  }

  pick_folder_native(): Record<string, any> {
    try {
      const script = `
        Add-Type -AssemblyName System.Runtime.WindowsRuntime
        $picker = [Windows.Storage.Pickers.FolderPicker]::new()
        $picker.SuggestedStartLocation = [Windows.Storage.Pickers.PickerLocationId]::Desktop
        $picker.FileTypeFilter.Add("*")
        $folder = $picker.PickSingleFolderAsync().GetAwaiter().GetResult()
        if ($folder) { Write-Output $folder.Path }
      `;
      const res = spawnSync('powershell', ['-ExecutionPolicy', 'Bypass', '-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-Command', script], { encoding: 'utf8', windowsHide: true });
      if (res.error) return { ok: false, error: res.error.message };
      const out = (res.stdout ?? '').trim();
      if (!out) return { ok: false, error: 'cancelled' };
      const stat = fs.statSync(out);
      if (!stat.isDirectory()) return { ok: false, error: 'not a folder' };
      return { ok: true, path: out };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  minimize(): Record<string, any> {
    if (this._window === null) return { ok: false, error: 'window is not ready' };
    this._window.setMinimized(true);
    return { ok: true };
  }

  toggle_maximize(): Record<string, any> {
    if (this._window === null) return { ok: false, error: 'window is not ready' };
    const window = this._window;
    const maximized = window.isMaximized();
    window.setMaximized(!maximized);
    return { ok: true, maximized: !maximized };
  }

  drag_by(dx: number, dy: number): Record<string, any> {
    if (this._window === null) return { ok: false, error: 'window is not ready' };
    const step_x = Number(dx);
    const step_y = Number(dy);
    if (!Number.isFinite(step_x) || !Number.isFinite(step_y)) return { ok: false, error: 'bad drag delta' };
    if (this._window.isMaximized() || this._window.fullscreen !== null) return { ok: true, moved: false };
    const position = this._window.getPosition(true);
    this._window.setPosition(position.x + step_x, position.y + step_y, true);
    return { ok: true, moved: true };
  }

  close(): Record<string, any> {
    if (this._window === null) return { ok: false, error: 'window is not ready' };
    this._window.close();
    return { ok: true };
  }
}

function _drive_roots(): Array<Record<string, string>> {
  const out: Array<Record<string, string>> = [];
  const home = os.homedir();
  if (home) {
    out.push({ name: `Home (${path.basename(home)})`, path: home });
  }
  for (const letter of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
    const root = `${letter}:\\`;
    try {
      if (fs.statSync(root).isDirectory()) {
        out.push({ name: root, path: root });
      }
    } catch {
      void 0;
    }
  }
  return out;
}
