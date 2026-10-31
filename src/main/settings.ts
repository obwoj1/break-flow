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
 *
 * The key is decrypted once (`loadApiKey`, at startup) and kept in memory, so reading it never waits
 * on the Keychain. Encryption uses the async safeStorage API, which doesn't block the main process.
 */
export class Settings {
  private readonly path = join(app.getPath('userData'), 'settings.json')
  private data: StoredSettings
  private cachedApiKey: string | null = null

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
    return this.cachedApiKey !== null
  }

  get apiKey(): string | null {
    return this.cachedApiKey
  }

  /** Decrypts the saved key into memory. Call once after the app is ready. */
  async loadApiKey(): Promise<void> {
    if (!this.data.encryptedApiKey || !(await safeStorage.isAsyncEncryptionAvailable())) return
    try {
      const { result, shouldReEncrypt } = await safeStorage.decryptStringAsync(
        Buffer.from(this.data.encryptedApiKey, 'base64'),
      )
      this.cachedApiKey = result
      // The encryption key was rotated or upgraded: store the API key under the new one.
      if (shouldReEncrypt) await this.setApiKey(result)
    } catch {
      this.cachedApiKey = null // e.g. the Keychain item was reset; the user re-enters the key
    }
  }

  async setApiKey(key: string): Promise<void> {
    if (!(await safeStorage.isAsyncEncryptionAvailable())) {
      throw new Error('Secure storage (Keychain) is not available.')
    }
    this.data.encryptedApiKey = (await safeStorage.encryptStringAsync(key)).toString('base64')
    this.cachedApiKey = key
    this.save()
  }

  removeApiKey(): void {
    delete this.data.encryptedApiKey
    this.cachedApiKey = null
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
