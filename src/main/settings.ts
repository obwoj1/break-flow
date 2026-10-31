import { app, safeStorage } from 'electron'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { HotkeyName } from '../shared/types'

interface StoredSettings {
  hotkey: HotkeyName
  cleanupEnabled: boolean
  dictionary: string[]
  /** The OpenAI key, encrypted with macOS Keychain-backed safeStorage, base64. */
  encryptedApiKey?: string
}

const defaults: StoredSettings = { hotkey: 'fn', cleanupEnabled: true, dictionary: [] }

const MAX_DICTIONARY_WORDS = 100
const MAX_WORD_LENGTH = 60

/**
 * Settings saved to ~/Library/Application Support/Break Flow/settings.json.
 * The API key is encrypted before it's written, so the file never holds it in plain text.
 */
export class Settings {
  private readonly path = join(app.getPath('userData'), 'settings.json')
  private data: StoredSettings

  constructor() {
    this.data = this.load()
  }

  get hotkey(): HotkeyName {
    return this.data.hotkey
  }

  set hotkey(value: HotkeyName) {
    this.data.hotkey = value
    this.save()
  }

  get cleanupEnabled(): boolean {
    return this.data.cleanupEnabled
  }

  set cleanupEnabled(value: boolean) {
    this.data.cleanupEnabled = value
    this.save()
  }

  get dictionary(): string[] {
    return this.data.dictionary
  }

  /** Saves the cleaned-up list and returns it. */
  setDictionary(words: unknown[]): string[] {
    this.data.dictionary = cleanDictionary(words)
    this.save()
    return this.data.dictionary
  }

  get hasApiKey(): boolean {
    return this.apiKey !== null
  }

  get apiKey(): string | null {
    if (!this.data.encryptedApiKey || !safeStorage.isEncryptionAvailable()) return null
    try {
      return safeStorage.decryptString(Buffer.from(this.data.encryptedApiKey, 'base64'))
    } catch {
      return null // e.g. the Keychain entry was reset; the user re-enters the key
    }
  }

  setApiKey(key: string): void {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('Secure storage (Keychain) is not available.')
    }
    this.data.encryptedApiKey = safeStorage.encryptString(key).toString('base64')
    this.save()
  }

  removeApiKey(): void {
    delete this.data.encryptedApiKey
    this.save()
  }

  private load(): StoredSettings {
    try {
      const parsed = JSON.parse(readFileSync(this.path, 'utf8')) as Partial<StoredSettings>
      return {
        ...defaults,
        ...parsed,
        hotkey: parsed.hotkey === 'rightOption' ? 'rightOption' : 'fn',
        cleanupEnabled: parsed.cleanupEnabled !== false,
        dictionary: Array.isArray(parsed.dictionary) ? cleanDictionary(parsed.dictionary) : [],
      }
    } catch {
      return { ...defaults }
    }
  }

  private save(): void {
    writeFileSync(this.path, JSON.stringify(this.data, null, 2), { mode: 0o600 })
  }
}

/**
 * OpenAI rejects the whole transcription if any keyword contains "<", ">" or a line break, so
 * strip those, trim, drop empties and case-insensitive duplicates, and cap the size.
 */
function cleanDictionary(words: unknown[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const word of words) {
    if (typeof word !== 'string') continue
    const clean = word.replace(/[<>\r\n]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_WORD_LENGTH)
    const key = clean.toLowerCase()
    if (!clean || seen.has(key)) continue
    seen.add(key)
    result.push(clean)
    if (result.length === MAX_DICTIONARY_WORDS) break
  }
  return result
}
