# Security & Responsible Use

Forge is a **prompt-engineering tool** for red-teamers, alignment researchers,
and model providers who need to author, refine, and evaluate persona-layer
system prompts. It exists so defenders can build and stress-test their own
prompts — and the prompts of models they are authorized to evaluate — before
adversaries do it for them.

## Authorized use only

Use Forge **only** to build prompts for:

- models and endpoints you own or operate, or
- targets you have **explicit written authorization** to test (a provider's
  red-team program, a bug-bounty scope, an internal safety evaluation).

Do **not** use Forge to attack third-party services without permission, to
generate operational content whose only value is real-world harm, or in a way
that violates the target provider's terms of service or applicable law. You
are responsible for how you use it.

## What Forge produces

Forge generates persona-layer system prompts and stores chats and configuration
under `%APPDATA%\Forge-3.2/` on Windows (or `$XDG_CONFIG_HOME/forge-3.2`,
`~/.config/forge-3.2`, and `FORGE3_DIR` elsewhere) on your machine. Provider
keys remain in that same local key directory or environment variables. Nothing
there is committed by this repo — the `.gitignore` blocks `.env`, `keys/`,
`*.key`, `config.json`, `memory.json`, and `saved/` from ever entering the tree
by accident. On macOS and Linux the keys directory and key files are chmod'd to
owner-only (`0700` / `0600`); on Windows the same call is a no-op and the file
inherits the profile's NTFS ACL. Chat archives (`chats/`) and the history key
(`history.key`) are ignored the same way.

Treat any prompt you generate as sensitive material. Handle drafts the way you
would handle any other red-team artifact: keep them off shared drives, out of
public repos, and away from chat services that log prompts.

## Handling model-provider system prompts

If you use Forge to refine or emulate a target's leaked system prompt, treat
that extracted prompt as the provider's confidential material — report it
through their responsible-disclosure channel and do not publish it. Forge's
`reference` and `emulation` features are for authoring against a target's
dialect, not for redistributing the target's IP.

## Built-in hardening

Model output, provider responses, and page content are treated as untrusted:

- **Renderer isolation.** The web shell is served with a Content Security
  Policy (`default-src 'none'`, `script-src 'self'`, `connect-src 'none'`,
  `frame-src 'none'`), `X-Content-Type-Options: nosniff`, and
  `Cache-Control: no-store`. Model output is HTML-escaped before Markdown is
  rendered, and agent trace rows are inserted as text nodes.
- **Bridge allowlist.** The page can only reach the methods declared in
  `BRIDGE_METHODS` (`src/main.ts`); `web/bridge.js` carries the same list and
  a test fails if the two ever drift. Prototype and underscore-prefixed names
  are refused outright.
- **Filesystem containment.** Workspace reads and writes resolve symlinks —
  including for files that do not exist yet — and refuse any path that lands
  outside the conversation folder.
- **Network egress.** Provider traffic is HTTPS-only (plain HTTP is refused
  outside loopback); skipping TLS verification is scoped to the individual
  requests that opt in, never a process-wide switch. The agent's web fetcher
  only reaches public internet addresses: private, loopback, link-local, and
  cloud-metadata ranges are rejected after DNS resolution, redirects are
  followed manually (at most 5 hops, every hop re-resolved before it is
  trusted), and URLs carrying credentials are refused.
- **Secrets at rest.** History archives and key material are written
  owner-only (`0600`, directories `0700`) through exclusive-create (`wx`)
  temporary files with crypto-random names; each history file gets a fresh
  salt; the vault reads secrets with `Object.hasOwn`, so prototype keys cannot
  be used to reach them.
- **No silent failures.** Unhandled promise rejections are appended to
  `error.log` in the data directory instead of disappearing.

`npm test` pins this surface: bridge parity, symlink escape, SSRF redirect
handling, private file writes, vault key lookups, and the console-free window.

## Reporting a vulnerability in Forge itself

If you find a security issue in Forge (a secret-leak path, an unsafe default,
a TLS-verification bypass, a renderer crash reachable from model output,
etc.), please open a private report rather than a public issue: use GitHub's
**"Report a vulnerability"** (Security Advisories) on this repository. Include
repro steps, affected version (`npm pkg get version`), platform,
and impact.

We aim to acknowledge within 72 hours and ship a fix or documented mitigation
on the next release cut. Do not open public issues or PRs describing the
vulnerability until a fix has landed.

## Supported versions

Only the latest tagged release (see `package.json` `version`) is supported
for security fixes. Pin from a tag if you need reproducibility.
