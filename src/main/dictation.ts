import { Notification, systemPreferences } from 'electron'
import { EventEmitter } from 'node:events'
import { rm } from 'node:fs/promises'
import type { AppState, DictationStatus, HotkeyName } from '../shared/types'
import type { HelperEvent, HelperProcess } from './helper'
import type { History } from './history'
import type { Settings } from './settings'
import { transcribe, TranscriptionError } from './transcriber'

/**
 * Runs the dictation loop: the helper records → we transcribe with OpenAI → the helper pastes.
 *
 * Emits:
 *   'state'            AppState — whenever anything the UI shows changes
 *   'history'          — after a transcript is added
 *   'needs-attention'  — the user pressed the hotkey but setup isn't finished; show the window
 */
export class Dictation extends EventEmitter {
  private status: DictationStatus = 'idle'
  private error: string | null = null

  constructor(
    private readonly helper: HelperProcess,
    private readonly settings: Settings,
    private readonly history: History,
  ) {
    super()
  }

  start(): void {
    this.helper.on('event', (event: HelperEvent) => void this.handle(event))
    this.helper.on('running', (running: boolean) => {
      if (!running) this.status = 'idle'
      this.emitState()
    })
    this.helper.start()
  }

  snapshot(): AppState {
    return {
      status: this.status,
      helperRunning: this.helper.running,
      microphone: systemPreferences.getMediaAccessStatus('microphone'),
      accessibility: systemPreferences.isTrustedAccessibilityClient(false),
      hasApiKey: this.settings.hasApiKey,
      hotkey: this.settings.hotkey,
      error: this.error,
    }
  }

  emitState(): void {
    this.emit('state', this.snapshot())
  }

  setHotkey(hotkey: HotkeyName): void {
    this.settings.hotkey = hotkey
    this.configureHelper()
    this.emitState()
  }

  saveApiKey(key: string): void {
    this.settings.setApiKey(key)
    this.error = null
    this.configureHelper()
    this.emitState()
  }

  removeApiKey(): void {
    this.settings.removeApiKey()
    this.configureHelper()
    this.emitState()
  }

  /** Recording stays off until there's an API key, so we never record audio we can't use. */
  private configureHelper(): void {
    this.helper.send({ cmd: 'configure', hotkey: this.settings.hotkey, enabled: this.settings.hasApiKey })
  }

  private async handle(event: HelperEvent): Promise<void> {
    switch (event.type) {
      case 'ready':
        this.configureHelper()
        this.emitState()
        break
      case 'status':
      case 'accessibility':
        this.emitState()
        break
      case 'recording-started':
        this.setStatus('recording')
        break
      case 'recording-discarded':
        this.setStatus('idle')
        break
      case 'recording-blocked':
        this.setStatus('idle')
        this.emit('needs-attention')
        break
      case 'recording-finished':
        await this.finish(event.path, event.duration)
        break
      case 'pasted':
        break
      case 'error':
        this.fail(event.message)
        break
    }
  }

  private async finish(path: string, duration: number): Promise<void> {
    const apiKey = this.settings.apiKey
    if (!apiKey) {
      await rm(path, { force: true })
      this.setStatus('idle')
      this.emit('needs-attention')
      return
    }

    this.setStatus('transcribing')
    try {
      const text = await transcribe(path, apiKey)
      if (text) {
        this.helper.send({ cmd: 'paste', text })
        this.history.add(text, duration)
        this.emit('history')
        this.error = null
      } else {
        this.error = "Didn't catch any words — try again a little closer to the mic."
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.fail(message)
      if (error instanceof TranscriptionError && error.invalidKey) this.emit('needs-attention')
    } finally {
      await rm(path, { force: true }) // recordings never outlive their transcription
      this.setStatus('idle')
    }
  }

  private fail(message: string): void {
    this.error = message
    this.emitState()
    if (Notification.isSupported()) {
      new Notification({ title: 'Break Flow', body: message, silent: true }).show()
    }
  }

  private setStatus(status: DictationStatus): void {
    this.status = status
    this.emitState()
  }
}
