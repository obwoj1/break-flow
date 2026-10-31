# Break Flow

Hold a key, talk, let go — your words get typed into whatever app you're in.
A personal take on Wispr Flow for macOS 13+: an **Electron** app with a small **Swift helper**.

> **Status (v0.4.0):** custom dictionary, real app icon, plus everything from v0.3.0 — voice → text with OpenAI (`gpt-transcribe`), AI cleanup (`gpt-6-luna`)
> that removes "um"s and applies self-corrections, a floating pill with live sound bars while you
> talk, an app window with setup, history and settings, and a menu bar icon.
> See [CONTEXT.md](CONTEXT.md) for the roadmap and decisions.

## Install it

Needs Node 24 (`nvm use` picks it up from `.nvmrc`) and the Xcode Command Line Tools.

```bash
nvm use
npm install
scripts/setup-signing.sh   # once per Mac — see "Signing" below
npm run install-app
```

That builds everything, puts **Break Flow** in `/Applications`, and opens it. After that it's a
normal app: Spotlight, Dock, or the waveform icon in the menu bar.

### First launch

The window walks you through three steps:

1. **Microphone** → *Allow*.
2. **Accessibility** → *Open Settings* → switch on **Break Flow**. This lets it see the hotkey in
   other apps and press Cmd+V for you. The window ticks it off by itself.
3. **OpenAI API key** → paste a key from
   [platform.openai.com/api-keys](https://platform.openai.com/api-keys). It's checked with OpenAI,
   then encrypted with your Mac's Keychain.

## Use it

1. Click into any text box (Notes, a browser, Messages).
2. **Hold Fn (🌐)**, talk, let go. A small pill at the bottom of the screen shows sound bars while
   you talk, then dots while OpenAI transcribes and cleans up (usually a second or two).
3. Your words get typed where the cursor is, and saved to **History** in the window. History
   shows which app you dictated into and lets you flip between the cleaned and original text.

**Dictionary** (Settings): names and jargon to always spell exactly — e.g. your name, "Supabase",
"Morgan State". They're sent to OpenAI as transcription keywords and to the cleanup step.

**AI cleanup** (on by default, switch in Settings) removes filler words and false starts, fixes
punctuation, applies "at 3 — no, 4" corrections, and adjusts to the app (casual in chat, exact in
code editors). If cleanup is slow or fails, your raw words are pasted instead.

Closing the window keeps Break Flow running in the menu bar; quit from the menu bar icon or ⌘Q.

If Fn opens the emoji picker, set *System Settings → Keyboard → Press 🌐 key to → Do Nothing*,
or switch the hotkey to **Right Option** in Settings.

**Privacy & cost:** recordings go to OpenAI and are deleted from your Mac as soon as the text comes
back. With cleanup on, the transcript and the app name go to OpenAI too (`store: false`).
Transcripts stay in `~/Library/Application Support/Break Flow/history.json`. Transcription is
about a cent a minute; cleanup costs a tiny fraction of that.

## Develop

| Command | What it does |
|---|---|
| `npm run dev` | Builds the helper, runs the app with hot reload |
| `npm run typecheck` | TypeScript check |
| `npm run package` | Builds `dist/mac-arm64/Break Flow.app` (signed ad hoc) |
| `npm run install-app` | Package + copy to `/Applications` + launch |

**Permissions in dev mode:** macOS gives permissions to whichever app *launched* the process. With
`npm run dev` that's your terminal (Warp, VS Code…), so switch on Accessibility for the terminal
instead. The installed app asks for itself.

### Signing

`scripts/setup-signing.sh` creates a self-signed **Break Flow Dev** certificate in its own keychain
(`~/Library/Keychains/break-flow-dev.keychain-db`, password in `~/.config/break-flow/`). Every build
is signed with it, so macOS sees the same app each time: Accessibility stays on and Electron's
Keychain item doesn't prompt after each reinstall.

Without it, builds are signed ad hoc, which looks like a brand-new app to macOS every time —
`install-app` then clears the stale Accessibility grant, and a Keychain prompt appears on launch
(the app is frozen until you answer it).

Undo: `security delete-keychain ~/Library/Keychains/break-flow-dev.keychain-db && rm -r ~/.config/break-flow`.

## How it fits together

```
 you hold Fn
     │
┌────▼──────────────── Swift helper (helper/) ───────────────────┐
│ HotkeyMonitor → AudioRecorder (16 kHz WAV) ─┐       Paster ◄─┐ │
└─────────────────────────────────────────────┼────────────────┼─┘
                       JSON lines over stdio  │                │
┌─────────────────── Electron main (src/main) ▼────────────────┼─┐
│ HelperProcess → Dictation → transcriber (OpenAI) → "paste" ──┘ │
│                     │  → History, Settings (safeStorage)       │
└─────────────────────┼──────────────────────────────────────────┘
                      │ IPC (preload: window.breakFlow)
               React window (src/renderer) + menu bar tray
```

| Path | What it does |
|---|---|
| `helper/Sources/BreakFlowHelper/Helper.swift` | Native coordinator: hotkey → record → report; runs paste commands |
| `helper/.../Bridge.swift` | JSON-lines channel to Electron over stdin/stdout |
| `helper/.../HotkeyMonitor.swift` | Notices Fn / Right Option press and release in any app |
| `helper/.../AudioRecorder.swift` | Records the mic to a temp 16 kHz mono WAV |
| `helper/.../Paster.swift` | Types text via clipboard + Cmd+V, then restores your clipboard |
| `src/main/index.ts` | App startup, window, IPC handlers, permission requests |
| `src/main/helper.ts` | Starts the Swift helper, parses its events, restarts it on crash |
| `src/main/dictation.ts` | The record → transcribe → paste loop and app state |
| `src/main/transcriber.ts` | OpenAI upload + API key check |
| `src/main/cleaner.ts` | AI cleanup with `gpt-6-luna`, timeout and fallback guard |
| `src/main/overlay.ts` | The floating recording pill window (never takes focus) |
| `src/main/settings.ts` / `history.ts` | Hotkey + encrypted key / past transcripts, as JSON in Application Support |
| `src/main/tray.ts` | Menu bar icon and menu |
| `src/preload/index.ts` | The only functions the window can call (`window.breakFlow`) |
| `src/renderer/` | React UI: Home (setup + status), History, Settings; `overlay/` is the pill |
| `scripts/` | Signing setup + signing, install to /Applications, app + tray icon generators |
| `build-resources/` | App icon (`icon.icns`, made by `scripts/make-app-icon.swift`) |
