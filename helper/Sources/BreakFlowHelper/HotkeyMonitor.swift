import AppKit

/// Which key you hold down to talk.
enum Hotkey: String, CaseIterable {
    case fn
    case rightOption

    var title: String {
        switch self {
        case .fn: return "Fn (🌐)"
        case .rightOption: return "Right Option (⌥)"
        }
    }

    /// Hardware key code macOS reports for this key.
    var keyCode: UInt16 {
        switch self {
        case .fn: return 63          // kVK_Function
        case .rightOption: return 61 // kVK_RightOption
        }
    }

    /// Whether this key is held in the event's modifier flags.
    func isHeld(in flags: NSEvent.ModifierFlags) -> Bool {
        switch self {
        case .fn:
            return flags.contains(.function)
        case .rightOption:
            // `.option` is set by either Option key, so check the right-side device bit
            // (NX_DEVICERALTKEYMASK) to tell them apart.
            return flags.rawValue & 0x40 != 0
        }
    }
}

/// Watches the keyboard everywhere on the Mac and reports when the hotkey goes down and comes back up.
///
/// Modifier keys like Fn and Option don't send normal key-down events; they send "flags changed"
/// events, so that's what we listen to. Seeing other apps' key events requires the Accessibility
/// permission.
final class HotkeyMonitor {
    var hotkey: Hotkey
    var onPress: () -> Void = {}
    var onRelease: () -> Void = {}

    private var globalMonitor: Any?
    private var localMonitor: Any?
    private var isDown = false

    init(hotkey: Hotkey) {
        self.hotkey = hotkey
    }

    func start() {
        stop()
        // Global: key events while another app is in front. Local: while our own menu is open.
        globalMonitor = NSEvent.addGlobalMonitorForEvents(matching: .flagsChanged) { [weak self] event in
            self?.handle(event)
        }
        localMonitor = NSEvent.addLocalMonitorForEvents(matching: .flagsChanged) { [weak self] event in
            self?.handle(event)
            return event
        }
    }

    func stop() {
        if let globalMonitor { NSEvent.removeMonitor(globalMonitor) }
        if let localMonitor { NSEvent.removeMonitor(localMonitor) }
        globalMonitor = nil
        localMonitor = nil
        isDown = false
    }

    private func handle(_ event: NSEvent) {
        guard event.keyCode == hotkey.keyCode else { return }
        let pressed = hotkey.isHeld(in: event.modifierFlags)
        if pressed && !isDown {
            isDown = true
            onPress()
        } else if !pressed && isDown {
            isDown = false
            onRelease()
        }
    }
}
