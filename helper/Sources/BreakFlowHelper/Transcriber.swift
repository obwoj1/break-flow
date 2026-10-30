import Foundation

/// Turns a recording into text with OpenAI's transcription API.
///
/// One request per recording: upload the WAV, get the words back. Streaming while you talk
/// (lower latency) is a Stage 4 upgrade.
struct Transcriber {
    static let apiKeyAccount = "openai-api-key"

    /// OpenAI's recommended transcription model as of 2026-10 (whisper-1 and the gpt-4o-*-transcribe
    /// models are deprecated until 2027-02-26).
    static let model = "gpt-transcribe"

    private static let endpoint = URL(string: "https://api.openai.com/v1/audio/transcriptions")!

    /// OpenAI rejects uploads over 25 MB (~13 minutes of our 16 kHz WAV).
    private static let maxUploadBytes = 25 * 1024 * 1024

    let apiKey: String

    func transcribe(_ fileURL: URL) async throws -> String {
        let audio = try Data(contentsOf: fileURL)
        guard audio.count <= Self.maxUploadBytes else { throw TranscriptionError.tooLong }

        let boundary = "BreakFlow-\(UUID().uuidString)"
        var request = URLRequest(url: Self.endpoint, timeoutInterval: 60)
        request.httpMethod = "POST"
        request.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")

        var body = MultipartBody(boundary: boundary)
        body.addField("model", Self.model)
        body.addField("response_format", "json")
        body.addFile("file", filename: "speech.wav", contentType: "audio/wav", data: audio)

        let (data, response) = try await URLSession.shared.upload(for: request, from: body.finish())
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0

        guard status == 200 else {
            throw TranscriptionError.from(status: status, body: data)
        }
        guard let text = try? JSONDecoder().decode(TranscriptionResponse.self, from: data).text else {
            throw TranscriptionError.unexpectedResponse
        }
        return text.trimmingCharacters(in: .whitespacesAndNewlines)
    }
}

private struct TranscriptionResponse: Decodable {
    let text: String
}

private struct OpenAIErrorResponse: Decodable {
    struct Detail: Decodable { let message: String }
    let error: Detail
}

enum TranscriptionError: LocalizedError {
    case invalidKey
    case rateLimited
    case tooLong
    case server(Int, String)
    case unexpectedResponse

    static func from(status: Int, body: Data) -> TranscriptionError {
        switch status {
        case 401: return .invalidKey
        case 429: return .rateLimited
        default:
            let message = (try? JSONDecoder().decode(OpenAIErrorResponse.self, from: body))?.error.message
            return .server(status, message ?? "No details")
        }
    }

    var errorDescription: String? {
        switch self {
        case .invalidKey: return "OpenAI rejected the API key."
        case .rateLimited: return "OpenAI rate limit or quota reached — check billing."
        case .tooLong: return "Recording too long (over 25 MB)."
        case .server(let status, let message): return "OpenAI error \(status): \(message)"
        case .unexpectedResponse: return "Unexpected response from OpenAI."
        }
    }
}

/// Builds a multipart/form-data request body (the format file-upload APIs expect).
private struct MultipartBody {
    let boundary: String
    private var data = Data()

    init(boundary: String) {
        self.boundary = boundary
    }

    mutating func addField(_ name: String, _ value: String) {
        append("--\(boundary)\r\n")
        append("Content-Disposition: form-data; name=\"\(name)\"\r\n\r\n")
        append("\(value)\r\n")
    }

    mutating func addFile(_ name: String, filename: String, contentType: String, data fileData: Data) {
        append("--\(boundary)\r\n")
        append("Content-Disposition: form-data; name=\"\(name)\"; filename=\"\(filename)\"\r\n")
        append("Content-Type: \(contentType)\r\n\r\n")
        data.append(fileData)
        append("\r\n")
    }

    func finish() -> Data {
        var result = data
        result.append(Data("--\(boundary)--\r\n".utf8))
        return result
    }

    private mutating func append(_ string: String) {
        data.append(Data(string.utf8))
    }
}
