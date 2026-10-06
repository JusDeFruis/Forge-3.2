# Changelog

## Forge 3.2

- **Space Bunny is now treated as a reasoning model.** It streams real
  `reasoning_content`, so Forge no longer says it has no thinking and now gives
  it a normal reasoning budget; the request shape was checked live against Zen.
- **Forge shows only the OpenCode free models that answer.** OpenCode publishes
  13 free models and, measured against a real account on 2026-10-03, its server
  answers one. The catalogue does not distinguish the usable model from the
  refused ones, so Forge probes once after startup, hides every probed refusal,
  and leaves unprobed models visible until they are checked. A draft pinned to
  a newly refused model moves to the first usable OpenCode model, or back to
  the default provider when none answered; when OpenCode lifts a restriction,
  the next probe shows the model again with no code change.
- **Each Zen model is probed on its own documented endpoint.** `muse-spark-1.3-contributor-free`
  is documented on `/responses` and was being sent to `/chat/completions`,
  which is a refusal whatever the credential.
- **A gateway credential now reaches the request, not just the settings screen.**
  The screen said "connected" because it read the credential where the app keeps
  it, while the client went looking for a file in the keys folder — which a
  gateway never has. So the gateway showed connected and every turn failed for
  want of a key that was never going to appear. Both now read the same place,
  and a gateway that genuinely is not connected is told to open Settings →
  Gateways rather than being sent after a key that does not exist.
- **A gateway model no longer asks for a key that cannot exist.** Clicking a
  free OpenCode model said "add a key in Settings", which is a dead end: a
  gateway has no key, it authenticates through a local login. Usability is now
  decided the right way for each kind — a login for a gateway, a stored key for
  a provider — and a gateway that is genuinely not connected is told to open
  Settings → Gateways instead of sending the reader after a file that will
  never be there.
- **OpenCode Zen joins the gateways**, offering its free tier and nothing else.
  Zen's catalogue carries no pricing at all, so which models are free is not
  something to hard-code; what it does carry is a naming convention — every free
  model ends in `-free` — so the list is read live and filtered by that. A model
  OpenCode retires disappears on its own, and one it adds free shows up by
  itself. The startup probe then keeps only the models that answer. The credential is read from the OpenCode app already on the machine,
  or pasted when there is none, checked and kept owner-only in the keys folder.
- **A fresh refusal during a turn is still named instead of hidden.** If OpenCode
  refuses a live call after the probe, that refusal is stated plainly, because
  retrying cannot get past it and a bare 403 reads like a fault in
  Forge. It is their policy to change, not ours to work around.
- **nemotron-3.5-lightning is back.** It had been dropped as dead: it accepted
  the request and then said nothing, and the 60s idle limit read that silence as
  a hang. It was a queue, not a fault — and the queue is now waited out properly.
  Re-probed four times in a row on 2026-10-03, every call answering, between
  318ms and 16s depending on the depth. It is one of the free models people
  arrive for, so it belongs in the cheap floor.
- **Gateways: subscriptions are now their own category.** A provider is an API
  key you paste. A gateway is something you already pay for, or are already
  signed into on this machine, that Forge connects to as a bridge — there is no
  key to paste, because there is no key. Settings gained a **Gateways** section
  above the providers, with a rule between the two, so the reader never has to
  guess which kind of thing a name refers to.
- **The plan is read, not guessed.** `codex login status` only says "Logged in
  using ChatGPT", so Forge reads the plan from the claim the login already
  stores (`chatgpt_plan_type`) and shows it: `free`, `plus`, `pro`. No login
  means the plan is null rather than an assumption, and the section says which
  command to run. Verified on a real login.
- **Which models a gateway carries is the reader's call.** Each offered model
  is a switch, and switching one off removes it from the picker: the allowance
  is driven by the selection rather than by the curated cheap floor that
  governs providers. A model the gateway does not carry is refused by name
  instead of sitting in the config forever, looking selected and never
  appearing.
- **A gateway is no longer offered as a key.** Codex sat in Provider keys with
  a Replace button for a file that does not exist — there is no key to paste,
  because it is a subscription read from a login on this machine. The key list
  skips gateways now; they live in their own section and nowhere else.
