import AVFoundation

/// A finished recording on disk.
struct Recording {
    let url: URL
    let duration: TimeInterval
}

/// Records the default microphone to a temporary WAV file while the hotkey is held.
///
/// Uses AVAudioEngine: the engine hands us small chunks ("buffers") of audio as they arrive.
/// Each chunk is converted to 16 kHz mono — what speech-to-text models expect, and about a
/// tenth the size of raw mic audio — then appended to the file.
final class AudioRecorder {
    /// 16 kHz mono float, the format chunks are converted to before writing.
    private static let speechFormat = AVAudioFormat(
        commonFormat: .pcmFormatFloat32, sampleRate: 16_000, channels: 1, interleaved: false
    )!

    /// On disk: 16-bit WAV, accepted by OpenAI and whisper.cpp alike (~1 MB per 30 s).
    private static let fileSettings: [String: Any] = [
        AVFormatIDKey: kAudioFormatLinearPCM,
        AVSampleRateKey: 16_000,
        AVNumberOfChannelsKey: 1,
        AVLinearPCMBitDepthKey: 16,
        AVLinearPCMIsFloatKey: false,
        AVLinearPCMIsBigEndianKey: false,
    ]

    private let engine = AVAudioEngine()
    private var writer: ChunkWriter?
    private var startedAt: Date?

    var isRecording: Bool { startedAt != nil }

    func start() throws {
        guard !isRecording else { return }

        let input = engine.inputNode
        let inputFormat = input.outputFormat(forBus: 0)
        guard inputFormat.sampleRate > 0, inputFormat.channelCount > 0 else {
            throw RecorderError.noMicrophone
        }

        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("breakflow-\(UUID().uuidString).wav")
        let writer = try ChunkWriter(url: url, inputFormat: inputFormat)
        self.writer = writer

        input.installTap(onBus: 0, bufferSize: 4096, format: inputFormat) { buffer, _ in
            writer.append(buffer)
        }
        engine.prepare()
        do {
            try engine.start()
        } catch {
            input.removeTap(onBus: 0)
            writer.close()
            self.writer = nil
            try? FileManager.default.removeItem(at: url)
            throw error
        }
        startedAt = Date()
    }

    /// Stops recording and returns the finished file, or nil if nothing was recording.
    func stop() -> Recording? {
        guard let startedAt, let writer else { return nil }
        engine.inputNode.removeTap(onBus: 0)
        engine.stop()
        writer.close() // finalizes the WAV header so the file is readable
        self.startedAt = nil
        self.writer = nil
        return Recording(url: writer.url, duration: Date().timeIntervalSince(startedAt))
    }

    /// Microphone access is requested from Electron; the helper only checks it.
    static var hasPermission: Bool {
        AVCaptureDevice.authorizationStatus(for: .audio) == .authorized
    }

    /// Converts mic chunks to 16 kHz mono and writes them to the file.
    ///
    /// Chunks arrive on an audio thread while `close()` is called from the main thread,
    /// so a lock keeps a late chunk from writing to a file that's already closed.
    private final class ChunkWriter {
        let url: URL
        private var file: AVAudioFile?
        private let converter: AVAudioConverter
        private let lock = NSLock()

        init(url: URL, inputFormat: AVAudioFormat) throws {
            guard let converter = AVAudioConverter(from: inputFormat, to: AudioRecorder.speechFormat) else {
                throw RecorderError.unsupportedFormat
            }
            converter.downmix = true // multi-channel mics → mono
            self.converter = converter
            self.url = url
            self.file = try AVAudioFile(
                forWriting: url,
                settings: AudioRecorder.fileSettings,
                commonFormat: .pcmFormatFloat32,
                interleaved: false
            )
        }

        func append(_ buffer: AVAudioPCMBuffer) {
            lock.lock()
            defer { lock.unlock() }
            guard let file else { return }

            let ratio = AudioRecorder.speechFormat.sampleRate / buffer.format.sampleRate
            let capacity = AVAudioFrameCount(Double(buffer.frameLength) * ratio) + 1024
            guard let output = AVAudioPCMBuffer(pcmFormat: AudioRecorder.speechFormat, frameCapacity: capacity) else {
                return
            }

            var handedOver = false
            var error: NSError?
            converter.convert(to: output, error: &error) { _, status in
                if handedOver {
                    status.pointee = .noDataNow
                    return nil
                }
                handedOver = true
                status.pointee = .haveData
                return buffer
            }
            if error == nil, output.frameLength > 0 {
                try? file.write(from: output)
            }
        }

        func close() {
            lock.lock()
            defer { lock.unlock() }
            if #available(macOS 15.0, *) {
                file?.close()
            }
            file = nil // releasing the last reference also closes it on older macOS
        }
    }
}

enum RecorderError: LocalizedError {
    case noMicrophone
    case unsupportedFormat

    var errorDescription: String? {
        switch self {
        case .noMicrophone: return "No microphone input found."
        case .unsupportedFormat: return "The microphone's audio format isn't supported."
        }
    }
}
