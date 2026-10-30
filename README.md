# Break Flow

Hold a key, talk, let go — your words get typed into whatever app you're in.
A personal take on Wispr Flow, built as a native Swift menu bar app for macOS 13+.

> **Status: Stage 1 (skeleton).** Right now it pastes a test line instead of your words.
> Speech-to-text comes in Stage 2. See [CONTEXT.md](CONTEXT.md) for the roadmap and decisions.

## Run it

Needs the Xcode Command Line Tools (Swift 5.9+). No Xcode required.

```bash
scripts/run.sh
```

That builds `build/Break Flow.app`, launches it, and puts a waveform icon in your menu bar.

### First launch: two permissions

1. **Microphone** — macOS asks right away. Click Allow.
2. **Accessibility** — macOS shows a prompt; click *Open System Settings* and switch on
   **Break Flow**. This lets it see the hotkey in other apps and press Cmd+V for you.

The menu bar menu shows ⚠️ items for anything still missing.

## Test Stage 1

1. Click into any text box (Notes, a browser, Messages).
2. **Hold Fn (🌐)**, say something, let go. The icon turns into a red mic while you hold.
3. You should see: `Break Flow works! (recorded 2.3s)`.

If Fn opens the emoji picker or Apple Dictation instead, either set
*System Settings → Keyboard → Press 🌐 key to → Do Nothing*, or switch the hotkey to
**Right Option** from the menu bar menu.

## Rebuilding

Run `scripts/run.sh` again after changes. Because builds aren't signed with a certificate, macOS
treats each one as a new app, so the script clears the old Accessibility grant and you'll be asked
to switch it on again. Use `scripts/run.sh --keep-perms` to skip the reset.

## Project layout

| File | What it does |
|---|---|
| `Sources/BreakFlow/main.swift` | Starts the app as menu-bar-only (no Dock icon) |
| `Sources/BreakFlow/AppDelegate.swift` | Menu bar icon + menu; ties hotkey → recorder → paster together |
| `Sources/BreakFlow/HotkeyMonitor.swift` | Notices when you press and release Fn / Right Option anywhere |
| `Sources/BreakFlow/AudioRecorder.swift` | Records the mic to a temp file while you hold the key |
| `Sources/BreakFlow/Paster.swift` | Types text via clipboard + Cmd+V, then puts your old clipboard back |
| `Sources/BreakFlow/Permissions.swift` | Checks Accessibility and opens the right System Settings pane |
| `Resources/Info.plist` | App identity, menu-bar-only flag, microphone prompt text |
| `scripts/build-app.sh` | Builds and wraps the binary into a signed `.app` |
| `scripts/run.sh` | Rebuild + relaunch |
