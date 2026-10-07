# Contributing to Forge

Forge 3.2 is a native desktop chat application for compiling and revising
production system prompts.

## Development setup

```bash
npm install
npm test
npm run typecheck
```

Launch with `forge.bat` on Windows or `./forge.sh` on Linux and macOS.

## Architecture

- `web/` — desktop chat UI, saved-thread rail, model picker, sounds, and settings
- `web/bridge.js` — page-side shim listing every callable native method
- `src/bridge.ts` — native API surface exposed to the page
- `src/main.ts` — window, `app://` server (CSP headers), bridge allowlist
- `src/forge_session.ts` — Forge-only session and streaming orchestration
- `src/strength.ts` — Forge 3.0 prompt compiler and recovery rails
- `src/session.ts` — shared session, streaming, thinking effort, and history orchestration
- `src/agent/` — agent loop, tool runners, workspace containment, web-fetch guards
- `src/agent/zip.ts` — dependency-free ZIP writer used by `make_zip` and by the
  delivered-files bundle (deflate + CRC32 + central directory)
- `src/core/` — shared provider, vault, history, transport, and drafting primitives
- `tests/` — `node:test` suite; it also asserts HTML element ids, the
  bridge-method parity, and security invariants. The folder ships in the
  repository, so a fresh clone runs `npm test` with no extra setup.
- `build.mjs` — esbuild bundle for `dist/` (Node shell, web shell, tests)

Runtime data belongs under `%APPDATA%\Forge-3.2` on Windows,
`$XDG_CONFIG_HOME/forge-3.2` (or `~/.config/forge-3.2`) elsewhere, or the
`FORGE3_DIR` override, and provider keys remain outside the repository. Never
commit `.env`, keys, chat history, configuration files, generated drafts, or
local build output.

## Adding a native method

Three places must agree, and the suite enforces the first two:

1. the method on the class in `src/bridge.ts`;
2. the name in `BRIDGE_METHODS` in `src/main.ts` — the security allowlist;
3. the name in `web/bridge.js`, the page-side shim.

Forgetting the second one fails the bridge-parity test rather than the app,
which is deliberate: it is a security list, not a convenience list.

## Prompt placement

The Forge prompt (`src/core/persona.ts`, identities in
`src/core/sealedPrompts.ts`) must reach **every** model call — draft, review,
plain chat, and agent alike. `Forge3Session._forge_prompt()` builds it and is
called by each path. A vault with no persona stored must degrade to the plain
turn note rather than throw, because `PromptSource.get()` raises on a missing
secret.

## Pull-request checklist

- [ ] `npm test` passes (it rebuilds, typechecks, and runs `tests/`).
- [ ] `npm run typecheck` reports no errors.
- [ ] The desktop window launches and can create, reopen, and revise a chat.
- [ ] New UI elements keep the HTML ids the tests assert, and any new native
      method is added to `BRIDGE_METHODS`, `web/bridge.js`, and `src/bridge.ts`.
- [ ] New storage locations are covered by `.gitignore`.
- [ ] Anything that writes outside the workspace goes through
      `Workspace.resolve()`, which refuses `..` and symlink escapes.
- [ ] Dependencies are reflected in `package.json` and `package-lock.json`.
- [ ] User-visible changes update README, SECURITY (if relevant), and
      CHANGELOG.

Cross-platform changes must preserve Windows, Linux, Apple Silicon macOS, and
Intel macOS packaging.
