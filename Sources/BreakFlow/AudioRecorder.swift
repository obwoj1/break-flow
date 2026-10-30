import AVFoundation

/// A finished recording on disk.
struct Recording {
    let url: URL
    let duration: TimeInterval
}

/// Records the default microphone to a temporary file while the hotkey is held.
///
/// Uses AVAudioEngine: the engine hands us small chunks ("buffers") of audio as they arrive,
/// and we append each one to a file. Later stages will also use these chunks for a live level
/// meter and for streaming to a speech-to-text service.
final class AudioRecorder {
    private let engine = AVAudioEngine()
    private var file: AVAudioFile?
    private var startedAt: Date?

    var isRecording: Bool { startedAt != nil }

    func start() throws {
        guard !isRecording else { return }

        let input = engine.inputNode
        let format = input.outputFormat(forBus: 0)
        guard format.sampleRate > 0, format.channelCount > 0 else {
            throw RecorderError.noMicrophone
        }

        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("breakflow-\(UUID().uuidString).caf")
        let file = try AVAudioFile(forWriting: url, settings: format.settings)
        self.file = file

        input.installTap(onBus: 0, bufferSize: 4096, format: format) { buffer, _ in
            try? file.write(from: buffer)
        }
        engine.prepare()
        do {
            try engine.start()
        } catch {
            input.removeTap(onBus: 0)
            self.file = nil
            try? FileManager.default.removeItem(at: url)
            throw error
        }
        startedAt = Date()
    }

    /// Stops recording and returns the file, or nil if nothing was recording.
    func stop() -> Recording? {
        guard let startedAt, let file else { return nil }
        engine.inputNode.removeTap(onBus: 0)
        engine.stop()
        self.startedAt = nil
        self.file = nil
        return Recording(url: file.url, duration: Date().timeIntervalSince(startedAt))
    }

    /// Asks macOS for microphone access (shows the system prompt the first time).
    static func requestPermission(_ completion: @escaping (Bool) -> Void) {
        switch AVCaptureDevice.authorizationStatus(for: .audio) {
        case .authorized:
            completion(true)
        case .notDetermined:
            AVCaptureDevice.requestAccess(for: .audio) { granted in
                DispatchQueue.main.async { completion(granted) }
            }
        default:
            completion(false)
        }
    }

    static var hasPermission: Bool {
        AVCaptureDevice.authorizationStatus(for: .audio) == .authorized
    }
}

enum RecorderError: LocalizedError {
    case noMicrophone

    var errorDescription: String? {
        switch self {
        case .noMicrophone: return "No microphone input found."
        }
    }
}
