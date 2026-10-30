import AppKit

/// The menu bar app. Wires the hotkey, the recorder and the paster together.
///
/// Stage 1 flow: hold the hotkey → record → let go → paste a test line saying how long you talked.
/// Stage 2 swaps that test line for the real transcript.
final class AppDelegate: NSObject, NSApplicationDelegate, NSMenuDelegate {
    private enum State {
        case idle
        case recording
    }

    /// Holds shorter than this are treated as accidental taps and thrown away.
    private static let minimumHold: TimeInterval = 0.3
    private static let hotkeyDefaultsKey = "hotkey"

    private var statusItem: NSStatusItem!
    private let menu = NSMenu()
    private let recorder = AudioRecorder()
    private var hotkeyMonitor: HotkeyMonitor!
    private var accessibilityPoll: Timer?
    private var state = State.idle { didSet { updateIcon() } }
    private var lastMessage = "Ready"

    private var hotkey: Hotkey {
        get {
            let raw = UserDefaults.standard.string(forKey: Self.hotkeyDefaultsKey) ?? ""
            return Hotkey(rawValue: raw) ?? .fn
        }
        set {
            UserDefaults.standard.set(newValue.rawValue, forKey: Self.hotkeyDefaultsKey)
            hotkeyMonitor.hotkey = newValue
        }
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)
        menu.delegate = self
        statusItem.menu = menu
        updateIcon()

        hotkeyMonitor = HotkeyMonitor(hotkey: hotkey)
        hotkeyMonitor.onPress = { [weak self] in self?.startRecording() }
        hotkeyMonitor.onRelease = { [weak self] in self?.finishRecording() }
        hotkeyMonitor.start()

        AudioRecorder.requestPermission { _ in }
        if !Permissions.hasAccessibility {
            Permissions.requestAccessibility()
            waitForAccessibility()
        }
    }

    // MARK: - Recording

    private func startRecording() {
        guard state == .idle else { return }
        guard AudioRecorder.hasPermission else {
            lastMessage = "Microphone access needed"
            NSSound.beep()
            return
        }
        do {
            try recorder.start()
            state = .recording
            NSSound(named: "Tink")?.play()
        } catch {
            lastMessage = "Couldn't record: \(error.localizedDescription)"
            NSSound.beep()
        }
    }

    private func finishRecording() {
        guard state == .recording else { return }
        state = .idle
        guard let recording = recorder.stop() else { return }
        defer { try? FileManager.default.removeItem(at: recording.url) }

        guard recording.duration >= Self.minimumHold else {
            lastMessage = "Too short — hold the key while you talk"
            return
        }

        let seconds = String(format: "%.1f", recording.duration)
        Paster.paste("Break Flow works! (recorded \(seconds)s)")
        lastMessage = "Last recording: \(seconds)s"
    }

    // MARK: - Accessibility

    /// macOS doesn't notify apps when Accessibility is granted, so check once a second.
    /// Global key monitors added before the grant stay deaf, so restart ours once it lands.
    private func waitForAccessibility() {
        accessibilityPoll?.invalidate()
        accessibilityPoll = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] timer in
            guard Permissions.hasAccessibility else { return }
            timer.invalidate()
            self?.accessibilityPoll = nil
            self?.hotkeyMonitor.start()
        }
    }

    // MARK: - Menu bar

    private func updateIcon() {
        guard let button = statusItem?.button else { return }
        let recording = state == .recording
        let image = NSImage(
            systemSymbolName: recording ? "mic.fill" : "waveform",
            accessibilityDescription: recording ? "Break Flow — recording" : "Break Flow"
        )
        image?.isTemplate = !recording
        button.image = image
        button.contentTintColor = recording ? .systemRed : nil
    }

    func menuNeedsUpdate(_ menu: NSMenu) {
        menu.removeAllItems()

        menu.addItem(disabledItem("Break Flow — hold \(hotkey.title) to talk"))
        menu.addItem(disabledItem(lastMessage))
        menu.addItem(.separator())

        if !Permissions.hasAccessibility {
            menu.addItem(actionItem("⚠️ Grant Accessibility access…", #selector(openAccessibility)))
        }
        if !AudioRecorder.hasPermission {
            menu.addItem(actionItem("⚠️ Grant Microphone access…", #selector(openMicrophone)))
        }

        let hotkeyItem = NSMenuItem(title: "Hotkey", action: nil, keyEquivalent: "")
        let hotkeyMenu = NSMenu()
        for option in Hotkey.allCases {
            let item = actionItem(option.title, #selector(chooseHotkey(_:)))
            item.representedObject = option.rawValue
            item.state = option == hotkey ? .on : .off
            hotkeyMenu.addItem(item)
        }
        hotkeyItem.submenu = hotkeyMenu
        menu.addItem(hotkeyItem)

        menu.addItem(.separator())
        menu.addItem(actionItem("Quit Break Flow", #selector(quit), key: "q"))
    }

    private func disabledItem(_ title: String) -> NSMenuItem {
        let item = NSMenuItem(title: title, action: nil, keyEquivalent: "")
        item.isEnabled = false
        return item
    }

    private func actionItem(_ title: String, _ action: Selector, key: String = "") -> NSMenuItem {
        let item = NSMenuItem(title: title, action: action, keyEquivalent: key)
        item.target = self
        return item
    }

    @objc private func chooseHotkey(_ sender: NSMenuItem) {
        guard let raw = sender.representedObject as? String, let choice = Hotkey(rawValue: raw) else { return }
        hotkey = choice
    }

    @objc private func openAccessibility() {
        Permissions.requestAccessibility()
        Permissions.openAccessibilitySettings()
        waitForAccessibility()
    }

    @objc private func openMicrophone() {
        if AudioRecorder.hasPermission { return }
        AudioRecorder.requestPermission { granted in
            if !granted { Permissions.openMicrophoneSettings() }
        }
    }

    @objc private func quit() {
        NSApp.terminate(nil)
    }
}
