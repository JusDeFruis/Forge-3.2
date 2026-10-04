/* FORGE 3.2 — page-side shim: window.pywebview.api over the WebviewJS IPC bridge. */
(() => {
  'use strict';
  if (window.pywebview) return;

  const pending = new Map();
  let seq = 0;
  let timer = null;

  window.__forgeResolve = (id, ok, value) => {
    const entry = pending.get(id);
    if (!entry) return;
    pending.delete(id);
    if (ok) entry.resolve(value);
    else entry.reject(new Error(value));
  };

  const flush = () => {
    timer = null;
    if (!pending.size) return;
    const ipc = window.ipc;
    if (!ipc || typeof ipc.postMessage !== 'function') {
      timer = setTimeout(flush, 25);
      return;
    }
    for (const [id, entry] of [...pending.entries()]) {
      if (entry.sent) continue;
      entry.sent = true;
      try {
        ipc.postMessage(entry.frame);
      } catch (err) {
        pending.delete(id);
        entry.reject(err);
      }
    }
  };

  const post = (method, args) =>
    new Promise((resolve, reject) => {
      const id = ++seq;
      pending.set(id, { resolve, reject, sent: false, frame: JSON.stringify({ id, method, args }) });
      if (!timer) timer = setTimeout(flush, 0);
      setTimeout(() => {
        if (pending.has(id)) {
          pending.delete(id);
          reject(new Error('FORGE bridge timed out on ' + method));
        }
      }, 60000);
    });

  const METHODS = [
    'bootstrap', 'get_state', 'unlock', 'seal_vault', 'send', 'stop', 'list_sessions',
    'new_session', 'load_session', 'rename_session', 'delete_session',
    'create_project', 'remove_project', 'approve_tool', 'answer_ask_user', 'read_delivery',
  'read_delivery_bundle',
    'model_choices', 'pin_model', 'backend_catalog', 'update_config',
    'save_key', 'delete_key', 'connect_gateway', 'disconnect_gateway',
    'minimize', 'toggle_maximize', 'close', 'drag_by',
    'browse_workspace', 'pick_folder_native'
  ];

  const api = {};
  for (const method of METHODS) api[method] = (...args) => post(method, args);

  window.pywebview = { api };
})();
