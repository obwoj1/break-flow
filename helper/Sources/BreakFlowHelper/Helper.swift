import AppKit

/// The native half of Break Flow. Owns everything Electron can't do on its own:
/// watching the hotkey system-wide, recording the mic, and pasting into other apps.
///
/// Commands from Electron:
///   {"cmd":"configure","hotkey":"fn"|"rightOption","enabled":true}
///   {"cmd":"paste","text":"…"}
///   {"cmd":"status"}
///
/// Events to Electron:
///   ready / status        {accessibility, microphone, recording}
///   accessibility         {trusted}           — sent when the grant changes
///   recording-started
///   level                 {value}             — mic loudness 0–1, ~10–20×/s while recording
///   recording-finished    {path, duration, app?} — Electron transcribes, then deletes the file.
///                                              `app` is the app you were dictating into.
///   recording-discarded   {reason}            — e.g. "too-short"
///   recording-blocked     {reason}            — "disabled" (no API key yet) or "microphone"
///   pasted
///   error                 {message}
final class Helper {
    /// Holds shorter than this are treated as accidental taps and thrown away.
    private static let minimumHold: TimeInterval = 0.3

    private let bridge = Bridge()
    private let recorder = AudioRecorder()
    private let hotkeyMonitor = HotkeyMonitor(hotkey: .fn)
    private var accessibilityPoll: Timer?
    private var lastAccessibility = Permissions.hasAccessibility

    /// Electron turns recording off until setup (API key) is done.
    private var enabled = false

    /// Name of the app in front when recording started — where the text will be pasted.
    private var targetApp: String?

    func start() {
        hotkeyMonitor.onPress = { [weak self] in self?.startRecording() }
        hotkeyMonitor.onRelease = { [weak self] in self?.finishRecording() }
        recorder.onLevel = { [weak self] level in
            // Rounded to keep the JSON lines short; the pill only needs a rough level.
            self?.bridge.send("level", ["value": (level * 100).rounded() / 100])
        }
        hotkeyMonitor.start()

        bridge.onCommand = { [weak self] name, payload in self?.handle(name, payload) }
        bridge.send("ready", statusFields()) // before reading stdin, so "ready" is always the first event
        bridge.start()

        watchAccessibility()
    }

    // MARK: - Commands

    private func handle(_ name: String, _ payload: [String: Any]) {
        switch name {
        case "configure":
            if let raw = payload["hotkey"] as? String, let hotkey = Hotkey(rawValue: raw) {
                hotkeyMonitor.hotkey = hotkey
            }
            if let enabled = payload["enabled"] as? Bool {
                self.enabled = enabled
            }
        case "paste":
            guard let text = payload["text"] as? String, !text.isEmpty else { return }
            Paster.paste(text)
            bridge.send("pasted")
        case "status":
            bridge.send("status", statusFields())
        default:
            bridge.send("error", ["message": "Unknown command: \(name)"])
        }
    }

    private func statusFields() -> [String: Any] {
        [
            "accessibility": Permissions.hasAccessibility,
            "microphone": AudioRecorder.hasPermission,
            "recording": recorder.isRecording,
        ]
    }

    // MARK: - Recording

    private func startRecording() {
        guard !recorder.isRecording else { return }
        guard enabled else {
            bridge.send("recording-blocked", ["reason": "disabled"])
            return
        }
        guard AudioRecorder.hasPermission else {
            bridge.send("recording-blocked", ["reason": "microphone"])
            return
        }
        do {
            try recorder.start()
            targetApp = NSWorkspace.shared.frontmostApplication?.localizedName
            bridge.send("recording-started")
        } catch {
            bridge.send("error", ["message": "Couldn't record: \(error.localizedDescription)"])
        }
    }

    private func finishRecording() {
        guard let recording = recorder.stop() else { return }
        guard recording.duration >= Self.minimumHold else {
            try? FileManager.default.removeItem(at: recording.url)
            bridge.send("recording-discarded", ["reason": "too-short"])
            return
        }
        var fields: [String: Any] = ["path": recording.url.path, "duration": recording.duration]
        if let targetApp { fields["app"] = targetApp }
        bridge.send("recording-finished", fields)
    }

    // MARK: - Accessibility

    /// macOS doesn't announce Accessibility grants, so check every second. Global key monitors
    /// added before the grant stay deaf, so restart ours whenever it flips to trusted.
    private func watchAccessibility() {
        accessibilityPoll = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in
            guard let self else { return }
            let trusted = Permissions.hasAccessibility
            guard trusted != self.lastAccessibility else { return }
            self.lastAccessibility = trusted
            if trusted { self.hotkeyMonitor.start() }
            self.bridge.send("accessibility", ["trusted": trusted])
        }
    }
}
