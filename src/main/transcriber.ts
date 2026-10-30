import { readFile } from 'node:fs/promises'

/**
 * OpenAI's recommended transcription model as of 2026-10. whisper-1 and the gpt-4o-*-transcribe
 * models are deprecated (accepted until 2027-02-26).
 */
export const TRANSCRIPTION_MODEL = 'gpt-transcribe'

const ENDPOINT = 'https://api.openai.com/v1/audio/transcriptions'

/** OpenAI rejects uploads over 25 MB (~13 minutes of the helper's 16 kHz WAV). */
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024

const TIMEOUT_MS = 60_000

export class TranscriptionError extends Error {
  constructor(
    message: string,
    readonly invalidKey = false,
  ) {
    super(message)
  }
}

/** Uploads one recording to OpenAI and returns the words. */
export async function transcribe(wavPath: string, apiKey: string): Promise<string> {
  const audio = await readFile(wavPath)
  if (audio.byteLength > MAX_UPLOAD_BYTES) {
    throw new TranscriptionError('Recording too long (over 25 MB).')
  }

  const form = new FormData()
  form.append('model', TRANSCRIPTION_MODEL)
  form.append('response_format', 'json')
  form.append('file', new Blob([audio], { type: 'audio/wav' }), 'speech.wav')

  let response: Response
  try {
    response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === 'TimeoutError'
    throw new TranscriptionError(timedOut ? 'OpenAI took too long to answer.' : "Couldn't reach OpenAI — check your internet.")
  }

  if (!response.ok) {
    throw await errorFrom(response)
  }
  const body = (await response.json()) as { text?: unknown }
  if (typeof body.text !== 'string') {
    throw new TranscriptionError('Unexpected response from OpenAI.')
  }
  return body.text.trim()
}

async function errorFrom(response: Response): Promise<TranscriptionError> {
  if (response.status === 401) {
    return new TranscriptionError('OpenAI rejected the API key.', true)
  }
  if (response.status === 429) {
    return new TranscriptionError('OpenAI rate limit or quota reached — check billing.')
  }
  let detail = 'No details'
  try {
    const body = (await response.json()) as { error?: { message?: string } }
    detail = body.error?.message ?? detail
  } catch {
    // keep the default detail
  }
  return new TranscriptionError(`OpenAI error ${response.status}: ${detail}`)
}