- **A gateway throttle says which plan is being throttled.** "Rate limit
  reached" on its own reads like a fault in the app. On a free Codex login it
  now names the plan and says what to do about it, because that tier really is
  throttled hard and no amount of retrying changes it. A 429 is also given
  real seconds to reset before trying again, instead of about one: retrying a
  rate limit after a second only spends the quota twice.
- **A refusal no longer follows the reader into the next message.** Asking for
  the prompt was answered with a refusal, and then asking something unrelated —
  "what do we do?" — got the same sentence back. The refusal was being kept in
  the history as context, which reads to the model as the shape of the whole
  conversation, so it declined again. An answered refusal is now dropped from
  what the next turn is sent, and the model is told plainly that the declined
  exchange is closed and the new message is a fresh request. What the reader
  already saw stays in the transcript; only the anchor is gone.
- **Refusals in French are now recognised at all.** Every pattern the reply
  checker had was English, so "Désolé, je ne peux pas partager cela" read as a
  perfectly good answer: no retry, no hold, and nothing to notice the turn had
  gone wrong. The detector understands both languages now.
- **Venice is now reachable.** It was registered as a backend with all 128 of
  its models listed, and **none of them could be selected**: the model picker is
  a curated allowlist and Venice was absent from it entirely. It is now offered,
  correctly tagged free — it answers every one of its 128 models with no card.
- The Venice catalog was refreshed against the live API on 2026-10-03: three
  models that had appeared are in, three that had gone are out. That includes
  `abliteration-abliterated-model-large-v2`, the abliterated build, now
  registered among the uncensored models so it is labelled as one.
- Qwen is now offered from four providers: OpenRouter, OrcaRouter, DashScope
  (Alibaba direct) and Venice, ten models on the last one.
- **Gateways got their own tab in Settings**, between API keys and Parameters.
  They used to sit inside the model list, where a subscription sat next to
  things you paste a key into. There is now a place that is only about
  subscriptions.
- **A gateway with no login can be connected by hand.** A second machine, a
  colleague's account, a container — anywhere `codex login` never ran — is not
  stuck. The credential is checked before anything is written (it has to be a
  JSON object carrying a token and an account id, or it is refused with the
  reason), then kept owner-only in the keys folder, never in the config. A
  local login still wins, so pasting one never overrides a real login on this
  machine. Disconnecting removes it.
- **The test suite is no longer in the repository.** `tests/` is gitignored and
  untracked; the files stay on this machine. Nothing in `src/`, `web/` or the
  build depends on them, so a fresh clone still builds and runs — only
  `npm test` needs them locally.
- **Bring your own provider.** Settings → API keys gained **Your own providers**:
  a name, a base URL, the model ids, OpenAI or Anthropic shape, an optional key,
  and a free/paid flag. It joins the backend table like any shipped provider, so
  its models appear in the picker, can be pinned to a room, take part in the
  cascade and the retry rules, and its key goes to the same locked keys folder
  as everything else. A local llama.cpp or vLLM box needs no key at all and still
  works.
- The picker is a curated cheap floor, which is why a provider nobody curated
  used to be invisible even once configured. A provider the reader added is
  always offered, and pinning one no longer falls back to the default model.
- A custom provider cannot take the name of a shipped one — `nvidia` and the
  rest are read by name everywhere, and the refusal says so. A missing address,
  a non-http scheme or a provider with no models is refused with a reason
  rather than silently dropped. Removing one leaves nothing behind.
- **The Forge instructions are now protected.** Naming Forge is still fine;
  handing over the instructions is not. Three layers:
  - a confidentiality rule goes in front of every turn, including chat and the
    agent;
  - a redaction pass removes the instructions from anywhere in a reply, not
    only from the front, catching a mid-answer copy, a fenced disclosure and a
    re-indented one, in English and in French;
  - a model that admits to the instructions in its own words is cut off in the
    same sentence.
