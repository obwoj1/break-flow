import ApplicationServices

/// Accessibility permission: needed to see the hotkey while other apps are in front
/// and to press Cmd+V on your behalf.
///
/// macOS grants permissions to the app that launched the helper (Break Flow, or your terminal
/// during development), so asking and opening System Settings is done from Electron.
enum Permissions {
    static var hasAccessibility: Bool {
        AXIsProcessTrusted()
    }
}
