import { useEffect, useState } from 'react'
import type { AppState, HistoryEntry } from '../../shared/types'

/** Live app state and history from the main process. */
export function useBreakFlow(): { state: AppState | null; history: HistoryEntry[] } {
  const [state, setState] = useState<AppState | null>(null)
  const [history, setHistory] = useState<HistoryEntry[]>([])

  useEffect(() => {
    void window.breakFlow.getState().then(setState)
    void window.breakFlow.getHistory().then(setHistory)
    const offState = window.breakFlow.onState(setState)
    const offHistory = window.breakFlow.onHistory(setHistory)
    return () => {
      offState()
      offHistory()
    }
  }, [])

  return { state, history }
}

export const HOTKEY_LABELS = {
  fn: { key: 'fn', name: 'Fn (🌐)' },
  rightOption: { key: '⌥', name: 'Right Option' },
} as const

const relative = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })

/** "just now", "5 minutes ago", "yesterday", or a date. */
export function timeAgo(iso: string): string {
  const seconds = (new Date(iso).getTime() - Date.now()) / 1000
  if (seconds > -45) return 'just now'
  if (seconds > -3600) return relative.format(Math.round(seconds / 60), 'minute')
  if (seconds > -86_400) return relative.format(Math.round(seconds / 3600), 'hour')
  if (seconds > -7 * 86_400) return relative.format(Math.round(seconds / 86_400), 'day')
  return new Date(iso).toLocaleDateString()
}

export function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length
}