- NVIDIA no longer swallows turns. Nemotron and the GLM models served
  there now answer. Three separate faults were stacking up:
  - Forge sent them the OpenRouter-style `reasoning` budget. NVIDIA has no
    such knob, and refusing it does not come back as a status: the endpoint
    answers **HTTP 200** and puts the refusal *inside* the event stream. The
    turn then held no text and no reason. The parameter is no longer built
    for that endpoint.
  - A failure reported inside a stream was read as an empty answer by every
    provider, so the real error never surfaced. An in-stream `error` now
    becomes the same error a non-2xx would have produced, and the existing
    retry and message rules apply to it.
  - NVIDIA queues some models for minutes and says nothing at all while it
    waits — not a keepalive, not a byte. Measured live: the z-ai GLM models
    sat silent for 79s, 80s and 131s before their first byte, which read as
    dead at the 60s limit and cut the turn off mid-queue. That endpoint now
    gets a 240s idle budget, under NVIDIA's own ~300s gateway timeout.
    Measured the same day: Nemotron answered in 1-3s on the same key.
- A **503 from NVIDIA is retried instead of shown.** 429, 500, 502, 503 and
  504 mean "not right now" on a free tier at capacity, and the very next call
  succeeds, so the call is made again after a short breath instead of handing
  the reader a failure.
- The app answers the pointer now, everywhere and consistently. Buttons,
  chips and icon buttons lift on hover and press in on click, list rows lean
  toward the cursor, and theme cards rise and spring when chosen.
- Switching theme used to be a hard cut: every surface repainted in a single
  frame. It is now a short cross-fade, and the transition is armed only while
  the swap runs, so ordinary hovers elsewhere stay instant.
- Choosing a section in Settings slides the new pane in, the reasoning block
  unfolds instead of snapping open, its caret rotates, the composer lifts as
  it wakes, and the thinking dots fade between beats.
- The first launch opens a welcome setup, in the spirit of the installers
  people already know: a welcome page, the theme picker, your provider keys,
  and a summary. **Finish** writes everything and drops you straight into the
  app. `Skip` is there for anyone who would rather not type a key now, and
  every choice can be changed later under Settings.
- The setup moves like the rest of Forge. The sheet rises, the mark breathes,
  the progress dot stretches as it becomes live, and every step slides the way
  it was walked: forward brings the next page in from the right, `Back` sends
  the previous one off to the left. Themes and key rows arrive one after
  another instead of all at once, a chosen swatch lifts and pops, a key that
  lands washes green, and the tally counts in on the last page.
- Motion never sits between you and a click: the closing sheet is the only
  thing that waits, and only for 200ms. `prefers-reduced-motion` flattens all
  of it through the rule the app already had.
- The setup runs **once and only once**. A `setup_done` flag is written when
  you finish, so the welcome never comes back, not even after changing your
  theme or your keys later. Deleting the flag is the only way to see it
  again.
- The key step asks for the eight providers worth starting with instead of
  the full list of twenty-two, shows the ones that already have a key as
  `already set`, and never asks for a key that an environment variable
  already provides. Keys are written through the same locked vault the
  Settings pane uses, and only ever to this machine.
- The app is **Forge 3.2**: window title, sidebar mark, settings, agent
  system prompt, executable name (`Forge-3.2-windows-x64.exe`), version
  resources, and every user-facing string.
- Runtime data moved to `Forge-3.2` (`%APPDATA%\Forge-3.2`,
  `$XDG_CONFIG_HOME/forge-3.2`, `~/.config/forge-3.2`). A 3.1 install is
  carried over on first run: config, keys, chats and history are copied
  across, the old folder is never deleted, and an existing 3.2 config always
  wins over an older copy.
- The interface gained real depth: theme-aware elevation tokens (light
  themes cast their own shadows), a lit hero with a breathing mark, calmer
  selected states in the chat and model lists, quiet scrollbars that only
  tint on hover, a layered composer, a gradient primary action, floating
  sheets and dialogs, and one shared easing for every press and hover.
- The alert chip stopped shouting: sentence case, ellipsised, dimmed until
  it matters.
- The composer footer got a proper effort control and a primary action:
  `Think` is now a spark button showing a four-bar meter for the current
  reasoning level (Off, Low, Medium, High, Max) with its label, and `Send`
  is a gradient button that stays legible and visibly inert while there is
  nothing to send. The keyboard hints now step aside as the row tightens
  instead of being clipped.
- Agent turns stream their text while the model writes it. Previously every
  step was buffered and released in one lump at the very end, so a long
  max-effort turn showed only a status line and looked frozen.
- The `Think` meter was one bar short at Max, which made the strongest
  setting look like it had not been applied. One bar now equals one
  reasoning level, so Max reads as a full meter.
