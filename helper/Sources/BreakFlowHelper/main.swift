import AppKit

// Break Flow Helper — started by the Electron app, never on its own.
// It needs an AppKit run loop for keyboard monitoring, but shows no Dock icon or menu bar.
let app = NSApplication.shared
app.setActivationPolicy(.prohibited)
let helper = Helper()
helper.start()
app.run()
