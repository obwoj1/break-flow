import Foundation

/// The helper's line to the Electron app: one JSON object per line.
///
/// Electron starts this helper as a child process. It writes commands to our stdin
/// (`{"cmd":"paste","text":"hi"}`) and reads events from our stdout
/// (`{"type":"recording-finished","path":"…","duration":2.1}`). When Electron quits, stdin
/// closes and the helper exits with it.
final class Bridge {
    /// Called on the main thread for each command Electron sends.
    var onCommand: (_ name: String, _ payload: [String: Any]) -> Void = { _, _ in }

    private let outputLock = NSLock()

    func start() {
        let thread = Thread { [weak self] in
            while let line = readLine() {
                guard let data = line.data(using: .utf8),
                      let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                      let name = object["cmd"] as? String
                else {
                    self?.send("error", ["message": "Unreadable command: \(line.prefix(200))"])
                    continue
                }
                DispatchQueue.main.async { self?.onCommand(name, object) }
            }
            // stdin closed: the Electron app is gone, so we go too.
            exit(0)
        }
        thread.name = "BreakFlowHelper.stdin"
        thread.start()
    }

    func send(_ type: String, _ fields: [String: Any] = [:]) {
        var object = fields
        object["type"] = type
        guard let data = try? JSONSerialization.data(withJSONObject: object),
              let line = String(data: data, encoding: .utf8)
        else { return }

        outputLock.lock()
        defer { outputLock.unlock() }
        FileHandle.standardOutput.write(Data((line + "\n").utf8))
    }
}