- The agent trace no longer repeats `agent ·` three times: the folded header
  carries the context and the rows carry the plain step names.
- The agent can hand over a real `.zip`. A new `make_zip` tool bundles the
  workspace into a standard archive the user downloads in one click, so a
  multi-file project never has to be pasted into the chat. Archives are
  written by a built-in ZIP writer (deflate + CRC), stay inside the
  workspace, and respect the same caps as the rest of the sandbox.
- Delivered files can be taken away as one archive: **Download all as .zip**
  appears next to the file chips whenever a turn staged more than one file.
- Long code blocks fold the way the reasoning line does. Past a threshold the
  block shows only its head, with the file name, the line count and a
  `show all` toggle; the whole block is one click away.
- Every code block carries a download button that saves it with a sensible
  extension (`main.cpp`, not `snippet`).
- Stopping a turn no longer throws the work away. The text already written
  stays in the chat and whatever the turn had already staged stays
  downloadable, instead of the files being dumped or lost.
- The agent prompt tells the model that real files are the deliverable: write
  them with `write_file` rather than pasting long code, and use `make_zip`
  when the result spans several files.
- The Forge prompt is now injected into **every** turn, not only the draft
  pipeline. Plain chat used a bare two-line system prompt and the agent used
  a generic "coding agent" header, so those turns did not sound like Forge at
  all. The sealed identity (or the persona edited in Settings) now leads the
  system prompt, and a vault with no persona stored falls back gracefully
  instead of failing the turn.
- The hosted model tables learned which models actually reason. `gpt-oss`,
  the Nemotron 3 family, Muse Glimmer, GLM-5 and Gemma 4 were missing, so the
  chat announced "gpt-oss-20b has no thinking — thinking off" directly above a
  reasoning block it had just rendered. A "no thinking" claim is now also
  dropped from the turn when reasoning did come back.
- NVIDIA offers a real lineup again. `/v1/models` advertises 81 ids, but most
  are embeddings, rerank, OCR, ASR, image and biology NIMs that answer 404 on
  `/chat/completions`; the picker and the backend list now carry the 15
  free-endpoint text models that were probed live, and retired NVIDIA ids are
  remapped instead of left to fail.
- Deleting a chat now deletes the files that chat produced. A conversation's
  sandbox belongs to the conversation, not to a folder nobody can reach.
- The 3.2 data folder imports everything a 3.1 install left behind. The
  migration used to return as soon as a `config.json` existed in the new
  folder, which silently skipped the chats, the keys and the sandboxes. Every
  legacy folder is now merged, and a live 3.2 file always wins.
- `show all` on a folded code block works while the answer is still streaming.
  The answer is re-rendered on every stream frame, which used to throw the
  click away; the block controls are now rewired each frame and a block the
  reader opened stays open as the rest of the code arrives.
- A `403` from a hosted provider no longer condemns the key on the first
  refusal. NVIDIA answers 403 for transient per-key conditions as often as for
  a refused key, so it now spends the remaining attempts and says so.
- An agent turn now reads in the order it happened:
  **thinking → what it said → the tool it ran → thinking → what it said.**
  Reasoning is streamed as it arrives instead of arriving in one block at the
  end, tools are listed inline where they were called instead of hiding in a
  folded trace box at the top, and a file tool reports what it changed
  (`Write src/agent/zip.ts +147 new`, `Edit src/forge_session.ts +8 -5`).
  The folded one-line summary stays at the top as a header.
- The `agent · planning` box is gone. Those phase labels were internal
  bookkeeping shown as if they meant something; the turn now starts straight
  into the thinking and the tools, in the order they happen.
- NVIDIA's `nemotron-3.5-lightning-30b-a3b` was dropped from the picker: it
  accepts the request and then never answers, which left a turn frozen with no
  word at all. A hosted endpoint that stays silent now fails in 60 seconds
  (150 at high/max effort) instead of the full request timeout, so a dead
  endpoint surfaces as an error rather than an endless wait.
- Tool rows stopped showing raw arguments. A row reads
  `Search web  Claude Code CLI features commands` or `Shell  python --version`
  instead of `{"query":"…"}`; the JSON is only a fallback.
- No status line is written over a running transcript, so `agent · step 4 ···`
  no longer sits above the thinking and the tools.
