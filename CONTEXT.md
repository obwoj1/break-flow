# Break Flow — Context

Our own take on Wispr Flow: hold a key, talk, and clean text gets typed into whatever app you're in.

Started 2026-10-30. Owner: Oba (obwoj1).
GitHub (private): https://github.com/obwoj1/break-flow

## Where the idea came from

We ran REA (`rea-agents` 6.8.0) plus a manual look at Wispr Flow 1.6.1324 to learn how it works.
Nothing from Wispr's code or assets is copied here — it was reference only. What we learned:

- A **native Swift helper** does the OS-level work: a `CGEventTap` for the Fn hotkey, the
  Accessibility API (`AXUIElement`) to read the focused text box for context, and clipboard + simulated
  Cmd+V to paste. It puts text on the clipboard lazily and treats "no app asked for the data" as a
  failed paste.
- An **Electron + React** app does the UI and history (SQLite).
- Audio is compressed to Opus and **streamed over a WebSocket** to their servers, which run
  speech-to-text and then an AI "cleanup/formatting" pass (hosted on Baseten).

## Decisions

| Date | Decision | Why |
|---|---|---|
| 2026-10-30 | ~~All-Swift menu bar app~~ — **superseded same day** | Was: one language, tiny app. |
| 2026-10-30 | **Electron + Swift helper** (Wispr's architecture) | Oba's call: wants a real app window built with web tech. Electron can't watch a held modifier key system-wide or paste into other apps, so the Swift code stays as a headless helper. |
| 2026-10-30 | Helper talks to Electron with **JSON lines over stdin/stdout** | Simplest IPC; helper exits when Electron closes its stdin. Helper is spawned directly, so macOS attributes its permissions to the Electron app (one "Break Flow" entry in Settings). |
| 2026-10-30 | **electron-vite + React + TypeScript**, **electron-builder** for packaging | Same toolchain Universe uses; builder bundles the helper into `Resources/bin/`. |
| 2026-10-30 | OpenAI calls, settings, history live in **Electron main** | Helper stays OS-only. API key moved from Swift Keychain code to Electron `safeStorage` (Keychain-backed). |
| 2026-10-30 | Recording **disabled until an API key is saved**; key **verified with OpenAI before saving** | Never record audio we can't use; catch typos immediately. |
| 2026-10-30 | **Swift Package Manager** for the helper, no Xcode project | Only Command Line Tools are installed. |
| 2026-10-30 | Stage 3 cleanup uses **OpenAI `gpt-6-luna`** (Responses API, `reasoning: none`, `store: false`) | Oba said "keep working" without choosing; OpenAI reuses his key. Luna is OpenAI's cheapest/fastest text model ($0.10/$0.50 per MTok). Easy to swap for Claude Haiku later. |
| 2026-10-30 | Cleanup is **best-effort**: 6 s timeout, and a result >1.4× the raw length counts as "answered instead of cleaned" → paste raw | Dictation must never break or paste something you didn't say because of the AI step. |
| 2026-10-30 | Helper reports the **frontmost app** with each recording | Cleanup adapts tone (chat vs email vs code); History shows where you dictated. |
| 2026-10-30 | **Floating pill** = separate non-focusable `type: 'panel'` window, `showInactive()`, ignores mouse | Must never steal focus, or the paste lands in the wrong place. |
| 2026-10-30 | **Self-signed "Break Flow Dev" cert** in its own keychain (`scripts/setup-signing.sh`) | Ad hoc builds froze on launch behind a Keychain prompt and reset Accessibility every install. Own keychain + stored password so codesign works without Oba's login password. |
| 2026-10-30 | Default hotkey **Fn**, with **Right Option** as an alternative | Fn matches Wispr. Fn can trigger the emoji picker / Apple dictation, so Right Option is the escape hatch. |
| 2026-10-30 | **Ad-hoc code signing** for now | No signing certificate on this Mac. Downside: macOS forgets the Accessibility grant after each rebuild (see "Known issues"). |
| 2026-10-30 | Build in **checkpoints** — stop after each stage so Oba can test | Oba's preference. |

## Roadmap

1. **Stage 1 — Skeleton** (done): menu bar app, hold hotkey → record mic → on release paste a
   fixed test string. Proves hotkey, mic, and paste all work.
2. **Stage 2 — Speech to text** (done, OpenAI `gpt-transcribe`): send the recording to a transcription API, or
   whisper.cpp for offline. Paste the real transcript.
3. **Stage 3 — Cleanup**: one Claude Haiku call that removes filler words, fixes punctuation, handles
   "actually I meant…", using the focused text box as context.
4. **Stage 4 — Polish**: floating recording pill with a live audio level, history window, settings,
   custom dictionary, streaming for lower latency.

## Status

- 2026-10-30: Repo created at `~/Developer/break-flow`. Stage 1 being written.
- 2026-10-30: **Stage 1 code complete.** Builds clean, `.app` launches and stays running (no crash).
  **Not yet tested by Oba**: the hold-Fn → paste flow, both permission prompts, Right Option.
  Next: Oba tests Stage 1; then pick the speech-to-text provider for Stage 2.

- 2026-10-30: Oba chose **OpenAI** for speech-to-text and a **private GitHub repo**.
- 2026-10-30: **Stage 2 code complete.** Recorder now writes 16 kHz mono WAV (verified with a
  1.5 s mic test: valid WAVE, 1 ch, 16 kHz). Transcriber verified against the live API with a
  fake key (got the expected 401 → "OpenAI rejected the API key"). **Not yet tested with a real
  key** — Oba adds his key via the menu and tests.
- 2026-10-30: Pushed to private GitHub repo `obwoj1/break-flow` (branch `main`).
- 2026-10-30: Swift-only app installed to /Applications; Oba asked for it as an **Electron app**.
- 2026-10-30: **Electron conversion code complete (v0.2.0).** Verified: typecheck clean; packaged
  app launches with the helper as a child; window renders the setup checklist (read via DevTools
  protocol); sandbox has no `require`; fake key rejected through the UI API and nothing saved.
  Installed to `/Applications/Break Flow.app` (replaced the Swift-only version, same bundle id).
  **Not yet tested by Oba**: real key, hold-Fn dictation end to end, tray menu, Right Option.
- 2026-10-30: Oba said "keep working". Built **Stage 3 (AI cleanup)** and the **recording pill**
  (v0.3.0). Verified: typecheck/build clean; cleaner fails safely in ~0.4 s with a bad key; pill
  rendered offscreen in both states (screenshots looked right); mic level events ~10/s.
- 2026-10-30: **Bug found & fixed — app froze on launch after reinstalls.** Cause: each ad hoc
  build has a new signature, so Electron's "Break Flow Safe Storage" Keychain item prompted for
  access; the prompt blocked the main process before the helper was spawned, and blocked quitting
  (AppleScript quit got "User canceled"). install-app's `open` then re-activated the stuck old copy.
  Fixes: Break Flow Dev certificate (stable identity), helper spawned before settings are read,
  install-app waits for the old copy to exit (force-kills after 5 s) and only resets Accessibility
  when the signer changes.
- 2026-10-30: Oba **had already saved an API key** (settings.json, 17:21) — kept; the Keychain item
  was NOT deleted. First launch of the cert-signed build asks for Keychain access once
  (**Always Allow**), and Accessibility must be switched on once more. After that both persist.

## Helper ↔ Electron protocol

Commands (Electron → helper): `configure {hotkey, enabled}`, `paste {text}`, `status`.
Events (helper → Electron): `ready`/`status {accessibility, microphone, recording}`,
`accessibility {trusted}`, `recording-started`, `recording-finished {path, duration}`,
`recording-discarded {reason}`, `recording-blocked {reason: disabled|microphone}`, `pasted`,
`error {message}`. Source of truth: `helper/Sources/BreakFlowHelper/Helper.swift`.

## Stage 2 details

- Model: **`gpt-transcribe`** — OpenAI's recommended transcription model per their docs on
  2026-10-30. `whisper-1`, `gpt-4o-transcribe`, `gpt-4o-mini-transcribe` are deprecated, accepted
  until 2027-02-26. Note: `gpt-transcribe` takes `languages` (array) + `keywords`, not `language`.
  `keywords` is the hook for a custom dictionary later.
- Upload: one multipart POST to `/v1/audio/transcriptions` after you let go (no streaming yet).
  Limit 25 MB ≈ 13 min of our WAV.
- API key: encrypted with Electron `safeStorage` (Keychain-backed) in
  `~/Library/Application Support/Break Flow/settings.json` (mode 600). Never stored in plain text.
- Recordings are deleted right after transcription (success or failure).

## Next ideas (Stage 4 remainder)

- Custom dictionary → `keywords` on `gpt-transcribe` (names, jargon).
- Streaming transcription while you talk (lower latency).
- Read the focused text box via Accessibility for richer cleanup context (what Wispr does).
- Real app icon (still the default Electron icon).
- `safeStorage.isEncryptionAvailable` is deprecated in Electron 45 → move to the async API.

## Open questions

- Keep OpenAI for cleanup, or switch to Claude Haiku? (Defaulted to OpenAI on 2026-10-30.)

## Known issues

- **`swift build` fails with the default build system** in Command Line Tools 26
  ("spec ':wrapper.xcdatamodel' already registered"). Workaround: `--build-system native`,
  which the scripts already pass. It prints a deprecation warning; harmless.

- **Without the dev certificate**, every build is a "new app" to macOS: Accessibility resets and a
  Keychain prompt freezes launch. Run `scripts/setup-signing.sh` once per Mac.
- **Dev mode permissions go to the terminal** that ran `npm run dev`, not to Break Flow.
- **npm 11 blocks install scripts** by default, so Electron's binary isn't downloaded on install;
  the `postinstall` script runs `install-electron` to fix that.
- Renderer bundle isn't minified (electron-vite default) — 580 KB, irrelevant for a local app.
