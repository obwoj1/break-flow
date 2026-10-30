# Break Flow — Context

Our own take on Wispr Flow: hold a key, talk, and clean text gets typed into whatever app you're in.

Started 2026-10-30. Owner: Oba (obwoj1).

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
| 2026-10-30 | **All-Swift menu bar app**, not Electron + Swift helper | One language, tiny app, no IPC between two processes. We can add a UI window later in SwiftUI. |
| 2026-10-30 | **Swift Package Manager + a build script**, no Xcode project | Only Command Line Tools are installed; SwiftPM builds AppKit apps fine. The script wraps the binary into a `.app`. |
| 2026-10-30 | Default hotkey **Fn**, with **Right Option** as an alternative | Fn matches Wispr. Fn can trigger the emoji picker / Apple dictation, so Right Option is the escape hatch. |
| 2026-10-30 | **Ad-hoc code signing** for now | No signing certificate on this Mac. Downside: macOS forgets the Accessibility grant after each rebuild (see "Known issues"). |
| 2026-10-30 | Build in **checkpoints** — stop after each stage so Oba can test | Oba's preference. |

## Roadmap

1. **Stage 1 — Skeleton** (in progress): menu bar app, hold hotkey → record mic → on release paste a
   fixed test string. Proves hotkey, mic, and paste all work.
2. **Stage 2 — Speech to text**: send the recording to a transcription API (OpenAI or Deepgram), or
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

## Open questions

- Stage 2 speech-to-text: OpenAI API (simple, paid per minute), Deepgram (fast streaming), or
  whisper.cpp (free, offline, runs on the Mac)?
- Put the repo on GitHub (private) now or later?

## Known issues

- **`swift build` fails with the default build system** in Command Line Tools 26
  ("spec ':wrapper.xcdatamodel' already registered"). Workaround: `--build-system native`,
  which the scripts already pass. It prints a deprecation warning; harmless.

- **Accessibility permission resets on every rebuild** (ad-hoc signing changes the app's identity).
  `scripts/run.sh` resets the old grant so macOS asks again cleanly. A real fix is a self-signed
  "Break Flow Dev" certificate — later.