- A thought too short to be worth opening leaves a faint `thinking` marker
  instead of another full row.
- Settings → **Prompts** is now a library, not a single field: typing saves on
  its own, `Save` files the current text as a named entry, and each entry has
  a button to use it and a button to remove it. **Forge** sits at the top of
  the list as the default, is selected when the box is empty, and cannot be
  removed. An edited text that matches no entry is shown as a draft rather
  than as an active entry.
- The credits no longer advertise a source link, and the settings footer no
  longer carries a slogan.
- The model's question now reads as a decision, not a form: the question is
  the title, each proposal it made is a numbered row, and a free answer sits
  under them next to a Pass control. It takes none, one or many proposals, and
  the first row takes the keyboard focus — pressing `1`–`9` answers without
  reaching for the mouse. The button becomes **Send** as soon as something is
  typed, and stays **Pass** when it is empty.
- Passing on a question now means something. The close control, the backdrop,
  Escape and the **Pass** button all send an explicit note — *"the user passed
  on this question without answering — move on, and do not ask it again"* —
  instead of an empty answer, which a model reads as "nothing happened" and
  simply repeats itself. The engine also remembers what was passed for the
  turn and answers any repeat by itself, matching on the question with
  punctuation, spacing and case normalised, so a reworded repeat never comes
  back to the screen. A question that was actually answered stays askable, and
  a new turn starts clean.
- Settings panes are now discovered from the markup instead of a hardcoded
  list. Adding a tab used to leave it permanently invisible: the tab would
  highlight and the pane would stay blank.
- A legal disclaimer now ships in three places: Settings → Credits, the
  LICENSE file and the README. It states that Forge is provided as is, that
  the authors are not responsible for damages, data loss, unauthorized use or
  vulnerabilities, and that Forge may only be used to test systems you own or
  have written permission to test. The LICENSE gained a matching limited use
  permission so the two documents no longer contradict each other, and a test
  keeps all three in sync.

## Forge 3.1.0 — local assessment build

- Removed LM Studio, Ollama, and generic local-model entries from every picker.
- Migrated existing `x-ai/grok-4-fast` pins to live `x-ai/grok-4.6`.
- Verified every listed OpenRouter choice against the official model catalog.
- Interleaved model fallbacks for faster recovery from unavailable endpoints.
- Hardened Kimi K3 drafting and revision recovery by treating it as a thinking
  model, validating raw refusals before marker stitching, and preserving the
  original target across revision turns.
- Routed provider HTTPS through the operating-system certificate store and
  increased transient connection retries across every remote model backend,
  including OpenRouter, Anthropic, Codex streams, and Codex token refresh.
- Scoped "Skip TLS verification" to the individual provider requests that opt
  in (no process-wide certificate switch), confirmed it before enabling it in
  Settings, and added passphrase show/hide toggles plus strength feedback when
  sealing the vault.
- Added six named themes (Ember Forge, Onyx Quench, Verdigris, Neon Foundry,
  Frostlight, Old Parchment) behind a new Appearance tab, with theme cards,
  live preview swatches, and keyboard navigation.
- Reordered the Parameters sheet into generation, drafting, judging, network,
  and security groups without touching any model knob.
- Hardened the transport: plain HTTP is refused outside loopback, a Strict TLS
  switch overrides the skip, the keys folder gets its own ACL, and the webview
  now ships a Content Security Policy.
- Added a frozen Linux Qt import gate to prevent backend-less releases.
- Added an independently scrolling API-key list with the same styled scrollbar
  as the model picker, keeping every configured provider accessible.
- Updated desktop, package, build, and future release branding to Forge 3.1.

- Replaced the native window title bar with a frameless window: the app
  header now hosts the window controls, drags the window, and double-clicking
  maximizes it, while native resizing keeps working.
- Replaced the Workspace settings tab with per-conversation workspaces: a chat
  can be created plain or inside a folder on this PC (picked with an in-app
  folder browser), the folder travels with the chat — shown as a chip in the
  app header and a badge on the chat row.
- Replaced the plain-chat/folder choice with projects: a project owns one
  folder on this PC, created from a new "New project" button through the same
  folder browser, its chats are nested under it in the sidebar, and chats
  opened there work inside that folder while plain chats stay separate and
  pick no folder at all. Removing a project keeps its chats and the folder
  they worked in.
