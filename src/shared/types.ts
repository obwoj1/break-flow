// Types shared by the main process, the preload bridge and the React UI.

export type HotkeyName = 'fn' | 'rightOption'

export type DictationStatus = 'idle' | 'recording' | 'transcribing'

/** Microphone status as macOS reports it. */
export type MicrophoneAccess = 'granted' | 'denied' | 'not-determined' | 'restricted' | 'unknown'

export interface AppState {
  status: DictationStatus
  helperRunning: boolean
  microphone: MicrophoneAccess
  accessibility: boolean
  hasApiKey: boolean
  hotkey: HotkeyName
  /** Latest problem worth showing, cleared after the next successful dictation. */
  error: string | null
}

export interface HistoryEntry {
  id: string
  text: string
  /** ISO timestamp. */
  createdAt: string
  durationSeconds: number
}

/** What the preload script exposes to the UI as `window.breakFlow`. */
export interface BreakFlowApi {
  getState(): Promise<AppState>
  onState(listener: (state: AppState) => void): () => void
  getHistory(): Promise<HistoryEntry[]>
  onHistory(listener: (history: HistoryEntry[]) => void): () => void
  deleteHistoryEntry(id: string): Promise<void>
  clearHistory(): Promise<void>
  copyText(text: string): Promise<void>
  setHotkey(hotkey: HotkeyName): Promise<void>
  saveApiKey(key: string): Promise<{ ok: true } | { ok: false; error: string }>
  removeApiKey(): Promise<void>
  requestMicrophone(): Promise<void>
  requestAccessibility(): Promise<void>
}