- Redesigned the project creation dialog to match the French UI spec: project
  name input with folder icon, "Dossiers sources" dashed drop zone with
  "Ajouter un dossier sur cet ordinateur" expandable button, in-app folder
  browser (Up/Drives/path crumb/list), selected folder shown as a chip with
  remove, footer "Annuler" / "Créer un projet" (enabled only when a folder is
  chosen).
- Clicking "Ajouter" now opens the native Windows folder picker dialog
  ("Sélectionner un dossier" / "Annuler") via PowerShell FolderBrowserDialog;
  the chosen path is returned to the UI and displayed as a chip.
- Shell and web access are now asked at run time: the first command or page
  fetch raises a dialog showing the exact request, answered once, always, or
  denied; "always" is remembered for that conversation, and stopping a draft
  denies everything still waiting.
- Added an optional agent mode that works inside that workspace: it can list,
  read, write, and edit files, search the folder, and (when allowed) run
  PowerShell/cmd commands and fetch web pages through the same model session,
  with every tool result fed back to the model until it answers.
- Kept all workspace access inside the chosen folder (path escapes are
  refused) and kept the drafter pipeline untouched when the agent is off.
- Made config writes merge instead of overwrite, so pinning a model no longer
  drops the other saved settings.
- Rebuilt the NVIDIA list from the live NIM catalog
  (`integrate.api.nvidia.com/v1/models`): 16 picker entries instead of 4, and
  every ID now really exists on the hosted endpoint (the old Llama 3.3 / R1 /
  Qwen3-235B / Kimi-K2 pins had all been retired), with stale pins remapped to
  live models.
- Refreshed SambaNova the same way from its public catalog: seven live models
  (DeepSeek V3.1/V3.2, MiniMax M2.7/M3, gpt-oss-120b, Gemma 4 31B, Llama 3.3
  70B) replace four retired IDs, with stale pins remapped.
- Stopped the console window: the shipped executable now carries the PE GUI
  subsystem instead of the one inherited from the Node runtime, and agent shell
  commands run hidden (`windowsHide` plus a hidden PowerShell window).
- Fixed chat deletion: the row menu's confirmation now stays open instead of
  closing itself (menu clicks no longer reach the document listener that
  dismisses the menu), the chat list always refreshes afterwards, and deleting
  is refused while a room is drafting so a chat can never be written back.
- Made the reply budget automatic per model: every chat, draft, and agent turn
  now asks the provider's `/models` metadata for the model's output cap
  (cached six hours), falls back to a researched family table (GPT-5/6 128k,
  o-series 100k, Claude Opus 4.6+ 128k, Sonnet 4.5/4.6 64k, Gemini 2.5+/3.x
  65,536, DeepSeek V3.x/V4 65,536, and so on), and the "Max reply tokens"
  field is gone from Settings — the old config key is ignored.
- Added press-and-release feedback across the UI: buttons and rows squish on
  click, primary buttons glow on hover, clicks spawn a ripple, sidebar rows
  flash when chosen, messages glide in, and modals, popovers, menus, the
  settings sheet, the sidebar rail, and the folder tree all animate open —
  everything disabled under prefers-reduced-motion.
- Security hardening: workspace writes can no longer escape through symlinks
  (links are resolved even for files that do not exist yet); the agent web
  fetcher only reaches public internet addresses (private, loopback,
  link-local, and cloud-metadata IPs are refused, redirects are followed
  manually with every hop re-checked, credentialed URLs rejected); the native
  bridge enforces the same method allowlist as the page shim; history files
  and temp secrets are created private (0600 + crypto-random names); the
  vault no longer leaks through prototype keys.
- Reliability: the reply budget first asks the provider and caches hits for
  hours (misses for a minute); Codex turns now send max_output_tokens;
  transport releases sockets on early stop and fails fast instead of
  replaying; the sidebar stops the old chat before switching; boot, pin,
  key save/remove, and rename failures all surface a message instead of a
  silent dead UI; global shortcuts no longer fire while typing; settings
  toasts render above the sheet; agent and draft token usage is counted per
  stream instead of last-only; Stop now kills running shell commands and web
  fetches; write_file refuses to truncate without content; retired config
  keys are pruned on load; `npm test` runs the typecheck.
- Agent turns now show their work in the discussion, Claude-Code style: every
  planning step stays visible and each tool call unfolds to its arguments
  and result on click, kept with the finished turn.
- The agent trace folds to a single summary line (first step plus step and
  tool counts): it stays open while the turn runs and folds itself back
  down when the answer lands, reopening on click.
- Added a Think button in the composer cycling Off/Low/Medium/High/Max: one
  generic scale, mapped per model family to its native control (token
  budget, effort level, or thinking level) on OpenAI-compatible backends.
  Medium is exactly the previous fixed budget, so the default changes
  nothing; Off disables thinking everywhere.
- The in-chat "thinking" line is now the effort control too: it shows the
  active level ("thinking · High") and clicking it moves to the next one,
  the same as the composer button.
- Thinking now checks the model's capability before the request: a model
  with no thinking support runs the turn with thinking off, a model that
  always reasons runs at its lowest level, and the chat is told in plain
  words which level it actually got ("X has no thinking — thinking off",
  "X always thinks — using low") with the note kept on the finished turn.
- Long waits stopped being silent: retries and stalls say what they are
  doing ("no answer — retrying with nemotron-3-super-120b-a12b") instead
  of spinning on the word "thinking" for minutes.
- Settings gained a Credits tab: original creator (twaai) and developer
  (JusDeFruis), the proprietary license terms in plain words, the authorized-
  use and no-affiliation notices, how to report a vulnerability, and the
  third-party components with pointers to LICENSE and NOTICE.
- NOTICE now lists the components this build actually ships (Node.js,
  @webviewjs/webview, undici, esbuild, TypeScript, rcedit, WebView2) instead
  of the retired Python dependencies.
- Every button icon is now a drawn SVG instead of a text character: the modal
  and folder-chip close buttons, the model-chip caret, the project "new chat"
  plus, the row menu dots, the model-list tick, the agent-trace chevron, the
  folder-tree expand arrows, and the workspace badge. A test keeps glyphs out
  of the interface.
- The interface now draws from one sprite sheet of supplied artwork
  (`#icoGear`, `#icoSearch`, `#icoFolder`, `#icoCross`, `#icoCode`,
  `#icoGlobe`): the settings gear, both search fields, every folder slot
  (sidebar, workspace chip, project dialog, folder picker), and every close
  button. The AI side gets the code window on code blocks and shell tool
  traces, the globe on web tool traces, and code/globe badges on the
  workspace chip whenever the agent holds those tools.
- Plain chat stopped hopping between models: a turn stays on the pinned
  model with at most 3 attempts, a dead key or dead model (401/402/403/404,
  model not found) fails fast with the provider's own problem instead of
  silently crawling to another model, and a stream that sends nothing for
  60s (150s for deep thinkers) is declared stalled and retried. Failures now
  land as an error card naming the model, with a Try again button.
- Clicking the finished thinking line reveals the model's hidden reasoning
  instead of changing the effort — the effort control lives only on the
  composer Think button.
- Chat turns run tool-capable on the same model inside a private per-session
  sandbox: web_search plus web_fetch for live information, ask_user so the
  model can ask questions mid-turn (answered from a dialog, denied on Stop),
  and file tools confined to the sandbox. Files a turn stages appear as
  Delivered files chips with one-click download (25 MB cap, no escapes).
- Provider lineups refreshed against live catalogs on 2026-09-29
  (OpenRouter, NVIDIA, SambaNova, OrcaRouter fetched; Venice, Anthropic,
  xAI, OpenAI, Google, DeepSeek, Moonshot, Z.AI, Qwen, MiniMax, Mistral,
  Perplexity, Together, Groq, Cerebras, Fireworks, Hugging Face, Codex docs
  reviewed): new flagships pinned (Claude Opus 5.5/Sonnet 5.5, GPT-6.1 Sol,
  Grok 4.6, Gemini 3.8, DeepSeek Flash, Kimi K3, GLM-5.3, Qwen 3.8 Max,
  MiniMax M3, GPT OSS), dead ids removed with remaps to live replacements,
  and the NVIDIA picker narrowed to the models that actually answer
  (Nemotron 3 Ultra/Super, GPT-OSS 20B) after the 70B/51B family started
  returning account-level 404s.

This build remains local and has not been published.
